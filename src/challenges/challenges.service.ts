
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Challenge } from './schemas/challenge.schema';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Injectable()
export class ChallengesService {
  constructor(
    @InjectModel(Challenge.name) private readonly model: Model<Challenge>,
  ) {}

  async create(dto: CreateChallengeDto): Promise<Challenge> {
    const created = new this.model(dto);
    return created.save();
  }

  async findAll(): Promise<Challenge[]> {
    return this.model.find().exec();
  }

  async findOne(id: string): Promise<Challenge> {
    const found = await this.model.findById(id).exec();
    if (!found) throw new NotFoundException(`Challenge with id ${id} not found`);
    return found;
  }

  async update(id: string, dto: UpdateChallengeDto): Promise<Challenge> {
    const updated = await this.model.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Challenge with id ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Challenge with id ${id} not found`);
  }

  async findPublished(): Promise<Challenge[]> {
    return this.model.find({ status: 'published' }).exec();
  }

  async findPublishedById(id: string): Promise<Challenge> {
    const found = await this.model.findById(id).exec();
    if (!found || found.status !== 'published') {
      throw new NotFoundException(`Published challenge with id ${id} not found`);
    }
    return found;
  }

  async findRandom(): Promise<Challenge | null> {
    const count = await this.model.countDocuments({ status: 'published' });
    if (count === 0) return null;
    const random = Math.floor(Math.random() * count);
    return this.model.findOne({ status: 'published' }).skip(random).exec();
  }
}
