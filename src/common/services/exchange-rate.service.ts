import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Currency } from "../../database/enums";

@Injectable()
export class ExchangeRateService{
    private readonly logger = new Logger(ExchangeRateService.name);
    private readonly apiKey: string;
    private readonly apiUrl: string;

    private rateCache: Map<string, {rate: number; timestamp: number}> = new Map();
    private readonly CACHE_TTL = 3600000;

    private historicalRateCache: Map<string, {rate: number; timestamp: number}> = new Map();
    private readonly HISTORICAL_CACHE_TTL = 24 * 3600000;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.getOrThrow('EXCHANGE_RATE_API_KEY');
        this.apiUrl = this.configService.getOrThrow('EXCHANGE_RATE_API_URL');
    }

    async getRate(from: Currency, to: Currency, date? : Date): Promise<number> {
        if(from === to) {
            return 1;
        }

        const formattedDate = date ? date.toISOString().split('T')[0] : 'current';

        const cacheKey = `${from}_${to}_${formattedDate}`;
        const cache = date ? this.historicalRateCache : this.rateCache;
        const CACHE_TTL_TO_USE = date ? this.HISTORICAL_CACHE_TTL : this.CACHE_TTL;

        const cached = cache.get(cacheKey);

        if(cached && Date.now() - cached.timestamp < CACHE_TTL_TO_USE) {
            this.logger.log(`Using cached rate for ${from} => ${to} on ${formattedDate}: ${cached.rate}`);
            return cached.rate;
        }

        try{
            let url : string;

            if(date) {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const day = date.getDate();
                url = `${this.apiUrl}/${this.apiKey}/history/${from}/${year}/${month}/${day}`;
                this.logger.log(`Fetching historical exchange rate: ${from} => ${to} on ${formattedDate}`);
            } else {
                url = `${this.apiUrl}/${this.apiKey}/pair/${from}/${to}`;
                this.logger.log(`Fetching current exchange rate: ${from} => ${to}`);
            }


            const response = await fetch(url);

            if(!response.ok) {
                throw new Error(`API returned status ${response.status} for URL: ${url}`);
            }

            const data = await response.json();

            if(data.result !== 'success') {
                throw new Error(`API error: ${data['error-type']} for URL: ${url}`);
            }
            let rate: number;
            if(date) {
                rate = data.conversion_rates[to];
                if(rate === undefined) {
                    throw new Error(`Historical rate for target currency ${to} not found in response.`);
                }
            } else {
                rate = data.conversion_rate;
            }

            if(rate === undefined || rate === null) {
                throw new Error(`Exchange rate is undefined or null in API response for URL: ${url}`);
            }

            cache.set(cacheKey, {rate, timestamp: Date.now()});
            this.logger.log(`Fetched rate ${from} => ${to} on ${formattedDate}: ${rate}`);

            return rate;
        } catch(error){
            this.logger.error(`Failed to fetch exchange rate: ${error.message}`);

            if (error.message.includes('API returned status 404')) {
                throw new HttpException(
                    `Exchange rate data not available for ${from} to ${to} on ${formattedDate}.`,
                    404
                );
            }

            throw new HttpException(
                'Unable to fetch exchange rates. Please try again later.',
                503
            )
        }
    }

    async convert(amount: number, from: Currency, to: Currency, date?: Date): Promise<number> {
        const rate = await this.getRate(from, to, date);
        const converted = amount * rate;

        return Math.round(converted * 100) / 100;
    }


    clearCache(): void {
        this.rateCache.clear();
        this.historicalRateCache.clear();
        this.logger.log('Exchange rate caches cleared');
    }
}