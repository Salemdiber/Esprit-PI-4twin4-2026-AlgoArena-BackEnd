import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { Challenge, ChallengeDocument } from './schemas/challenge.schema';

@Injectable()
export class ChallengesService {
  constructor(
    @InjectModel(Challenge.name) private readonly model: Model<ChallengeDocument>,
  ) {}

  private normalizeTitle(title: string): string {
    return (title || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  private normalizeDescriptionPrefix(description: string): string {
    return (description || '')
      .slice(0, 200)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  private async ensureChallengeUniqueness(dto: CreateChallengeDto, ignoreId?: string): Promise<string[]> {
    const title = (dto.title || '').trim();
    const normalizedTitle = this.normalizeTitle(title);
    const exact = await this.model.findOne({ title }).lean().exec();
    if (exact && String((exact as any)._id) !== String(ignoreId || '')) {
      throw new ConflictException(`A challenge with the title '${title}' already exists. Please use a unique title.`);
    }
    const normalized = await this.model.findOne({ normalizedTitle }).lean().exec();
    if (normalized && String((normalized as any)._id) !== String(ignoreId || '')) {
      throw new ConflictException(`A challenge with the title '${title}' already exists. Please use a unique title.`);
    }
    const descriptionPrefix = this.normalizeDescriptionPrefix(dto.description || '');
    if (!descriptionPrefix) return [];
    const docs = await this.model.find({}, { _id: 1, title: 1, description: 1 }).lean().exec();
    const similar = docs.find((doc: any) => {
      if (String(doc?._id) === String(ignoreId || '')) return false;
      return this.normalizeDescriptionPrefix(doc?.description || '') === descriptionPrefix;
    });
    return similar ? [`Potential duplicate description detected with "${similar.title}".`] : [];
  }

  async create(dto: CreateChallengeDto): Promise<Challenge> {
    await this.ensureChallengeUniqueness(dto);
    const created = new this.model({
      ...dto,
      normalizedTitle: this.normalizeTitle(dto.title),
    });
    return created.save();
  }

  async findAll(): Promise<Challenge[]> {
    return this.model.find().exec();
  }

  async findPublished(): Promise<Challenge[]> {
    return this.model.find({ status: 'published' }).exec();
  }

  async findOne(id: string): Promise<Challenge> {
    const found = await this.model.findById(id).exec();
    if (!found) throw new NotFoundException(`Challenge with id ${id} not found`);
    return found;
  }

  async findPublishedById(id: string): Promise<Challenge> {
    const found = await this.model.findById(id).exec();
    if (!found || found.status !== 'published') {
      throw new NotFoundException(`Published challenge with id ${id} not found`);
    }
    return found;
  }

  async update(id: string, dto: UpdateChallengeDto): Promise<Challenge> {
    if (dto.title || dto.description) {
      const existing = await this.model.findById(id).lean().exec();
      if (!existing) throw new NotFoundException(`Challenge with id ${id} not found`);
      await this.ensureChallengeUniqueness({
        ...(existing as any),
        ...dto,
        title: (dto.title ?? (existing as any).title) as string,
        description: (dto.description ?? (existing as any).description) as string,
      } as CreateChallengeDto, id);
    }
    const updated = await this.model.findByIdAndUpdate(
      id,
      {
        ...dto,
        ...(dto.title ? { normalizedTitle: this.normalizeTitle(dto.title) } : {}),
      },
      { new: true },
    ).exec();
    if (!updated) throw new NotFoundException(`Challenge with id ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Challenge with id ${id} not found`);
  }
}
