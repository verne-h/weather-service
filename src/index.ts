import dotenv from 'dotenv';

// Load environment variables from .env file BEFORE other imports
dotenv.config();

import cluster from 'cluster';
import os from 'os';
import express, { Application, Request, Response } from 'express';
import weatherRouter from './routes/weatherRoutes';
import { configManager } from './config/envConfig';

const numCPUs = os.cpus().length;

// Cluster pattern: Fork workers for each CPU core
if (cluster.isPrimary) {
    console.log(`Primary process ${process.pid} is running`);
    console.log(`Forking ${numCPUs} workers...`);

    // Fork workers for each CPU
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Handle worker exit and restart
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
        console.log('Starting a new worker...');
        cluster.fork();
    });

    // Log when workers come online
    cluster.on('online', (worker) => {
        console.log(`Worker ${worker.process.pid} is online`);
    });
} else {
    // Worker processes run the Express server
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
                console.log(`Worker ${process.pid}: Server is listening on ${HOST}:${PORT}`);
            });
        } catch (error) {
            console.error(`Worker ${process.pid}: Failed to start server:`, error);
            process.exit(1);
        }
    }

    startServer();
}