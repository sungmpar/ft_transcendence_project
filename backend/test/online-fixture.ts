import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { resolve } from 'path';
import * as express from 'express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { io, Socket } from '../../frontend/node_modules/socket.io-client';
import { GameGateway } from '../src/game/game.gateway';
import { GameService } from '../src/game/game.service';
import { MatchService } from '../src/user/match.service';
import { UserService } from '../src/user/user.service';
import { Match } from '../src/user/entity/match.entity';
import { User } from '../src/user/entity/user.entity';
import { Channel } from '../src/chat/entity/channel.entity';
import { Message } from '../src/chat/entity/message.entity';
import { UserController } from '../src/user/user.controller';
import { ProfileService } from '../src/user/profile.service';
import { UserGuard } from '../src/user/user.guard';
import { JwtAuthGuard } from '../src/auth/jwt.auth.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { EmailService } from '../src/auth/email.service';
import { ChatGateway } from '../src/chat/chat.gateway';
import { ChatService } from '../src/chat/chat.service';
import { DMChannel } from '../src/chat/entity/dm-channel.entity';

// Deliberately no AppModule, main.ts, .env loader, production URL, or configurable
// host/database/user. Root starts this disposable PostgreSQL instance separately.
const DATABASE = Object.freeze({
  host: '127.0.0.1', port: 55432,
  database: 'arcade_fixture', username: 'arcade_fixture',
});

export type FixtureCredential = 'valid' | 'missing' | 'malformed' | 'unknown-user';
export interface OnlineFixture {
  app: INestApplication;
  httpUrl: string;
  browserCredential(user: User): string;
  dataSource: DataSource;
  createPlayer(): Promise<User>;
  client(user?: User, credential?: FixtureCredential, namespace?: 'game' | 'chat'): Socket;
  close(): Promise<void>;
}

export async function startOnlineFixture(options: { serveFrontend?: boolean; includeServices?: boolean; frontendDist?: string; cors?: boolean } = {}): Promise<OnlineFixture> {
  const schema = `arcade_${randomBytes(8).toString('hex')}`;
  const previousSecret = process.env.SECRET;
  const secret = randomBytes(32).toString('hex');
  process.env.SECRET = secret;
  const dataSource = new DataSource({
    type: 'postgres', ...DATABASE,
    // Only this specifically named fixture password is accepted, if local initdb
    // used password authentication. It is never returned, logged, or serialized.
    password: process.env.ARCADE_FIXTURE_DB_PASSWORD,
    schema, entities: [User, Match, Channel, Message, ...(options.includeServices ? [DMChannel] : [])],
    synchronize: false, logging: false,
    extra: { max: 4, application_name: 'arcade-upgrade-fixture' },
  });
  let app: INestApplication | undefined;
  let ownsSchema = false;
  let stage = 'connect';
  const sockets = new Set<Socket>();
  const restoreSecret = () => {
    if (previousSecret === undefined) delete process.env.SECRET;
    else process.env.SECRET = previousSecret;
  };
  try {
    await dataSource.initialize();
    stage = 'database-identity';
    const [identity] = await dataSource.query(
      'SELECT current_database() AS database, current_user AS username',
    );
    if (identity.database !== DATABASE.database || identity.username !== DATABASE.username) {
      throw new Error('Fixture database identity did not match the hard allowlist');
    }
    // The identifier is generated above from hexadecimal bytes, not user input.
    stage = 'create-schema';
    await dataSource.query(`CREATE SCHEMA "${schema}"`);
    ownsSchema = true;
    stage = 'synchronize';
    await dataSource.synchronize();
    stage = 'compile-test-module';
    const module = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      controllers: [UserController, ...(options.includeServices ? [AuthController] : [])],
      providers: [
        ProfileService, UserGuard, JwtAuthGuard, JwtStrategy,
        GameGateway, GameService, MatchService, UserService, JwtService,
        { provide: getRepositoryToken(User), useValue: dataSource.getRepository(User) },
        { provide: getRepositoryToken(Match), useValue: dataSource.getRepository(Match) },
        ...(options.includeServices ? [AuthService, ChatGateway, ChatService,
          { provide: EmailService, useValue: { sendJoinMail: async () => {
            throw new Error('External mail is outside this isolated fixture');
          } } },
          { provide: getRepositoryToken(Channel), useValue: dataSource.getRepository(Channel) },
          { provide: getRepositoryToken(DMChannel), useValue: dataSource.getRepository(DMChannel) },
          { provide: getRepositoryToken(Message), useValue: dataSource.getRepository(Message) },
        ] : []),
      ],
    }).compile();
    stage = 'create-application';
    app = module.createNestApplication({ logger: false, ...(options.cors ? { cors: true } : {}) });
    // Match main.ts's request validation while keeping its production DB/OAuth
    // bootstrap out of this disposable fixture.
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    if (options.serveFrontend) {
      stage = 'mount-frontend';
      const frontend = options.frontendDist ? resolve(options.frontendDist) : resolve(__dirname, '../../frontend/dist');
      app.use(express.static(frontend));
      app.use((request: express.Request, response: express.Response, next: express.NextFunction) => {
        if (request.method === 'GET' && !/^\/(user|auth|socket\.io)(\/|$)/.test(request.path)) {
          response.sendFile(resolve(frontend, 'index.html'));
        } else next();
      });
    }
    stage = 'listen';
    await app.listen(0, DATABASE.host);
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Fixture HTTP listener has no TCP port');
    const url = `http://${DATABASE.host}:${address.port}/game`;
    const jwt = module.get(JwtService);
    let playerNumber = 0;
    return {
      app,
      httpUrl: `http://${DATABASE.host}:${address.port}`,
      browserCredential(user) { return jwt.sign({ username: user.name }, { secret, expiresIn: '10m' }); },
      dataSource,
      async createPlayer() {
        playerNumber++;
        const suffix = randomBytes(3).toString('hex');
        const name = `fixture_${playerNumber}_${suffix}`;
        const repository = dataSource.getRepository(User);
        return repository.save(repository.create({
          name, nickname: `f${playerNumber}${suffix}`,
          email: `${name}@example.invalid`, profileUrl: resolve(__dirname, '../profiles/default.jpeg'),
        }));
      },
      client(user, credential = 'valid', namespace = 'game') {
        if (credential === 'valid' && !user) throw new Error('A valid fixture client requires a saved fixture player');
        const token = credential === 'missing' ? undefined
          : credential === 'malformed' ? 'invalid-fixture-token'
          : jwt.sign({ username: credential === 'unknown-user' ? 'fixture_user_that_does_not_exist' : user.name },
            { secret, expiresIn: '10m' });
        const socket = io(namespace === 'game' ? url : url.replace(/\/game$/, '/chat'), {
          autoConnect: false, transports: ['websocket'], reconnection: false,
          forceNew: true, auth: token === undefined ? {} : { token },
          timeout: 5000,
        });
        sockets.add(socket);
        return socket;
      },
      async close() {
        for (const socket of sockets) {
          socket.disconnect();
          socket.removeAllListeners();
        }
        sockets.clear();
        await app.close();
        // Drop only the schema this fixture successfully created. Never use
        // dropDatabase, dropSchema:true, or touch the public schema.
        if (ownsSchema && dataSource.isInitialized) {
          await dataSource.query(`DROP SCHEMA "${schema}" CASCADE`);
          ownsSchema = false;
        }
        if (dataSource.isInitialized) await dataSource.destroy();
        restoreSecret();
      },
    };
  } catch (error) {
    if (app) await app.close();
    if (ownsSchema && dataSource.isInitialized) await dataSource.query(`DROP SCHEMA "${schema}" CASCADE`);
    if (dataSource.isInitialized) await dataSource.destroy();
    restoreSecret();
    // Connection errors may carry connection options. Surface only a bounded
    // error code, never the original credentials/options or signed JWTs.
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code)
      ? ` (${error.code})` : '';
    const categories = ['Error', 'TypeError', 'QueryFailedError', 'UnknownDependenciesException', 'EntityMetadataNotFoundError',
      'DataTypeNotSupportedError', 'DriverPackageNotInstalledError', 'ColumnTypeUndefinedError', 'MissingPrimaryColumnError', 'TypeORMError'];
    const category = categories.includes(error?.name) ? error.name : 'OtherError';
    throw new Error(`Disposable online fixture initialization failed [${stage}/${category}]${code}; inspect the isolated test setup`);
  }
}

export function nextEvent<T = any>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(event, success);
      socket.off('connect_error', connectionError);
      socket.off('error', gameError);
      socket.off('disconnect', disconnected);
    };
    const success = (value: T) => { cleanup(); resolve(value); };
    const connectionError = () => { cleanup(); reject(new Error(`Connection rejected while waiting for ${event}`)); };
    const gameError = () => { cleanup(); reject(new Error(`Game error while waiting for ${event}`)); };
    const disconnected = () => { cleanup(); reject(new Error(`Disconnected while waiting for ${event}`)); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for ${event}`)); }, timeoutMs);
    socket.once(event, success);
    if (event !== 'connect_error') socket.once('connect_error', connectionError);
    if (event !== 'error') socket.once('error', gameError);
    if (event !== 'disconnect') socket.once('disconnect', disconnected);
  });
}

export async function connectFixtureClient(socket: Socket): Promise<void> {
  const connected = nextEvent(socket, 'connect');
  socket.connect();
  await connected;
}

export async function waitForFixture<T>(read: () => Promise<T>, accept: (value: T) => boolean,
  timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  do {
    const result = await read();
    if (accept(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for the isolated fixture state');
}
