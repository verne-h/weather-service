/**
 * Worker Thread for CPU-intensive weather data processing
 * 
 * This worker handles heavy data transformation tasks off the main thread,
 * keeping the event loop free for handling incoming requests.
 */

import { parentPort, workerData } from 'worker_threads';

interface RawWeatherData {
    location: {
        name: string;
        region: string;
        country: string;
        localtime: string;
    };
    current: {
        temp_c: number;
        temp_f: number;
        feelslike_c: number;
        feelslike_f: number;
        condition: {
            text: string;
            icon: string;
        };
        wind_kph: number;
        wind_mph: number;
        wind_dir: string;
        wind_degree: number;
        humidity: number;
        pressure_mb: number;
        pressure_in: number;
        vis_km: number;
        vis_miles: number;
        uv: number;
    };
}

interface ProcessedWeatherData {
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

interface WorkerInput {
    rawWeatherList: RawWeatherData[];
    page: number;
    limit: number;
}

interface WorkerOutput {
    data: ProcessedWeatherData[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Transform raw API weather data into our clean format
 */
function transformWeatherData(rawWeather: RawWeatherData): ProcessedWeatherData {
    return {
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
    };
}

/**
 * Process weather data with pagination
 */
function processWeatherData(input: WorkerInput): WorkerOutput {
    const { rawWeatherList, page, limit } = input;

    // Transform all raw data
    const allResults = rawWeatherList.map(transformWeatherData);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = allResults.slice(startIndex, endIndex);

    return {
        data: paginatedData,
        pagination: {
            page,
            limit,
            total: allResults.length,
            totalPages: Math.ceil(allResults.length / limit),
        },
    };
}

// Execute when worker is started
if (parentPort) {
    const result = processWeatherData(workerData as WorkerInput);
    parentPort.postMessage(result);
}

export { processWeatherData, WorkerInput, WorkerOutput };
