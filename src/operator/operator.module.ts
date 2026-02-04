import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonModule } from "src/common/common.module";
import { Account} from "src/database/entities/account.entity";
import { Card } from "src/database/entities/card.entity";
import { CardService } from "./services/card.service";
import { Module } from "@nestjs/common";
import { OperatorController } from "./operator.controller";

@Module({
    imports: [
        TypeOrmModule.forFeature([Card, Account]),
        CommonModule,
    ],
    controllers:[OperatorController],
    providers: [CardService],
    exports: [CardService],
})
export class OperatorModule {}