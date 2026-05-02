import * as crypto from 'crypto';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let jwtService: any;
  let recaptchaService: any;
  let emailService: any;
  let settingsService: any;
  let configService: any;
  let cacheService: any;
  let emailDeliverabilityService: any;
  let i18n: any;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      setPlacementProblems: jest.fn(),
      findLatestByUsernameOrEmail: jest.fn(),
      setRefreshTokenHash: jest.fn(),
      findOne: jest.fn(),
      findByGoogleId: jest.fn(),
      findByGithubId: jest.fn(),
      findByEmail: jest.fn(),
      linkOAuthProvider: jest.fn(),
    };
    jwtService = { sign: jest.fn(), verify: jest.fn() };
    recaptchaService = { validate: jest.fn() };
    emailService = { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) };
    settingsService = { getSettings: jest.fn() };
    configService = {};
    cacheService = { get: jest.fn(), set: jest.fn() };
    emailDeliverabilityService = { validate: jest.fn() };
    i18n = { translate: jest.fn((key) => key) };

    service = new AuthService(
      users,
      jwtService,
      recaptchaService,
      emailService,
      settingsService,
      configService,
      cacheService,
      emailDeliverabilityService,
      i18n,
    );
  });

  it('registers a user, sends welcome email, and stores placement problems when generated', async () => {
    settingsService.getSettings.mockResolvedValue({ userRegistration: true });
    recaptchaService.validate.mockResolvedValue(undefined);
    emailDeliverabilityService.validate.mockResolvedValue({ valid: true });
    users.create.mockResolvedValue({ _id: { toString: () => 'user-1' }, username: 'neo' });
    users.setPlacementProblems.mockResolvedValue(undefined);
    jest.spyOn(service as any, 'generateChallenges').mockResolvedValue([{ title: 'T1' }]);

    const dto = {
      username: 'neo',
      email: 'neo@example.com',
      password: 'Valid123!',
      recaptchaToken: 'token',
    };

    const created = await service.register(dto);

    expect(created.username).toBe('neo');
    expect(users.create).toHaveBeenCalledWith(dto);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('neo@example.com', 'neo');
    expect(users.setPlacementProblems).toHaveBeenCalledWith('user-1', [{ title: 'T1' }]);
  });

  it('signs login tokens and stores the refresh token hash', async () => {
    jwtService.sign.mockImplementationOnce(() => 'access-token');
    jwtService.sign.mockImplementationOnce(() => 'refresh-token');
    users.setRefreshTokenHash.mockResolvedValue(undefined);

    const result = await service.login({ _id: 'user-42', username: 'lina', role: 'Player' });

    expect(result).toEqual({ access_token: 'access-token', refresh_token: 'refresh-token' });
    expect(users.setRefreshTokenHash).toHaveBeenCalledWith(
      'user-42',
      crypto.createHash('sha256').update('refresh-token').digest('hex'),
    );
  });

  it('validates a user by password hash and strips the passwordHash field', async () => {
    recaptchaService.validate.mockResolvedValue(undefined);
    const passwordHash = crypto.createHash('sha256').update('Passw0rd!').digest('hex');
    users.findLatestByUsernameOrEmail.mockResolvedValue({
      _id: 'user-7',
      username: 'alice',
      passwordHash,
      role: 'Player',
    });

    const user = await service.validateUser('alice', 'Passw0rd!', 'captcha');

    expect(user).toEqual({
      _id: 'user-7',
      username: 'alice',
      role: 'Player',
    });
  });
});