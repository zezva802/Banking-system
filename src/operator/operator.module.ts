import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonModule } from "../common/common.module";
import { Account} from "../database/entities/account.entity";
import { Card } from "../database/entities/card.entity";
import { CardService } from "./services/card.service";
import { Module } from "@nestjs/common";
import { OperatorController } from "./operator.controller";
import { UsersService } from "./services/user.service";
import { AccountService } from "./services/account.service";
import { User } from "../database/entities/user.entity";

@Module({
    imports: [
        TypeOrmModule.forFeature([Card, Account, User ]),
        CommonModule,
    ],
    controllers:[OperatorController],
    providers: [CardService, UsersService, AccountService],
    exports: [CardService, UsersService, AccountService],
})
export class OperatorModule {}