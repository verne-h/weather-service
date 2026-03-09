import { WeatherService } from '../src/services/WeatherService';
import { WeatherApiClient } from '../src/clients/WeatherApiClient';

// Mock the WeatherApiClient
jest.mock('../src/clients/WeatherApiClient');

// Mock the runWorker function
jest.mock('../src/workers/WorkerPool', () => ({
    runWorker: jest.fn(),
}));

import { runWorker } from '../src/workers/WorkerPool';

describe('WeatherService - Concurrency Features', () => {
    let weatherService: WeatherService;
    let mockWeatherClient: jest.Mocked<WeatherApiClient>;
    const mockRunWorker = runWorker as jest.MockedFunction<typeof runWorker>;

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
        jest.clearAllMocks();
        weatherService = new WeatherService('test-api-key');
        mockWeatherClient = (weatherService as any).weatherClient as jest.Mocked<WeatherApiClient>;
    });

    describe('Worker Thread Usage', () => {
        it('should use main thread for small datasets (< 50 items)', async () => {
            const mockResponses = Array.from({ length: 10 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city');

            // Should NOT call runWorker for small datasets
            expect(mockRunWorker).not.toHaveBeenCalled();
            expect(result.data).toHaveLength(10);
            expect(result.pagination.total).toBe(10);
        });

        it('should use worker thread for large datasets (>= 50 items)', async () => {
            const mockResponses = Array.from({ length: 50 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            const expectedResult = {
                data: mockResponses.slice(0, 20).map((item, i) => ({
                    city: `City${i + 1}`,
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
                })),
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 50,
                    totalPages: 3,
                },
            };

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);
            mockRunWorker.mockResolvedValue(expectedResult);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city');

            // Should call runWorker for large datasets
            expect(mockRunWorker).toHaveBeenCalledTimes(1);
            expect(mockRunWorker).toHaveBeenCalledWith(
                expect.stringContaining('weatherDataWorker.js'),
                {
                    rawWeatherList: mockResponses,
                    page: 1,
                    limit: 20,
                }
            );
            expect(result).toEqual(expectedResult);
        });

        it('should force worker thread usage when useWorker is true', async () => {
            const mockResponses = Array.from({ length: 5 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            const expectedResult = {
                data: mockResponses.map((item, i) => ({
                    city: `City${i + 1}`,
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
                })),
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 5,
                    totalPages: 1,
                },
            };

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);
            mockRunWorker.mockResolvedValue(expectedResult);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                useWorker: true,
            });

            // Should call runWorker even for small datasets when forced
            expect(mockRunWorker).toHaveBeenCalledTimes(1);
            expect(result).toEqual(expectedResult);
        });

        it('should not use worker thread when useWorker is false', async () => {
            const mockResponses = Array.from({ length: 60 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            const result = await weatherService.getCurrentWeatherForMatchingCities('city', {
                useWorker: false,
            });

            // Should NOT call runWorker when explicitly disabled
            expect(mockRunWorker).not.toHaveBeenCalled();
            expect(result.data).toHaveLength(20);
            expect(result.pagination.total).toBe(60);
        });

        it('should pass correct pagination to worker thread', async () => {
            const mockResponses = Array.from({ length: 100 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            const expectedResult = {
                data: [],
                pagination: {
                    page: 3,
                    limit: 15,
                    total: 100,
                    totalPages: 7,
                },
            };

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);
            mockRunWorker.mockResolvedValue(expectedResult);

            await weatherService.getCurrentWeatherForMatchingCities('city', {
                page: 3,
                limit: 15,
            });

            expect(mockRunWorker).toHaveBeenCalledWith(
                expect.stringContaining('weatherDataWorker.js'),
                {
                    rawWeatherList: mockResponses,
                    page: 3,
                    limit: 15,
                }
            );
        });
    });

    describe('Threshold Behavior', () => {
        it('should not use worker for exactly 49 items', async () => {
            const mockResponses = Array.from({ length: 49 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);

            await weatherService.getCurrentWeatherForMatchingCities('city');

            expect(mockRunWorker).not.toHaveBeenCalled();
        });

        it('should use worker for exactly 50 items (threshold)', async () => {
            const mockResponses = Array.from({ length: 50 }, (_, i) => ({
                ...mockWeatherResponse,
                location: { ...mockWeatherResponse.location, name: `City${i + 1}` },
            }));

            mockWeatherClient.getCurrentWeatherForMatchingCities.mockResolvedValue(mockResponses);
            mockRunWorker.mockResolvedValue({
                data: [],
                pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
            });

            await weatherService.getCurrentWeatherForMatchingCities('city');

            expect(mockRunWorker).toHaveBeenCalledTimes(1);
        });
    });
});
