import { Body, Controller, Post } from "@nestjs/common";
import { CardService } from "./services/card.service";
import { CreateCardDto } from "./dto/create-card.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./services/user.service";
import { AccountService } from "./services/account.service";
import { CreateAccountDto } from "./dto/create-account.dto";

@Controller('operator')
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