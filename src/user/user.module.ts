import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "src/database/entities/account.entity";
import { Card } from "src/database/entities/card.entity";
import { Transaction } from "typeorm";
import { UserController } from "./user.controller";
import { UserService } from "./services/user.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([Account, Card, Transaction])
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule{}