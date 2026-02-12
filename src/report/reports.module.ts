import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonModule } from "../common/common.module";
import { AtmOperation } from "../database/entities/atmOperation.entity";
import { Transaction } from "../database/entities/transaction.entity";
import { User } from "../database/entities/user.entity";
import { ReportsService } from "./services/reports.service";
import { ReportsController } from "./reports.controller";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([User, Transaction, AtmOperation]),
        CommonModule,
    ],
    controllers: [ReportsController],
    providers: [ReportsService],
    exports: [ReportsService],
})
export class ReportsModule {}