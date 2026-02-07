import { IsEnum, IsNumber, IsUUID, Min } from "class-validator";
import { Currency } from "src/database/enums";

export class TransferOwnDto{
    @IsUUID()
    fromAccountId: string;

    @IsUUID()
    toAccountId: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsEnum(Currency)
    currency: Currency;
}