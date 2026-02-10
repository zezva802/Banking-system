import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CryptoService } from "../../common/services/crypto.service";
import { Account } from "../../database/entities/account.entity";
import { Card } from "../../database/entities/card.entity";
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

    private generateCardNumber(): string {
        const prefix = '41697388';
        const random = Math.floor(Math.random() * 1e8)
                            .toString()
                            .padStart(8, '0');
        return prefix + random;
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

        const hashedPin = await this.cryptoService.hashPin(pin);

        const cardholderName = `${account.user.name} ${account.user.surname}`;

        const today = new Date();
        
        const expirationMonth = today.getMonth() + 1;

        const expirationYear = today.getFullYear() + 3;
        
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while(true) {
            try {
                const card = this.cardRepository.create({
                    cardNumber: this.generateCardNumber(),
                    cardholderName,
                    expirationMonth,
                    expirationYear,
                    pin: hashedPin,
                    account,
                });

                await this.cardRepository.save(card);

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const {pin: _pin, account: _account, ...safeCard} = card;

                return safeCard;
            } catch(err) {
                if (err.code !== '23505') {
                    throw err;
                }
            }
        }

    }
}