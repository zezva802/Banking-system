import { Controller, Post, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AtmService } from './atm.service';
import { AtmJwtAuthGuard } from './guards/atm-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthorizeDto } from './dto/authorize.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { ChangePinDto } from './dto/change-pin.dto';

@Controller('atm')
export class AtmController {
    constructor(private readonly atmService: AtmService) {}

    @Post('authorize')
    async authorize(@Body() authorizeDto: AuthorizeDto) {
        return await this.atmService.authorize(authorizeDto);
    }

    @Get('balance')
    @UseGuards(AtmJwtAuthGuard)
    async getBalance(@CurrentUser() user: { cardId: string; accountId: string }) {
        return await this.atmService.getBalance(user.accountId, user.cardId);
    }

    @Post('withdraw')
    @UseGuards(AtmJwtAuthGuard)
    async withdraw(
        @CurrentUser() user: { cardId: string; accountId: string },
        @Body() withdrawDto: WithdrawDto
    ) {
        return await this.atmService.withdraw(user.cardId, user.accountId, withdrawDto);
    }

    @Put('pin')
    @UseGuards(AtmJwtAuthGuard)
    async changePin(
        @CurrentUser() user: { cardId: string; accountId: string },
        @Body() changePinDto: ChangePinDto
    ) {
        return await this.atmService.changePin(user.cardId, changePinDto);
    }
}