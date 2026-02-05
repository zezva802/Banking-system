import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonModule } from "src/common/common.module";
import { Account} from "src/database/entities/account.entity";
import { Card } from "src/database/entities/card.entity";
import { CardService } from "./services/card.service";
import { Module } from "@nestjs/common";
import { OperatorController } from "./operator.controller";
import { UsersService } from "./services/user.service";
import { AccountService } from "./services/account.service";
import { User } from "src/database/entities/user.entity";

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