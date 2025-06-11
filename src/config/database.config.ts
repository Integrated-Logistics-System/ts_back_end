import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://recipe_admin:RecipeAI2024!@192.168.0.111:27017/recipe_ai?authSource=admin',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: 'majority',
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
  },
}));
