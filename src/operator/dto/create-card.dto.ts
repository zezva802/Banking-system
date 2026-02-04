import { IsString, IsUUID, Length, Matches } from "class-validator";

export class CreateCardDto {
    @IsUUID()
    accountId: string;

    @IsString()
    @Length(4,4)
    @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
    pin: string;
}