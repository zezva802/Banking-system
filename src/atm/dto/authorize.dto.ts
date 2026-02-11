import { IsString, Length, Matches } from "class-validator";

export class AuthorizeDto{
    @IsString()
    @Length(16, 16)
    @Matches(/^\d{16}$/, { message: 'Card number must be 16 digits' })
    cardNumber: string;

    @IsString()
    @Length(4,4)
    @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
    pin: string;
}