import { IsUUID, IsString, IsNumber, Min, IsEnum } from "class-validator";
import { Currency } from "src/database/enums";

export class TransferOtherDto {
    @IsUUID()
    fromAccountId: string;

    @IsString()
    receiverIban: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsEnum(Currency)
    currency: Currency;
}