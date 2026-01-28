import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { Card } from "./card.entity";
import { AtmOperationType, Currency } from "../enums";

@Entity('atm_operations')
export class AtmOperation{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'enum', enum: AtmOperationType})
    type: AtmOperationType;

    @Column({type: 'decimal', precision: 15, scale: 2, nullable: true})
    amount: number;

    @Column({type: 'decimal', precision: 15, scale: 2, default: 0})
    commission: number;

    @Column({type: 'enum', enum: Currency, enumName: 'currency_enum', nullable: true})
    currency: Currency;

    @ManyToOne(() => Card, card => card.atmOperations, {
        nullable: false
    })
    card: Card;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    operationDate: Date;
}