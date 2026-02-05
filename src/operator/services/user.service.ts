import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CryptoService } from "src/common/services/crypto.service";
import { User } from "src/database/entities/user.entity";
import { Repository } from "typeorm";
import { CreateUserDto } from "../dto/create-user.dto";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private cryptoService: CryptoService,
    ) {}

    async createUser(createUserDto: CreateUserDto){
        const emailExists = await this.userRepository.findOneBy({
            email: createUserDto.email
        })

        if(emailExists){
            throw new ConflictException('Email already exists');
        }

        const numberExists = await this.userRepository.findOneBy({
           privateNumber : createUserDto.privateNumber
        });

        if(numberExists) {
            throw new ConflictException('Number is already registered by different user');
        }
        const dateOfBirth = new Date(createUserDto.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dateOfBirth.getFullYear();
        const monthDifference = today.getMonth() - dateOfBirth.getMonth();

        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())) {
            age--;
        }

        if(age < 18) {
            throw new BadRequestException('Must be 18 years or older');
        }

        const hashedPassword = await this.cryptoService.hashPassword(createUserDto.password);

        const user = this.userRepository.create({
            name: createUserDto.name,
            surname: createUserDto.surname,
            privateNumber: createUserDto.privateNumber,
            dateOfBirth: createUserDto.dateOfBirth,
            email: createUserDto.email,
            password: hashedPassword,
        });
        await this.userRepository.save(user);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {password , ...safeUser} = user; 

        return safeUser;
    }
}