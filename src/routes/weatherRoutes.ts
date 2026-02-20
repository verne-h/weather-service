import { Router, Request, Response } from 'express';
import { WeatherService } from '../services/WeatherService';
import { configManager } from '../config/envConfig';
import { rateLimiter } from '../middleware/rateLimiter';

const weatherRouter = Router();

// Initialize WeatherService with API key from config
const config = configManager.getConfig();
const weatherService = new WeatherService(config.weatherApiKey);

weatherRouter.get('/current', rateLimiter, async (req: Request, res: Response) => {
    try {
        const { city, page, limit } = req.query;

        if (!city || typeof city !== 'string') {
            return res.status(400).json({
                error: 'City query parameter is required'
            });
        }

        const pageNum = page ? parseInt(page as string) : undefined;
        const limitNum = limit ? parseInt(limit as string) : undefined;

        const result = await weatherService.getCurrentWeatherForMatchingCities(city, {
            page: pageNum,
            limit: limitNum,
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

export default weatherRouter;