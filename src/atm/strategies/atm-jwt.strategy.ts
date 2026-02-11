import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AtmJwtStrategy extends PassportStrategy(Strategy, 'atm-jwt') {
    constructor(private configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow('JWT_SECRET'),
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validate(payload: any) {
        if(payload.type !== 'atm_session') {
            throw new UnauthorizedException('Invalid ATM session token');
        }

        if(!payload.cardId || !payload.accountId) {
            throw new UnauthorizedException('Invalid token payload');
        }

        return {
            cardId: payload.cardId,
            accountId: payload.accountId
        };
    }
}