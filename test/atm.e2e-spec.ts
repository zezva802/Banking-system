import { INestApplication, ValidationPipe } from "@nestjs/common"
import { Account } from "../src/database/entities/account.entity";
import { User } from "../src/database/entities/user.entity";
import { Card } from "../src/database/entities/card.entity";
import { Repository } from "typeorm";
import { AtmOperation } from "../src/database/entities/atmOperation.entity";
import { UsersService as OperatorUsersService } from "../src/operator/services/user.service";
import { AccountService as OperatorAccountService } from "../src/operator/services/account.service";
import { CardService as OperatorCardService } from "../src/operator/services/card.service";
import { AuthService } from "../src/auth/auth.service";
import { DataSource } from "typeorm";
import { AtmOperationType, Currency, UserRole } from "../src/database/enums";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { ExchangeRateService } from "../src/common/services/exchange-rate.service";
import { CommissionService } from "../src/common/services/commission.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import request from 'supertest';

describe('AtmController (e2e)', () => {
    let app: INestApplication;
    let userRepository: Repository<User>;
    let accountRepository: Repository<Account>;
    let cardRepository: Repository<Card>;
    let atmOperationRepository: Repository<AtmOperation>;
    let operatorUsersService: OperatorUsersService;
    let operatorAccountService: OperatorAccountService;
    let operatorCardService: OperatorCardService;
    let authService: AuthService;
    let dataSource: DataSource;

    const mockExchangeRateService = {
        getRate: jest.fn((from: Currency, to: Currency) => {
            if(from === to) return 1;
            if(from === Currency.GEL && to === Currency.USD) return 0.37;
            if(from === Currency.USD && to === Currency.GEL) return 2.7;
            if(from === Currency.GEL && to === Currency.EUR) return 0.32;
            if(from === Currency.EUR && to === Currency.GEL) return 3.1;
            return 1;
        }),
        convert: jest.fn(async (amount: number, from: Currency, to: Currency) => {
            const rate = mockExchangeRateService.getRate(from, to);
            return Math.round(amount * rate * 100) / 100;
        }),
        clearCache: jest.fn(),
    };

    const mockCommissionService = {
        calculateTransferOther: jest.fn((amount: number) => ({ commission: amount * 0.01, rate: 0.01 })),
        calculateAtmCommission: jest.fn((amount: number) => amount * 0.02),
    };

    let testUser: User;
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
            transform: true
        }));
        await app.init();

        userRepository = moduleFixture.get(getRepositoryToken(User));
        accountRepository = moduleFixture.get(getRepositoryToken(Account));
        atmOperationRepository = moduleFixture.get(getRepositoryToken(AtmOperation));
        cardRepository = moduleFixture.get(getRepositoryToken(Card));
        operatorUsersService = moduleFixture.get(OperatorUsersService);
        operatorAccountService = moduleFixture.get(OperatorAccountService);
        operatorCardService = moduleFixture.get(OperatorCardService);
        authService = moduleFixture.get(AuthService);
        dataSource = moduleFixture.get(DataSource);
    });

    beforeEach(async () => {
        await atmOperationRepository.query('TRUNCATE TABLE atm_operations RESTART IDENTITY CASCADE;');
        await cardRepository.query('TRUNCATE TABLE cards RESTART IDENTITY CASCADE;');
        await accountRepository.query('TRUNCATE TABLE accounts RESTART IDENTITY CASCADE;');
        await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');

        const operator = await operatorUsersService.createUser({
            name: 'Test',
            surname: 'ATM Operator',
            privateNumber: '12345678901',
            dateOfBirth: new Date('1990-01-01'),
            email: 'atm.operator@example.com',
            password: 'StrongATMPassword1!',
        });
        await userRepository.update(operator.id, { role: UserRole.OPERATOR });
        const operatorLoginResponse = await authService.login({
            email: 'atm.operator@example.com',
            password: 'StrongATMPassword1!',
        });
        testOperatorToken = operatorLoginResponse.accessToken;

        const newUserDto = {
            name: 'ATM',
            surname: 'User',
            privateNumber: '1112223345',
            dateOfBirth: new Date('1988-08-08'),
            email: 'atm.user@example.com',
            password: 'ATMUserPassword1!',
        };
        testUser = await operatorUsersService.createUser(newUserDto);

        mockExchangeRateService.getRate.mockClear();
        mockExchangeRateService.convert.mockClear();
        mockCommissionService.calculateAtmCommission.mockClear();
        mockCommissionService.calculateTransferOther.mockClear()
    });

    afterAll(async () => {
        await app.close();
    });

    describe('POST /atm/authorize', () => {
        let testCardNumber: string;
        let testCardPin: string;
        let testExpiredCard: Card;
        
        beforeEach(async () => {
            const account = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000,
            });


            const card = await operatorCardService.createCard(account.id, '1234');
            testCardNumber = card.cardNumber;
            testCardPin = '1234';

            const expiredCardAccount = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 0,
            });
            testExpiredCard = await operatorCardService.createCard(expiredCardAccount.id, '9999');

            await cardRepository.update(testExpiredCard.id, {
                expirationYear: new Date().getFullYear() - 4,
            });
        });

        it('should successfully authorize a valid card and return a session token', async () => {
            const response = await request(app.getHttpServer())
                                .post('/atm/authorize')
                                .send({
                                    cardNumber: testCardNumber,
                                    pin: testCardPin,
                                })
                                .expect(201);
            
            expect(response.body).toHaveProperty('sessionToken');
            expect(response.body).toHaveProperty('cardholderName', `${testUser.name} ${testUser.surname}`);
            expect(response.body).toHaveProperty('expiresIn', 180);
            expect(typeof response.body.sessionToken).toBe('string');

            const atmOperations = await atmOperationRepository.find({
                relations:{card: true},
                where: { card: { cardNumber: testCardNumber } },
            });
            expect(atmOperations).toHaveLength(1);
            expect(atmOperations[0].type).toBe(AtmOperationType.AUTHORIZATION);
            expect(atmOperations[0].card.cardNumber).toBe(testCardNumber); 
            const originalCard = await cardRepository.findOneBy({cardNumber: testCardNumber});
            expect(atmOperations[0].card.id).toBe(originalCard.id);
        });

        it('should return 404 if card not found', async () => {
            await request(app.getHttpServer())
                        .post('/atm/authorize')
                        .send({
                            cardNumber: '1111222233334444',
                            pin: '1234',
                        })
                        .expect(404)
                        .expect({
                            statusCode: 404,
                            message: 'Card not found',
                            error: 'Not Found',
                        });
            
            const atmOperations = await atmOperationRepository.find();
            expect(atmOperations).toHaveLength(0);
        });

        it('should return 403 if card is expired', async () => {
            await request(app.getHttpServer())
                    .post('/atm/authorize')
                    .send({
                        cardNumber: testExpiredCard.cardNumber,
                        pin: '9999'
                    })
                    .expect(403)
                    .expect({
                        statusCode: 403,
                        message: 'Card is not active or expired',
                        error: 'Forbidden',
                    });
            
            const atmOperations = await atmOperationRepository.find();
            expect(atmOperations).toHaveLength(0);
        });

        it('should return 401 if invalid PIN is provided', async () => {
            await request(app.getHttpServer())
                .post('/atm/authorize')
                .send({
                    cardNumber: testCardNumber,
                    pin: '0000',
                })
                .expect(401)
                .expect({
                    statusCode: 401,
                    message: 'invalid pin',
                    error: 'Unauthorized'
                });
            
            const atmOperations = await atmOperationRepository.find();
            expect(atmOperations).toHaveLength(0);
        });
    })
});