import { Injectable } from "@nestjs/common";
import { Card } from "src/database/entities/card.entity";

@Injectable()
export class CardValidatorService{
    isExpired(card: Card): boolean {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        return (
            card.expirationYear < currentYear || 
            (card.expirationYear === currentYear && card.expirationMonth < currentMonth)
        );
    }

    isActive(card: Card): boolean {
        return !card.deletedAt && !this.isExpired(card);
    }
}