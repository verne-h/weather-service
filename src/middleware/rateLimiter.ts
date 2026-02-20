import { Request, Response, NextFunction } from 'express';
import Bottleneck from 'bottleneck';

// Create a rate limiter: 10 requests per minute per IP
const limiters = new Map<string, Bottleneck>();

const RATE_LIMIT_MAX = 10; // max requests
const RATE_LIMIT_DURATION = 60 * 1000; // per 60 seconds

function getLimiterForIP(ip: string): Bottleneck {
    if (!limiters.has(ip)) {
        const limiter = new Bottleneck({
            reservoir: RATE_LIMIT_MAX, // initial number of requests allowed
            reservoirRefreshAmount: RATE_LIMIT_MAX, // number of requests to add
            reservoirRefreshInterval: RATE_LIMIT_DURATION, // interval in ms
        });
        limiters.set(ip, limiter);
    }
    return limiters.get(ip)!;
}

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const limiter = getLimiterForIP(ip);

    try {
        // Try to schedule the request
        await limiter.schedule(() => Promise.resolve());
        next();
    } catch (error) {
        // Rate limit exceeded
        res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.'
        });
    }
};