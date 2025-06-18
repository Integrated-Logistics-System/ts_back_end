import { Test, TestingModule } from '@nestjs/testing';
import { RAGService } from './rag.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { OllamaService } from '../../shared/ollama/ollama.service';

describe('RAGService', () => {
  let service: RAGService;
  let elasticsearchService: ElasticsearchService;
  let ollamaService: OllamaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RAGService,
        {
          provide: ElasticsearchService,
          useValue: {
            search: jest.fn(),
          },
        },
        {
          provide: OllamaService,
          useValue: {
            generateResponse: jest.fn(),
            checkHealth: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RAGService>(RAGService);
    elasticsearchService = module.get<ElasticsearchService>(ElasticsearchService);
    ollamaService = module.get<OllamaService>(OllamaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOptimalRecipe', () => {
    it('should handle English query', async () => {
      const mockRecipes = [
        {
          id: '1',
          recipe_id: 1,
          name: 'Test Recipe',
          ingredients: ['test'],
          steps: ['test step'],
          minutes: 30,
          n_ingredients: 1,
          n_steps: 1,
        },
      ];

      jest.spyOn(elasticsearchService, 'search').mockResolvedValue({
        hits: {
          hits: mockRecipes.map(recipe => ({ _id: recipe.id, _score: 1.0, _source: recipe })),
        },
      });

      jest.spyOn(ollamaService, 'generateResponse').mockResolvedValue('Test explanation');

      const result = await service.findOptimalRecipe('pasta');

      expect(result.originalQuery).toBe('pasta');
      expect(result.recipes).toHaveLength(1);
      expect(result.explanation).toBe('Test explanation');
    });

    it('should handle Korean query', async () => {
      jest.spyOn(elasticsearchService, 'search').mockResolvedValue({
        hits: { hits: [] },
      });

      jest.spyOn(ollamaService, 'generateResponse').mockRejectedValue(new Error('Translation failed'));

      const result = await service.findOptimalRecipe('파스타');

      expect(result.originalQuery).toBe('파스타');
      expect(result.translatedQuery).toBe('파스타'); // fallback to original
      expect(result.recipes).toHaveLength(0);
    });

    it('should handle empty query', async () => {
      const result = await service.findOptimalRecipe('');

      expect(result.originalQuery).toBe('');
      expect(result.recipes).toHaveLength(0);
      expect(result.explanation).toContain('찾지 못했습니다');
    });

    it('should handle Elasticsearch errors gracefully', async () => {
      jest.spyOn(elasticsearchService, 'search').mockRejectedValue(new Error('ES Error'));

      const result = await service.findOptimalRecipe('test');

      expect(result.recipes).toHaveLength(0);
      expect(result.explanation).toContain('찾지 못했습니다');
    });

    it('should handle Ollama errors gracefully', async () => {
      jest.spyOn(elasticsearchService, 'search').mockResolvedValue({
        hits: { hits: [] },
      });

      jest.spyOn(ollamaService, 'generateResponse').mockRejectedValue(new Error('Ollama Error'));

      const result = await service.findOptimalRecipe('test');

      expect(result).toBeDefined();
      expect(result.recipes).toHaveLength(0);
    });
  });
});
