import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ExchangeRateService } from "../../common/services/exchange-rate.service";
import { Account } from "../../database/entities/account.entity";
import { Card } from "../../database/entities/card.entity";
import { DataSource, Repository} from "typeorm";
import { Transaction } from "../../database/entities/transaction.entity";
import { TransferOwnDto } from "../dto/transfer-own.dto";
import { TransactionType, TransactionStatus} from "../../database/enums";
import { TransferOtherDto } from "../dto/transfer-other.dto";
import { CommissionService } from "../../common/services/commission.service";

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

        return cards.map((card) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { pin, ...safeCard } = card;
            return safeCard;
        });
    }

    async transferOwn(userId: string, dto: TransferOwnDto) {
        if (dto.fromAccountId === dto.toAccountId) {
            throw new BadRequestException('Cannot transfer to the same account');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        const transaction = await this.transactionRepository.save({
            amount: dto.amount,
            currency: dto.currency,
            commission: 0,
            transactionType: TransactionType.OWN_ACCOUNT,
            status: TransactionStatus.PENDING,
            senderAccount: { id: dto.fromAccountId },
            receiverAccount: { id: dto.toAccountId },
        });


        await queryRunner.startTransaction();

        try {
            const from = await queryRunner.manager.createQueryBuilder(Account, 'account')
                                                    .innerJoinAndSelect('account.user', 'user')
                                                    .where('account.id = :id', {id: dto.fromAccountId})
                                                    .setLock('pessimistic_write')
                                                    .getOne();

            if (!from) {
                throw new NotFoundException('Sender account not found');
            }

            if (from.user.id !== userId) {
                throw new ForbiddenException('You can only transfer from your own accounts');
            }


            const to = await queryRunner.manager.createQueryBuilder(Account, 'account')
                                                .innerJoinAndSelect('account.user', 'user')
                                                .where('account.id = :id', {id: dto.toAccountId})
                                                .setLock('pessimistic_write')
                                                .getOne();
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


            from.balance = Number(from.balance) - amountToDeduct;
            to.balance = Number(to.balance) + amountToAdd;

            await queryRunner.manager.save(Account, from);
            await queryRunner.manager.save(Account, to);


            await queryRunner.commitTransaction();


            await this.transactionRepository.update(transaction.id, {
                status: TransactionStatus.COMPLETED,
            });


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

            await this.transactionRepository.update(transaction.id, {
                status: TransactionStatus.FAILED,
            });

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async transferOther(userId: string, dto: TransferOtherDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        const receiver = await this.accountRepository.findOne({
            where: {iban: dto.receiverIban}
        });
        if(!receiver){
            throw new NotFoundException('receiver account not found');
        }

        const sender = await this.accountRepository.findOne({
            where: {id: dto.fromAccountId}
        });
        if(!sender){
            throw new NotFoundException('receiver account not found');
        }

        let amountToDeduct = dto.amount;

        if(dto.currency !== sender.currency) {
            amountToDeduct = await this.exchangeRateService.convert(
                dto.amount,
                dto.currency,
                sender.currency,
            );
        }

        const initialCommissionCalc = this.commissionService.calculateTransferOther(amountToDeduct);

        const transaction = await this.transactionRepository.save({
            amount: dto.amount,
            currency: dto.currency,
            commission: initialCommissionCalc.commission,
            commissionRate: initialCommissionCalc.rate,
            transactionType: TransactionType.OTHER_ACCOUNT,
            status: TransactionStatus.PENDING,
            senderAccount: { id: dto.fromAccountId },
            receiverAccount: { id: receiver.id },
        });

        await queryRunner.startTransaction();
        

        try {
            const from = await queryRunner.manager.createQueryBuilder(Account, 'account')
                                                    .innerJoinAndSelect('account.user', 'user')
                                                    .where('account.id = :id', {id: dto.fromAccountId})
                                                    .setLock('pessimistic_write')
                                                    .getOne();

            if(!from) {
                throw new NotFoundException('Sender account not found');
            }

            if(from.user.id !== userId) {
                throw new ForbiddenException('You can only transfer from your own accounts');
            }

            const to = await queryRunner.manager.createQueryBuilder(Account, 'account')
                                                .innerJoinAndSelect('account.user', 'user')
                                                .where('account.iban = :iban', {iban: dto.receiverIban})
                                                .setLock('pessimistic_write')
                                                .getOne();

            if(!to){
                throw new NotFoundException('receiver account not found');
            }

            if(to.user.id === userId) {
                throw new BadRequestException(
                    'Use transfer-own endpoint for transfers between your accounts',
                );
            }


            
            let amountToAdd = dto.amount;

            

            if(dto.currency !== to.currency) {
                amountToAdd = await this.exchangeRateService.convert(
                    dto.amount,
                    dto.currency,
                    to.currency,
                );
            }

            const {commission} = this.commissionService.calculateTransferOther(amountToDeduct);
            const totalDeduction = amountToDeduct + commission;

            if(Number(from.balance) < totalDeduction) {
                throw new BadRequestException('Insufficient balance');
            }


            from.balance = Number(from.balance) - totalDeduction;
            to.balance = Number(to.balance) + amountToAdd;

            await queryRunner.manager.save(Account, from);
            await queryRunner.manager.save(Account, to);

            await queryRunner.commitTransaction();

            await queryRunner.manager.update(Transaction, transaction.id, {
                status: TransactionStatus.COMPLETED,
            });

            return{
                message: 'Transfer completed successfully',
                transaction: {
                    id: transaction.id,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    commission: transaction.commission,
                    commissionRate: initialCommissionCalc.rate,
                    from: from.iban,
                    to: to.iban,
                    createdAt: transaction.createdAt,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            await this.transactionRepository.update(transaction.id, {
                status: TransactionStatus.FAILED,
            });

            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}