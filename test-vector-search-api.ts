/**
 * 벡터 검색 API 통합 테스트 스크립트
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:8081';
const API_BASE = `${BASE_URL}/api/vector-search`;

// 테스트 데이터
const testCases = [
  {
    name: 'Basic Vector Search (POST)',
    method: 'POST',
    endpoint: '/search',
    data: {
      query: '김치찌개 레시피',
      k: 5,
      vectorWeight: 0.7,
      textWeight: 0.3,
      useHybridSearch: true,
      minScore: 0.2
    }
  },
  {
    name: 'Simple Vector Search (GET)',
    method: 'GET',
    endpoint: '/search?q=된장찌개&k=3&hybrid=true'
  },
  {
    name: 'Personalized Recommendations',
    method: 'POST',
    endpoint: '/recommendations',
    data: {
      preferences: ['healthy', 'quick', 'korean'],
      allergies: ['nuts'],
      favoriteIngredients: ['chicken', 'vegetables'],
      difficulty: 'easy',
      maxCookTime: 30,
      k: 8
    }
  },
  {
    name: 'Vector Search Stats',
    method: 'GET',
    endpoint: '/stats'
  }
];

async function testVectorSearchAPI() {
  console.log('🧪 Testing Vector Search API Endpoints...\n');

  for (const testCase of testCases) {
    try {
      console.log(`🔍 Testing: ${testCase.name}`);
      console.log(`   Method: ${testCase.method}`);
      console.log(`   Endpoint: ${testCase.endpoint}`);
      
      if (testCase.data) {
        console.log(`   Data:`, JSON.stringify(testCase.data, null, 2));
      }

      const startTime = Date.now();
      
      let response;
      if (testCase.method === 'POST') {
        response = await axios.post(`${API_BASE}${testCase.endpoint}`, testCase.data, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } else {
        response = await axios.get(`${API_BASE}${testCase.endpoint}`, {
          timeout: 30000
        });
      }

      const responseTime = Date.now() - startTime;

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ⏱️  Response Time: ${responseTime}ms`);
      
      if (response.data.results) {
        console.log(`   📊 Results: ${response.data.results.length} recipes found`);
        console.log(`   🎯 Search Method: ${response.data.searchMethod}`);
        console.log(`   ⚡ Search Time: ${response.data.searchTime}ms`);
        
        // Show first result preview
        if (response.data.results.length > 0) {
          const firstResult = response.data.results[0];
          console.log(`   📖 First Result: "${firstResult.name}" (Score: ${firstResult.combinedScore?.toFixed(3)})`);
        }
      } else if (response.data.elasticsearch) {
        console.log(`   📊 Total Recipes: ${response.data.totalRecipes}`);
        console.log(`   🔍 Indexed Recipes: ${response.data.indexedRecipes}`);
        console.log(`   ⚡ ES Status: ${response.data.elasticsearch.status}`);
      }
      
      console.log('   ✅ Test Passed\n');

    } catch (error) {
      console.log(`   ❌ Test Failed`);
      
      if (axios.isAxiosError(error)) {
        console.log(`   📊 Status: ${error.response?.status || 'No Response'}`);
        console.log(`   💬 Message: ${error.response?.data?.message || error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
          console.log(`   🚨 Server not running on ${BASE_URL}`);
          console.log(`   💡 Start server with: npm run start:dev`);
        }
      } else {
        console.log(`   💬 Error: ${error}`);
      }
      
      console.log('');
    }
  }
}

// 개별 API 엔드포인트 테스트 함수들
async function testBasicSearch() {
  console.log('🔍 Testing Basic Vector Search...');
  
  try {
    const response = await axios.post(`${API_BASE}/search`, {
      query: '마파두부 레시피',
      k: 3,
      vectorWeight: 0.6,
      textWeight: 0.4,
      useHybridSearch: true,
      allergies: [],
      preferences: ['spicy']
    });

    console.log('✅ Basic Search Success!');
    console.log(`Found ${response.data.results.length} recipes`);
    console.log(`Search took ${response.data.searchTime}ms`);
    
    return response.data;
  } catch (error) {
    console.log('❌ Basic Search Failed:', error);
    return null;
  }
}

async function testSimilarRecipes() {
  console.log('🔍 Testing Similar Recipes Search...');
  
  try {
    // 먼저 기본 검색으로 레시피 ID 획득
    const searchResponse = await axios.get(`${API_BASE}/search?q=김치찌개&k=1`);
    
    if (searchResponse.data.results.length === 0) {
      console.log('⚠️  No recipes found for similarity test');
      return;
    }

    const recipeId = searchResponse.data.results[0].id;
    console.log(`Using recipe ID: ${recipeId}`);

    const response = await axios.get(`${API_BASE}/similar/${recipeId}?k=3`);

    console.log('✅ Similar Recipes Success!');
    console.log(`Base Recipe: ${response.data.baseRecipe.name}`);
    console.log(`Found ${response.data.similarRecipes.results.length} similar recipes`);
    
    return response.data;
  } catch (error) {
    console.log('❌ Similar Recipes Failed:', error);
    return null;
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 Vector Search API Test Suite\n');
  console.log('='.repeat(50));
  
  // 전체 API 테스트
  await testVectorSearchAPI();
  
  console.log('='.repeat(50));
  console.log('🧪 Individual Function Tests\n');
  
  // 개별 기능 테스트
  await testBasicSearch();
  console.log('');
  await testSimilarRecipes();
  
  console.log('\n🎉 Vector Search API Test Suite Completed!');
  console.log('\n📝 Available Endpoints:');
  console.log('  POST /api/vector-search/search - Advanced vector search');
  console.log('  GET  /api/vector-search/search - Simple vector search');
  console.log('  GET  /api/vector-search/similar/:id - Find similar recipes');
  console.log('  POST /api/vector-search/recommendations - Personalized recommendations');
  console.log('  GET  /api/vector-search/stats - Service statistics');
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other tests
export {
  testVectorSearchAPI,
  testBasicSearch,
  testSimilarRecipes,
  API_BASE
};