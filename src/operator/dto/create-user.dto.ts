import { IsDateString, IsEmail, IsString, Length, Matches } from "class-validator";

export class CreateUserDto {
    @IsString()
    @Length(2, 50)
    @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Name must contain only letters' })
    name: string;

    @IsString()
    @Length(2, 50)
    @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Surname must contain only letters' })
    surname: string;

    @IsString()
    @Length(11, 11)
    @Matches(/^\d{11}$/, { message: 'Private number must be exactly 11 digits' })
    privateNumber: string;

    @IsDateString()
    dateOfBirth: Date;

    @IsEmail()
    email: string;

    @IsString()
    @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
        message: 'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character'
    })
    password: string;
}