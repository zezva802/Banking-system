import { Module } from "@nestjs/common";
import { CryptoService } from "./services/crypto.service";
import { CardValidatorService } from "./services/card-validator.service";
import { IbanValidatorService } from "./services/iban-validator.service";

@Module({
    providers:[CryptoService, CardValidatorService, IbanValidatorService],
    exports:[CryptoService, CardValidatorService, IbanValidatorService]
})
export class CommonModule {}