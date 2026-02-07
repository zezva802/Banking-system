import { Injectable } from "@nestjs/common";
import { CountryCode, IBAN, IBANBuilder } from "ibankit";
import { Account } from "src/database/entities/account.entity";
import { Repository } from "typeorm";

@Injectable()
export class IbanValidatorService {
    private readonly COUNTRY_CODE = 'GE';
    private readonly BANK_CODE = 'NB';

    validate(iban: string): boolean {
        return IBAN.isValid(iban);
    }

    async generate(accountRepository: Repository<Account>): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
            const accountNumber = Math.floor(Math.random() * 1e16)
                                        .toString()
                                        .padStart(16, '0');
                                        
            const iban = new IBANBuilder()
                            .countryCode(CountryCode.GE)
                            .bankCode(this.BANK_CODE)
                            .accountNumber(accountNumber)
                            .build()
                            .toString();

            const exists = await accountRepository.exist({
                where: {iban},
            });

            if(!exists) {
                return iban
            }
        }
    }

    normalizeForStorage(iban: string): string {
        return iban.replace(/\s/g, '').toUpperCase();
    }
}