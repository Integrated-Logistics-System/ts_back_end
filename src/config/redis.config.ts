import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || '192.168.0.111',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || 'RecipeAI2024!',
  db: parseInt(process.env.REDIS_DB || '0', 10),
  url: process.env.REDIS_URL || 'redis://:RecipeAI2024!@192.168.0.111:6379',
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 300,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
}));
