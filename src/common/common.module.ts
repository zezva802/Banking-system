import { Module } from "@nestjs/common";
import { CryptoService } from "./services/crypto.service";
import { CardValidatorService } from "./services/card-validator.service";
import { IbanValidatorService } from "./services/iban-validator.service";
import { ExchangeRateService } from "./services/exchange-rate.service";
import { ConfigModule } from "@nestjs/config";
import { CommissionService } from "./services/commission.service";

@Module({
    imports:[ConfigModule],
    providers:[CryptoService, CardValidatorService, IbanValidatorService, ExchangeRateService, CommissionService],
    exports:[CryptoService, CardValidatorService, IbanValidatorService, ExchangeRateService, CommissionService],
})
export class CommonModule {}