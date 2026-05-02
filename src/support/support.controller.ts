import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupportService } from './support.service';
import { ScheduleMeetingDto } from './dto/schedule-meeting.dto';
import { ContactSupportDto } from './dto/contact-support.dto';
import { ReportBugDto } from './dto/report-bug.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('schedule-meeting')
  createMeeting(@Req() req: any, @Body() dto: ScheduleMeetingDto) {
    return this.supportService.createScheduleMeeting(req.user.userId, dto);
  }

  @Post('contact')
  createContact(@Req() req: any, @Body() dto: ContactSupportDto) {
    return this.supportService.createContact(req.user.userId, dto);
  }

  @Post('report-bug')
  createBug(@Req() req: any, @Body() dto: ReportBugDto) {
    return this.supportService.createBugReport(req.user.userId, dto);
  }

  @Get('my-requests')
  myRequests(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.supportService.getMyRequests(
      req.user.userId,
      Number(page || 1),
      Number(limit || 10),
      category,
    );
  }

  @Get('my-requests/:id')
  myRequestById(@Req() req: any, @Param('id') id: string) {
    return this.supportService.getMyRequestById(req.user.userId, id);
  }

  @Get('admin/requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  adminRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.supportService.getAdminRequests(
      Number(page || 1),
      Number(limit || 20),
      status,
      category,
    );
  }

  @Get('admin/requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  adminRequestById(@Param('id') id: string) {
    return this.supportService.getAdminRequestById(id);
  }

  @Patch('admin/requests/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  updateAdminRequestStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportStatusDto,
  ) {
    return this.supportService.updateAdminRequestStatus(id, dto);
  }
}
