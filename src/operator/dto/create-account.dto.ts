import { IsNumber, IsUUID, IsEnum, IsOptional, IsString } from "class-validator";
import { Currency } from "../../database/enums";

export class CreateAccountDto {
    @IsUUID()
    userId: string;

    @IsOptional()
    @IsString()
    iban?: string;

    @IsOptional()
    @IsNumber()
    initialBalance?: number;

    @IsEnum(Currency)
    currency: Currency;
}