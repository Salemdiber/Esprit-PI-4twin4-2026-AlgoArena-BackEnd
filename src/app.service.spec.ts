import { AppService } from './app.service';

describe('AppService', () => {
  it('returns the application greeting', () => {
    const service = new AppService();

    expect(service.getHello()).toBe('Hello World!');
  });
});