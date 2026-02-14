import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { ExchangeRateService } from "../../common/services/exchange-rate.service";
import { AtmOperation } from "../../database/entities/atmOperation.entity";
import { Transaction } from "../../database/entities/transaction.entity";
import { User } from "../../database/entities/user.entity";
import { AtmOperationType, Currency, TransactionStatus } from "../../database/enums";
import { Between, DataSource, MoreThanOrEqual, Repository } from "typeorm";

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>,
        @InjectRepository(AtmOperation)
        private atmOperationRepository: Repository<AtmOperation>,
        private dataSource: DataSource,
        private exchangeRateService: ExchangeRateService,
        private configService: ConfigService,
    ) {}

    async getUserStatistics() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const lastYear = currentYear - 1;

        const startOfCurrentYear = new Date(currentYear, 0, 1);
        const endOfCurrentYear = new Date(currentYear, 11, 31, 23, 59, 59);
        const usersThisYear = await this.userRepository.count({
            where: {
                createdAt: Between(startOfCurrentYear, endOfCurrentYear),
            },
        });

        const startOfLastYear = new Date(lastYear, 0, 1);
        const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59);
        const usersLastYear = await this.userRepository.count({
            where: {
                createdAt: Between(startOfLastYear, endOfLastYear),
            },
        });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const usersLast30Days = await this.userRepository.count({
            where: {
                createdAt: MoreThanOrEqual(thirtyDaysAgo),
            },
        });

        return {
            usersRegisteredThisYear: usersThisYear,
            usersRegisteredLastYear: usersLastYear,
            usersRegisteredLast30Days: usersLast30Days,
        };
    }

    async getTransactionStatistics() {
        const today = new Date();

        const getDateRange = (monthsAgo: number) => {
            const date = new Date();
            date.setMonth(today.getMonth() - monthsAgo);
            date.setDate(1);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        const oneMonthAgo = getDateRange(1);
        const sixMonthsAgo = getDateRange(6);
        const oneYearAgo = getDateRange(12);

        const transactionsLastMonthCount = await this.transactionRepository.count({
            where: {
                createdAt: MoreThanOrEqual(oneMonthAgo),
                status: TransactionStatus.COMPLETED,
            },
        });

        const transactionsLast6MonthsCount = await this.transactionRepository.count({
            where: {
                createdAt: MoreThanOrEqual(sixMonthsAgo),
                status: TransactionStatus.COMPLETED,
            },
        });

        const transactionsLastYearCount = await this.transactionRepository.count({
            where: {
                createdAt: MoreThanOrEqual(oneYearAgo),
                status: TransactionStatus.COMPLETED,
            },
        });

        const allCompletedTransactions = await this.transactionRepository.find({
            where: {
                createdAt: MoreThanOrEqual(oneYearAgo),
                status: TransactionStatus.COMPLETED,
                commission: MoreThanOrEqual(0.01),
            },
        });

        const allAtmWithdrawals = await this.atmOperationRepository.find({
            where: {
                type: AtmOperationType.WITHDRAW,
                createdAt: MoreThanOrEqual(oneYearAgo),
                commission: MoreThanOrEqual(0.01)
            }
        });

        const calculateTotalCommission = async (targetCurrency: Currency) => {
            let total = 0;

            for(const tx of allCompletedTransactions) {
                if(!tx.commission || Number(tx.commission) <= 0) continue;

                let commissionInTargetCurrency = Number(tx.commission);
                if(tx.currency !== targetCurrency) {
                    commissionInTargetCurrency = await this.exchangeRateService.convert(
                        Number(tx.commission),
                        tx.currency,
                        targetCurrency,
                        tx.createdAt
                    );
                }
                total += commissionInTargetCurrency;
            }

            for (const atmOp of allAtmWithdrawals) {
                if(!atmOp.commission || Number(atmOp.commission) <= 0) continue;

                let commissionInTargetCurrency = Number(atmOp.commission);
                if(atmOp.currency !== targetCurrency) {
                    commissionInTargetCurrency = await this.exchangeRateService.convert(
                        Number(atmOp.commission),
                        atmOp.currency,
                        targetCurrency,
                        atmOp.createdAt
                    );
                }
                total += commissionInTargetCurrency;
            }
            return Math.round(total * 100) / 100;
        };
            const totalCommissionGEL = await calculateTotalCommission(Currency.GEL);
            const totalCommissionUSD = await calculateTotalCommission(Currency.USD);
            const totalCommissionEUR = await calculateTotalCommission(Currency.EUR);

            const totalCountForAvg = allCompletedTransactions.length + allAtmWithdrawals.length;

            const averageCommissionGEL = totalCountForAvg > 0 ? (totalCommissionGEL / totalCountForAvg) : 0;
            const averageCommissionUSD = totalCountForAvg > 0 ? (totalCommissionUSD / totalCountForAvg) : 0;
            const averageCommissionEUR = totalCountForAvg > 0 ? (totalCommissionEUR / totalCountForAvg) : 0;

            const transactionsLastMonthByDay: {date: string; count: number}[] = [];
            const dateMap: {[key: string]: number } = {};

            const rawDailyTransactions = await this.transactionRepository
                                        .createQueryBuilder('transaction')
                                        .select("DATE_TRUNC('day', transaction.createdAt)", 'day')
                                        .addSelect('COUNT(transaction.id)', 'count')
                                        .where('transaction.createdAt >= :oneMonthAgo', {oneMonthAgo})
                                        .andWhere('transaction.status = :status', {status: TransactionStatus.COMPLETED})
                                        .groupBy('day')
                                        .orderBy('day', 'ASC')
                                        .getRawMany();
            
            const rawDailyAtmOperations = await this.atmOperationRepository
                                        .createQueryBuilder('atmOperation')
                                        .select("DATE_TRUNC('day', atmOperation.createdAt)", 'day')
                                        .addSelect('COUNT(atmOperation.id)', 'count')
                                        .where('atmOperation.createdAt >= :oneMonthAgo', { oneMonthAgo })
                                        .andWhere('atmOperation.type = :type', { type: AtmOperationType.WITHDRAW })
                                        .groupBy('day')
                                        .orderBy('day', 'ASC')
                                        .getRawMany();
            
            [...rawDailyTransactions, ...rawDailyAtmOperations].forEach(row => {
                const date = new Date(row.day).toISOString().split('T')[0];
                dateMap[date] = (dateMap[date] || 0) + Number(row.count);
            });

            let currentDay = new Date(oneMonthAgo);
            while(currentDay <= today) {
                const dateString = currentDay.toISOString().split('T')[0];
                transactionsLastMonthByDay.push({date: dateString, count: dateMap[dateString] || 0});
                currentDay.setDate(currentDay.getDate() + 1);
            }

            const totalAtmWithdrawals = await this.atmOperationRepository.find({
                where: {
                    type: AtmOperationType.WITHDRAW,
                    createdAt: MoreThanOrEqual(oneYearAgo),
                },
            });

            const calculateTotalWithdrawals = async (targetCurrency: Currency) => {
                let total = 0;
                for (const atmOp of totalAtmWithdrawals) {
                    if(!atmOp.amount) continue;
                    let amountInTargetCurrency = Number(atmOp.amount);
                    if(atmOp.currency !== targetCurrency) {
                        amountInTargetCurrency = await this.exchangeRateService.convert(
                            Number(atmOp.amount),
                            atmOp.currency,
                            targetCurrency,
                            atmOp.createdAt
                        );
                    }
                    total += amountInTargetCurrency;
                }
                return Math.round(total * 100) / 100;
            };

            const totalWithdrawalsGEL = await calculateTotalWithdrawals(Currency.GEL);
            const totalWithdrawalsUSD = await calculateTotalWithdrawals(Currency.USD);
            const totalWithdrawalsEUR = await calculateTotalWithdrawals(Currency.EUR);

            return {
                transactionsCount: {
                    lastMonth: transactionsLastMonthCount,
                    last6Months: transactionsLast6MonthsCount,
                    lastYear: transactionsLastYearCount,
                },
                totalCommissionIncome: {
                    GEL: totalCommissionGEL,
                    USD: totalCommissionUSD,
                    EUR: totalCommissionEUR,
                },
                averageCommissionPerTransaction: {
                    GEL: Math.round(averageCommissionGEL * 100) / 100,
                    USD: Math.round(averageCommissionUSD * 100) / 100,
                    EUR: Math.round(averageCommissionEUR * 100) / 100,
                },
                transactionsPerDayLastMonth: transactionsLastMonthByDay,
                totalAtmWithdrawalAmount: {
                    GEL: totalWithdrawalsGEL,
                    USD: totalWithdrawalsUSD,
                    EUR: totalWithdrawalsEUR,
                },
            };
        }
    }
