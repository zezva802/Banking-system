import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Account} from "./account.entity";
import { TransactionStatus, TransactionType, Currency } from "../enums";



@Entity('transactions')
export class Transaction{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'decimal', precision: 15, scale: 2, nullable: false})
    amount: number;

    @Column({type: 'enum', enum: Currency, enumName: 'currency_enum', default: Currency.GEL})
    currency: Currency;

    @Column({type: 'decimal', precision: 15, scale: 2, default: 0})
    commission: number;

    @Column({type: 'enum', enum:TransactionType})
    transactionType: TransactionType;

    @Column({type: 'enum', enum: TransactionStatus, default:TransactionStatus.PENDING})
    status: TransactionStatus;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Account, account => account.sentTransactions, {nullable: false})
    senderAccount: Account;

    @ManyToOne(() => Account, account => account.receivedTransactions, {nullable: false})
    receiverAccount: Account;
}