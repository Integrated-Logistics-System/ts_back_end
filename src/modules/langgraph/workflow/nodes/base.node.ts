import { Injectable, Logger } from '@nestjs/common';
import { GraphState } from '../workflow.builder';

/**
 * Base class for all workflow nodes
 * Provides common functionality and error handling
 */
@Injectable()
export abstract class BaseNode {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Abstract method that each node must implement
   */
  abstract execute(state: GraphState): Promise<Partial<GraphState>>;

  /**
   * Wrapper method that handles common error handling and logging
   */
  async process(state: GraphState): Promise<Partial<GraphState>> {
    const startTime = Date.now();
    const nodeName = this.constructor.name.replace('Node', '');
    
    this.logger.log(`🔄 ${nodeName} processing: "${state.query}"`);

    try {
      const result = await this.execute(state);
      const processingTime = Date.now() - startTime;
      
      this.logger.log(`✅ ${nodeName} completed in ${processingTime}ms`);
      
      return {
        ...result,
        metadata: {
          ...state.metadata,
          [`${nodeName.toLowerCase()}Time`]: processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`❌ ${nodeName} failed after ${processingTime}ms:`, error);
      
      return this.handleError(error, state, processingTime);
    }
  }

  /**
   * Common error handling for all nodes
   */
  protected handleError(
    error: any, 
    state: GraphState, 
    processingTime: number
  ): Partial<GraphState> {
    const nodeName = this.constructor.name.replace('Node', '').toLowerCase();
    
    return {
      response: this.getErrorResponse(error, state),
      metadata: {
        ...state.metadata,
        [`${nodeName}Time`]: processingTime,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  /**
   * Generate appropriate error response for each node
   */
  protected abstract getErrorResponse(error: any, state: GraphState): string;

  /**
   * Utility method to safely get user status
   */
  protected getUserStatusSafely(state: GraphState): string {
    return state.userStatus || '';
  }

  /**
   * Utility method to enhance query with user context
   */
  protected enhanceQueryWithUserContext(query: string, userStatus?: string): string {
    if (!userStatus) {
      return query;
    }
    return `${userStatus} ${query}`;
  }
}