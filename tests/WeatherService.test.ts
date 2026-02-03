import { WeatherService } from '../src/services/WeatherService';
import { WeatherApiClient } from '../src/clients/WeatherApiClient';

// Mock the WeatherApiClient
jest.mock('../src/clients/WeatherApiClient');

describe('WeatherService', () => {
    let weatherService: WeatherService;
    let mockWeatherClient: jest.Mocked<WeatherApiClient>;

    const mockWeatherResponse = {
        location: {
            name: 'London',
            region: 'City of London, Greater London',
            country: 'United Kingdom',
            lat: 51.52,
            lon: -0.11,
            tz_id: 'Europe/London',
            localtime: '2026-02-02 12:00',
        },
        current: {
            temp_c: 10,
            temp_f: 50,
            feelslike_c: 8,
            feelslike_f: 46,
            condition: {
                text: 'Partly cloudy',
                icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
                code: 116,
            },
            wind_kph: 15,
            wind_mph: 9,
            wind_dir: 'SW',
            wind_degree: 225,
            humidity: 75,
            pressure_mb: 1013,
            pressure_in: 29.91,
            precip_mm: 0,
            precip_in: 0,
            cloud: 50,
            vis_km: 10,
            vis_miles: 6,
            uv: 3,
            gust_mph: 12,
            gust_kph: 19,
        },
    };

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create a new instance for each test
        weatherService = new WeatherService('test-api-key');
        mockWeatherClient = (weatherService as any).weatherClient as jest.Mocked<WeatherApiClient>;
    });

    describe('getCurrentWeatherForMatchingCities', () => {
        it('should return paginated weather data with default pagination', async () => {
            const mockResponses = [
                { ...mockWeatherResponse, location: { ...mockWeatherResponse.location, name: 'London' } },
                { ...mockWeatherResponse, location: { ...mockWeatherResponse.location, name: 'Paris' } },
                { ...mockWeatherResponse, location: { ...mockWeatherResponse.location, name: 'Berlin' } },
            ];

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city');

            expect(result.data).toHaveLength(3);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 3,
                totalPages: 1,
            });
            expect(mockWeatherClient.getCurrentWeatherForMatchingCities).toHaveBeenCalledWith('city', 20);
        });

        it('should apply custom pagination options', async () => {
            const mockResponses = Array.from({ length: 10 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: 2,
                limit: 5,
            });

            expect(result.data).toHaveLength(5);
            expect(result.data[0].city).toBe('City6');
            expect(result.data[4].city).toBe('City10');
            expect(result.pagination).toEqual({
                page: 2,
                limit: 5,
                total: 10,
                totalPages: 2,
            });
            expect(mockWeatherClient.getCurrentWeatherForMatchingCities).toHaveBeenCalledWith('city', 10);
        });

        it('should handle page 1 with custom limit', async () => {
            const mockResponses = Array.from({ length: 15 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: 1,
                limit: 10,
            });

            expect(result.data).toHaveLength(10);
            expect(result.data[0].city).toBe('City1');
            expect(result.data[9].city).toBe('City10');
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 15,
                totalPages: 2,
            });
        });

        it('should clamp limit to maximum of 20', async () => {
            const mockResponses = [mockWeatherResponse];
            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                limit: 50,
            });

            expect(result.pagination.limit).toBe(20);
            expect(mockWeatherClient.getCurrentWeatherForMatchingCities).toHaveBeenCalledWith('city', 20);
        });

        it('should clamp limit to minimum of 1', async () => {
            const mockResponses = [mockWeatherResponse];
            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                limit: 0,
            });

            expect(result.pagination.limit).toBe(1);
        });

        it('should clamp page to minimum of 1', async () => {
            const mockResponses = [mockWeatherResponse];
            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: -5,
            });

            expect(result.pagination.page).toBe(1);
        });

        it('should return empty data array when no results match', async () => {
            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue([]);

            const result = await weatherService.getCurrentWeatherForMatchingCities('nonexistent');

            expect(result.data).toEqual([]);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
            });
        });

        it('should correctly format weather data', async () => {
            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue([mockWeatherResponse]);

            const result = await weatherService.getCurrentWeatherForMatchingCities('London');

            expect(result.data[0]).toEqual({
                city: 'London',
                region: 'City of London, Greater London',
                country: 'United Kingdom',
                temperature: {
                    celsius: 10,
                    fahrenheit: 50,
                    feelsLikeCelsius: 8,
                    feelsLikeFahrenheit: 46,
                },
                condition: {
                    text: 'Partly cloudy',
                    icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
                },
                wind: {
                    speedKph: 15,
                    speedMph: 9,
                    direction: 'SW',
                    degree: 225,
                },
                humidity: 75,
                pressure: {
                    mb: 1013,
                    in: 29.91,
                },
                visibility: {
                    km: 10,
                    miles: 6,
                },
                uv: 3,
                localTime: '2026-02-02 12:00',
            });
        });

        it('should handle pagination when requesting page beyond available data', async () => {
            const mockResponses = Array.from({ length: 5 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: 3,
                limit: 3,
            });

            // Page 3 with limit 3 starts at index 6, but we only have 5 items
            expect(result.data).toEqual([]);
            expect(result.pagination).toEqual({
                page: 3,
                limit: 3,
                total: 5,
                totalPages: 2,
            });
        });

        it('should handle last page with partial results', async () => {
            const mockResponses = Array.from({ length: 7 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: 2,
                limit: 5,
            });

            // Page 2 should have only 2 items (City6 and City7)
            expect(result.data).toHaveLength(2);
            expect(result.data[0].city).toBe('City6');
            expect(result.data[1].city).toBe('City7');
            expect(result.pagination).toEqual({
                page: 2,
                limit: 5,
                total: 7,
                totalPages: 2,
            });
        });

        it('should calculate totalNeeded correctly for different page/limit combinations', async () => {
            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue([]);

            await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: 3,
                limit: 10,
            });

            // Page 3 with limit 10 means we need 30 items total
            expect(mockWeatherClient.getCurrentWeatherForMatchingCities).toHaveBeenCalledWith('city', 30);
        });
    });
});
