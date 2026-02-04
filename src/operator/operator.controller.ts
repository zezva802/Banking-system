import { Body, Controller, Post } from "@nestjs/common";
import { CardService } from "./services/card.service";
import { CreateCardDto } from "./dto/create-card.dto";

@Controller('operator')
export class OperatorController {
    constructor(private readonly cardService: CardService){}

    @Post('cards')
    async createCard(@Body() createCardDto: CreateCardDto ){
        return this.cardService.createCard(
            createCardDto.accountId,
            createCardDto.pin
        )
    }
}