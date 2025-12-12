import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sdePath = path.join(__dirname, '../../eve-online-static-data-3133773-jsonl/types.jsonl');

async function testSDEParsing() {
  const rl = readline.createInterface({
    input: fs.createReadStream(sdePath),
    crlfDelay: Infinity
  });

  let count = 0;
  const testIds = [1230, 1228, 1224, 17470, 17471, 22];
  const found = {};

  for await (const line of rl) {
    count++;
    
    try {
      const obj = JSON.parse(line);
      
      if (testIds.includes(obj._key)) {
        found[obj._key] = {
          typeId: obj._key,
          nameEn: obj.name?.en || 'N/A',
          nameFr: obj.name?.fr || 'N/A',
          volume: obj.volume || 0,
          groupId: obj.groupID,
          published: obj.published
        };
      }
    } catch (err) {
      console.error(`Error parsing line ${count}:`, err.message);
    }
  }

  console.log('📊 Total types dans le fichier:', count);
  console.log('\n✅ Minerais trouvés:');
  
  testIds.forEach(id => {
    if (found[id]) {
      const ore = found[id];
      console.log(`\nType ${ore.typeId}:`);
      console.log(`  Name (en): ${ore.nameEn}`);
      console.log(`  Name (fr): ${ore.nameFr}`);
      console.log(`  Volume: ${ore.volume} m³`);
      console.log(`  Group ID: ${ore.groupId}`);
    } else {
      console.log(`\n❌ Type ${id}: Non trouvé`);
    }
  });
}

testSDEParsing().catch(console.error);
