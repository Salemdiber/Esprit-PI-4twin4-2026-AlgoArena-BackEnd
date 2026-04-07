import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';
import { Battle, BattleDocument } from './schemas/battle.schema';
import { BattleStatus } from './battle.enums';
import { UserService } from '../user/user.service';

@Injectable()
export class BattlesService {
  constructor(
    @InjectModel(Battle.name) private readonly model: Model<BattleDocument>,
    private readonly userService: UserService,
  ) {}

  private computeBattleXp(battle: Pick<Battle, 'playerScoreTotal' | 'opponentScoreTotal'>): number {
    const playerScore = Math.max(0, Number(battle.playerScoreTotal || 0));
    const opponentScore = Math.max(0, Number(battle.opponentScoreTotal || 0));
    const winBonus = playerScore > opponentScore ? 250 : 0;
    return Math.max(0, Math.round(playerScore + winBonus));
  }

  private isExpired(battle: Pick<Battle, 'startedAt' | 'timeLimitSeconds'>): boolean {
    const startedAtMs = new Date(battle.startedAt as any).getTime();
    if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return false;
    const limitSeconds = Math.max(1, Number((battle as any).timeLimitSeconds || 900));
    const deadlineMs = startedAtMs + limitSeconds * 1000;
    return Date.now() >= deadlineMs;
  }

  private async maybeFinalizeAndAward(battle: BattleDocument): Promise<BattleDocument> {
    if (!battle) return battle;

    const shouldFinalize = battle.battleStatus === BattleStatus.ACTIVE && this.isExpired(battle as any);
    if (shouldFinalize) {
      battle.battleStatus = BattleStatus.FINISHED;
      battle.endedAt = battle.endedAt || new Date();
    }

    const shouldAward = battle.battleStatus === BattleStatus.FINISHED && !Boolean((battle as any).xpAwarded);
    if (shouldAward) {
      const xpGranted = this.computeBattleXp(battle as any);
      if (xpGranted > 0) {
        await this.userService.updateXpAndRank(battle.userId, xpGranted);
      }
      (battle as any).xpGranted = xpGranted;
      (battle as any).xpAwarded = true;
    }

    if (shouldFinalize || shouldAward) {
      await battle.save();
    }

    return battle;
  }

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
    const battles = await this.model.find().exec();
    return Promise.all(battles.map((b) => this.maybeFinalizeAndAward(b)));
  }

  async findByUserId(userId: string): Promise<Battle[]> {
    const battles = await this.model.find({ userId }).exec();
    return Promise.all(battles.map((b) => this.maybeFinalizeAndAward(b)));
  }

  async findOne(id: string): Promise<Battle> {
    const found = await this.model.findById(id).exec();
    if (!found) throw new NotFoundException(`Battle with id ${id} not found`);
    return this.maybeFinalizeAndAward(found);
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
    return this.maybeFinalizeAndAward(updated);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Battle with id ${id} not found`);
  }
}
