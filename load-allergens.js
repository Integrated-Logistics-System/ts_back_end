const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');
const csv = require('csv-parser');

async function loadAllergensToElasticsearch() {
  const client = new Client({ 
    node: 'http://192.168.0.111:9200',
    requestTimeout: 180000,
  });

  try {
    console.log('🔍 Elasticsearch 연결 확인...');
    await client.ping();
    console.log('✅ Elasticsearch 연결 성공');

    // 기존 allergens 인덱스 삭제
    console.log('🔄 기존 allergens 인덱스 삭제...');
    try {
      await client.indices.delete({ index: 'allergens' });
    } catch (e) {
      console.log('ℹ️ 기존 인덱스가 없음');
    }

    // allergens 인덱스 생성
    console.log('🔧 allergens 인덱스 생성...');
    await client.indices.create({
      index: 'allergens',
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          refresh_interval: '-1'
        },
        mappings: {
          properties: {
            ingredient_name: { 
              type: 'text', 
              analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
                english: { analyzer: 'english' },
                korean: { analyzer: 'standard' }
              }
            },
            글루텐함유곡물: { type: 'float' },
            갑각류: { type: 'float' },
            난류: { type: 'float' },
            어류: { type: 'float' },
            땅콩: { type: 'float' },
            대두: { type: 'float' },
            우유: { type: 'float' },
            견과류: { type: 'float' },
            셀러리: { type: 'float' },
            겨자: { type: 'float' },
            참깨: { type: 'float' },
            아황산류: { type: 'float' },
            루핀: { type: 'float' },
            연체동물: { type: 'float' },
            복숭아: { type: 'float' },
            토마토: { type: 'float' },
            돼지고기: { type: 'float' },
            쇠고기: { type: 'float' },
            닭고기: { type: 'float' },
            note: { type: 'text' },
            // 검색 편의를 위한 추가 필드
            has_allergens: { type: 'boolean' },
            allergen_count: { type: 'integer' },
            allergen_types: { type: 'keyword' },
            risk_level: { type: 'keyword' } // high, medium, low, none
          }
        }
      }
    });

    // CSV 스트림 처리
    await processAllergenStream(client);

    // 인덱스 최적화
    console.log('🔧 인덱스 최적화...');
    await client.indices.refresh({ index: 'allergens' });
    await client.indices.putSettings({
      index: 'allergens',
      body: { refresh_interval: '1s' }
    });

    // 최종 확인
    const count = await client.count({ index: 'allergens' });
    console.log(`🎉 알레르기 데이터 인덱싱 완료: ${count.count.toLocaleString()} 재료`);

    // 통계 출력
    await printAllergenStats(client);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

async function processAllergenStream(client) {
  return new Promise((resolve, reject) => {
    let batch = [];
    let processedCount = 0;
    const batchSize = 1000;

    const allergenFields = [
      '글루텐함유곡물', '갑각류', '난류', '어류', '땅콩', '대두', '우유', '견과류',
      '셀러리', '겨자', '참깨', '아황산류', '루핀', '연체동물', '복숭아', '토마토',
      '돼지고기', '쇠고기', '닭고기'
    ];

    const processBatch = async () => {
      if (batch.length === 0) return;

      try {
        const body = [];
        batch.forEach((row, index) => {
          if (row.ingredient_name && row.ingredient_name.trim()) {
            // 알레르기 수치 분석
            const allergenValues = allergenFields.map(field => 
              parseFloat(row[field]) || 0
            );
            
            const hasAllergens = allergenValues.some(val => val > 0);
            const allergenCount = allergenValues.filter(val => val > 0).length;
            const maxAllergenValue = Math.max(...allergenValues);
            
            // 알레르기 타입 추출
            const allergenTypes = allergenFields.filter((field, idx) => 
              allergenValues[idx] > 0
            );

            // 위험도 계산
            let riskLevel = 'none';
            if (maxAllergenValue >= 0.8) riskLevel = 'high';
            else if (maxAllergenValue >= 0.5) riskLevel = 'medium';
            else if (maxAllergenValue > 0) riskLevel = 'low';

            body.push({ 
              index: { 
                _index: 'allergens', 
                _id: processedCount + index + 1 
              } 
            });

            const document = {
              ingredient_name: row.ingredient_name.trim(),
              // 원본 알레르기 데이터
              ...allergenFields.reduce((acc, field) => {
                acc[field] = parseFloat(row[field]) || 0;
                return acc;
              }, {}),
              note: row.note || '',
              // 분석된 메타데이터
              has_allergens: hasAllergens,
              allergen_count: allergenCount,
              allergen_types: allergenTypes,
              risk_level: riskLevel
            };

            body.push(document);
          }
        });

        if (body.length > 0) {
          await client.bulk({ 
            body,
            timeout: '60s',
            refresh: false
          });
          
          processedCount += batch.length;
          console.log(`📊 진행: ${processedCount.toLocaleString()} 재료`);
        }
        
        batch = [];
        
      } catch (error) {
        console.error(`❌ 배치 오류:`, error.message);
      }
    };

    fs.createReadStream('../data/allergen_ultra_clean.csv')
      .pipe(csv({
        quote: '"',
        escape: '"',
        skipEmptyLines: true
      }))
      .on('data', async (row) => {
        batch.push(row);

        if (batch.length >= batchSize) {
          await processBatch();
        }
      })
      .on('end', async () => {
        await processBatch(); // 마지막 배치
        console.log(`✅ 스트림 완료: 총 ${processedCount} 재료 처리`);
        resolve();
      })
      .on('error', (error) => {
        console.error('❌ 스트림 오류:', error.message);
        reject(error);
      });
  });
}

async function printAllergenStats(client) {
  try {
    console.log('\n📊 알레르기 데이터 통계:');
    
    // 위험도별 통계
    const riskStats = await client.search({
      index: 'allergens',
      body: {
        size: 0,
        aggs: {
          risk_levels: {
            terms: { field: 'risk_level' }
          }
        }
      }
    });

    console.log('🚨 위험도별 재료 수:');
    riskStats.aggregations.risk_levels.buckets.forEach(bucket => {
      console.log(`  ${bucket.key}: ${bucket.doc_count.toLocaleString()} 개`);
    });

    // 알레르기 타입별 통계 (상위 10개)
    const typeStats = await client.search({
      index: 'allergens',
      body: {
        size: 0,
        aggs: {
          allergen_types: {
            terms: { 
              field: 'allergen_types',
              size: 10
            }
          }
        }
      }
    });

    console.log('\n🔍 주요 알레르기 타입 (상위 10개):');
    typeStats.aggregations.allergen_types.buckets.forEach((bucket, index) => {
      console.log(`  ${index + 1}. ${bucket.key}: ${bucket.doc_count.toLocaleString()} 재료`);
    });

  } catch (error) {
    console.error('통계 조회 오류:', error.message);
  }
}

console.log('🚀 알레르기 데이터 Elasticsearch 인덱싱 시작...');
console.log('📝 특징: 직접 CSV 처리, 메타데이터 생성, 통계 분석');
loadAllergensToElasticsearch();