import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';
import { Battle, BattleDocument } from './schemas/battle.schema';
import { BattleStatus } from './battle.enums';

@Injectable()
export class BattlesService {
  constructor(
    @InjectModel(Battle.name) private readonly model: Model<BattleDocument>,
  ) {}

  private async generateIdBattle(): Promise<string> {
    let base = (await this.model.countDocuments().exec()) + 1;
    let candidate = `BT-${String(base).padStart(4, '0')}`;
    while (await this.model.exists({ idBattle: candidate })) {
      base += 1;
      candidate = `BT-${String(base).padStart(4, '0')}`;
    }
    return candidate;
  }

  async create(dto: CreateBattleDto): Promise<Battle> {
    const battleStatus = dto.battleStatus || BattleStatus.PENDING;
    const payload: Partial<CreateBattleDto> = {
      ...dto,
      idBattle: dto.idBattle || (await this.generateIdBattle()),
    };

    if (battleStatus !== BattleStatus.FINISHED) {
      delete payload.winnerUserId;
    }

    const created = new this.model(payload);
    return created.save();
  }

  async findAll(): Promise<Battle[]> {
    return this.model.find().exec();
  }

  async findByUserId(userId: string): Promise<Battle[]> {
    return this.model.find({ userId }).exec();
  }

  async findOne(id: string): Promise<Battle> {
    const found = await this.model.findById(id).exec();
    if (!found) throw new NotFoundException(`Battle with id ${id} not found`);
    return found;
  }

  async update(id: string, dto: UpdateBattleDto): Promise<Battle> {
    const existing = await this.model.findById(id).exec();
    if (!existing) throw new NotFoundException(`Battle with id ${id} not found`);

    const nextStatus = dto.battleStatus || existing.battleStatus;
    const updatePayload: any = { ...dto };

    if (nextStatus !== BattleStatus.FINISHED) {
      updatePayload.winnerUserId = null;
    }

    const updated = await this.model.findByIdAndUpdate(id, updatePayload, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Battle with id ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Battle with id ${id} not found`);
  }
}
