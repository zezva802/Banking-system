import { Injectable } from "@nestjs/common";
import * as bcrypt from 'bcrypt';

@Injectable()
export class CryptoService{
    private readonly PASSWORD_SALT_ROUNDS = 12;
    private readonly PIN_SALT_ROUNDS = 10;

    async hashPassword(password: string): Promise<string>{
        return bcrypt.hash(password, this.PASSWORD_SALT_ROUNDS);
    }

    async comparePassword(password: string, hash: string): Promise<boolean>{
        return bcrypt.compare(password, hash);
    }

    async hashPin(pin: string): Promise<string>{
        return bcrypt.hash(pin, this.PIN_SALT_ROUNDS);
    }

    async comparePin(pin: string, hash: string): Promise<boolean>{
        return bcrypt.compare(pin, hash);
    }
}