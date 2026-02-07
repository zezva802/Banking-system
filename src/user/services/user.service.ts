import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ExchangeRateService } from "src/common/services/exchange-rate.service";
import { Account } from "src/database/entities/account.entity";
import { Card } from "src/database/entities/card.entity";
import { DataSource, Repository} from "typeorm";
import { Transaction } from "src/database/entities/transaction.entity";
import { TransferOwnDto } from "../dto/transfer-own.dto";
import { TransactionType, TransactionStatus} from "src/database/enums";
import { TransferOtherDto } from "../dto/transfer-other.dto";
import { CommissionService } from "src/common/services/commission.service";

@Injectable()
export class UserService{
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>,
        private exchangeRateService: ExchangeRateService,
        private dataSource: DataSource,
        private commissionService: CommissionService,
    ) {}

    async getUserAccounts(userId: string){
        const accounts = await this.accountRepository.find({
            where: {
                user: {
                    id: userId
                },
            },
            order: {
                createdAt: 'DESC'
            }
        });

        return accounts;

    }

    async getUserCards(userId: string){
        const cards = await this.cardRepository.find({
            relations: {
                account: true
            },
            where: {
                account: {
                    user: {
                        id: userId
                    }
                },
            },
            order: {
                createdAt: 'DESC',
            }
        });

        return cards;
    }

    async transferOwn(userId: string, dto: TransferOwnDto) {
        if (dto.fromAccountId === dto.toAccountId) {
            throw new BadRequestException('Cannot transfer to the same account');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let transactionId: string | null = null;

        try {
            const from = await queryRunner.manager.findOne(Account, {
                where: { id: dto.fromAccountId },
                relations: { user: true },
                lock: { mode: 'pessimistic_write' },
            });

            if (!from) {
                throw new NotFoundException('Sender account not found');
            }

            if (from.user.id !== userId) {
                throw new ForbiddenException('You can only transfer from your own accounts');
            }


            const to = await queryRunner.manager.findOne(Account, {
                where: { id: dto.toAccountId },
                relations: { user: true },
                lock: { mode: 'pessimistic_write' },
            });

            if (!to) {
                throw new NotFoundException('Receiver account not found');
            }

            if (to.user.id !== userId) {
                throw new BadRequestException(
                    'Use transfer-other endpoint for transfers to other users',
                );
            }


            let amountToDeduct = dto.amount;
            let amountToAdd = dto.amount;

            if (dto.currency !== from.currency) {
                amountToDeduct = await this.exchangeRateService.convert(
                    dto.amount,
                    dto.currency,
                    from.currency,
                );
            }

            if (dto.currency !== to.currency) {
                amountToAdd = await this.exchangeRateService.convert(
                    dto.amount,
                    dto.currency,
                    to.currency,
                );
            }


            if (Number(from.balance) < amountToDeduct) {
                throw new BadRequestException('Insufficient balance');
            }


            const transaction = queryRunner.manager.create(Transaction, {
                amount: dto.amount,
                currency: dto.currency,
                commission: 0,
                transactionType: TransactionType.OWN_ACCOUNT,
                status: TransactionStatus.PENDING,
                senderAccount: from,
                receiverAccount: to,
            });
            await queryRunner.manager.save(Transaction, transaction);
            transactionId = transaction.id;


            from.balance = Number(from.balance) - amountToDeduct;
            to.balance = Number(to.balance) + amountToAdd;

            await queryRunner.manager.save(Account, from);
            await queryRunner.manager.save(Account, to);


            await queryRunner.manager.update(Transaction, transaction.id, {
                status: TransactionStatus.COMPLETED,
            });

            await queryRunner.commitTransaction();


            return {
                message: 'Transfer completed successfully',
                transaction: {
                    id: transaction.id,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    commission: transaction.commission,
                    from: from.iban,
                    to: to.iban,
                    createdAt: transaction.createdAt,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if(transactionId) {
                await this.transactionRepository.update(transactionId, {
                    status: TransactionStatus.FAILED
                })
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async transferOther(userId: string, dto: TransferOtherDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        
        let transactionId: string | null = null;

        try {
            const from = await queryRunner.manager.findOne(Account, {
                where: {id: dto.fromAccountId},
                relations: { user: true },
                lock: {mode: 'pessimistic_write'},
            });

            if(!from) {
                throw new NotFoundException('Sender account not found');
            }

            if(from.user.id !== userId) {
                throw new ForbiddenException('You can only transfer from your own accounts');
            }

            const to = await queryRunner.manager.findOne(Account, {
                where: {iban: dto.receiverIban},
                relations: {user: true},
                lock: {mode: 'pessimistic_write'},
            });

            if(!to){
                throw new NotFoundException('receiver account not found');
            }

            if(to.user.id === userId) {
                throw new BadRequestException(
                    'Use transfer-own endpoint for transfers between your accounts',
                );
            }


            let amountToDeduct = dto.amount;
            let amountToAdd = dto.amount;

            if(dto.currency !== from.currency) {
                amountToDeduct = await this.exchangeRateService.convert(
                    dto.amount,
                    dto.currency,
                    from.currency,
                );
            }

            if(dto.currency !== to.currency) {
                amountToAdd = await this.exchangeRateService.convert(
                    dto.amount,
                    dto.currency,
                    from.currency,
                );
            }

            const {commission, rate} = this.commissionService.calculateTransferOther(amountToDeduct);
            const totalDeduction = amountToDeduct + commission;

            if(Number(from.balance) < totalDeduction) {
                throw new BadRequestException('Insufficient balance');
            }

            const transaction = queryRunner.manager.create(Transaction, {
                amount: dto.amount,
                currency: dto.currency,
                commission,
                commissionRate: rate,
                transactionType: TransactionType.OTHER_ACCOUNT,
                status: TransactionStatus.PENDING,
                senderAccount: from,
                receiverAccount: to,
            });

            await queryRunner.manager.save(Transaction, transaction);
            transactionId = transaction.id;

            from.balance = Number(from.balance) - totalDeduction;
            to.balance = Number(to.balance) + amountToAdd;

            await queryRunner.manager.save(Account, from);
            await queryRunner.manager.save(Account, to);

            await queryRunner.manager.update(Transaction, transaction.id, {
                status: TransactionStatus.COMPLETED,
            });

            await queryRunner.commitTransaction();

            return{
                message: 'Transfer completed successfully',
                transaction: {
                    id: transaction.id,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    commission: transaction.commission,
                    from: from.iban,
                    to: to.iban,
                    createdAt: transaction.createdAt,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if(transactionId) {
                await this.transactionRepository.update(transactionId, {
                    status: TransactionStatus.FAILED,
                });
            }

            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}