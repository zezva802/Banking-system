import { Module } from "@nestjs/common";
import { CryptoService } from "./services/crypto.service";
import { CardValidatorService } from "./services/card-validator.service";
import { IbanValidatorService } from "./services/iban-validator.service";
import { ExchangeRateService } from "./services/exchange-rate.service";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports:[ConfigModule],
    providers:[CryptoService, CardValidatorService, IbanValidatorService, ExchangeRateService],
    exports:[CryptoService, CardValidatorService, IbanValidatorService, ExchangeRateService]
})
export class CommonModule {}