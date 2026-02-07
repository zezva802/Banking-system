import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ExchangeRateService } from './common/services/exchange-rate.service';
import { Currency } from './database/enums';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private exchangeRateService: ExchangeRateService) {}

  @Get('test-exchange')
  async testExchange(
    @Query('amount') amount: string,
    @Query('from') from: Currency,
    @Query('to') to: Currency,
  ) {
    const amountNum = parseFloat(amount);
    const rate = await this.exchangeRateService.getRate(from, to);
    const converted = await this.exchangeRateService.convert(amountNum, from, to);

    return {
      amount: amountNum,
      from,
      to,
      rate,
      converted,
      example: `${amountNum} ${from} = ${converted} ${to}`,
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

}
