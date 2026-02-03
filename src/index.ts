import dotenv from 'dotenv';

// Load environment variables from .env file BEFORE other imports
dotenv.config();

import express, { Application, Request, Response } from 'express';
import weatherRouter from './routes/weatherRoutes';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/weather', weatherRouter);

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});