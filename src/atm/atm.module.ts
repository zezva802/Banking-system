import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonModule } from "../common/common.module";
import { Account } from "../database/entities/account.entity";
import { AtmOperation } from "../database/entities/atmOperation.entity";
import { Card } from "../database/entities/card.entity";
import { AtmController } from "./atm.controller";
import { AtmService } from "./atm.service";
import { AtmJwtStrategy } from "./strategies/atm-jwt.strategy";

@Module({
    imports: [
        TypeOrmModule.forFeature([Card, Account, AtmOperation]),
        CommonModule,
        PassportModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.getOrThrow('JWT_SECRET'),
            })
        })
    ],
    controllers: [AtmController],
    providers: [AtmService, AtmJwtStrategy],
    exports: [AtmService],
})
export class AtmModule {}