import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Account } from "./account.entity";
import { AtmOperation } from "./atmOperation.entity";
import { Exclude } from "class-transformer";

@Entity('cards')
export class Card{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({length: 16, unique:true})
    cardNumber: string;

    @Column()
    cardholderName: string;

    @Column()
    expirationMonth: number;

    @Column()
    expirationYear: number;

    @Column({length: 60})
    @Exclude()
    pin: string;

    @ManyToOne(()=> Account, account => account.cards, {nullable: false})
    account: Account;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;

    @OneToMany(() => AtmOperation, operation => operation.card)
    atmOperations: AtmOperation[];
}