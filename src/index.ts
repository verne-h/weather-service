import dotenv from 'dotenv';

// Load environment variables from .env file BEFORE other imports
dotenv.config();

import express, { Application, Request, Response } from 'express';
import weatherRouter from './routes/weatherRoutes';
import { configManager } from './config/envConfig';

const app: Application = express();

// Initialize config and start server
async function startServer() {
    try {
        const config = await configManager.init();
        const PORT = config.port;
        const HOST = config.host;

        app.use(express.json());

        app.use('/weather', weatherRouter);

        app.listen(PORT, HOST, () => {
            console.log(`Server is listening on ${HOST}:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();