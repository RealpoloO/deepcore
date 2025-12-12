import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sdePath = path.join(__dirname, '../../eve-online-static-data-3133773-jsonl/types.jsonl');
const dbPath = path.join(__dirname, '../../data/whatdidimine.db');

// Group IDs des minerais (basé sur la structure EVE Online)
const ORE_GROUPS = [
  450, // Arkonor
  451, // Bistot
  452, // Crokite
  453, // Dark Ochre
  454, // Gneiss
  455, // Hedbergite
  456, // Hemorphite
  457, // Jaspet
  458, // Kernite
  459, // Pyroxeres
  460, // Scordite
  461, // Omber
  462, // Veldspar
  463, // Plagioclase
  465, // Spodumain
  467, // Mercoxit
  469, // Ice
  711, // Compressed Ore
  712, // Compressed Ice
  1031 // Abyssal Ores
];

async function importSDE() {
  console.log('🚀 Import du SDE EVE Online...\n');

  // Vérifier que le fichier existe
  if (!fs.existsSync(sdePath)) {
    console.error(`❌ Fichier SDE introuvable: ${sdePath}`);
    process.exit(1);
  }

  // Ouvrir la base de données
  const db = new Database(dbPath);
  
  try {
    console.log('📖 Lecture du fichier types.jsonl...');
    
    const rl = readline.createInterface({
      input: fs.createReadStream(sdePath),
      crlfDelay: Infinity
    });

    let totalCount = 0;
    let oreCount = 0;
    const ores = [];

    // Parser chaque ligne
    for await (const line of rl) {
      totalCount++;
      
      try {
        const obj = JSON.parse(line);
        
        // Filtrer uniquement les minerais (par groupID)
        if (ORE_GROUPS.includes(obj.groupID) && obj.published !== false) {
          ores.push({
            typeId: obj._key,
            name: obj.name?.en || `Unknown Type ${obj._key}`,
            volume: obj.volume || 0,
            groupId: obj.groupID
          });
          oreCount++;
        }
      } catch (err) {
        console.error(`⚠️  Erreur ligne ${totalCount}:`, err.message);
      }
    }

    console.log(`\n✅ Types parsés: ${totalCount}`);
    console.log(`💎 Minerais trouvés: ${oreCount}\n`);

    // Insérer dans la base de données
    console.log('💾 Import dans la base de données...');
    
    const insert = db.prepare(`
      INSERT OR REPLACE INTO ore_types (type_id, name, volume, cached_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const insertMany = db.transaction((ores) => {
      for (const ore of ores) {
        insert.run(ore.typeId, ore.name, ore.volume);
      }
    });

    insertMany(ores);

    console.log(`✅ ${oreCount} minerais importés avec succès!\n`);

    // Afficher quelques exemples
    console.log('📋 Exemples importés:');
    const samples = db.prepare('SELECT type_id, name, volume FROM ore_types LIMIT 10').all();
    samples.forEach(ore => {
      console.log(`  Type ${ore.type_id}: ${ore.name} (${ore.volume} m³)`);
    });

    // Statistiques
    const stats = db.prepare('SELECT COUNT(*) as count FROM ore_types').get();
    console.log(`\n📊 Total dans la DB: ${stats.count} minerais`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error);
    process.exit(1);
  } finally {
    db.close();
  }

  console.log('\n🎉 Import terminé avec succès!');
}

// Exécuter l'import
importSDE().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
