import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sdePath = path.join(__dirname, '../../eve-online-static-data-3133773-jsonl/types.jsonl');

// Cache en mémoire pour les recherches rapides
let typeCache = null;
let nameLookup = null;

/**
 * Charge tous les types en mémoire au démarrage
 */
async function loadTypes() {
  if (typeCache) return;

  console.log('📖 Loading SDE types into memory...');
  
  typeCache = new Map();
  nameLookup = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(sdePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      
      if (obj._key && obj.name?.en) {
        const typeData = {
          typeId: obj._key,
          name: obj.name.en,
          volume: obj.volume || 0,
          iconID: obj.iconID || null,
          published: obj.published !== false
        };

        typeCache.set(obj._key, typeData);

        // Index par nom (lowercase pour recherche insensible à la casse)
        const nameLower = obj.name.en.toLowerCase();
        nameLookup.set(nameLower, obj._key);
      }
    } catch (err) {
      // Ignore les lignes malformées
    }
  }

  console.log(`✅ Loaded ${typeCache.size} types into memory`);
}

/**
 * Recherche un type par nom
 * @param {string} name - Le nom à rechercher
 * @returns {Object|null} Les données du type ou null
 */
function findTypeByName(name) {
  if (!typeCache) {
    throw new Error('SDE types not loaded yet');
  }

  const nameLower = name.toLowerCase().trim();
  
  // Recherche exacte
  const typeId = nameLookup.get(nameLower);
  if (typeId) {
    return typeCache.get(typeId);
  }

  // Recherche approximative (contient le nom)
  for (const [cachedName, cachedTypeId] of nameLookup.entries()) {
    if (cachedName.includes(nameLower)) {
      return typeCache.get(cachedTypeId);
    }
  }

  return null;
}

/**
 * Récupère un type par ID
 * @param {number} typeId - L'ID du type
 * @returns {Object|null} Les données du type ou null
 */
function getTypeById(typeId) {
  if (!typeCache) {
    throw new Error('SDE types not loaded yet');
  }

  return typeCache.get(typeId) || null;
}

/**
 * Recherche plusieurs types par noms
 * @param {string[]} names - Array de noms à rechercher
 * @returns {Map} Map de nom -> typeData
 */
function findTypesByNames(names) {
  const results = new Map();
  
  for (const name of names) {
    const type = findTypeByName(name);
    if (type) {
      results.set(name, type);
    }
  }

  return results;
}

export default {
  loadTypes,
  findTypeByName,
  getTypeById,
  findTypesByNames
};
