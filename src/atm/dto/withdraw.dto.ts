import { IsEnum, IsNumber, Min } from "class-validator";
import { Currency } from "../../database/enums";

export class WithdrawDto{
    @IsNumber()
    @Min(1)
    amount: number;

    @IsEnum(Currency)
    currency: Currency;
}