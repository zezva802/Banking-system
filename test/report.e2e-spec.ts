import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { Repository, DataSource } from 'typeorm';
import { User } from '../src/database/entities/user.entity';
import { Account } from '../src/database/entities/account.entity';
import { Card } from '../src/database/entities/card.entity';
import { Transaction } from '../src/database/entities/transaction.entity';
import { AtmOperation } from '../src/database/entities/atmOperation.entity';
import { Currency, UserRole, AtmOperationType, TransactionStatus, TransactionType } from '../src/database/enums';
import { UsersService as OperatorUsersService } from '../src/operator/services/user.service';
import { AccountService as OperatorAccountService } from '../src/operator/services/account.service';
import { CardService as OperatorCardService } from '../src/operator/services/card.service';
import { AuthService } from '../src/auth/auth.service';
import { ExchangeRateService } from '../src/common/services/exchange-rate.service';
import { CommissionService } from '../src/common/services/commission.service';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('ReportsController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let accountRepository: Repository<Account>;
  let cardRepository: Repository<Card>;
  let transactionRepository: Repository<Transaction>;
  let atmOperationRepository: Repository<AtmOperation>;
  let operatorUsersService: OperatorUsersService;
  let operatorAccountService: OperatorAccountService;
  let operatorCardService: OperatorCardService;
  let authService: AuthService;
  let dataSource: DataSource;

  const mockExchangeRateService = {
    getRate: jest.fn((from: Currency, to: Currency, date?: Date) => {
      if (from === to) return 1;

      if (date) {
        const dateString = date.toISOString().split('T')[0];
        if (dateString === '2026-01-10' && from === Currency.USD && to === Currency.GEL) return 2.8;
        if (dateString === '2026-01-10' && from === Currency.GEL && to === Currency.USD) return 0.35;
        if (dateString === '2026-01-05' && from === Currency.EUR && to === Currency.GEL) return 3.2;
        if (dateString === '2026-01-05' && from === Currency.GEL && to === Currency.EUR) return 0.31;
      }
      

      if (from === Currency.GEL && to === Currency.USD) return 0.37;
      if (from === Currency.USD && to === Currency.GEL) return 2.7;
      if (from === Currency.GEL && to === Currency.EUR) return 0.32;
      if (from === Currency.EUR && to === Currency.GEL) return 3.1;
      return 1;
    }),
    convert: jest.fn(async (amount: number, from: Currency, to: Currency, date?: Date) => {
      const rate = mockExchangeRateService.getRate(from, to, date);
      return Math.round(amount * rate * 100) / 100;
    }),
    clearCache: jest.fn(),
  };


  const mockCommissionService = {
    calculateTransferOther: jest.fn((amount: number) => ({ commission: amount * 0.01, rate: 0.01 })),
    calculateAtmCommission: jest.fn((amount: number) => amount * 0.02),
  };


  let testOperatorUser: User;
  let testOperatorToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(ExchangeRateService)
    .useValue(mockExchangeRateService)
    .overrideProvider(CommissionService)
    .useValue(mockCommissionService)
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    accountRepository = moduleFixture.get(getRepositoryToken(Account));
    cardRepository = moduleFixture.get(getRepositoryToken(Card));
    transactionRepository = moduleFixture.get(getRepositoryToken(Transaction));
    atmOperationRepository = moduleFixture.get(getRepositoryToken(AtmOperation));
    operatorUsersService = moduleFixture.get(OperatorUsersService);
    operatorAccountService = moduleFixture.get(OperatorAccountService);
    operatorCardService = moduleFixture.get(OperatorCardService);
    authService = moduleFixture.get(AuthService);
    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(async () => {

    await atmOperationRepository.query('TRUNCATE TABLE atm_operations RESTART IDENTITY CASCADE;');
    await transactionRepository.query('TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;'); // Added
    await cardRepository.query('TRUNCATE TABLE cards RESTART IDENTITY CASCADE;');
    await accountRepository.query('TRUNCATE TABLE accounts RESTART IDENTITY CASCADE;');
    await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');

    const uniqueSeed = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const operatorEmail = `reports.operator.${uniqueSeed}@example.com`;
    const operatorPrivateNumber = `54321${uniqueSeed.substring(0,6)}`;

    const operator = await operatorUsersService.createUser({
      name: 'Report',
      surname: 'Manager',
      privateNumber: operatorPrivateNumber,
      dateOfBirth: new Date('1980-01-01'),
      email: operatorEmail,
      password: 'ReportOperator1!',
    });
    await userRepository.update(operator.id, { role: UserRole.OPERATOR });
    const operatorLoginResponse = await authService.login({
      email: operatorEmail,
      password: 'ReportOperator1!',
    });
    testOperatorToken = operatorLoginResponse.accessToken;

    mockExchangeRateService.getRate.mockClear();
    mockExchangeRateService.convert.mockClear();
    mockCommissionService.calculateAtmCommission.mockClear();
    mockCommissionService.calculateTransferOther.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /reports/users/statistics', () => {
    it('should return user registration statistics for current year, last year, and last 30 days', async () => {
      const today = new Date();
      const thisYear = today.getFullYear();
      const lastYear = thisYear - 1;

      await operatorUsersService.createUser({
        name: 'User1', surname: 'ThisYear', privateNumber: '11111111111', dateOfBirth: new Date('1990-01-01'), email: 'user1@example.com', password: 'Password1!'
      });
      await userRepository.save(userRepository.create({
        name: 'User2', surname: 'LastYear', privateNumber: '22222222222', dateOfBirth: new Date('1990-01-01'), email: 'user2@example.com', password: 'Password1!',
        createdAt: new Date(lastYear, 5, 15)
      }));

      const aFewDaysAgo = new Date();
      aFewDaysAgo.setDate(today.getDate() - 5);
      await userRepository.save(userRepository.create({
        name: 'User3', surname: 'Last30Days', privateNumber: '33333333333', dateOfBirth: new Date('1990-01-01'), email: 'user3@example.com', password: 'Password1!',
        createdAt: aFewDaysAgo
      }));

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(today.getDate() - 60);
      await userRepository.save(userRepository.create({
        name: 'User4', surname: 'NotLast30Days', privateNumber: '44444444444', dateOfBirth: new Date('1990-01-01'), email: 'user4@example.com', password: 'Password1!',
        createdAt: sixtyDaysAgo
      }));


      const response = await request(app.getHttpServer())
        .get('/reports/users/statistics')
        .set('Authorization', `Bearer ${testOperatorToken}`)
        .expect(200);


      expect(response.body).toHaveProperty('usersRegisteredThisYear');
      expect(response.body).toHaveProperty('usersRegisteredLastYear');
      expect(response.body).toHaveProperty('usersRegisteredLast30Days');

      expect(response.body.usersRegisteredThisYear).toBe(3);
      expect(response.body.usersRegisteredLastYear).toBe(2);
      expect(response.body.usersRegisteredLast30Days).toBe(3);

    });

    it('should return 401 if not authenticated', async () => {
        await request(app.getHttpServer())
            .get('/reports/users/statistics')
            .expect(401);
    });

    it('should return 403 if authenticated as a regular user (not operator)', async () => {
        const uniqueSeed = Date.now().toString() + Math.random().toString(36).substring(2, 6);
        const regularUserEmail = `regular.user.${uniqueSeed}@example.com`;
        const regularUserPrivateNumber = `99999${uniqueSeed.substring(0,6)}`;
        const regularUser = await operatorUsersService.createUser({
            name: 'Regular', surname: 'User', privateNumber: regularUserPrivateNumber, dateOfBirth: new Date('1990-01-01'), email: regularUserEmail, password: 'Password1!'
        });
        const regularUserLoginResponse = await authService.login({
            email: regularUserEmail, password: 'Password1!'
        });
        const regularUserToken = regularUserLoginResponse.accessToken;

        await request(app.getHttpServer())
            .get('/reports/users/statistics')
            .set('Authorization', `Bearer ${regularUserToken}`)
            .expect(403);
    });
  });
});