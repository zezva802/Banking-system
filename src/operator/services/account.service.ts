import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IbanValidatorService } from "src/common/services/iban-validator.service";
import { Account } from "src/database/entities/account.entity";
import { User } from "src/database/entities/user.entity";
import { Repository } from "typeorm";
import { CreateAccountDto } from "../dto/create-account.dto";

@Injectable()
export class AccountService{
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private ibanValidator: IbanValidatorService,
    ) {}

    async createAccount(createAccountDto:CreateAccountDto) {
        const user = await this.userRepository.findOne({
            where: {id: createAccountDto.userId}
        });

        if(!user) {
            throw new NotFoundException('User not found');
        }

        let iban: string;

        if(createAccountDto.iban){
            iban = this.ibanValidator.normalizeForStorage(createAccountDto.iban);

            if(!this.ibanValidator.validate(iban)) {
                throw new BadRequestException('Invalid IBAN format');
            }

            const existingAccount = await this.accountRepository.findOne({
                where: {iban},
            });

            if(existingAccount) {
                throw new ConflictException('IBAN already exists');
            }
        } else {
            iban = await this.ibanValidator.generate(this.accountRepository);
        }

        const account = this.accountRepository.create({
            user,
            iban,
            balance: createAccountDto.initialBalance ?? 0 ,
            currency: createAccountDto.currency
        });

        await this.accountRepository.save(account);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {user:_user , ...accountWithoutUser} = account;

        return accountWithoutUser;
    }
}