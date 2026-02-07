import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Currency } from "src/database/enums";

@Injectable()
export class ExchangeRateService{
    private readonly logger = new Logger(ExchangeRateService.name);
    private readonly apiKey: string;
    private readonly apiUrl: string;

    private rateCache: Map<string, {rate: number; timestamp: number}> = new Map();
    private readonly CACHE_TTL = 3600000;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.getOrThrow('EXCHANGE_RATE_API_KEY');
        this.apiUrl = this.configService.getOrThrow('EXCHANGE_RATE_API_URL');
    }

    async getRate(from: Currency, to: Currency): Promise<number> {
        if(from === to) {
            return 1;
        }

        const cacheKey = `${from}_${to}`;
        const cached = this.rateCache.get(cacheKey);

        if(cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            this.logger.log(`Using cached rate for ${from} => ${to}: ${cached.rate}`);
            return cached.rate;
        }

        try{
            const url = `${this.apiUrl}/${this.apiKey}/pair/${from}/${to}`;
            this.logger.log(`Fetching exchange rate: ${from} => ${to}`);

            const response = await fetch(url);

            if(!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const data = await response.json();

            if(data.result !== 'success') {
                throw new Error(`API error: ${data['error-type']}`);
            }

            const rate = data.conversion_rate;

            this.rateCache.set(cacheKey, {rate, timestamp: Date.now() });
            this.logger.log(`Fetched rate ${from} => ${to}: ${rate}`);

            return rate;
        } catch(error){
            this.logger.error(`Failed to fetch exchange rate: ${error.message}`);
            throw new HttpException(
                'Unable to fetch exchange rates. Please try again later.',
                503
            )
        }
    }

    async convert(amount: number, from: Currency, to: Currency): Promise<number> {
        const rate = await this.getRate(from, to);
        const converted = amount * rate;

        return Math.round(converted * 100) / 100;
    }

    clearCache(): void {
        this.rateCache.clear();
        this.logger.log('Exchange rate cache cleared');
    }
}