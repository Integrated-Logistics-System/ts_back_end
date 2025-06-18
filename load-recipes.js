const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');

async function loadRecipesToElasticsearch() {
  const client = new Client({ 
    node: 'http://192.168.0.111:9200',
    requestTimeout: 300000,
  });

  try {
    console.log('🔍 Elasticsearch 연결 확인...');
    await client.ping();
    console.log('✅ Elasticsearch 연결 성공');

    // 기존 인덱스 삭제
    console.log('🔄 기존 recipes 인덱스 삭제...');
    try {
      await client.indices.delete({ index: 'recipes' });
    } catch (e) {
      console.log('ℹ️ 기존 인덱스가 없음');
    }

    // 새 인덱스 생성
    console.log('🔧 recipes 인덱스 생성...');
    await client.indices.create({
      index: 'recipes',
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          refresh_interval: '-1'
        },
        mappings: {
          properties: {
            id: { type: 'integer' },
            name: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            ingredients: { type: 'keyword' },
            steps: { type: 'text' },
            tags: { type: 'keyword' },
            minutes: { type: 'integer' },
            n_steps: { type: 'integer' },
            n_ingredients: { type: 'integer' },
            nutrition: { type: 'text' },
            contributor_id: { type: 'integer' },
            submitted: { type: 'date', format: 'yyyy-MM-dd||epoch_millis' }
          }
        }
      }
    });

    // JSON 파일 확인
    const jsonPath = '../data/RAW_recipes.json';
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ RAW_recipes.json 파일이 없습니다. 먼저 convert-to-json.js를 실행하세요.');
      return;
    }

    // JSON 데이터 로드
    console.log('📖 JSON 파일 읽기...');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📊 로드된 레시피: ${jsonData.length.toLocaleString()}`);

    // 배치 인덱싱
    const batchSize = 1000;
    let processedCount = 0;

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      const body = [];

      batch.forEach(recipe => {
        body.push({ index: { _index: 'recipes', _id: recipe.id } });
        body.push({
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tags: recipe.tags,
          minutes: recipe.minutes,
          n_steps: recipe.n_steps,
          n_ingredients: recipe.n_ingredients,
          nutrition: recipe.nutrition,
          contributor_id: recipe.contributor_id,
          submitted: formatDate(recipe.submitted)
        });
      });

      try {
        await client.bulk({ 
          body,
          timeout: '120s',
          refresh: false
        });
        
        processedCount += batch.length;
        const progress = ((processedCount / jsonData.length) * 100).toFixed(1);
        console.log(`📊 진행: ${processedCount.toLocaleString()} / ${jsonData.length.toLocaleString()} (${progress}%)`);
        
      } catch (error) {
        console.error(`❌ 배치 오류:`, error.message);
      }
    }

    // 인덱스 최적화
    console.log('🔧 인덱스 최적화 중...');
    await client.indices.refresh({ index: 'recipes' });
    await client.indices.putSettings({
      index: 'recipes',
      body: { refresh_interval: '1s' }
    });

    // 최종 확인
    const count = await client.count({ index: 'recipes' });
    console.log(`🎉 인덱싱 완료: ${count.count.toLocaleString()} 레시피`);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'null') return '2000-01-01';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '2000-01-01';
    return date.toISOString().split('T')[0];
  } catch {
    return '2000-01-01';
  }
}

console.log('🚀 레시피 데이터 Elasticsearch 인덱싱 시작...');
loadRecipesToElasticsearch();