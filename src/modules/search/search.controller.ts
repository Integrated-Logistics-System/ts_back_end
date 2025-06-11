import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService, SearchOptions } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across all content types',
    description:
      'Search for recipes, ingredients, and other content using traditional or semantic search',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'Korean spicy noodle soup',
  })
  @ApiQuery({
    name: 'types',
    description: 'Content types to search',
    required: false,
    example: 'recipe,ingredient',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    example: 10,
  })
  @ApiQuery({
    name: 'semantic',
    description: 'Use semantic search',
    required: false,
    example: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: ['recipe', 'ingredient', 'user'],
                  },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  score: { type: 'number' },
                  metadata: { type: 'object' },
                },
              },
            },
            count: { type: 'number' },
            query: { type: 'string' },
          },
        },
        message: { type: 'string', example: 'Search completed successfully' },
      },
    },
  })
  async search(
    @Query('q') query: string,
    @Query('types') types?: string,
    @Query('limit') limit?: number,
    @Query('semantic') useSemanticSearch?: boolean,
  ) {
    const searchOptions: SearchOptions = {
      query,
      limit: limit || 10,
      useSemanticSearch: useSemanticSearch !== false,
    };

    if (types) {
      searchOptions.types = types.split(',') as (
        | 'recipe'
        | 'ingredient'
        | 'user'
      )[];
    }

    const results = await this.searchService.globalSearch(searchOptions);

    return {
      success: true,
      data: {
        results,
        count: results.length,
        query,
      },
      message: 'Search completed successfully',
    };
  }

  @Get('suggest')
  @ApiOperation({
    summary: 'Get auto-complete suggestions',
    description: 'Get search suggestions for auto-complete functionality',
  })
  @ApiQuery({
    name: 'q',
    description: 'Partial search query',
    example: 'Korea',
  })
  @ApiQuery({
    name: 'type',
    description: 'Type of suggestions',
    required: false,
    example: 'recipe',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Suggestions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'string' },
            },
            query: { type: 'string' },
          },
        },
        message: {
          type: 'string',
          example: 'Suggestions retrieved successfully',
        },
      },
    },
  })
  async getSuggestions(
    @Query('q') query: string,
    @Query('type') type: 'recipe' | 'ingredient' = 'recipe',
  ) {
    const suggestions = await this.searchService.suggestAutoComplete(
      query,
      type,
    );

    return {
      success: true,
      data: {
        suggestions,
        query,
      },
      message: 'Suggestions retrieved successfully',
    };
  }
}
