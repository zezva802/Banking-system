import { IsString, Length, Matches } from "class-validator";

export class ChangePinDto{
    @IsString()
    @Length(4,4)
    @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
    newPin: string;
}