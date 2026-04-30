import { AppController } from './app.controller';

describe('AppController', () => {
  it('delegates to AppService for the root greeting', () => {
    const appService = {
      getHello: jest.fn().mockReturnValue('Hello World!'),
    };
    const controller = new AppController(appService as any);

    expect(controller.getHello()).toBe('Hello World!');
    expect(appService.getHello).toHaveBeenCalledTimes(1);
  });
});