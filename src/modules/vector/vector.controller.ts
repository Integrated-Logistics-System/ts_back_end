import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { VectorService } from './services/vector.service';
import {
  CreateVectorDto,
  VectorSearchDto,
  VectorSearchResult,
  UpdateVectorDto,
} from './dto';

@ApiTags('vectors')
@Controller('vectors')
export class VectorController {
  private readonly logger = new Logger(VectorController.name);

  constructor(private readonly vectorService: VectorService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new vector',
    description:
      'Creates a new vector from the provided content and stores it in Elasticsearch',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Vector created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            vectorId: {
              type: 'string',
              example: 'recipe_507f1f77bcf86cd799439011_uuid',
            },
          },
        },
        message: { type: 'string', example: 'Vector created successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async createVector(@Body() createVectorDto: CreateVectorDto) {
    try {
      const vectorId = await this.vectorService.createVector(createVectorDto);

      return {
        success: true,
        data: { vectorId },
        message: 'Vector created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create vector', error);
      throw error;
    }
  }

  @Post('search')
  @ApiOperation({
    summary: 'Search for similar vectors',
    description: 'Searches for vectors similar to the provided query text',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Similar vectors found',
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
                $ref: '#/components/schemas/VectorSearchResult',
              },
            },
            count: { type: 'number', example: 5 },
          },
        },
        message: { type: 'string', example: 'Similar vectors found' },
      },
    },
  })
  async searchVectors(@Body() searchDto: VectorSearchDto) {
    try {
      const results = await this.vectorService.searchVectors(searchDto);

      return {
        success: true,
        data: {
          results,
          count: results.length,
        },
        message: 'Similar vectors found',
      };
    } catch (error) {
      this.logger.error('Failed to search vectors', error);
      throw error;
    }
  }

  @Put(':vectorId')
  @ApiOperation({
    summary: 'Update a vector',
    description: 'Updates an existing vector with new content or metadata',
  })
  @ApiParam({
    name: 'vectorId',
    description: 'ID of the vector to update',
    example: 'recipe_507f1f77bcf86cd799439011_uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vector updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Vector updated successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vector not found',
  })
  async updateVector(
    @Param('vectorId') vectorId: string,
    @Body() updateVectorDto: UpdateVectorDto,
  ) {
    try {
      await this.vectorService.updateVector(vectorId, updateVectorDto);

      return {
        success: true,
        message: 'Vector updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update vector ${vectorId}`, error);
      throw error;
    }
  }

  @Delete(':vectorId')
  @ApiOperation({
    summary: 'Delete a vector',
    description: 'Deletes a vector from both Elasticsearch and MongoDB',
  })
  @ApiParam({
    name: 'vectorId',
    description: 'ID of the vector to delete',
    example: 'recipe_507f1f77bcf86cd799439011_uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vector deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Vector deleted successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vector not found',
  })
  async deleteVector(@Param('vectorId') vectorId: string) {
    try {
      await this.vectorService.deleteVector(vectorId);

      return {
        success: true,
        message: 'Vector deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete vector ${vectorId}`, error);
      throw error;
    }
  }

  @Delete('source/:sourceType/:sourceId')
  @ApiOperation({
    summary: 'Delete vectors by source',
    description: 'Deletes all vectors associated with a specific source',
  })
  @ApiParam({
    name: 'sourceType',
    description: 'Type of the source (e.g., recipe, ingredient)',
    example: 'recipe',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'ID of the source document',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vectors deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Vectors deleted successfully' },
      },
    },
  })
  async deleteVectorsBySource(
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string,
  ) {
    try {
      await this.vectorService.deleteVectorsBySource(sourceType, sourceId);

      return {
        success: true,
        message: 'Vectors deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete vectors for ${sourceType}:${sourceId}`,
        error,
      );
      throw error;
    }
  }

  @Get(':vectorId/metadata')
  @ApiOperation({
    summary: 'Get vector metadata',
    description: 'Retrieves metadata for a specific vector',
  })
  @ApiParam({
    name: 'vectorId',
    description: 'ID of the vector',
    example: 'recipe_507f1f77bcf86cd799439011_uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vector metadata retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            vectorId: { type: 'string' },
            sourceType: { type: 'string' },
            sourceId: { type: 'string' },
            content: { type: 'string' },
            metadata: { type: 'object' },
            namespace: { type: 'string' },
            dimensions: { type: 'number' },
            embeddingModel: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        message: { type: 'string', example: 'Vector metadata retrieved' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vector not found',
  })
  async getVectorMetadata(@Param('vectorId') vectorId: string) {
    try {
      const metadata = await this.vectorService.getVectorMetadata(vectorId);

      return {
        success: true,
        data: metadata,
        message: 'Vector metadata retrieved',
      };
    } catch (error) {
      this.logger.error(`Failed to get metadata for vector ${vectorId}`, error);
      throw error;
    }
  }

  @Get('source/:sourceType/:sourceId')
  @ApiOperation({
    summary: 'Get vectors by source',
    description: 'Retrieves all vectors associated with a specific source',
  })
  @ApiParam({
    name: 'sourceType',
    description: 'Type of the source',
    example: 'recipe',
  })
  @ApiParam({
    name: 'sourceId',
    description: 'ID of the source document',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vectors retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            vectors: { type: 'array', items: { type: 'object' } },
            count: { type: 'number' },
          },
        },
        message: { type: 'string', example: 'Vectors retrieved' },
      },
    },
  })
  async getVectorsBySource(
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string,
  ) {
    try {
      const vectors = await this.vectorService.getVectorsBySource(
        sourceType,
        sourceId,
      );

      return {
        success: true,
        data: {
          vectors,
          count: vectors.length,
        },
        message: 'Vectors retrieved',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vectors for ${sourceType}:${sourceId}`,
        error,
      );
      throw error;
    }
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk create vectors',
    description: 'Creates multiple vectors in a single operation',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Vectors created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            vectorIds: { type: 'array', items: { type: 'string' } },
            count: { type: 'number' },
          },
        },
        message: { type: 'string', example: 'Vectors created successfully' },
      },
    },
  })
  async bulkCreateVectors(@Body() createVectorDtos: CreateVectorDto[]) {
    try {
      const vectorIds =
        await this.vectorService.bulkCreateVectors(createVectorDtos);

      return {
        success: true,
        data: {
          vectorIds,
          count: vectorIds.length,
        },
        message: 'Vectors created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to bulk create vectors', error);
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get vector statistics',
    description: 'Retrieves statistics about vectors in the database',
  })
  @ApiQuery({
    name: 'sourceType',
    description: 'Filter by source type',
    required: false,
    example: 'recipe',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vector statistics retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            elasticsearchStats: { type: 'object' },
            mongoCount: { type: 'number' },
          },
        },
        message: { type: 'string', example: 'Vector statistics retrieved' },
      },
    },
  })
  async getVectorStats(@Query('sourceType') sourceType?: string) {
    try {
      const [elasticsearchStats, mongoCount] = await Promise.all([
        this.vectorService.getIndexStats(),
        this.vectorService.getVectorCount(sourceType),
      ]);

      return {
        success: true,
        data: {
          elasticsearchStats,
          mongoCount,
        },
        message: 'Vector statistics retrieved',
      };
    } catch (error) {
      this.logger.error('Failed to get vector statistics', error);
      throw error;
    }
  }
}
