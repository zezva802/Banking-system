import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";


@Injectable()
export class AtmJwtAuthGuard extends AuthGuard('atm-jwt') {}