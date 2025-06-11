import { registerAs } from '@nestjs/config';

export const elasticsearchConfig = registerAs('elasticsearch', () => ({
  node: process.env.ELASTICSEARCH_NODE || 'http://192.168.0.111:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || '',
    password: process.env.ELASTICSEARCH_PASSWORD || '',
  },
  requestTimeout: 30000,
  pingTimeout: 3000,
  maxRetries: 3,
  indices: {
    recipes: `${process.env.ELASTICSEARCH_INDEX_PREFIX || 'recipe-ai'}-recipes`,
    ingredients: `${process.env.ELASTICSEARCH_INDEX_PREFIX || 'recipe-ai'}-ingredients`,
    vectors: `${process.env.ELASTICSEARCH_INDEX_PREFIX || 'recipe-ai'}-vectors`,
    users: `${process.env.ELASTICSEARCH_INDEX_PREFIX || 'recipe-ai'}-users`,
  },
  mappings: {
    recipes: {
      properties: {
        title: { type: 'text', analyzer: 'standard' },
        description: { type: 'text', analyzer: 'standard' },
        ingredients: { type: 'text', analyzer: 'standard' },
        instructions: { type: 'text', analyzer: 'standard' },
        tags: { type: 'keyword' },
        difficulty: { type: 'keyword' },
        cookingTime: { type: 'integer' },
        servings: { type: 'integer' },
        embedding: { type: 'dense_vector', dims: 768 },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
      },
    },
  },
}));
