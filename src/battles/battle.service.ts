import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';
import { Battle, BattleDocument } from './schemas/battle.schema';
import { BattleStatus, BattleType } from './battle.enums';

@Injectable()
export class BattlesService {
  constructor(
    @InjectModel(Battle.name) private readonly model: Model<BattleDocument>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string, args?: Record<string, unknown>): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang, args });
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
    const battleStatus =
      dto.battleType === BattleType.ONE_VS_ONE && !dto.opponentId
        ? BattleStatus.PENDING
        : dto.battleStatus || BattleStatus.PENDING;
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

  private async attachUsernames<T extends Record<string, any>>(
    battles: T[],
  ): Promise<Array<T & { creatorUsername?: string; opponentUsername?: string }>> {
    if (!Array.isArray(battles) || battles.length === 0) return [];

    const idSet = new Set<string>();
    battles.forEach((battle) => {
      const creatorId = String(battle?.userId || '').trim();
      const opponentId = String(battle?.opponentId || '').trim();
      if (creatorId) idSet.add(creatorId);
      if (opponentId) idSet.add(opponentId);
    });

    const ids = Array.from(idSet).filter((id) => Types.ObjectId.isValid(id));
    if (!ids.length) {
      return battles.map((battle) => ({
        ...battle,
        creatorUsername: undefined,
        opponentUsername: undefined,
      }));
    }

    const users = await this.userModel
      .find({ _id: { $in: ids } })
      .select('_id username')
      .lean()
      .exec();

    const userMap = new Map<string, string>();
    users.forEach((user: any) => {
      userMap.set(String(user?._id || ''), String(user?.username || ''));
    });

    return battles.map((battle) => {
      const creatorId = String(battle?.userId || '').trim();
      const opponentId = String(battle?.opponentId || '').trim();
      return {
        ...battle,
        creatorUsername: userMap.get(creatorId) || undefined,
        opponentUsername: userMap.get(opponentId) || undefined,
      };
    });
  }

  async findAll(): Promise<any[]> {
    const rows = await this.model.find().lean().exec();
    return this.attachUsernames(rows as any[]);
  }

  async findByUserId(userId: string): Promise<any[]> {
    const rows = await this.model
      .find({
        $or: [{ userId }, { opponentId: userId }],
      })
      .select('_id idBattle battleStatus battleType roundNumber challengeId opponentId botDifficulty selectChallengeType userId createdAt endedAt winnerUserId')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();
    return this.attachUsernames(rows as any[]);
  }

  async findJoinableBattles(userId: string): Promise<any[]> {
    const rows = await this.model
      .find({
        battleType: BattleType.ONE_VS_ONE,
        battleStatus: BattleStatus.PENDING,
        userId: { $ne: userId },
        $or: [{ opponentId: null }, { opponentId: '' }],
      })
      .select('_id idBattle battleStatus battleType roundNumber challengeId opponentId botDifficulty selectChallengeType userId createdAt endedAt winnerUserId')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
    return this.attachUsernames(rows as any[]);
  }

  async findOne(id: string): Promise<any> {
    const found = await this.model.findById(id).lean().exec();
    if (!found)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    const rows = await this.attachUsernames([found as any]);
    return rows[0] || found;
  }

  async update(id: string, dto: UpdateBattleDto): Promise<Battle> {
    const existing = await this.model.findById(id).exec();
    if (!existing)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));

    const nextStatus = dto.battleStatus || existing.battleStatus;
    const updatePayload: any = { ...dto };

    if (nextStatus !== BattleStatus.FINISHED) {
      updatePayload.winnerUserId = null;
    }

    const updated = await this.model
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();
    if (!updated)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    return updated;
  }

  async joinBattle(id: string, joiningUserId: string): Promise<Battle> {
    const battle = await this.model.findById(id).exec();
    if (!battle)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));

    if (battle.battleType !== BattleType.ONE_VS_ONE) {
      throw new BadRequestException('Only 1vs1 battles can be joined');
    }

    if (battle.userId === joiningUserId) {
      throw new BadRequestException('You cannot join your own battle');
    }

    if (battle.battleStatus === BattleStatus.CANCELLED) {
      throw new BadRequestException('Cannot join a cancelled battle');
    }

    if (battle.battleStatus === BattleStatus.FINISHED) {
      throw new BadRequestException('Cannot join a finished battle');
    }

    if (
      battle.opponentId &&
      battle.opponentId !== '' &&
      battle.opponentId !== joiningUserId
    ) {
      throw new ConflictException('Battle already has an opponent');
    }

    battle.opponentId = joiningUserId;
    battle.battleStatus = BattleStatus.ACTIVE;
    battle.startedAt = new Date();
    return battle.save();
  }

  async submitRoundResult(
    id: string,
    userId: string,
    input: { roundIndex: number; result: Record<string, any> },
  ): Promise<{
    battleId: string;
    roundIndex: number;
    userId: string;
    result: Record<string, any>;
    timestamp: string;
  }> {
    const battle = await this.model.findById(id).exec();
    if (!battle)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));

    if (battle.battleType !== BattleType.ONE_VS_ONE) {
      throw new BadRequestException('Round submit is only available for 1vs1');
    }

    const isParticipant = battle.userId === userId || battle.opponentId === userId;
    if (!isParticipant) {
      throw new BadRequestException('User is not a participant of this battle');
    }

    if (battle.battleStatus !== BattleStatus.ACTIVE) {
      throw new BadRequestException('Battle is not active');
    }

    const roundIndex = Number(input?.roundIndex ?? -1);
    if (!Number.isInteger(roundIndex) || roundIndex < 0) {
      throw new BadRequestException('roundIndex must be a non-negative integer');
    }

    if (roundIndex >= Number(battle.roundNumber || 0)) {
      throw new BadRequestException('roundIndex exceeds battle rounds');
    }

    const result = input?.result || {};
    const list = Array.isArray((battle as any).pvpRoundResults)
      ? (battle as any).pvpRoundResults
      : [];

    const idx = list.findIndex(
      (it: any) =>
        Number(it?.roundIndex) === roundIndex && String(it?.userId) === userId,
    );
    const payload = {
      roundIndex,
      userId,
      result,
      updatedAt: new Date(),
    };

    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }

    (battle as any).pvpRoundResults = list;
    await battle.save();

    return {
      battleId: String((battle as any)?._id || id),
      roundIndex,
      userId,
      result,
      timestamp: payload.updatedAt.toISOString(),
    };
  }

  async getRoundResults(id: string): Promise<
    Array<{
      roundIndex: number;
      userId: string;
      result: Record<string, any>;
      timestamp: string;
    }>
  > {
    const battle = await this.model.findById(id).lean().exec();
    if (!battle)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));

    const rows = Array.isArray((battle as any).pvpRoundResults)
      ? (battle as any).pvpRoundResults
      : [];

    return rows.map((row: any) => ({
      roundIndex: Number(row?.roundIndex || 0),
      userId: String(row?.userId || ''),
      result: row?.result || {},
      timestamp: new Date(row?.updatedAt || Date.now()).toISOString(),
    }));
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
  }
}
