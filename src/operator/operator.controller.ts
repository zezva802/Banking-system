import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CardService } from "./services/card.service";
import { CreateCardDto } from "./dto/create-card.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./services/user.service";
import { AccountService } from "./services/account.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { UserRole } from "src/database/enums";

@Controller('operator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR)
export class OperatorController {
    constructor(
        private readonly cardService: CardService,
        private readonly userService: UsersService,
        private readonly accountService: AccountService
    ){}

    @Post('cards')
    async createCard(@Body() createCardDto: CreateCardDto ){
        return this.cardService.createCard(
            createCardDto.accountId,
            createCardDto.pin
        )
    }

    @Post('users')
    async createUser(@Body() createUserDto: CreateUserDto){
        return this.userService.createUser(createUserDto);
    }

    @Post('accounts')
    async createAccount(@Body() createAccountDto: CreateAccountDto) {
        return this.accountService.createAccount(createAccountDto);
    }
}