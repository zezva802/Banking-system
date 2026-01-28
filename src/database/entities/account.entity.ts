import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany} from "typeorm";
import { Transaction } from "./transaction.entity";
import { User } from "./user.entity";
import { Card } from "./card.entity";
import { Currency } from "../enums";

@Entity('accounts')
export class Account{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({unique: true})
    iban: string;

    @Column({type:'decimal', precision: 15, scale:2, default:0})
    balance: number;

    @Column({type:'enum', enum: Currency, enumName:'currency_enum', default: Currency.GEL})
    currency: Currency;

    @ManyToOne(()=>User, user => user.accounts, {nullable: false})
    user: User;

    @OneToMany(()=>Card, card => card.account)
    cards: Card[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;

    @OneToMany(() => Transaction, transaction => transaction.senderAccount)
    sentTransactions: Transaction[];

    @OneToMany(() => Transaction, transaction => transaction.receiverAccount)
    receivedTransactions: Transaction[];

}