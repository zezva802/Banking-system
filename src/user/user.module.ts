import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../database/entities/account.entity";
import { Card } from "../database/entities/card.entity";
import { Transaction } from "../database/entities/transaction.entity";
import { UserController } from "./user.controller";
import { UserService } from "./services/user.service";
import { CommonModule } from "../common/common.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([Account, Card, Transaction]),
        CommonModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule{}