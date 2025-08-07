import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 프롬프트 파일 로더 서비스
 * 개별 .prompt 파일에서 프롬프트를 로드하고 템플릿 변수를 치환합니다.
 */
@Injectable()
export class PromptFileLoaderService {
  private readonly logger = new Logger(PromptFileLoaderService.name);
  private readonly promptsDir = join(__dirname, 'prompts');
  private readonly promptCache = new Map<string, string>();

  constructor() {
    this.logger.log('🗂️ 프롬프트 파일 로더 서비스 초기화됨');
  }

  /**
   * 프롬프트 파일 로드 및 변수 치환
   */
  loadPrompt(fileName: string, variables: Record<string, any> = {}): string {
    try {
      // 캐시 확인
      const cacheKey = fileName;
      let template = this.promptCache.get(cacheKey);

      if (!template) {
        // 파일에서 로드
        const filePath = join(this.promptsDir, `${fileName}.prompt`);
        template = readFileSync(filePath, 'utf-8');
        this.promptCache.set(cacheKey, template);
        this.logger.debug(`📁 프롬프트 파일 로드: ${fileName}.prompt`);
      }

      // 변수 치환
      const processedPrompt = this.processTemplate(template, variables);
      
      this.logger.debug(`✅ 프롬프트 처리 완료: ${fileName} (길이: ${processedPrompt.length})`);
      return processedPrompt;

    } catch (error) {
      this.logger.error(`❌ 프롬프트 파일 로드 실패: ${fileName}`, error);
      throw new Error(`Failed to load prompt file: ${fileName}`);
    }
  }

  /**
   * 템플릿 변수 치환 (Handlebars 스타일)
   */
  private processTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    // 단순 변수 치환: {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined || value === null) {
        return '';
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    });

    // 조건부 블록 처리: {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const value = variables[condition];
      if (value && value !== 'false' && value !== 0 && !(Array.isArray(value) && value.length === 0)) {
        return content;
      }
      return '';
    });

    // {{else}} 처리: {{#if condition}}...{{else}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, ifContent, elseContent) => {
      const value = variables[condition];
      if (value && value !== 'false' && value !== 0 && !(Array.isArray(value) && value.length === 0)) {
        return ifContent;
      }
      return elseContent;
    });

    return result.trim();
  }

  /**
   * 캐시 초기화 (개발 중 프롬프트 변경 시 사용)
   */
  clearCache(): void {
    this.promptCache.clear();
    this.logger.log('🗑️ 프롬프트 캐시 초기화됨');
  }

  /**
   * 사용 가능한 프롬프트 파일 목록 반환
   */
  getAvailablePrompts(): string[] {
    return Array.from(this.promptCache.keys());
  }
}