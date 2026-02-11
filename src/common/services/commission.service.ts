import { Injectable } from "@nestjs/common";


@Injectable()
export class CommissionService{
    private readonly OTHER_TRANSFER_RATE = 0.01;
    private readonly ATM_WITHDRAWAL_RATE = 0.01;

    calculateTransferOther(amount: number): {
        commission: number;
        rate: number;
    } {
        const rate = this.OTHER_TRANSFER_RATE;
        const commission = amount * rate;
        return {
            commission,
            rate
        };
    }

    calculateAtmCommission(amount: number) {
        const rate = this.ATM_WITHDRAWAL_RATE;
        const commission = amount * rate;
        return commission;
    }
}