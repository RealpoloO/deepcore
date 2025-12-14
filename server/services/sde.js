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
          groupId: obj.groupID || null,
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
  
  // Recherche exacte - parcourir TOUS les types pour trouver toutes les correspondances
  const matchingTypes = [];
  for (const type of typeCache.values()) {
    if (type.name.toLowerCase() === nameLower) {
      matchingTypes.push(type);
    }
  }

  // Si on a des correspondances exactes, choisir la meilleure
  if (matchingTypes.length > 0) {
    // Prioriser dans cet ordre:
    // 1. Published ET pas un blueprint
    // 2. Published
    // 3. Pas un blueprint
    // 4. N'importe lequel
    
    const publishedNonBlueprint = matchingTypes.find(t => 
      t.published && !t.name.toLowerCase().includes('blueprint')
    );
    if (publishedNonBlueprint) return publishedNonBlueprint;
    
    const published = matchingTypes.find(t => t.published);
    if (published) return published;
    
    const nonBlueprint = matchingTypes.find(t => 
      !t.name.toLowerCase().includes('blueprint')
    );
    if (nonBlueprint) return nonBlueprint;
    
    return matchingTypes[0];
  }

  // Recherche approximative (contient le nom)
  // Prioriser les items published qui ne sont PAS des blueprints
  let bestMatch = null;
  for (const type of typeCache.values()) {
    if (type.name.toLowerCase().includes(nameLower)) {
      // Priorité maximale: published + non-blueprint
      if (type.published && !type.name.toLowerCase().includes('blueprint')) {
        return type;
      }
      
      // Garder le meilleur match en backup
      if (!bestMatch || (type.published && !bestMatch.published)) {
        bestMatch = type;
      }
    }
  }
  
  return bestMatch;
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
