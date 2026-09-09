import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';

describe('existing guest redirect controller contract', () => {
  const original = {
    flag: process.env.ENABLE_GUEST_LOGIN,
    front: process.env.FRONT_URL,
  };
  const createGuest = jest.fn();
  const issueJwtToken = jest.fn();
  const controller = new AuthController(
    { issueJwtToken } as unknown as AuthService,
    { createGuest } as unknown as UserService,
  );
  function response() {
    return {
      header: jest.fn(),
      vary: jest.fn(),
      cookie: jest.fn(),
      redirect: jest.fn(),
    };
  }
  // Resolve the existing Nest @Req/@Res argument metadata, so removing an unused
  // @Req does not require changing the test or assuming parameter positions.
  function invoke(res: ReturnType<typeof response>, origin: string) {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      AuthController,
      'guestLogin',
    );
    const args: unknown[] = [];
    for (const key of Object.keys(metadata)) {
      const item = metadata[key];
      args[item.index] = key.startsWith('1:') ? res : { headers: { origin } };
    }
    return Reflect.apply(controller.guestLogin, controller, args);
  }
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONT_URL = 'https://game.example';
    process.env.ENABLE_GUEST_LOGIN = 'true';
    createGuest.mockResolvedValue({ name: 'fixture-placeholder' });
    issueJwtToken.mockResolvedValue('synthetic-test-value');
  });
  afterAll(() => {
    if (original.flag === undefined) delete process.env.ENABLE_GUEST_LOGIN;
    else process.env.ENABLE_GUEST_LOGIN = original.flag;
    if (original.front === undefined) delete process.env.FRONT_URL;
    else process.env.FRONT_URL = original.front;
  });
  test('issues one existing cookie and callback without special credential CORS', async () => {
    const res = response();
    await invoke(res, 'https://game.example');
    expect(createGuest).toHaveBeenCalledTimes(1);
    expect(issueJwtToken).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie.mock.calls[0][0]).toBe('token');
    expect(res.cookie.mock.calls[0][2]).toEqual({ httpOnly: false });
    expect(res.redirect).toHaveBeenCalledWith(
      'https://game.example/login?token=check',
    );
    expect(res.header).not.toHaveBeenCalled();
    expect(res.vary).not.toHaveBeenCalled();
  });
  test('the disabled flag still forbids account creation and cookie issuance', async () => {
    process.env.ENABLE_GUEST_LOGIN = 'false';
    const res = response();
    await expect(invoke(res, 'https://game.example')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(createGuest).not.toHaveBeenCalled();
    expect(issueJwtToken).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.header).not.toHaveBeenCalled();
  });
});
