import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get('ELASTICSEARCH_URL') || 'http://192.168.0.111:9200',
      requestTimeout: 30000,
      pingTimeout: 3000,
    });
    
    this.checkConnection();
  }

  async checkConnection(): Promise<void> {
    try {
      const isConnected = await this.ping();
      if (isConnected) {
        this.logger.log('✅ Elasticsearch 연결 성공');
        await this.checkRecipeIndex();
      } else {
        this.logger.error('❌ Elasticsearch 연결 실패');
      }
    } catch (error) {
      this.logger.error('Elasticsearch 초기화 오류:', error.message);
    }
  }

  async checkRecipeIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: 'recipes'
      });

      if (indexExists) {
        const count = await this.client.count({ index: 'recipes' });
        this.logger.log(`📊 recipes 인덱스: ${count.count.toLocaleString()} 개 레시피`);
      } else {
        this.logger.warn('⚠️ recipes 인덱스가 없습니다. load-recipes.js를 실행하세요.');
      }
    } catch (error) {
      this.logger.error('인덱스 확인 실패:', error.message);
    }
  }

  async search(index: string, body: any): Promise<any> {
    try {
      this.logger.debug(`🔍 검색 실행: ${index}`);
      
      const response = await this.client.search({
        index,
        body
      });

      const hitCount = response.hits?.hits?.length || 0;
      this.logger.debug(`📋 검색 결과: ${hitCount}개`);

      return response;
    } catch (error) {
      this.logger.error(`❌ 검색 실패 [${index}]:`, error.message);
      return { hits: { hits: [], total: { value: 0 } } };
    }
  }

  async getById(index: string, id: string | number): Promise<any> {
    try {
      const response = await this.client.search({
        index,
        body: {
          query: {
            bool: {
              should: [
                { term: { 'id': id } },
                { term: { 'recipe_id': id } },
                { term: { '_id': id.toString() } }
              ]
            }
          },
          size: 1
        }
      });

      if (response.hits?.hits?.length > 0) {
        return response.hits.hits[0]._source;
      }

      return null;
    } catch (error) {
      this.logger.error(`ID로 검색 실패 [${index}/${id}]:`, error.message);
      return null;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Elasticsearch ping 실패:', error.message);
      return false;
    }
  }

  async getIndexStats(index: string): Promise<any> {
    try {
      const stats = await this.client.indices.stats({ index });
      return {
        total_docs: stats.indices?.[index]?.total?.docs?.count || 0,
        store_size: stats.indices?.[index]?.total?.store?.size_in_bytes || 0,
      };
    } catch (error) {
      this.logger.error(`인덱스 통계 조회 실패 [${index}]:`, error.message);
      return null;
    }
  }

  async updateDocument(index: string, id: string | number, data: any): Promise<void> {
    try {
      await this.client.update({
        index,
        id: id.toString(),
        body: {
          doc: data,
          doc_as_upsert: true
        }
      });
    } catch (error) {
      this.logger.error(`문서 업데이트 실패 [${index}/${id}]:`, error.message);
      throw error;
    }
  }
}