import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { BattleStatus, BattleType } from './battle.enums';
import { BattlesService } from './battle.service';

jest.mock('./schemas/battle.schema', () => ({
  Battle: class Battle {},
}));

describe('BattlesService', () => {
  let model: any;
  let userModel: any;
  let i18n: any;
  let service: BattlesService;

  beforeEach(() => {
    model = {
      countDocuments: jest.fn(),
      exists: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    userModel = { find: jest.fn() };
    i18n = { translate: jest.fn((key) => key) };
    service = new BattlesService(model as any, userModel as any, i18n);
  });

  it('creates a pending 1vs1 battle and generates an idBattle', async () => {
    model.countDocuments.mockReturnValue({ exec: () => Promise.resolve(2) });
    model.exists.mockResolvedValue(false);

    const save = jest.fn().mockImplementation(function resolveSelf(this: any) {
      return Promise.resolve(this);
    });
    const battleCtor = jest.fn().mockImplementation((payload) => ({ ...payload, save }));
    service = new BattlesService(battleCtor as any, userModel as any, i18n);
    battleCtor.countDocuments = model.countDocuments;
    battleCtor.exists = model.exists;

    const created = await service.create({ battleType: BattleType.ONE_VS_ONE } as any);

    expect(created.idBattle).toBe('BT-0003');
    expect(created.battleStatus).toBeUndefined();
    expect(save).toHaveBeenCalled();
  });

  it('joins a pending battle and rejects invalid joins', async () => {
    const save = jest.fn().mockImplementation(function resolveSelf(this: any) {
      return Promise.resolve(this);
    });
    model.findById.mockReturnValue({ exec: () => Promise.resolve({
      _id: 'battle-1',
      battleType: BattleType.ONE_VS_ONE,
      battleStatus: BattleStatus.PENDING,
      userId: 'creator-1',
      opponentId: '',
      save,
    }) });

    const updated = await service.joinBattle('battle-1', 'opponent-1');

    expect(updated.opponentId).toBe('opponent-1');
    expect(updated.battleStatus).toBe(BattleStatus.ACTIVE);

    model.findById.mockReturnValue({ exec: () => Promise.resolve({
      _id: 'battle-2',
      battleType: BattleType.ONE_VS_ONE,
      battleStatus: BattleStatus.PENDING,
      userId: 'creator-1',
      opponentId: 'other',
      save,
    }) });

    await expect(service.joinBattle('battle-2', 'opponent-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('submits a round result for a participant and rejects invalid inputs', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const battle = {
      _id: 'battle-3',
      battleType: BattleType.ONE_VS_ONE,
      battleStatus: BattleStatus.ACTIVE,
      userId: 'creator-1',
      opponentId: 'opponent-1',
      roundNumber: 3,
      pvpRoundResults: [],
      save,
    };
    model.findById.mockReturnValue({ exec: () => Promise.resolve(battle) });

    const result = await service.submitRoundResult('battle-3', 'creator-1', {
      roundIndex: 1,
      result: { passed: true },
    });

    expect(result.roundIndex).toBe(1);
    expect(result.userId).toBe('creator-1');
    expect(battle.pvpRoundResults).toHaveLength(1);

    await expect(service.submitRoundResult('battle-3', 'intruder', { roundIndex: 1, result: {} })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the battle does not exist', async () => {
    model.findById.mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve(null),
      }),
    });

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});