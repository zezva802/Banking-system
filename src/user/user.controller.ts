import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { TransferOwnDto } from "./dto/transfer-own.dto";
import { TransferOtherDto } from "./dto/transfer-other.dto";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { UserRole } from "src/database/enums";
import { UserService } from "./services/user.service";


@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
export class UserController{
    constructor(
        private readonly userService: UserService
    ) {}

    @Get('accounts')
    async getAccounts(@CurrentUser() user: {id: string}){
        return await this.userService.getUserAccounts(user.id);
    }

    @Get('cards')
    async getCards(@CurrentUser() user: {id: string}){
        return await this.userService.getUserCards(user.id);
    }

    @Post('transfer/own')
    async transferOwn(
        @CurrentUser() user: {id: string},
        @Body() transferOwnDto: TransferOwnDto
    ){
        return await this.userService.transferOwn(user.id, transferOwnDto);
    }

    @Post('transfer/other')
    async transferOther(
        @CurrentUser() user: {id: string},
        @Body() transferOtherDto: TransferOtherDto
    ){
        return await this.userService.transferOther(user.id, transferOtherDto);
    }
}