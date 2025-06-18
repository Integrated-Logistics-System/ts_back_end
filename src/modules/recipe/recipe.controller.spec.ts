import { Test, TestingModule } from '@nestjs/testing';
import { RecipeController } from './recipe.controller';
import { RAGService } from '../rag/rag.service';

describe('RecipeController', () => {
  let controller: RecipeController;
  let ragService: RAGService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipeController],
      providers: [
        {
          provide: RAGService,
          useValue: {
            findOptimalRecipe: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RecipeController>(RecipeController);
    ragService = module.get<RAGService>(RAGService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchRecipe', () => {
    it('should return recipe search results', async () => {
      const mockResult = {
        originalQuery: 'pasta',
        translatedQuery: 'pasta',
        detectedLanguage: 'en',
        recipes: [],
        explanation: 'Test explanation',
        cookingTips: [],
      };

      jest.spyOn(ragService, 'findOptimalRecipe').mockResolvedValue(mockResult);

      const result = await controller.searchRecipe({ query: 'pasta' });

      expect(result).toEqual(mockResult);
      expect(ragService.findOptimalRecipe).toHaveBeenCalledWith('pasta', undefined);
    });

    it('should handle Korean query', async () => {
      const mockResult = {
        originalQuery: '파스타',
        translatedQuery: 'pasta',
        detectedLanguage: 'ko',
        recipes: [],
        explanation: 'Test explanation',
        cookingTips: [],
      };

      jest.spyOn(ragService, 'findOptimalRecipe').mockResolvedValue(mockResult);

      const result = await controller.searchRecipe({ query: '파스타', language: 'ko' });

      expect(result).toEqual(mockResult);
      expect(ragService.findOptimalRecipe).toHaveBeenCalledWith('파스타', 'ko');
    });
  });

  describe('chatRecipe', () => {
    it('should return chat response', async () => {
      const mockResult = {
        originalQuery: 'quick breakfast',
        translatedQuery: 'quick breakfast',
        detectedLanguage: 'en',
        recipes: [
          {
            id: '1',
            name: 'Quick Eggs',
            ingredients: ['eggs'],
            steps: ['cook eggs'],
            minutes: 5,
          },
        ],
        explanation: 'Here are some quick breakfast recipes',
        cookingTips: ['Use fresh eggs'],
      };

      jest.spyOn(ragService, 'findOptimalRecipe').mockResolvedValue(mockResult);

      const result = await controller.chatRecipe({ query: 'quick breakfast' });

      expect(result.response).toBe('Here are some quick breakfast recipes');
      expect(result.recipes).toEqual(mockResult.recipes);
      expect(ragService.findOptimalRecipe).toHaveBeenCalledWith('quick breakfast');
    });

    it('should handle empty query', async () => {
      const mockResult = {
        originalQuery: '',
        translatedQuery: '',
        detectedLanguage: 'unknown',
        recipes: [],
        explanation: '레시피를 찾지 못했습니다',
        cookingTips: [],
      };

      jest.spyOn(ragService, 'findOptimalRecipe').mockResolvedValue(mockResult);

      const result = await controller.chatRecipe({ query: '' });

      expect(result.response).toBe('레시피를 찾지 못했습니다');
      expect(result.recipes).toEqual([]);
    });
  });
});
