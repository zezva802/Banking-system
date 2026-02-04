import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CryptoService } from "src/common/services/crypto.service";
import { Account } from "src/database/entities/account.entity";
import { Card } from "src/database/entities/card.entity";
import { Repository } from "typeorm";

@Injectable()
export class CardService {
    constructor(
        @InjectRepository(Card)
        private cardRepository: Repository<Card>,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private readonly cryptoService: CryptoService
    ) {}

    private async generateUniqueCardNumber(): Promise<string> {
        const count = await this.cardRepository.count();
        const newNumber = (4169738800000000 + count + 1).toString();
        return newNumber;
    }

    async createCard(accountId: string, pin: string) {
        const account = await this.accountRepository.findOne({
            where: {
                id: accountId,
            },
            relations: {
                user: true,
            }
        });

        if(!account) {
            throw new NotFoundException('Account not found')
        }

        const cardNumber = await this.generateUniqueCardNumber();

        const hashedPin = await this.cryptoService.hashPin(pin);

        const cardholderName = `${account.user.name} ${account.user.surname}`;

        const today = new Date();
        
        const expirationMonth = today.getMonth() + 1;

        const expirationYear = today.getFullYear() + 3;
        
        const card = this.cardRepository.create({
            cardNumber,
            cardholderName,
            expirationMonth,
            expirationYear,
            pin: hashedPin,
            account,
        });

        await this.cardRepository.save(card);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {pin:_pin, ...safeCard} = card;

        return safeCard;

    }
}