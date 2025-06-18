import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Recipe API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body.service).toBe('AI Recipe Assistant');
          expect(res.body.features).toContain('recipe-search');
          expect(res.body.features).toContain('multilingual-support');
          expect(res.body.features).toContain('rag-powered');
        });
    });

    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('🍽️ AI Recipe Assistant API가 정상적으로 실행 중입니다!');
    });
  });

  describe('Recipe Search', () => {
    it('/recipe/search (POST) - English query', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/search')
        .send({ query: 'pasta' })
        .expect(201);

      expect(response.body).toHaveProperty('originalQuery', 'pasta');
      expect(response.body).toHaveProperty('translatedQuery');
      expect(response.body).toHaveProperty('detectedLanguage');
      expect(response.body).toHaveProperty('recipes');
      expect(response.body).toHaveProperty('explanation');
      expect(Array.isArray(response.body.recipes)).toBe(true);
    });

    it('/recipe/search (POST) - Korean query', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/search')
        .send({ query: '파스타' })
        .expect(201);

      expect(response.body).toHaveProperty('originalQuery', '파스타');
      expect(response.body).toHaveProperty('translatedQuery');
      expect(response.body).toHaveProperty('detectedLanguage');
      expect(response.body).toHaveProperty('recipes');
      expect(response.body).toHaveProperty('explanation');
      expect(Array.isArray(response.body.recipes)).toBe(true);
    });

    it('/recipe/search (POST) - breakfast query', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/search')
        .send({ query: 'breakfast pizza' })
        .expect(201);

      expect(response.body.originalQuery).toBe('breakfast pizza');
      expect(Array.isArray(response.body.recipes)).toBe(true);
      
      // 결과가 있다면 레시피 구조 검증
      if (response.body.recipes.length > 0) {
        const recipe = response.body.recipes[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('ingredients');
        expect(recipe).toHaveProperty('steps');
        expect(recipe).toHaveProperty('minutes');
        expect(Array.isArray(recipe.ingredients)).toBe(true);
        expect(Array.isArray(recipe.steps)).toBe(true);
      }
    });

    it('/recipe/search (POST) - empty query', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/search')
        .send({ query: '' })
        .expect(201);

      expect(response.body.originalQuery).toBe('');
      // 빈 쿼리도 처리되므로 응답 메시지 확인
      expect(response.body.explanation).toBeDefined();
    });

    it('/recipe/search (POST) - invalid request body', () => {
      const response = request(app.getHttpServer())
        .post('/recipe/search')
        .send({})
        .expect(201);
      
      // query가 없어도 처리됨 (기본값 사용)
      return response;
    });
  });

  describe('Recipe Chat', () => {
    it('/recipe/chat (POST) - breakfast request', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/chat')
        .send({ query: 'quick breakfast' })
        .expect(201);

      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('recipes');
      expect(typeof response.body.response).toBe('string');
      expect(Array.isArray(response.body.recipes)).toBe(true);
    });

    it('/recipe/chat (POST) - Korean cooking request', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/chat')
        .send({ query: '간단한 아침식사' })
        .expect(201);

      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('recipes');
      expect(typeof response.body.response).toBe('string');
    });

    it('/recipe/chat (POST) - missing query', () => {
      return request(app.getHttpServer())
        .post('/recipe/chat')
        .send({})
        .expect(201); // 빈 쿼리도 처리됨
    });
  });

  describe('Recipe Search Performance', () => {
    it('should respond within 30 seconds', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .post('/recipe/search')
        .send({ query: 'chicken curry' })
        .expect(201);
        
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(30000); // 30초 이내
    }, 35000);
  });

  describe('Recipe Search Data Validation', () => {
    it('should return valid recipe structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/recipe/search')
        .send({ query: 'sandwich' })
        .expect(201);

      // 기본 응답 구조 검증
      expect(response.body).toMatchObject({
        originalQuery: expect.any(String),
        translatedQuery: expect.any(String),
        detectedLanguage: expect.any(String),
        recipes: expect.any(Array),
        explanation: expect.any(String)
      });

      // 레시피가 있다면 구조 검증
      response.body.recipes.forEach((recipe: any) => {
        expect(recipe).toMatchObject({
          id: expect.any(String),
          recipe_id: expect.any(Number),
          name: expect.any(String),
          ingredients: expect.any(Array),
          steps: expect.any(Array),
          minutes: expect.any(Number),
          n_ingredients: expect.any(Number),
          n_steps: expect.any(Number)
        });
      });
    });
  });
});
