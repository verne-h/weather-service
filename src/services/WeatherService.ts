import { WeatherApiClient } from "../clients/WeatherApiClient";

interface PaginationOptions {
    page?: number;
    limit?: number;
}

interface PaginatedWeatherResult {
    data: WeatherData[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface WeatherData {
    city: string;
    region: string;
    country: string;
    temperature: {
        celsius: number;
        fahrenheit: number;
        feelsLikeCelsius: number;
        feelsLikeFahrenheit: number;
    };
    condition: {
        text: string;
        icon: string;
    };
    wind: {
        speedKph: number;
        speedMph: number;
        direction: string;
        degree: number;
    };
    humidity: number;
    pressure: {
        mb: number;
        in: number;
    };
    visibility: {
        km: number;
        miles: number;
    };
    uv: number;
    localTime: string;
}

export class WeatherService {
    private weatherClient: WeatherApiClient;

    constructor(apiKey: string) {
        this.weatherClient = new WeatherApiClient({ apiKey });
    }

    /**
     * Fetch current weather for all cities matching the query
     * @param query - Partial city name to search for
     * @param options - Pagination options (page and limit)
     * @returns Paginated weather data for matching cities
     */
    async getCurrentWeatherForMatchingCities(
        query: string,
        options: PaginationOptions = {}
    ): Promise<PaginatedWeatherResult> {
        const { page = 1, limit = 20 } = options;
        const pageNum = Math.max(1, page);
        const limitNum = Math.min(20, Math.max(1, limit));

        // Calculate total items needed from API based on pagination
        const totalNeeded = pageNum * limitNum;

        const rawWeatherList = await this.weatherClient.getCurrentWeatherForMatchingCities(query, totalNeeded);

        const allResults = rawWeatherList.map(rawWeather => ({
            city: rawWeather.location.name,
            region: rawWeather.location.region,
            country: rawWeather.location.country,
            temperature: {
                celsius: rawWeather.current.temp_c,
                fahrenheit: rawWeather.current.temp_f,
                feelsLikeCelsius: rawWeather.current.feelslike_c,
                feelsLikeFahrenheit: rawWeather.current.feelslike_f,
            },
            condition: {
                text: rawWeather.current.condition.text,
                icon: rawWeather.current.condition.icon,
            },
            wind: {
                speedKph: rawWeather.current.wind_kph,
                speedMph: rawWeather.current.wind_mph,
                direction: rawWeather.current.wind_dir,
                degree: rawWeather.current.wind_degree,
            },
            humidity: rawWeather.current.humidity,
            pressure: {
                mb: rawWeather.current.pressure_mb,
                in: rawWeather.current.pressure_in,
            },
            visibility: {
                km: rawWeather.current.vis_km,
                miles: rawWeather.current.vis_miles,
            },
            uv: rawWeather.current.uv,
            localTime: rawWeather.location.localtime,
        }));

        // Apply pagination
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedData = allResults.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: allResults.length,
                totalPages: Math.ceil(allResults.length / limitNum),
            },
        };
    }
}

export default WeatherService;
