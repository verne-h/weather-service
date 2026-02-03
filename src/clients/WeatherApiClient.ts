import axios, { AxiosInstance } from "axios";
import Bottleneck from "bottleneck";

interface WeatherApiConfig {
    apiKey: string;
    baseUrl?: string;
    rateLimit?: {
        maxConcurrent?: number;
        minTime?: number;
    };
}

interface LocationSearchResult {
    id: number;
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    url: string;
}

interface WeatherResponse {
    location: {
        name: string;
        region: string;
        country: string;
        lat: number;
        lon: number;
        tz_id: string;
        localtime: string;
    };
    current: {
        temp_c: number;
        temp_f: number;
        condition: {
            text: string;
            icon: string;
            code: number;
        };
        wind_mph: number;
        wind_kph: number;
        wind_degree: number;
        wind_dir: string;
        pressure_mb: number;
        pressure_in: number;
        precip_mm: number;
        precip_in: number;
        humidity: number;
        cloud: number;
        feelslike_c: number;
        feelslike_f: number;
        vis_km: number;
        vis_miles: number;
        uv: number;
        gust_mph: number;
        gust_kph: number;
    };
}

export class WeatherApiClient {
    private client: AxiosInstance;
    private apiKey: string;
    private limiter: Bottleneck;

    constructor(config: WeatherApiConfig) {
        this.apiKey = config.apiKey;
        this.client = axios.create({
            baseURL: config.baseUrl || "https://api.weatherapi.com/v1",
            timeout: 10000,
        });

        // Initialize rate limiter
        // Default: max 3 concurrent requests, minimum 100ms between requests
        this.limiter = new Bottleneck({
            maxConcurrent: config.rateLimit?.maxConcurrent || 3,
            minTime: config.rateLimit?.minTime || 100,
        });
    }

    /**
     * Search for cities that match the query
     * @param query - Partial city name to search for
     * @param limit - Maximum number of results to return (default: 10, max: 20)
     * @returns Array of matching locations
     */
    async searchLocations(query: string, limit: number = 10): Promise<LocationSearchResult[]> {
        try {
            const maxLimit = Math.min(20, Math.max(1, limit));

            const response = await this.limiter.schedule(() =>
                this.client.get<LocationSearchResult[]>("/search.json", {
                    params: {
                        key: this.apiKey,
                        q: query,
                    },
                })
            );

            // Apply limit since the API doesn't support a limit parameter
            return response.data.slice(0, maxLimit);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Failed to search locations: ${error.response?.data?.error?.message || error.message}`
                );
            }
            throw error;
        }
    }

    /**
     * Get current weather for a given city
     * @param city - City name, e.g., "London", "New York", "Tokyo"
     * @returns Weather information for the specified city
     */
    async getCurrentWeather(city: string): Promise<WeatherResponse> {
        try {
            const response = await this.limiter.schedule(() =>
                this.client.get<WeatherResponse>("/current.json", {
                    params: {
                        key: this.apiKey,
                        q: city,
                        aqi: "no",
                    },
                })
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Failed to fetch weather data: ${error.response?.data?.error?.message || error.message}`
                );
            }
            throw error;
        }
    }

    /**
     * Get current weather for all cities that partially match the query
     * @param query - Partial city name to search for
     * @param limit - Maximum number of cities to fetch weather for (default: 10, max: 20)
     * @returns Array of weather information for all matching cities
     */
    async getCurrentWeatherForMatchingCities(query: string, limit: number = 20): Promise<WeatherResponse[]> {
        try {
            // First, search for all matching locations with limit
            const locations = await this.searchLocations(query, limit);

            if (locations.length === 0) {
                return [];
            }

            // Fetch weather for all matching locations in parallel
            const weatherPromises = locations.map(location =>
                this.getCurrentWeather(`${location.name},${location.country}`)
            );

            const weatherResults = await Promise.all(weatherPromises);
            return weatherResults;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `Failed to fetch weather for matching cities: ${error.response?.data?.error?.message || error.message}`
                );
            }
            throw error;
        }
    }
}

export default WeatherApiClient;