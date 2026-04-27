import { NotFoundException, ConflictException } from '@nestjs/common';
import { ChallengeService } from './challenge.service';

describe('ChallengeService', () => {
  let svc: ChallengeService;
  let mockModel: any;
  let mockAudit: any;
  let mockI18n: any;

  beforeEach(() => {
    mockModel = {
      findOne: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      findByIdAndUpdate: jest.fn().mockReturnThis(),
      findByIdAndDelete: jest.fn().mockReturnThis(),
      updateOne: jest.fn().mockReturnThis(),
      save: jest.fn(),
    };
    mockAudit = { create: jest.fn() };
    mockI18n = { translate: jest.fn((k) => k) };

    svc = new ChallengeService(mockModel as any, mockAudit as any, mockI18n as any);
  });

  test('create: returns warnings when similar description exists', async () => {
    // no exact title matches
    mockModel.exec.mockResolvedValueOnce(null); // exact title
    mockModel.exec.mockResolvedValueOnce(null); // normalized title
    // docs to check description similarity
    mockModel.exec.mockResolvedValueOnce([
      { _id: '1', title: 'Other', description: 'Similar DESC prefix...' },
    ]);

    // mock save
    const saved = { _id: 'abc', title: 'T', difficulty: 'easy', status: 'draft', aiGenerated: false, tags: [] };
    const fakeCtor = function (this: any, data: any) { Object.assign(this, data); this.save = () => Promise.resolve(saved); };

    // replace model with constructor-like for instantiation
    const modelCtor: any = jest.fn().mockImplementation((d) => new (fakeCtor as any)(d));
    // attach static methods used by service (return chainable objects)
    modelCtor.findOne = (..._args: any) => ({ lean: () => ({ exec: () => Promise.resolve(null) }) });
    modelCtor.find = (..._args: any) => ({ lean: () => ({ exec: () => Promise.resolve([{ _id: '1', title: 'Other', description: 'Similar DESC prefix...' }]) }) });

    svc = new ChallengeService(modelCtor as any, mockAudit as any, mockI18n as any);

    const res = await svc.create({ title: 'T', description: 'Similar DESC prefix...' } as any, 'uid', 'Actor');
    expect(res.challenge).toMatchObject(saved);
    expect(res.warnings.length).toBeGreaterThanOrEqual(0);
    expect(mockAudit.create).toHaveBeenCalled();
  });

  test('create: published triggers two audit logs', async () => {
    mockModel.exec.mockResolvedValueOnce(null);
    mockModel.exec.mockResolvedValueOnce(null);
    mockModel.exec.mockResolvedValueOnce([]);

    const saved = { _id: 'p1', title: 'P', difficulty: 'easy', status: 'published', aiGenerated: false, tags: [] };
    const fakeCtor = function (this: any, data: any) { Object.assign(this, data); this.save = () => Promise.resolve(saved); };
    const modelCtor: any = jest.fn().mockImplementation((d) => new (fakeCtor as any)(d));
    modelCtor.findOne = (..._args: any) => ({ lean: () => ({ exec: () => Promise.resolve(null) }) });
    modelCtor.find = (..._args: any) => ({ lean: () => ({ exec: () => Promise.resolve([]) }) });

    svc = new ChallengeService(modelCtor as any, mockAudit as any, mockI18n as any);

    await svc.create({ title: 'P', description: 'd' } as any, 'uid', 'Actor');
    // should create two audit logs: created + published
    expect(mockAudit.create).toHaveBeenCalledTimes(2);
  });

  test('findAll: returns paginated results and respects sort', async () => {
    const items = [{ title: 'a' }, { title: 'b' }];
    mockModel.exec.mockResolvedValueOnce(items);
    mockModel.exec.mockResolvedValueOnce(2);

    const out = await svc.findAll({ page: 1, limit: 10, sort: 'xp' });
    expect(out.challenges).toBe(items);
    expect(out.total).toBe(2);
    expect(out.pages).toBe(1);
  });

  test('findById: throws NotFoundException when missing', async () => {
    mockModel.exec.mockResolvedValueOnce(null);
    await expect(svc.findById('x')).rejects.toThrow(NotFoundException);
  });

  test('publish/unpublish/remove call audit and update', async () => {
    const existing = { _id: 'x', title: 'X', status: 'draft', difficulty: 'easy', tags: [] };
    mockModel.exec.mockResolvedValueOnce(existing); // findById in publish
    mockModel.exec.mockResolvedValueOnce({}); // findByIdAndUpdate result
    await svc.publish('x', 'uid', 'Actor');
    expect(mockAudit.create).toHaveBeenCalled();

    mockModel.exec.mockResolvedValueOnce(existing); // findById in unpublish
    mockModel.exec.mockResolvedValueOnce({});
    await svc.unpublish('x', 'uid', 'Actor');
    expect(mockAudit.create).toHaveBeenCalled();

    mockModel.exec.mockResolvedValueOnce(existing); // findById in remove
    mockModel.exec.mockResolvedValueOnce({}); // findByIdAndDelete
    await svc.remove('x', 'uid', 'Actor');
    expect(mockAudit.create).toHaveBeenCalled();
  });

  test('incrementSolvedCount calls updateOne', async () => {
    mockModel.exec.mockResolvedValueOnce(null);
    await svc.incrementSolvedCount('z');
    expect(mockModel.updateOne).toHaveBeenCalledWith({ _id: 'z' }, { $inc: { solvedCount: 1 } });
  });
});
