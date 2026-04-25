import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBattleDto } from './dto/create-battle.dto';
import { UpdateBattleDto } from './dto/update-battle.dto';
import { Battle, BattleDocument } from './schemas/battle.schema';
import { BattleStatus, BattleType } from './battle.enums';
import { UserService } from '../user/user.service';

@Injectable()
export class BattlesService {
  constructor(
    @InjectModel(Battle.name) private readonly model: Model<BattleDocument>,
    private readonly userService: UserService,
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

  private async resolveUsername(userId?: string | null): Promise<string | null> {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) return null;
    if (safeUserId === 'AI-1') return 'AI Master';

    const user = await this.userService.findOne(safeUserId).catch(() => null) as any;
    return String(user?.username || safeUserId).trim() || null;
  }

  private async hydrateBattle(battle: any) {
    if (!battle) return battle;

    const [creatorUsername, opponentUsername] = await Promise.all([
      this.resolveUsername(battle.userId),
      this.resolveUsername(battle.opponentId),
    ]);

    return {
      ...battle,
      creatorUsername,
      opponentUsername,
    };
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
    const saved = await created.save();
    return this.hydrateBattle(saved.toObject()) as Promise<Battle>;
  }

  async findAll(): Promise<Battle[]> {
    const battles = await this.model.find().lean().exec();
    return Promise.all(battles.map((battle) => this.hydrateBattle(battle))) as Promise<Battle[]>;
  }

  async findByUserId(userId: string): Promise<Battle[]> {
    const battles = await this.model
      .find({ userId })
      .select('_id idBattle battleStatus battleType roundNumber challengeId opponentId botDifficulty selectChallengeType userId createdAt endedAt winnerUserId')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();
    return Promise.all(battles.map((battle) => this.hydrateBattle(battle))) as Promise<Battle[]>;
  }

  async findOne(id: string): Promise<Battle> {
    const found = await this.model.findById(id).lean().exec();
    if (!found)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    return this.hydrateBattle(found) as Promise<Battle>;
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
    return this.hydrateBattle(updated.toObject()) as Promise<Battle>;
  }

  async join(id: string, userId: string): Promise<Battle> {
    const existing = await this.model.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    }

    if (existing.battleType !== BattleType.ONE_VS_ONE) {
      throw new BadRequestException(this.tr('battles.joinNotSupported'));
    }

    if (String(existing.userId) === String(userId)) {
      throw new BadRequestException(this.tr('battles.cannotJoinOwnBattle'));
    }

    if (existing.battleStatus !== BattleStatus.PENDING) {
      throw new ConflictException(this.tr('battles.cannotJoinBattleState'));
    }

    if (existing.opponentId && String(existing.opponentId) !== String(userId)) {
      throw new ConflictException(this.tr('battles.alreadyJoined'));
    }

    const updated = await this.model
      .findByIdAndUpdate(
        id,
        {
          opponentId: userId,
          battleStatus: BattleStatus.ACTIVE,
          startedAt: existing.startedAt || new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    }

    return updated;
  }

  async submitRoundResult(
    id: string,
    userId: string,
    payload: {
      roundIndex: number;
      result: Record<string, unknown>;
    },
  ): Promise<Battle> {
    const battle = await this.model.findById(id).exec();
    if (!battle) {
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    }

    const battleUserId = String(battle.userId || '');
    const battleOpponentId = String(battle.opponentId || '');
    const actorId = String(userId || '');
    if (actorId !== battleUserId && actorId !== battleOpponentId) {
      throw new BadRequestException(this.tr('battles.cannotSubmitRoundResult'));
    }

    const roundIndex = Number(payload?.roundIndex);
    if (!Number.isInteger(roundIndex) || roundIndex < 0) {
      throw new BadRequestException(this.tr('battles.invalidRoundIndex'));
    }

    const battleRounds = Number(battle.roundNumber || 0);
    if (roundIndex >= battleRounds) {
      throw new BadRequestException(this.tr('battles.invalidRoundIndex'));
    }

    const results = Array.isArray((battle as any).pvpRoundResults)
      ? [...(battle as any).pvpRoundResults]
      : [];
    const existingIndex = results.findIndex(
      (entry) => Number(entry.roundIndex) === roundIndex && String(entry.userId) === actorId,
    );
    const entry = {
      roundIndex,
      userId: actorId,
      result: payload.result,
      createdAt: existingIndex >= 0 ? results[existingIndex].createdAt || new Date() : new Date(),
      updatedAt: new Date(),
    };

    if (existingIndex >= 0) {
      results[existingIndex] = entry;
    } else {
      results.push(entry);
    }

    const completedRounds = new Set(
      results
        .filter((item) => item?.result)
        .map((item) => Number(item.roundIndex)),
    );
    const allRoundsDone = battleRounds > 0 && Array.from({ length: battleRounds }).every((_, index) => {
      const perRound = results.filter((item) => Number(item.roundIndex) === index && item?.result);
      return perRound.length >= (battle.battleType === BattleType.ONE_VS_ONE ? 2 : 1);
    });

    const updatePayload: any = {
      pvpRoundResults: results,
    };

    if (allRoundsDone) {
      updatePayload.battleStatus = BattleStatus.FINISHED;
      updatePayload.endedAt = new Date();
    }

    const updated = await this.model
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    }

    return this.hydrateBattle(updated.toObject()) as Promise<Battle>;
  }

  async getRoundResults(id: string) {
    const battle = await this.model.findById(id).lean().exec() as any;
    if (!battle) {
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
    }

    return {
      results: Array.isArray(battle.pvpRoundResults) ? battle.pvpRoundResults : [],
      battleStatus: battle.battleStatus || BattleStatus.PENDING,
      endedAt: battle.endedAt || null,
    };
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted)
      throw new NotFoundException(this.tr('battles.notFoundById', { id }));
  }
}
