import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Card } from "../database/entities/card.entity";
import { MoreThan, Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { AuthorizeDto } from "./dto/authorize.dto";
import { CardValidatorService } from "../common/services/card-validator.service";
import { CryptoService } from "../common/services/crypto.service";
import { JwtService } from "@nestjs/jwt";
import { AtmOperation } from "../database/entities/atmOperation.entity";
import { AtmOperationType, Currency } from "../database/enums";
import { Account } from "../database/entities/account.entity";
import { WithdrawDto } from "./dto/withdraw.dto";
import { CommissionService } from "../common/services/commission.service";
import { ExchangeRateService } from "../common/services/exchange-rate.service";
import { ConfigService } from "@nestjs/config";
import { ChangePinDto } from "./dto/change-pin.dto";
import { DataSource } from "typeorm";

@Injectable()
export class AtmService{
    constructor(
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        private cardValidatorService: CardValidatorService,
        private cryptoService: CryptoService,
        private jwtService: JwtService,
        @InjectRepository(AtmOperation)
        private atmOperationRepository: Repository<AtmOperation>,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private commissionService: CommissionService,
        private exchangeRateService: ExchangeRateService,
        private configService: ConfigService,
        private dataSource: DataSource,
    ){}

    async authorize(dto: AuthorizeDto) {
        const card = await this.cardRepository.findOne({
            where: { cardNumber: dto.cardNumber },
            relations: { account: true },
        });


        if (!card) {
            throw new NotFoundException('Card not found');
        }

        if(!this.cardValidatorService.isActive(card)){
            throw new ForbiddenException('Card is not active or expired');
        }


        const isPinValid = await this.cryptoService.comparePin(dto.pin, card.pin);

        if(!isPinValid) {
            throw new UnauthorizedException('invalid pin');
        }

        const payload = {
            cardId: card.id,
            accountId: card.account.id,
            type: 'atm_session',
        };
        const accessToken = this.jwtService.sign(payload,{
            expiresIn: '3m'
        });

        const atmOperation = this.atmOperationRepository.create({
            type: AtmOperationType.AUTHORIZATION,
            card: card,
        })
        await this.atmOperationRepository.save(atmOperation);

        return {
            sessionToken: accessToken,
            cardholderName: card.cardholderName,
            expiresIn: 180,
        };
    }

    async getBalance(accountId: string, cardId: string) {
        const account = await this.accountRepository.findOne({
            where: {
                id: accountId
            },
        });

        if(!account) {
            throw new NotFoundException('Account not found');
        }


        const atmOperation = this.atmOperationRepository.create({
            type: AtmOperationType.BALANCE_CHECK,
            currency: account.currency,
            card: {id: cardId},
        });
        await this.atmOperationRepository.save(atmOperation);

        return {
            balance: account.balance,
            currency: account.currency,
            accountIban: account.iban
        };
    }

    async withdraw(cardId: string, accountId: string, dto: WithdrawDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const account = await queryRunner.manager.createQueryBuilder(Account, 'account')
                                                    .where('account.id = :id', { id: accountId })
                                                    .setLock('pessimistic_write')
                                                    .getOne();

            if(!account) {
                throw new NotFoundException('Account not found');
            }

            const commission = this.commissionService.calculateAtmCommission(dto.amount);
            const totalAmountRequested = dto.amount + commission;

            let amountToDeductFromAccount = totalAmountRequested;
            if(dto.currency !== account.currency) {
                amountToDeductFromAccount = await this.exchangeRateService.convert(
                    totalAmountRequested,
                    dto.currency,
                    account.currency
                );
            }
            amountToDeductFromAccount = Math.round(amountToDeductFromAccount * 100) / 100;

            if(Number(account.balance) < amountToDeductFromAccount) {
                throw new BadRequestException('Insufficient balance');
            }


            await this.checkDailyLimit(cardId, dto.amount, dto.currency);

            account.balance = Number(account.balance) - amountToDeductFromAccount;
            await queryRunner.manager.save(Account, account);

            const atmOperation = queryRunner.manager.create(AtmOperation, {
                type: AtmOperationType.WITHDRAW,
                amount: dto.amount,
                commission: commission,
                currency: dto.currency,
                card: { id: cardId },
            });
            await queryRunner.manager.save(atmOperation);

            await queryRunner.commitTransaction();

            return {
                message: 'Withdrawal successful',
                amount: dto.amount,
                currency: dto.currency,
                commission: commission,
                totalDeducted: totalAmountRequested,
                newAccountBalance: account.balance,
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private async checkDailyLimit(
        cardId: string, 
        amount: number, 
        currency: Currency
    ): Promise<void> {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const recentWithdrawals = await this.atmOperationRepository.find({
            where: {
                card: { id: cardId },
                type: AtmOperationType.WITHDRAW,
                createdAt: MoreThan(twentyFourHoursAgo),
            },
        });

        let totalWithdrawnInGel = 0;
        for (const op of recentWithdrawals) {
            if(!op.amount) continue;
            
            let amountInGel = Number(op.amount);
            if(op.currency !== Currency.GEL) {
                amountInGel = await this.exchangeRateService.convert(
                    Number(op.amount),
                    op.currency,
                    Currency.GEL
                );
            }
            totalWithdrawnInGel += amountInGel;
        }

        let currentWithdrawalInGel = amount;
        if(currency !== Currency.GEL) {
            currentWithdrawalInGel = await this.exchangeRateService.convert(
                amount,
                currency,
                Currency.GEL
            );
        }

        const dailyLimit = Number(
            this.configService.get('ATM_DAILY_LIMIT_GEL')
        ) || 10000;
        
        if(totalWithdrawnInGel + currentWithdrawalInGel > dailyLimit) {
            throw new BadRequestException(
                `Daily withdrawal limit exceeded. Attempted to withdraw ${amount.toFixed(2)} ${currency}. ` +
                `Limit: ${dailyLimit} GEL. ` +
                `Already withdrawn today: ${totalWithdrawnInGel.toFixed(2)} GEL. ` +
                `Remaining limit: ${(dailyLimit - totalWithdrawnInGel).toFixed(2)} GEL.`
            );
        }
    }

    async changePin(cardId: string, dto: ChangePinDto) {
        const card = await this.cardRepository.findOne({
            where: {id: cardId},
        });

        if(!card) {
            throw new NotFoundException('card not found');
        }

        const hashedPin = await this.cryptoService.hashPin(dto.newPin);

        card.pin = hashedPin;
        await this.cardRepository.save(card);

        const atmOperation = this.atmOperationRepository.create({
            type: AtmOperationType.PIN_CHANGE,
            card: card,
        });
        await this.atmOperationRepository.save(atmOperation);

        return {
            message: 'PIN changed successfully',
        }
    }
}