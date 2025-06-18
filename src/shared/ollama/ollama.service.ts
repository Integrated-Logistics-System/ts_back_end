import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options?: {
    temperature?: number;
    top_k?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  model: string;
  created_at: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeout: number;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('OLLAMA_URL') || 'http://192.168.0.111:11434';
    this.defaultModel = this.configService.get('OLLAMA_MODEL') || 'qwen2.5:0.5b';
    this.timeout = 30000; // 30초 타임아웃
    
    this.checkConnection();
  }

  async checkConnection(): Promise<void> {
    try {
      const isConnected = await this.ping();
      if (isConnected) {
        this.logger.log('✅ Ollama 연결 성공');
        await this.checkModels();
      } else {
        this.logger.error('❌ Ollama 연결 실패');
      }
    } catch (error) {
      this.logger.error('Ollama 초기화 오류:', error.message);
    }
  }

  async checkModels(): Promise<void> {
    try {
      const models = await this.listModels();
      if (models.length > 0) {
        this.logger.log(`🤖 사용 가능한 모델: ${models.map(m => m.name).join(', ')}`);
        
        // 기본 모델 존재 여부 확인
        const hasDefaultModel = models.some(m => m.name.includes(this.defaultModel.split(':')[0]));
        if (!hasDefaultModel) {
          this.logger.warn(`⚠️ 기본 모델 (${this.defaultModel})이 없습니다. 첫 번째 모델을 사용합니다.`);
        }
      } else {
        this.logger.warn('⚠️ 설치된 모델이 없습니다. 모델을 다운로드하세요.');
      }
    } catch (error) {
      this.logger.error('모델 목록 조회 실패:', error.message);
    }
  }

  async generateResponse(
    prompt: string,
    model?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<string> {
    try {
      const requestModel = model || this.defaultModel;
      
      this.logger.debug(`🤖 AI 응답 생성 시작 [${requestModel}]`);
      this.logger.debug(`📝 프롬프트 길이: ${prompt.length}자`);

      const requestData: OllamaGenerateRequest = {
        model: requestModel,
        prompt: prompt.trim(),
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.maxTokens || 500,
        }
      };

      const response = await axios.post<OllamaGenerateResponse>(
        `${this.baseUrl}/api/generate`,
        requestData,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.data && response.data.response) {
        const generatedText = response.data.response.trim();
        this.logger.debug(`✅ AI 응답 생성 완료: ${generatedText.length}자`);
        return generatedText;
      }

      throw new Error('Ollama 응답이 비어있습니다.');

    } catch (error) {
      this.logger.error('AI 응답 생성 실패:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      }
      
      if (error.response?.status === 404) {
        throw new Error(`모델 '${model || this.defaultModel}'을 찾을 수 없습니다.`);
      }
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('AI 응답 생성 시간이 초과되었습니다.');
      }
      
      throw new Error(`AI 응답 생성 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  async listModels(): Promise<Array<{ name: string; size: number; digest: string }>> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });

      if (response.data && response.data.models) {
        return response.data.models;
      }

      return [];
    } catch (error) {
      this.logger.error('모델 목록 조회 실패:', error.message);
      return [];
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error('Ollama ping 실패:', error.message);
      return false;
    }
  }

  async pullModel(modelName: string): Promise<boolean> {
    try {
      this.logger.log(`📥 모델 다운로드 시작: ${modelName}`);
      
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        { name: modelName },
        { timeout: 300000 } // 5분 타임아웃
      );

      this.logger.log(`✅ 모델 다운로드 완료: ${modelName}`);
      return true;
    } catch (error) {
      this.logger.error(`모델 다운로드 실패 [${modelName}]:`, error.message);
      return false;
    }
  }

  async deleteModel(modelName: string): Promise<boolean> {
    try {
      await axios.delete(`${this.baseUrl}/api/delete`, {
        data: { name: modelName },
        timeout: 10000
      });

      this.logger.log(`🗑️ 모델 삭제 완료: ${modelName}`);
      return true;
    } catch (error) {
      this.logger.error(`모델 삭제 실패 [${modelName}]:`, error.message);
      return false;
    }
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
