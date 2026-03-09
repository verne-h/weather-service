# Weather Service

A TypeScript-based REST API service that provides current weather information for cities worldwide. The service fetches weather data from WeatherAPI.com and provides paginated results with rate limiting.

## Features

- 🌤️ Fetch current weather data for multiple matching cities
- 📄 Paginated API responses
- 🚦 Built-in rate limiting to prevent API abuse
- ⚡ **Multi-process clustering** for horizontal scaling across CPU cores
- 🧵 **Worker threads** for CPU-intensive data processing (automatic for large datasets)
- 🔄 Comprehensive error handling
- ✅ Unit tested with Jest
- 📦 Written in TypeScript for type safety

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- WeatherAPI.com API key ([Get one free here](https://www.weatherapi.com/signup.aspx))

## Installation

1. Clone the repository:
```bash
git clone https://github.com/verne-h/weather-service.git
cd weather-service
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
WEATHER_API_KEY=your_api_key_here
PORT=3000
```

## Usage

### Development Mode

Start the server with hot-reload:
```bash
npm run dev
```

### Production Mode

Build and run the compiled TypeScript:
```bash
npm run build
npm start
```

### Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## API Endpoints

### Get Current Weather

Retrieves current weather data for all cities matching the query string.

**Endpoint:** `GET /weather/current`

**Query Parameters:**
- `city` (required): City name or partial city name to search for
- `page` (optional): Page number for pagination (default: 1, min: 1)
- `limit` (optional): Number of results per page (default: 20, min: 1, max: 20)
- `useWorker` (optional): Force worker thread processing (default: auto for 50+ items)

**Example Request:**
```bash
curl "http://localhost:3000/weather/current?city=London&page=1&limit=5"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "city": "London",
      "region": "City of London, Greater London",
      "country": "United Kingdom",
      "temperature": {
        "celsius": 10,
        "fahrenheit": 50,
        "feelsLikeCelsius": 8,
        "feelsLikeFahrenheit": 46
      },
      "condition": {
        "text": "Partly cloudy",
        "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png"
      },
      "wind": {
        "speedKph": 15,
        "speedMph": 9,
        "direction": "SW",
        "degree": 225
      },
      "humidity": 75,
      "pressure": {
        "mb": 1013,
        "in": 29.91
      },
      "visibility": {
        "km": 10,
        "miles": 6
      },
      "uv": 3,
      "localTime": "2026-02-02 12:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 15,
    "totalPages": 3
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "City query parameter is required"
}
```

## Project Structure

```
weather-service/
├── src/
│   ├── clients/
│   │   └── WeatherApiClient.ts      # API client for WeatherAPI.com
│   ├── config/
│   │   └── envConfig.ts             # Environment configuration
│   ├── middleware/
│   │   └── rateLimiter.ts           # Rate limiting middleware
│   ├── routes/
│   │   └── weatherRoutes.ts         # API route definitions
│   ├── services/
│   │   └── WeatherService.ts        # Business logic layer
│   ├── stores/                      # Data stores (if needed)
│   ├── workers/
│   │   ├── WorkerPool.ts            # Worker thread pool management
│   │   └── weatherDataWorker.ts     # Weather data processing worker
│   └── index.ts                     # Application entry point (cluster primary)
├── tests/
│   └── WeatherService.test.ts       # Unit tests
├── .env                             # Environment variables (not in repo)
├── .gitignore
├── jest.config.js                   # Jest configuration
├── package.json
├── tsconfig.json                    # TypeScript configuration
└── README.md
```

## Architecture

### Core Components

- **WeatherApiClient**: Handles HTTP requests to the WeatherAPI.com service with built-in rate limiting using Bottleneck (3 concurrent requests, 100ms between requests) to respect external API limits
- **WeatherService**: Business logic layer that transforms raw API responses into a clean, formatted structure
- **weatherRoutes**: Express router that defines API endpoints and handles request validation
- **Rate Limiter**: Middleware to prevent API abuse on incoming requests (default: 10 requests per minute per IP address)

### Concurrency & Parallelism

#### Cluster Mode (Multi-Process)
The application uses Node.js cluster module to spawn multiple worker processes:
- **Primary Process**: Manages worker processes, not handling requests
- **Worker Processes**: One per CPU core, each running a full Express server
- **Load Balancing**: OS-level load balancing across workers on the same port
- **Auto-Restart**: Workers automatically restart on crash for high availability

#### Worker Threads (Multi-Threading)
For CPU-intensive data transformation:
- **Automatic Threshold**: Automatically uses worker threads for 50+ items
- **WorkerPool**: Reusable thread pool utility for efficient resource management
- **weatherDataWorker**: Offloads JSON transformation and pagination to separate thread
- **Non-Blocking**: Keeps event loop free for handling incoming requests

**Performance Notes:**
- Small datasets (< 50 items): Processed in main thread (faster due to no thread overhead)
- Large datasets (≥ 50 items): Automatically offloaded to worker thread
- Force worker usage: Add `useWorker=true` query parameter

## Technologies Used

- **TypeScript**: Type-safe development
- **Express**: Web framework
- **Axios**: HTTP client
- **Bottleneck**: Rate limiting
- **Jest**: Testing framework
- **ts-jest**: TypeScript preprocessor for Jest
- **dotenv**: Environment variable management

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WEATHER_API_KEY` | Your WeatherAPI.com API key | Yes | - |
| `PORT` | Server port number | No | 3000 || `NODE_ENV` | Environment mode (development/production) | No | development |

**Note:** The server automatically binds to `localhost` in development mode and `0.0.0.0` in production mode for security and deployment flexibility.
## License

ISC

## Author

verne-h
