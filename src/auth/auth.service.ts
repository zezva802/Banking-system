import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { CryptoService } from "../common/services/crypto.service";
import { User } from "../database/entities/user.entity";
import { Repository } from "typeorm";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
        private cryptoService: CryptoService,
        private configService: ConfigService,
    ) {}

    async login(loginDto: LoginDto){
        const user = await this.userRepository.findOne({
            where: {email: loginDto.email}
        });

        if(!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await this.cryptoService.comparePassword( loginDto.password, user.password);

        if(!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if(user.deletedAt) {
            throw new UnauthorizedException('Account has been deactivated');
        }

        const expiresIn = user.role === 'operator'
                            ? this.configService.get('JWT_OPERATOR_EXPIRATION')
                            : this.configService.get('JWT_EXPIRATION');

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role
        };

        const accessToken = this.jwtService.sign(payload, {
            expiresIn,
        });

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                surname: user.surname,
                role: user.role,
            }
        };
    }

    async validateUser(userId: string): Promise<User|null> {
        const user = await this.userRepository.findOne({
            where: {id: userId},
        });

        if(user?.deletedAt) {
            return null;
        }

        return user;
    }
}