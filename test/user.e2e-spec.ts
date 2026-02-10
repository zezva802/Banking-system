import { INestApplication, ValidationPipe } from "@nestjs/common"
import { Account } from "../src/database/entities/account.entity";
import { Transaction } from "../src/database/entities/transaction.entity";
import { User } from "../src/database/entities/user.entity";
import { DataSource, Repository } from "typeorm";
import { UsersService as OperatorUsersService } from '../src/operator/services/user.service';
import { AccountService as OperatorAccountService } from "../src/operator/services/account.service";
import { CardService as OperatorCardService } from "../src/operator/services/card.service";
import { AuthService } from "../src/auth/auth.service";
import { Currency, TransactionStatus, TransactionType } from "../src/database/enums";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { ExchangeRateService } from "../src/common/services/exchange-rate.service";
import { UserRole } from "../src/database/enums";
import request from 'supertest';
import { getRepositoryToken } from "@nestjs/typeorm";
   
describe('UserController (e2e)', () => {
    let app: INestApplication;

    let userRepository: Repository<User>;
    let accountRepository: Repository<Account>;
    let transactionRepository: Repository<Transaction>;
    let operatorUsersService: OperatorUsersService;
    let operatorAccountService: OperatorAccountService;
    let operatorCardService: OperatorCardService;
    let authService: AuthService;
    let dataSource: DataSource;


    let testUser: Omit<User, 'password'>; ;
    let testUserToken: string;
    let testOperatorToken: string;

    const mockExchangeRateService = {
        getRate: jest.fn((from: Currency, to: Currency) => {
            if (from === to) return 1;
            if (from === Currency.GEL && to === Currency.USD) return 0.37;
            if (from === Currency.USD && to === Currency.GEL) return 2.7;
            if (from === Currency.GEL && to === Currency.EUR) return 0.32;
            if (from === Currency.EUR && to === Currency.GEL) return 3.1;
            return 1;
        }),
        convert: jest.fn(async (amount: number, from:Currency, to: Currency) => {
            const rate = mockExchangeRateService.getRate(from, to);
            return Math.round(amount * rate * 100) / 100;
        }),
        clearCache: jest.fn(),
    }

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
        .overrideProvider(ExchangeRateService)
        .useValue(mockExchangeRateService)
        .compile();

        app = moduleFixture.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            })
        );

        await app.init();

        userRepository = moduleFixture.get(getRepositoryToken(User));
        accountRepository = moduleFixture.get(getRepositoryToken(Account));
        transactionRepository = moduleFixture.get(getRepositoryToken(Transaction));
        operatorUsersService = moduleFixture.get(OperatorUsersService);
        operatorAccountService = moduleFixture.get(OperatorAccountService);
        operatorCardService = moduleFixture.get(OperatorCardService);
        authService = moduleFixture.get(AuthService);
        dataSource = moduleFixture.get(DataSource); 
    });

    afterAll(async () => {
        if(dataSource && dataSource.isInitialized){
            await dataSource.destroy();
        }
        await app.close();
    });

    beforeEach(async () => {
        await transactionRepository.query('TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;');
        await accountRepository.query('TRUNCATE TABLE accounts RESTART IDENTITY CASCADE;');
        await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');


        const operator = await operatorUsersService.createUser({
            name: 'Test',
            surname: 'Operator',
            privateNumber: '12345678901',
            dateOfBirth: new Date('1990-01-01'),
            email: 'operator@example.com',
            password: 'StrongPassword1!',
        });
            
        await userRepository.update(operator.id, { role: UserRole.OPERATOR });

        const operatorLoginResponse = await authService.login({
            email: 'operator@example.com',
            password: 'StrongPassword1!'
        });
        testOperatorToken = operatorLoginResponse.accessToken;


        testUser = await operatorUsersService.createUser({
            name: 'John',
            surname: 'Doe',
            privateNumber: '11122233344',
            dateOfBirth: new Date('1985-05-15'),
            email: 'john.doe@example.com',
            password: 'SecurePassword1!',
        });

        const userLoginResponse = await authService.login({
            email: 'john.doe@example.com',
            password: 'SecurePassword1!',
        });
        testUserToken = userLoginResponse.accessToken;
        mockExchangeRateService.getRate.mockClear();
        mockExchangeRateService.convert.mockClear();
    });

    describe('GET /user/accounts', () => {
        it('should return empty array if user has no accounts', async () => {
            const response = await request(app.getHttpServer())
                                    .get('/user/accounts')
                                    .set('Authorization', `Bearer ${testUserToken}`)
                                    .expect(200);
            expect(response.body).toEqual([]);
        });

        it('should return a list of accounts for the authenticated user', async () => {
            const account1 = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000,
            });

            const account2 = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.USD,
                initialBalance: 2000,
            });


            const response = await request(app.getHttpServer())
                                .get('/user/accounts')
                                .set('Authorization', `Bearer ${testUserToken}`)
                                .expect(200);

            expect(response.body).toHaveLength(2);

            const returnedAccount1 = response.body.find(acc => acc.id === account1.id);
            expect(returnedAccount1).toBeDefined();
            expect(returnedAccount1).toHaveProperty('id', account1.id);
            expect(returnedAccount1).toHaveProperty('iban', account1.iban);
            expect(returnedAccount1).toHaveProperty('balance', "1000.00");
            expect(returnedAccount1).toHaveProperty('currency', Currency.GEL);
            expect(returnedAccount1.userId).toBeUndefined();

            const returnedAccount2 = response.body.find(acc => acc.id === account2.id);
            expect(returnedAccount2).toBeDefined();
            expect(returnedAccount2).toHaveProperty('id', account2.id);
            expect(returnedAccount2).toHaveProperty('iban', account2.iban);
            expect(returnedAccount2).toHaveProperty('balance', "2000.00");
            expect(returnedAccount2).toHaveProperty('currency', Currency.USD);
            expect(returnedAccount2.userId).toBeUndefined();
        });

    
        });

    

    describe('GET /user/cards', () => {
        it('should return an empty array if the user has no cards', async () => {
            const response = await request(app.getHttpServer())
                                .get('/user/cards')
                                .set('Authorization', `Bearer ${testUserToken}`)
                                .expect(200);
            expect(response.body).toEqual([]);
        });

        it('should return a list of cards for the authenticated user', async () => {
            const account = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000,
            });

            const card = await operatorCardService.createCard(
                account.id,
                '1234'
            );

            const response = await request(app.getHttpServer())
                                .get('/user/cards')
                                .set('Authorization', `Bearer ${testUserToken}`)
                                .expect(200);

            expect(response.body).toHaveLength(1);
            const returnedCard = response.body[0];

            expect(returnedCard).toHaveProperty('id', card.id);
            expect(returnedCard).toHaveProperty('cardNumber', card.cardNumber);
            expect(returnedCard).toHaveProperty('cardholderName', card.cardholderName);
            expect(returnedCard).toHaveProperty('expirationMonth', card.expirationMonth);
            expect(returnedCard).toHaveProperty('expirationYear', card.expirationYear);
            expect(returnedCard.pin).toBeUndefined();
            expect(returnedCard).toHaveProperty('account');
            expect(returnedCard.account).toHaveProperty('id', account.id);
            expect(returnedCard.account).toHaveProperty('iban', account.iban);
            expect(returnedCard.account.userId).toBeUndefined();
        });
    });

    describe('POST /user/transfer/own', () => {
        it('should successfully transfer money between own accounts with the same money', async () => {
            const account1 = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000
            });

            const account2 = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 500
            });

            const transferAmount = 100;

            const response = await request(app.getHttpServer())
                                .post('/user/transfer/own')
                                .set('Authorization', `Bearer ${testUserToken}`)
                                .send({
                                    fromAccountId: account1.id,
                                    toAccountId: account2.id,
                                    amount: transferAmount,
                                    currency: Currency.GEL,
                                })
                                .expect(201);
            
            expect(response.body.message).toBe('Transfer completed successfully');
            expect(response.body.transaction).toHaveProperty('id');
            expect(response.body.transaction.amount).toBe(transferAmount);
            expect(response.body.transaction.currency).toBe(Currency.GEL);
            expect(response.body.transaction.commission).toBe("0.00");
            expect(response.body.transaction.from).toBe(account1.iban);
            expect(response.body.transaction.to).toBe(account2.iban);
            expect(response.body.transaction).toHaveProperty('createdAt');

            const updatedAccount1 = await accountRepository.findOneBy({ id: account1.id });
            const updatedAccount2 = await accountRepository.findOneBy({ id: account2.id });
            const transaction = await transactionRepository.findOneBy({ id: response.body.transaction.id });

            expect(Number(updatedAccount1?.balance)).toBeCloseTo(900.00);
            expect(Number(updatedAccount2?.balance)).toBeCloseTo(600.00);
            expect(transaction?.status).toBe(TransactionStatus.COMPLETED);
            expect(transaction?.transactionType).toBe(TransactionType.OWN_ACCOUNT);
            expect(Number(transaction?.commission)).toBeCloseTo(0);

            expect(mockExchangeRateService.convert).not.toHaveBeenCalled();
            expect(mockExchangeRateService.getRate).not.toHaveBeenCalled();
        });

        it('should successfully transfer money between own accounts with different currencies', async () => {
            const gelAccount = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000
            });

            const usdAccount = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.USD,
                initialBalance: 500,
            });

            const transferAmountDto = 100;

            const gelToUsdRate = 0.37;
            const usdToGelRate = 2.7;


            const response = await request(app.getHttpServer())
                                    .post('/user/transfer/own')
                                    .set('Authorization', `Bearer ${testUserToken}`)
                                    .send({
                                        fromAccountId: gelAccount.id,
                                        toAccountId: usdAccount.id,
                                        amount: transferAmountDto,
                                        currency: Currency.USD,
                                    })
                                    .expect(201);
            
            expect(response.body.message).toBe('Transfer completed successfully');
            expect(response.body.transaction).toHaveProperty('id');
            expect(response.body.transaction.amount).toBe(transferAmountDto);
            expect(response.body.transaction.currency).toBe(Currency.USD);
            expect(response.body.transaction.commission).toBe("0.00");
            expect(response.body.transaction.from).toBe(gelAccount.iban);
            expect(response.body.transaction.to).toBe(usdAccount.iban);
            expect(response.body.transaction).toHaveProperty('createdAt');

            const updatedGelAccount = await accountRepository.findOneBy({ id: gelAccount.id });
            const updatedUsdAccount = await accountRepository.findOneBy({ id: usdAccount.id });
            const transaction = await transactionRepository.findOneBy({ id: response.body.transaction.id });

            const expectedDeductionInGEL = Math.round(transferAmountDto * usdToGelRate * 100) / 100;
            const expectedAdditionInUSD = Math.round(transferAmountDto * 1 * 100) / 100;

            expect(Number(updatedGelAccount?.balance)).toBeCloseTo(1000 - expectedDeductionInGEL);
            expect(Number(updatedUsdAccount?.balance)).toBeCloseTo(500 + expectedAdditionInUSD);
            expect(transaction?.status).toBe(TransactionStatus.COMPLETED);
            expect(transaction?.transactionType).toBe(TransactionType.OWN_ACCOUNT);
            expect(Number(transaction?.commission)).toBeCloseTo(0);

            expect(mockExchangeRateService.convert).toHaveBeenCalledTimes(1);
            expect(mockExchangeRateService.convert).toHaveBeenCalledWith(transferAmountDto, Currency.USD, Currency.GEL);
        });

        it('should return 400 if sender has insufficient balance', async () => {
            const account1 = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 50,
            });

            const account2 = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
            });

            const transferAmount = 100;

            const response = await request(app.getHttpServer())
                                    .post('/user/transfer/own')
                                    .set('Authorization', `Bearer ${testUserToken}`)
                                    .send({
                                        fromAccountId: account1.id,
                                        toAccountId: account2.id,
                                        amount: transferAmount,
                                        currency: Currency.GEL,
                                    })
                                    .expect(400);
            
            expect(response.body.message).toBe('Insufficient balance');
            expect(response.body.error).toBe('Bad Request');
            expect(response.body.statusCode).toBe(400);


            const originalAccount1 = await accountRepository.findOneBy({ id: account1.id });
            const originalAccount2 = await accountRepository.findOneBy({ id: account2.id });
            expect(Number(originalAccount1?.balance)).toBeCloseTo(50);
            expect(Number(originalAccount2?.balance)).toBeCloseTo(0);


            const transactions = await transactionRepository.find();
            expect(transactions).toHaveLength(1);
            expect(transactions[0].status).toBe(TransactionStatus.FAILED);


            expect(mockExchangeRateService.convert).not.toHaveBeenCalled();
            expect(mockExchangeRateService.getRate).not.toHaveBeenCalled();
        })
    });

    describe('POST /user/transfer/other', () => {
        it('should successfully transfer money to another user\'s account with commission (same currency)', async () => {
            const senderAccount = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000,
            });

            const otherUser = await operatorUsersService.createUser({
                name: 'Akaki',
                surname: 'Tsereteli',
                privateNumber: '99988877766',
                dateOfBirth: new Date('1992-03-20'),
                email: 'akakitsereteli@example.com',
                password: 'Gamzrdeli123!',
            });

            const receiverAccount = await operatorAccountService.createAccount({
                userId: otherUser.id,
                currency: Currency.GEL,
                initialBalance: 500,
            });

            const transferAmount = 100;
            const commissionRate = 0.01;

            const calculatedCommission = transferAmount * commissionRate;
            const totalDeductionFromSender = calculatedCommission + transferAmount;

            const response = await request(app.getHttpServer())
                                    .post('/user/transfer/other')
                                    .set('Authorization', `Bearer ${testUserToken}`)
                                    .send({
                                        fromAccountId: senderAccount.id,
                                        receiverIban: receiverAccount.iban,
                                        amount: transferAmount,
                                        currency : Currency.GEL,
                                    })
                                    .expect(201);
            
            expect(response.body.message).toBe('Transfer completed successfully');
            expect(response.body.transaction).toHaveProperty('id');
            expect(response.body.transaction.amount).toBe(transferAmount);
            expect(response.body.transaction.currency).toBe(Currency.GEL);
            expect(Number(response.body.transaction.commission)).toBeCloseTo(calculatedCommission);
            expect(response.body.transaction.from).toBe(senderAccount.iban);
            expect(response.body.transaction.to).toBe(receiverAccount.iban);
            expect(response.body.transaction).toHaveProperty('createdAt');

            const updatedSenderAccount = await accountRepository.findOneBy({ id: senderAccount.id });
            const updatedReceiverAccount = await accountRepository.findOneBy({ id: receiverAccount.id });
            const transaction = await transactionRepository.findOneBy({ id: response.body.transaction.id });

            expect(Number(updatedSenderAccount?.balance)).toBeCloseTo(1000 - totalDeductionFromSender);
            expect(Number(updatedReceiverAccount?.balance)).toBeCloseTo(500 + transferAmount);
            expect(transaction?.status).toBe(TransactionStatus.COMPLETED);
            expect(transaction?.transactionType).toBe(TransactionType.OTHER_ACCOUNT);
            expect(Number(transaction?.commission)).toBeCloseTo(calculatedCommission);

            expect(mockExchangeRateService.convert).not.toHaveBeenCalled();
            expect(mockExchangeRateService.getRate).not.toHaveBeenCalled();
                    
        });

        it('should successfully transfer money to another user\'s account with commission (different currencies)', async () => {
            const senderAccount = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 1000,
            });


            const otherUser = await operatorUsersService.createUser({
                name: 'Jane',
                surname: 'Smith',
                privateNumber: '99988877767',
                dateOfBirth: new Date('1992-03-20'),
                email: 'jane.smith.diff@example.com',
                password: 'AnotherPassword2!',
            });
            const receiverAccount = await operatorAccountService.createAccount({
                userId: otherUser.id,
                currency: Currency.USD,
                initialBalance: 500,
            });

            const transferAmountDto = 100;

            
            const usdToGelRate = 2.7;
            const commissionRate = 0.01;

            const amountToDeductInSenderCurrency = Math.round(transferAmountDto * usdToGelRate * 100) / 100;

            const calculatedCommission = (amountToDeductInSenderCurrency * commissionRate);

            const totalDeductionFromSender = amountToDeductInSenderCurrency + calculatedCommission;

            const amountToAddInReceiverCurrency = transferAmountDto;


            const response = await request(app.getHttpServer())
                .post('/user/transfer/other')
                .set('Authorization', `Bearer ${testUserToken}`)
                .send({
                    fromAccountId: senderAccount.id,
                    receiverIban: receiverAccount.iban,
                    amount: transferAmountDto,
                    currency: Currency.USD,
                })
                .expect(201);


            expect(response.body.message).toBe('Transfer completed successfully');
            expect(response.body.transaction).toHaveProperty('id');
            expect(response.body.transaction.amount).toBe(transferAmountDto);
            expect(response.body.transaction.currency).toBe(Currency.USD);
            expect(Number(response.body.transaction.commission)).toBeCloseTo(calculatedCommission);
            expect(Number(response.body.transaction.commissionRate)).toBeCloseTo(commissionRate);
            expect(response.body.transaction.from).toBe(senderAccount.iban);
            expect(response.body.transaction.to).toBe(receiverAccount.iban);
            expect(response.body.transaction).toHaveProperty('createdAt');


            const updatedSenderAccount = await accountRepository.findOneBy({ id: senderAccount.id });
            const updatedReceiverAccount = await accountRepository.findOneBy({ id: receiverAccount.id });
            const transaction = await transactionRepository.findOneBy({ id: response.body.transaction.id });

            expect(Number(updatedSenderAccount?.balance)).toBeCloseTo(1000 - totalDeductionFromSender);
            expect(Number(updatedReceiverAccount?.balance)).toBeCloseTo(500 + amountToAddInReceiverCurrency);
            expect(transaction?.status).toBe(TransactionStatus.COMPLETED);
            expect(transaction?.transactionType).toBe(TransactionType.OTHER_ACCOUNT);
            expect(Number(transaction?.commission)).toBeCloseTo(calculatedCommission);
            expect(Number(transaction?.commissionRate)).toBeCloseTo(commissionRate);

            expect(mockExchangeRateService.convert).toHaveBeenCalledTimes(1);
            expect(mockExchangeRateService.convert).toHaveBeenCalledWith(transferAmountDto, Currency.USD, Currency.GEL);
        });

        it('should return 400 if sender account has insufficient balance (considering commission)', async () => {
            const senderAccount = await operatorAccountService.createAccount({
                userId: testUser.id,
                currency: Currency.GEL,
                initialBalance: 100,
            });

            const otherUser = await operatorUsersService.createUser({
                name: 'Bob',
                surname: 'Johnson',
                privateNumber: '22233344455',
                dateOfBirth: new Date('1990-01-01'),
                email: 'bob.johnson@example.com',
                password: 'SecurePassword2!',
            });
            const receiverAccount = await operatorAccountService.createAccount({
                userId: otherUser.id,
                currency: Currency.GEL,
                initialBalance: 500,
            });

            const transferAmount = 100;
            const commissionRate = 0.01;
            const calculatedCommission = (transferAmount * commissionRate);
            const totalDeductionRequired = transferAmount + calculatedCommission;

            const response = await request(app.getHttpServer())
                .post('/user/transfer/other')
                .set('Authorization', `Bearer ${testUserToken}`)
                .send({
                fromAccountId: senderAccount.id,
                receiverIban: receiverAccount.iban,
                amount: transferAmount,
                currency: Currency.GEL,
                })
                .expect(400);

            expect(response.body.message).toBe('Insufficient balance');
            expect(response.body.error).toBe('Bad Request');
            expect(response.body.statusCode).toBe(400);

            const originalSenderAccount = await accountRepository.findOneBy({ id: senderAccount.id });
            const originalReceiverAccount = await accountRepository.findOneBy({ id: receiverAccount.id });
            expect(Number(originalSenderAccount?.balance)).toBeCloseTo(100);
            expect(Number(originalReceiverAccount?.balance)).toBeCloseTo(500);

            const transactions = await transactionRepository.find({ where: { senderAccount: { id: senderAccount.id } } });
            expect(transactions).toHaveLength(1);
            expect(transactions[0].status).toBe(TransactionStatus.FAILED);
            expect(Number(transactions[0].commission)).toBeCloseTo(calculatedCommission);

            expect(mockExchangeRateService.convert).not.toHaveBeenCalled();
            expect(mockExchangeRateService.getRate).not.toHaveBeenCalled();
        });
    });

    
});