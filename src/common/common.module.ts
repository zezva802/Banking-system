import { Module } from "@nestjs/common";
import { CryptoService } from "./services/crypto.service";
import { CardValidatorService } from "./services/card-validator.service";

@Module({
    providers:[CryptoService, CardValidatorService],
    exports:[CryptoService, CardValidatorService]
})
export class CommonModule {}