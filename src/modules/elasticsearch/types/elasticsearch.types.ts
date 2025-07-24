// Elasticsearch 관련 공통 타입 정의
export interface ElasticsearchRecipe {
  id: string;
  name: string;
  nameKo: string;
  nameEn: string;
  description: string;
  descriptionKo: string;
  descriptionEn: string;
  ingredients: string[];
  ingredientsKo: string[];
  ingredientsEn: string[];
  steps: string[];
  stepsKo: string[];
  stepsEn: string[];
  difficulty: string;
  tags: string[];
  tagsKo: string[];
  tagsEn: string[];
  minutes: number;
  nSteps: number;
  nIngredients: number;
  servings?: number;
  source?: string;
  viewCount?: number;
  likeCount?: number;
  bookmarkCount?: number;
  averageRating?: number;
  ratingCount?: number;
  isBookmarked?: boolean;
  userRating?: number;
  personalNote?: string;
  personalTags?: string[];
  cookCount?: number;
  lastCookedAt?: Date;
  allergenInfo?: AllergenInfo;
  allergyRisk?: string;
  allergies?: string[];
  isSafeForAllergies?: boolean;
  safetyScore?: number;
  createdAt?: string;
  updatedAt?: string;
  isAiGenerated?: boolean;
  generationTimestamp?: string;
  
  // Vector Search 필드들 (새로 추가)
  embedding?: number[];           // 768차원 granite-embedding:278m 임베딩 벡터
  embeddingVersion?: string;      // 임베딩 모델 버전 ("granite-embedding-278m")
  embeddingText?: string;         // 임베딩 생성에 사용된 텍스트 (디버깅용)
  embeddingGeneratedAt?: string;  // 임베딩 생성 시간
}

export interface AllergenInfo {
  allergen_risk_score: number;
  contains_allergens: string[];
  high_risk_ingredients: string[];
  safe_for: string[];
  total_allergen_count: number;
  ingredient_details: Array<{
    name: string;
    allergens: string[];
    risk_level: string;
  }>;
}

// Elasticsearch 응답 타입들
export interface ElasticsearchHit<T = Record<string, unknown>> {
  _index: string;
  _id: string;
  _score?: number;
  _source: T;
}

export interface ElasticsearchResponse<T = Record<string, unknown>> {
  hits: {
    total: {
      value: number;
      relation: string;
    };
    hits: ElasticsearchHit<T>[];
  };
  aggregations?: Record<string, unknown>;
  suggest?: Record<string, unknown>;
}

export interface ElasticsearchCountResponse {
  count: number;
}

export interface ElasticsearchSuggestOption {
  text: string;
  _score: number;
}

export interface ElasticsearchSuggestResponse {
  suggest: {
    [key: string]: [{
      options: ElasticsearchSuggestOption[];
    }];
  };
}

// 검색 옵션 타입들
export interface SearchOptions {
  allergies?: string[];
  preferences?: string[];
  difficulty?: string;
  maxTime?: number;
  maxCookingTime?: number;
  minRating?: number;
  tags?: string[];
  limit?: number;
  page?: number;
  sortBy?: 'relevance' | 'rating' | 'time' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface AdvancedSearchOptions extends SearchOptions {
  ingredients?: string[];
  excludeIngredients?: string[];
  servings?: number;
  calories?: { min?: number; max?: number };
  sortBy?: 'relevance' | 'rating' | 'time' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  recipes: ElasticsearchRecipe[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchTime: number;
  aggregations?: Record<string, unknown>;
}

// 저장/업데이트 관련 타입들
export interface RecipeCreateInput {
  recipe: Partial<ElasticsearchRecipe>;
  validate?: boolean;
}

export interface RecipeUpdateInput {
  id: string;
  updates: Partial<ElasticsearchRecipe>;
  upsert?: boolean;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

// 통계 관련 타입들
export interface RecipeStats {
  totalRecipes: number;
  averageRating: number;
  popularTags: Array<{ tag: string; count: number }>;
  difficultyDistribution: Record<string, number>;
  averageCookingTime: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    connection: boolean;
    indexExists: boolean;
    docCount: number;
    lastUpdate: string;
  };
}

// Vector Search 관련 타입들
export interface VectorSearchOptions {
  query: string;
  k?: number;                    // 반환할 상위 k개 결과 (기본값: 10)
  vectorWeight?: number;         // 벡터 검색 가중치 (0.0 ~ 1.0, 기본값: 0.6)
  textWeight?: number;           // 텍스트 검색 가중치 (0.0 ~ 1.0, 기본값: 0.4)
  useHybridSearch?: boolean;     // 하이브리드 검색 사용 여부 (기본값: true)
  minScore?: number;             // 최소 유사도 점수 (기본값: 0.1)
  allergies?: string[];          // 알레르기 필터
  preferences?: string[];        // 사용자 선호도
}

export interface VectorSearchResult extends ElasticsearchRecipe {
  _score: number;                // Elasticsearch 검색 점수
  vectorSimilarity?: number;     // 벡터 유사도 점수
  textRelevance?: number;        // 텍스트 검색 점수
  combinedScore?: number;        // 최종 결합 점수
  searchMethod?: 'vector' | 'text' | 'hybrid'; // 사용된 검색 방법
}

export interface VectorSearchResponse {
  results: VectorSearchResult[];
  total: number;
  maxScore: number;
  searchTime: number;
  searchMethod: 'vector' | 'text' | 'hybrid';
  metadata: {
    vectorWeight: number;
    textWeight: number;
    queryEmbeddingTime?: number;
    elasticsearchTime: number;
    k: number;
  };
}

// 임베딩 인덱싱 관련 타입들
export interface EmbeddingIndexingOptions {
  batchSize?: number;            // 배치 크기 (기본값: 50)
  skipExisting?: boolean;        // 이미 임베딩이 있는 문서 스킵 여부
  forceRegenerate?: boolean;     // 기존 임베딩 강제 재생성 여부
  sourceFields?: string[];       // 임베딩 생성에 사용할 필드들
  progressCallback?: (progress: EmbeddingIndexingProgress) => void;
}

export interface EmbeddingIndexingProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  averageTimePerBatch: number;
}

export interface EmbeddingIndexingResult {
  success: boolean;
  summary: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    totalTime: number;
    averageTimePerDocument: number;
  };
  failures: Array<{
    documentId: string;
    error: string;
    retryAttempts: number;
  }>;
}