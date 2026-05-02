import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import nodemailer from 'nodemailer';
import { UserService } from '../user/user.service';
import {
  SupportRequest,
  SupportRequestDocument,
} from './schemas/support-request.schema';
import { SupportCategory } from './enums/support-category.enum';
import { ScheduleMeetingDto } from './dto/schedule-meeting.dto';
import { ContactSupportDto } from './dto/contact-support.dto';
import { ReportBugDto } from './dto/report-bug.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportStatus } from './enums/support-status.enum';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportRequest.name)
    private readonly supportModel: Model<SupportRequestDocument>,
    private readonly userService: UserService,
  ) {}

  private async nextReferenceNumber() {
    const count = await this.supportModel.countDocuments();
    return `SUP-${String(count + 1).padStart(6, '0')}`;
  }

  private async sendEmail(to: string, subject: string, text: string) {
    const host = process.env.SMTP_HOST;
    if (!host) return;
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  }

  private etaFor(category: SupportCategory, severity?: string) {
    if (category === SupportCategory.SCHEDULE_MEETING) return 'within 24 hours';
    if (category === SupportCategory.CONTACT_SUPPORT) return 'within 4 hours';
    if (severity === 'critical' || severity === 'high') return 'within 2 hours';
    return 'within 24 hours';
  }

  private readonly BUNDLE_MAX_BYTES = 64 * 1024;
  private readonly CONSOLE_MAX = 50;
  private readonly NETWORK_MAX = 20;

  private sanitizeBundle(input: unknown) {
    if (!input || typeof input !== 'object') return null;
    const blocked = ['authorization', 'token', 'password', 'cookie', 'email'];
    const cleanKey = (k: string) =>
      !blocked.some((b) => k.toLowerCase().includes(b));
    const clone = (val: any): any => {
      if (Array.isArray(val)) return val.map(clone);
      if (!val || typeof val !== 'object') return val;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        if (!cleanKey(k)) continue;
        out[k] = clone(v);
      }
      return out;
    };
    const sanitized = clone(input);
    const whitelist = {
      route: sanitized.route,
      fullUrl: sanitized.fullUrl,
      device: {
        browser: sanitized.device?.browser,
        os: sanitized.device?.os,
        userAgent: sanitized.device?.userAgent,
      },
      viewport: {
        width: sanitized.viewport?.width,
        height: sanitized.viewport?.height,
        pixelRatio: sanitized.viewport?.pixelRatio,
      },
      locale: sanitized.locale,
      timezone: sanitized.timezone,
      buildVersion: sanitized.buildVersion,
      featureFlags: Array.isArray(sanitized.featureFlags)
        ? sanitized.featureFlags
        : [],
      consoleErrors: Array.isArray(sanitized.consoleErrors)
        ? sanitized.consoleErrors
        : [],
      networkFailures: Array.isArray(sanitized.networkFailures)
        ? sanitized.networkFailures
        : [],
      clientTimestamp: sanitized.clientTimestamp,
      sessionId: sanitized.sessionId,
    } as any;
    whitelist.consoleErrors = whitelist.consoleErrors.slice(
      0,
      this.CONSOLE_MAX,
    );
    whitelist.networkFailures = whitelist.networkFailures.slice(
      0,
      this.NETWORK_MAX,
    );
    let payload = JSON.stringify(whitelist);
    if (Buffer.byteLength(payload, 'utf8') > this.BUNDLE_MAX_BYTES) {
      // Progressive truncation to keep payload lightweight
      whitelist.consoleErrors = whitelist.consoleErrors.slice(0, 20);
      whitelist.networkFailures = whitelist.networkFailures.slice(0, 10);
      payload = JSON.stringify(whitelist);
      if (Buffer.byteLength(payload, 'utf8') > this.BUNDLE_MAX_BYTES) {
        whitelist.consoleErrors = [];
        whitelist.networkFailures = [];
      }
    }
    return whitelist;
  }

  private async createRequest(
    userId: string,
    payload: Partial<SupportRequest>,
  ) {
    const user = (await this.userService.findOne(userId)) as any;
    const referenceNumber = await this.nextReferenceNumber();
    const created = await this.supportModel.create({
      ...payload,
      userId: new Types.ObjectId(userId),
      userEmail: user.email,
      userName: user.username,
      referenceNumber,
    });

    const eta = this.etaFor(
      payload.category!,
      (payload as any)?.bugDetails?.severity,
    );
    await this.sendEmail(
      user.email,
      `Support request ${referenceNumber} received`,
      `Hello ${user.username},\n\nWe received your support request.\nReference: ${referenceNumber}\nCategory: ${payload.category}\nSubject: ${payload.subject}\nEstimated response time: ${eta}`,
    );
    if (process.env.SUPPORT_EMAIL) {
      await this.sendEmail(
        process.env.SUPPORT_EMAIL,
        `New support request ${referenceNumber}`,
        `User: ${user.username} <${user.email}>\nCategory: ${payload.category}\nSubject: ${payload.subject}\nDescription:\n${payload.description}`,
      );
    }
    return created.toObject();
  }

  createScheduleMeeting(userId: string, dto: ScheduleMeetingDto) {
    return this.createRequest(userId, {
      category: SupportCategory.SCHEDULE_MEETING,
      subject: dto.subject,
      description: dto.description,
      priority: dto.priority,
      meetingDetails: {
        preferredDate: new Date(dto.preferredDate),
        preferredTimeSlot: dto.preferredTimeSlot,
        timezone: dto.timezone,
        meetingType: dto.meetingType,
        alternativeDate: dto.alternativeDate
          ? new Date(dto.alternativeDate)
          : null,
      } as any,
      attachmentUrls: [],
    });
  }

  createContact(userId: string, dto: ContactSupportDto) {
    return this.createRequest(userId, {
      category: SupportCategory.CONTACT_SUPPORT,
      subject: dto.subject,
      description: dto.description,
      priority: dto.priority,
      attachmentUrls: [],
    });
  }

  createBugReport(userId: string, dto: ReportBugDto) {
    const reproductionBundle = this.sanitizeBundle(dto.reproductionBundle);
    return this.createRequest(userId, {
      category: SupportCategory.REPORT_BUG,
      subject: dto.subject,
      description: dto.description,
      priority: dto.priority,
      bugDetails: {
        pageUrl: dto.pageUrl,
        browserInfo: dto.browserInfo,
        operatingSystem: dto.operatingSystem,
        severity: dto.severity,
        reproducible: dto.reproducible,
        stepsToReproduce: dto.stepsToReproduce,
        expectedBehavior: dto.expectedBehavior,
        actualBehavior: dto.actualBehavior,
        reproductionBundle,
      } as any,
      attachmentUrls: [],
    });
  }

  async getMyRequests(userId: string, page = 1, limit = 10, category?: string) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const query: any = { userId: new Types.ObjectId(userId) };
    if (category) query.category = category;
    const [items, total] = await Promise.all([
      this.supportModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.supportModel.countDocuments(query),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }

  async getMyRequestById(userId: string, id: string) {
    const item = await this.supportModel.findById(id).lean().exec();
    if (!item) throw new NotFoundException('Support request not found');
    if (String(item.userId) !== String(userId))
      throw new ForbiddenException('Forbidden');
    return item;
  }

  async getAdminRequests(page = 1, limit = 20, status?: string, category?: string) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const query: any = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const [items, total, statusCounts, categoryCounts] = await Promise.all([
      this.supportModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.supportModel.countDocuments(query),
      this.supportModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.supportModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      statusCounts,
      categoryCounts,
    };
  }

  async getAdminRequestById(id: string) {
    const item = await this.supportModel.findById(id).lean().exec();
    if (!item) throw new NotFoundException('Support request not found');
    return item;
  }

  async updateAdminRequestStatus(id: string, dto: UpdateSupportStatusDto) {
    const update: Partial<SupportRequest> = {
      status: dto.status,
      resolvedAt:
        dto.status === SupportStatus.RESOLVED || dto.status === SupportStatus.CLOSED
          ? new Date()
          : null,
    };

    const item = await this.supportModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean()
      .exec();

    if (!item) throw new NotFoundException('Support request not found');
    return item;
  }
}
