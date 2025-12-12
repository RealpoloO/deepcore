/**
 * @fileoverview Gestion du stockage offline avec IndexedDB
 * Permet de stocker les données de minage localement pour un accès hors ligne
 * @module utils/offlineStorage
 */

const DB_NAME = 'WhatDidIMineDB';
const DB_VERSION = 1;
const STORES = {
  MINING_RECORDS: 'miningRecords',
  ORE_TYPES: 'oreTypes',
  CHARACTERS: 'characters',
  INDUSTRY_JOBS: 'industryJobs'
};

let dbInstance = null;

/**
 * Ouvre ou crée la base de données IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Erreur d\'ouverture:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[IndexedDB] Base ouverte avec succès');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[IndexedDB] Mise à jour du schéma...');

      // Store pour les enregistrements de minage
      if (!db.objectStoreNames.contains(STORES.MINING_RECORDS)) {
        const miningStore = db.createObjectStore(STORES.MINING_RECORDS, {
          keyPath: 'id',
          autoIncrement: true
        });
        miningStore.createIndex('characterId', 'characterId', { unique: false });
        miningStore.createIndex('date', 'date', { unique: false });
        miningStore.createIndex('typeId', 'typeId', { unique: false });
      }

      // Store pour les types de minerai
      if (!db.objectStoreNames.contains(STORES.ORE_TYPES)) {
        const oreStore = db.createObjectStore(STORES.ORE_TYPES, {
          keyPath: 'typeId'
        });
        oreStore.createIndex('name', 'name', { unique: false });
      }

      // Store pour les personnages
      if (!db.objectStoreNames.contains(STORES.CHARACTERS)) {
        const charStore = db.createObjectStore(STORES.CHARACTERS, {
          keyPath: 'characterId'
        });
        charStore.createIndex('name', 'characterName', { unique: false });
      }

      // Store pour les jobs d'industrie
      if (!db.objectStoreNames.contains(STORES.INDUSTRY_JOBS)) {
        const jobsStore = db.createObjectStore(STORES.INDUSTRY_JOBS, {
          keyPath: 'jobId'
        });
        jobsStore.createIndex('characterId', 'characterId', { unique: false });
        jobsStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Sauvegarde des enregistrements de minage
 * @param {Array<Object>} records - Enregistrements à sauvegarder
 * @param {number} characterId - ID du personnage
 * @returns {Promise<void>}
 *
 * @example
 * saveMiningRecords([
 *   { date: '2025-01-01', typeId: 1230, quantity: 1000 }
 * ], 123456);
 */
export async function saveMiningRecords(records, characterId) {
  const db = await openDB();
  const transaction = db.transaction([STORES.MINING_RECORDS], 'readwrite');
  const store = transaction.objectStore(STORES.MINING_RECORDS);

  const promises = records.map(record => {
    const data = {
      ...record,
      characterId,
      syncedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  await Promise.all(promises);
  console.log(`[IndexedDB] ${records.length} enregistrements de minage sauvegardés`);
}

/**
 * Récupère les enregistrements de minage pour un personnage
 * @param {number} characterId - ID du personnage
 * @param {Object} filters - Filtres optionnels (startDate, endDate)
 * @returns {Promise<Array<Object>>}
 *
 * @example
 * const records = await getMiningRecords(123456, {
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31'
 * });
 */
export async function getMiningRecords(characterId, filters = {}) {
  const db = await openDB();
  const transaction = db.transaction([STORES.MINING_RECORDS], 'readonly');
  const store = transaction.objectStore(STORES.MINING_RECORDS);
  const index = store.index('characterId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(characterId);

    request.onsuccess = () => {
      let records = request.result;

      // Appliquer les filtres
      if (filters.startDate) {
        records = records.filter(r => r.date >= filters.startDate);
      }
      if (filters.endDate) {
        records = records.filter(r => r.date <= filters.endDate);
      }

      console.log(`[IndexedDB] ${records.length} enregistrements récupérés`);
      resolve(records);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Erreur de récupération:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Sauvegarde les types de minerai
 * @param {Object} oreTypes - Map de typeId vers {name, volume}
 * @returns {Promise<void>}
 */
export async function saveOreTypes(oreTypes) {
  const db = await openDB();
  const transaction = db.transaction([STORES.ORE_TYPES], 'readwrite');
  const store = transaction.objectStore(STORES.ORE_TYPES);

  const promises = Object.entries(oreTypes).map(([typeId, data]) => {
    return new Promise((resolve, reject) => {
      const request = store.put({
        typeId: parseInt(typeId),
        ...data,
        cachedAt: new Date().toISOString()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  await Promise.all(promises);
  console.log(`[IndexedDB] ${Object.keys(oreTypes).length} types de minerai sauvegardés`);
}

/**
 * Récupère un type de minerai
 * @param {number} typeId - ID du type de minerai
 * @returns {Promise<Object|null>}
 */
export async function getOreType(typeId) {
  const db = await openDB();
  const transaction = db.transaction([STORES.ORE_TYPES], 'readonly');
  const store = transaction.objectStore(STORES.ORE_TYPES);

  return new Promise((resolve, reject) => {
    const request = store.get(typeId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Erreur de récupération:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Sauvegarde les personnages
 * @param {Array<Object>} characters - Liste des personnages
 * @returns {Promise<void>}
 */
export async function saveCharacters(characters) {
  const db = await openDB();
  const transaction = db.transaction([STORES.CHARACTERS], 'readwrite');
  const store = transaction.objectStore(STORES.CHARACTERS);

  const promises = characters.map(character => {
    return new Promise((resolve, reject) => {
      const request = store.put(character);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  await Promise.all(promises);
  console.log(`[IndexedDB] ${characters.length} personnages sauvegardés`);
}

/**
 * Récupère tous les personnages
 * @returns {Promise<Array<Object>>}
 */
export async function getCharacters() {
  const db = await openDB();
  const transaction = db.transaction([STORES.CHARACTERS], 'readonly');
  const store = transaction.objectStore(STORES.CHARACTERS);

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = () => {
      console.log(`[IndexedDB] ${request.result.length} personnages récupérés`);
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Erreur de récupération:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Sauvegarde les jobs d'industrie
 * @param {Array<Object>} jobs - Liste des jobs
 * @param {number} characterId - ID du personnage
 * @returns {Promise<void>}
 */
export async function saveIndustryJobs(jobs, characterId) {
  const db = await openDB();
  const transaction = db.transaction([STORES.INDUSTRY_JOBS], 'readwrite');
  const store = transaction.objectStore(STORES.INDUSTRY_JOBS);

  const promises = jobs.map(job => {
    const data = {
      ...job,
      characterId,
      syncedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  await Promise.all(promises);
  console.log(`[IndexedDB] ${jobs.length} jobs sauvegardés`);
}

/**
 * Récupère les jobs d'industrie pour un personnage
 * @param {number} characterId - ID du personnage
 * @returns {Promise<Array<Object>>}
 */
export async function getIndustryJobs(characterId) {
  const db = await openDB();
  const transaction = db.transaction([STORES.INDUSTRY_JOBS], 'readonly');
  const store = transaction.objectStore(STORES.INDUSTRY_JOBS);
  const index = store.index('characterId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(characterId);

    request.onsuccess = () => {
      console.log(`[IndexedDB] ${request.result.length} jobs récupérés`);
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Erreur de récupération:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Efface toutes les données offline
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  const db = await openDB();

  const storeNames = [
    STORES.MINING_RECORDS,
    STORES.ORE_TYPES,
    STORES.CHARACTERS,
    STORES.INDUSTRY_JOBS
  ];

  const transaction = db.transaction(storeNames, 'readwrite');

  const promises = storeNames.map(storeName => {
    return new Promise((resolve, reject) => {
      const request = transaction.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  await Promise.all(promises);
  console.log('[IndexedDB] Toutes les données effacées');
}

/**
 * Vérifie l'espace de stockage disponible
 * @returns {Promise<Object>} {usage, quota, percentUsed}
 */
export async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage;
    const quota = estimate.quota;
    const percentUsed = ((usage / quota) * 100).toFixed(2);

    console.log(`[Storage] Utilisé: ${(usage / 1024 / 1024).toFixed(2)} MB / ${(quota / 1024 / 1024).toFixed(2)} MB (${percentUsed}%)`);

    return {
      usage,
      quota,
      percentUsed: parseFloat(percentUsed)
    };
  }

  return null;
}

export default {
  saveMiningRecords,
  getMiningRecords,
  saveOreTypes,
  getOreType,
  saveCharacters,
  getCharacters,
  saveIndustryJobs,
  getIndustryJobs,
  clearAllData,
  checkStorageQuota
};
