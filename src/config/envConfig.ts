import dotenv from 'dotenv';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Load .env file for local development
dotenv.config();

interface EnvConfig {
    weatherApiKey: string;
    port: number;
    nodeEnv: string;
    host: string;
}

class ConfigManager {
    private config: EnvConfig | null = null;

    async init(): Promise<EnvConfig> {
        if (this.config) {
            return this.config;
        }

        const nodeEnv = process.env.NODE_ENV || 'development';

        if (nodeEnv === 'production') {
            // Load from AWS Systems Manager Parameter Store in production
            this.config = await this.loadFromAWS();
        } else {
            // Load from .env file in development
            this.config = this.loadFromEnv();
        }

        this.validateConfig();
        return this.config;
    }

    private loadFromEnv(): EnvConfig {
        const weatherApiKey = process.env.WEATHER_API_KEY;

        if (!weatherApiKey) {
            throw new Error('WEATHER_API_KEY is not set in .env file');
        }

        return {
            weatherApiKey,
            port: parseInt(process.env.PORT || '3000', 10),
            nodeEnv: process.env.NODE_ENV || 'development',
            host: 'localhost',
        };
    }

    private async loadFromAWS(): Promise<EnvConfig> {
        const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

        try {
            // Fetch WEATHER_API_KEY from Parameter Store
            // Expected parameter name: /weather-service/WEATHER_API_KEY
            const command = new GetParameterCommand({
                Name: process.env.WEATHER_API_KEY_PARAM || '/weather-service/WEATHER_API_KEY',
                WithDecryption: true, // Use SecureString in Parameter Store
            });

            const response = await client.send(command);
            const weatherApiKey = response.Parameter?.Value;

            if (!weatherApiKey) {
                throw new Error('Failed to retrieve WEATHER_API_KEY from AWS Systems Manager');
            }

            return {
                weatherApiKey,
                port: parseInt(process.env.PORT || '3000', 10),
                nodeEnv: process.env.NODE_ENV || 'production',
                host: '0.0.0.0',
            };
        } catch (error) {
            console.error('Error loading configuration from AWS Systems Manager:', error);
            throw error;
        }
    }

    private validateConfig(): void {
        if (!this.config?.weatherApiKey) {
            throw new Error('WEATHER_API_KEY must be set');
        }
    }

    getConfig(): EnvConfig {
        if (!this.config) {
            throw new Error('ConfigManager not initialized. Call init() first.');
        }
        return this.config;
    }
}

// Export singleton instance
export const configManager = new ConfigManager();
