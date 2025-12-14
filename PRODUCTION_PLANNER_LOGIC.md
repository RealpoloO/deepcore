# Production Planner - Documentation Complète de la Logique

**Date:** 13 décembre 2025  
**Objectif:** Ce document explique de façon extrêmement détaillée le fonctionnement du Production Planner, incluant chaque décision logique, chaque algorithme, et les raisons derrière chaque choix. Ce document est destiné à être imprimé pour analyse et identification de problèmes potentiels.

---

## Table des Matières

1. [Vue d'Ensemble du Système](#1-vue-densemble-du-système)
2. [Architecture et Flux de Données](#2-architecture-et-flux-de-données)
3. [Phase 1: Validation et Parsing des Entrées](#3-phase-1-validation-et-parsing-des-entrées)
4. [Phase 2: Calcul Récursif de l'Arbre de Production](#4-phase-2-calcul-récursif-de-larbre-de-production)
5. [Phase 3: Organisation des Jobs par Catégories](#5-phase-3-organisation-des-jobs-par-catégories)
6. [Phase 4: Optimisation et Split des Jobs](#6-phase-4-optimisation-et-split-des-jobs)
7. [Phase 5: Simulation et Timeline](#7-phase-5-simulation-et-timeline)
8. [Système de Cache (Actuellement Désactivé)](#8-système-de-cache-actuellement-désactivé)
9. [Blacklist et Filtrage](#9-blacklist-et-filtrage)
10. [Gestion du Stock](#10-gestion-du-stock)
11. [Problèmes Potentiels et Limitations](#11-problèmes-potentiels-et-limitations)
12. [Configuration et Paramètres](#12-configuration-et-paramètres)

---

## 1. Vue d'Ensemble du Système

### Objectif Principal
Le Production Planner calcule automatiquement TOUT ce qu'il faut pour produire un ou plusieurs items dans EVE Online, incluant:
- Tous les composants intermédiaires nécessaires
- Les matériaux de base à acheter
- Le nombre de runs de chaque blueprint
- Le temps de production total et par catégorie
- L'organisation optimale des jobs pour utiliser efficacement les slots de production

### Concept Fondamental: L'Arbre de Production
Imaginez que vous voulez fabriquer un "Avatar" (supercapital ship). Pour fabriquer un Avatar, vous avez besoin de:
- Capital Core Temperature Regulator (1x)
- Capital Sensor Cluster (1x)
- Capital Tungsten Carbide Armor Plate (2x)
- etc.

Mais CHACUN de ces composants nécessite d'autres composants. Par exemple, le Capital Core Temperature Regulator nécessite:
- Core Temperature Regulator (32x)
- Fernite Carbide (5x)
- Hypersynaptic Fibers (5x)

Et le Core Temperature Regulator lui-même nécessite:
- Construction Blocks (4x)
- Self-Harmonizing Power Core (1x)
- Thermoelectric Catalysts (4x)

**L'arbre de production** est cette structure hiérarchique qui descend jusqu'aux matériaux de base (Tritanium, Pyerite, etc.) qui ne peuvent pas être fabriqués et doivent être achetés.

---

## 2. Architecture et Flux de Données

### Schéma du Flux
```
┌──────────────────────────────────────────────────────────────┐
│ INPUT: jobsInput, stockText, config                          │
│ - jobsInput: [{product, runs, me, te}]                      │
│ - stockText: "Item Name  Quantity\n..."                     │
│ - config: {manufacturingSlots, reactionSlots, blacklist...} │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: VALIDATION & PARSING                                │
│ - Parser le stock (format texte → Map<typeID, quantity>)    │
│ - Valider chaque job demandé (product existe? blueprint?)   │
│ - Cloner le stock pour éviter les mutations                 │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: CALCUL RÉCURSIF                                     │
│ Pour chaque job demandé:                                     │
│   ├─ Calculer l'arbre de production (récursif)              │
│   ├─ Marquer depth=0 comme "end product"                    │
│   ├─ Descendre dans les composants (depth+1)                │
│   ├─ Utiliser le stock disponible                           │
│   ├─ Respecter la blacklist                                 │
│   └─ Accumuler: allJobs[], materialsNeeded                  │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: ORGANISATION PAR CATÉGORIES                         │
│ - Trier tous les jobs selon leur groupID:                   │
│   • intermediate_composite_reactions                         │
│   • fuel_blocks                                              │
│   • composite_reactions                                      │
│   • biochemical_reactions                                    │
│   • hybrid_reactions                                         │
│   • construction_components                                  │
│   • advanced_components                                      │
│   • capital_components                                       │
│   • end_product_jobs (jobs avec isEndProduct=true)          │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: OPTIMISATION & SPLIT                                │
│ Pour chaque catégorie:                                       │
│   ├─ Séparer reactions vs manufacturing                     │
│   ├─ Regrouper les jobs identiques (même produit)           │
│   ├─ Allouer les slots disponibles intelligemment           │
│   ├─ Splitter les jobs longs SAUF end products              │
│   └─ Respecter dontSplitShorterThan threshold               │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: SIMULATION & TIMELINE                               │
│ - Simuler l'exécution avec slots disponibles                │
│ - Calculer startTime/endTime de chaque job                  │
│ - Déterminer le temps total de production                   │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ OUTPUT: Plan de production complet                           │
│ - materials: [{typeID, name, quantity}]                     │
│ - jobs: {category: [jobs]}                                   │
│ - categoryTimings: {totalTimeDays, slotsUsed}               │
│ - totalProductionTimeDays                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Validation et Parsing des Entrées

### 3.1 Validation des Quantités

**Fonction:** `validateQuantity(quantity, fieldName)`

**Règles de validation:**
- Doit être un nombre fini (pas NaN, pas Infinity)
- Doit être entre 1 et 1,000,000,000 (1 milliard)
- Arrondi vers le bas (Math.floor) pour éviter les fractions

**Pourquoi ces limites?**
- **Minimum 1:** On ne peut pas fabriquer 0 ou des quantités négatives
- **Maximum 1 milliard:** Limite de sécurité pour éviter les overflow et les calculs trop longs
- **Arrondi:** EVE Online ne supporte pas les quantités fractionnaires

**Code:**
```javascript
function validateQuantity(quantity, fieldName = 'quantity') {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`${fieldName} must be between 1 and ${MAX_QUANTITY.toLocaleString()}`);
  }
  return Math.floor(quantity);
}
```

### 3.2 Parsing du Stock

**Fonction:** `parseStock(stockText)`

**Format attendu:**
```
Item Name  Quantity
Tritanium  1000000
Pyerite  500000
Capital Core Temperature Regulator  5
```

**Processus:**
1. Split le texte par lignes (`\n`)
2. Limiter à 10,000 lignes max (sécurité)
3. Pour chaque ligne:
   - Trim les espaces
   - Matcher le pattern: `"Nom de l'item  Quantité"`
   - Utiliser regex: `/^(.+?)\s+(\d+)$/`
4. Trouver le typeID via `sde.findTypeByName(itemName)`
5. Accumuler dans une Map: `stock.set(typeID, quantity)`

**Gestion des erreurs:**
- Item non trouvé: Log warning, skip la ligne
- Quantité invalide: Log warning, skip la ligne
- Ligne mal formatée: Skip silencieusement

**Pourquoi une Map?**
- Lookup O(1) ultra rapide pendant le calcul
- Pas de duplication de typeID (accumulation automatique)

### 3.3 Clonage du Stock

**CRITIQUE:** Le stock est cloné AU DÉBUT de chaque calcul:
```javascript
const originalStock = await parseStock(stockText);
const stock = new Map(originalStock); // CLONE
```

**Pourquoi cloner?**
Le stock est **muté** pendant le calcul récursif (consommation). Sans clonage:
- Premier calcul: utilise le stock, le modifie
- Deuxième calcul (re-clic): stock déjà vide → résultats différents

**Bug historique:** Avant le clonage, re-calculer donnait des résultats différents (181 jobs → 1 job) car le stock avait été vidé lors du premier calcul.

---

## 4. Phase 2: Calcul Récursif de l'Arbre de Production

### 4.1 Fonction Principale: `calculateProductionTree`

**Signature:**
```javascript
function calculateProductionTree(
  productTypeID,      // L'ID du produit à fabriquer
  requiredQuantity,   // Quantité requise
  stock,              // Stock disponible (Map, muté)
  blacklist,          // Configuration de blacklist
  materialsNeeded,    // Accumulation des matériaux (Map, muté)
  jobs,               // Accumulation des jobs (Array, muté)
  depth = 0           // Profondeur actuelle (0 = end product)
)
```

### 4.2 Algorithme Récursif - Explication Pas-à-Pas

#### Étape 1: Validation de Profondeur
```javascript
if (depth > MAX_DEPTH) {
  logger.warn(`Max depth (${MAX_DEPTH}) reached for typeID ${productTypeID}`);
  return;
}
```

**Pourquoi?**
- Protection contre les boucles infinies
- Certains blueprints pourraient avoir des dépendances circulaires (rare mais possible)
- MAX_DEPTH = 20 (suffisant pour tout blueprint EVE Online)

#### Étape 2: Consommation du Stock
```javascript
const availableStock = stock.get(productTypeID) || 0;
let quantityToProduce = requiredQuantity - availableStock;

if (quantityToProduce <= 0) {
  // On a assez en stock, pas besoin de produire
  stock.set(productTypeID, availableStock - requiredQuantity);
  return;
}

// Utiliser tout le stock disponible
if (availableStock > 0) {
  stock.set(productTypeID, 0);
}
```

**Logique:**
1. Vérifier combien on a en stock
2. Si on a assez: consommer le stock, STOP (pas de production nécessaire)
3. Si on n'a pas assez: utiliser tout le stock disponible, produire le reste

**Exemple:**
- Besoin: 100x Core Temperature Regulator
- Stock: 30x
- Résultat: Consommer 30x du stock, produire 70x

#### Étape 3: Vérification Blacklist
```javascript
if (isBlacklisted(productTypeID, blacklist)) {
  // Ajouter aux matériaux à acheter
  const currentNeeded = materialsNeeded.get(productTypeID) || 0;
  materialsNeeded.set(productTypeID, currentNeeded + quantityToProduce);
  return;
}
```

**Pourquoi la blacklist?**
- Certains items sont plus rentables à acheter qu'à fabriquer
- Exemple: Fuel Blocks (si on n'a pas de setup ice mining)
- L'utilisateur peut blacklister par catégorie ou par nom

**Comportement:**
Si l'item est blacklisté → l'ajouter aux matériaux à acheter, ne PAS descendre dans la récursion.

#### Étape 4: Recherche du Blueprint
```javascript
const blueprint = blueprintService.getBlueprintByProduct(productTypeID);

if (!blueprint) {
  // Pas de blueprint = matériau de base (Tritanium, etc.)
  const currentNeeded = materialsNeeded.get(productTypeID) || 0;
  materialsNeeded.set(productTypeID, currentNeeded + quantityToProduce);
  return;
}
```

**Logique:**
- Si pas de blueprint trouvé = matériau de base (raw material)
- Exemples: Tritanium, Pyerite, Mexallon, etc.
- Ces matériaux doivent être achetés → ajouter à `materialsNeeded`

#### Étape 5: Calcul des Runs Nécessaires
```javascript
const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
const productsPerRun = activity.products[0]?.quantity || 1;
const runsNeeded = Math.ceil(quantityToProduce / productsPerRun);
```

**Explication:**
- Chaque blueprint produit une certaine quantité par run
- Exemple: Blueprint "Capital Core Temperature Regulator" produit 1x par run
- Si on a besoin de 10x → il faut 10 runs
- **Math.ceil:** Arrondir vers le haut (on ne peut pas faire 2.5 runs)

**Pourquoi toujours arrondir vers le haut?**
Si on a besoin de 15x et que le blueprint produit 10x par run:
- 15 / 10 = 1.5
- Math.ceil(1.5) = 2 runs
- 2 runs × 10 produits = 20 produits (5 de surplus, mais c'est nécessaire)

#### Étape 6: Calcul des Matériaux et du Temps
```javascript
// Calculer les matériaux avec bonus ME (Material Efficiency)
const materials = blueprintService.calculateMaterials(blueprint, runsNeeded, 10);

// Calculer le temps avec bonus TE (Time Efficiency)
const productionTime = blueprintService.calculateProductionTime(blueprint, runsNeeded, 20);
```

**Material Efficiency (ME):**
- ME = 10 signifie 10% de réduction des matériaux
- Exemple: Blueprint nécessite 1000 Tritanium base
- Avec ME 10: 1000 × (1 - 0.10) = 900 Tritanium

**Time Efficiency (TE):**
- TE = 20 signifie 20% de réduction du temps
- Exemple: Blueprint prend 3600 secondes base
- Avec TE 20: 3600 × (1 - 0.20) = 2880 secondes

**Pourquoi ME=10 et TE=20?**
- Ce sont des valeurs standards pour des BPOs (Blueprint Originals) bien recherchés
- Valeurs réalistes pour un joueur sérieux d'EVE Online
- TODO: Permettre à l'utilisateur de configurer ces valeurs

#### Étape 7: Création du Job
```javascript
const job = {
  blueprintTypeID: blueprint.blueprintTypeID,
  productTypeID: productTypeID,
  productName: type?.name || `Unknown (${productTypeID})`,
  runs: runsNeeded,
  quantityProduced: runsNeeded * productsPerRun,
  activityType: activityType, // 'reaction' ou 'manufacturing'
  productionTime: productionTime, // en secondes
  productionTimeDays: productionTime / 86400, // conversion en jours
  materials: materials, // [{typeID, quantity}]
  depth: depth,
  isEndProduct: depth === 0 // CRITIQUE: marquer les produits finaux
};

jobs.push(job);
```

**Champs importants:**
- **depth:** Profondeur dans l'arbre (0 = produit demandé par l'utilisateur)
- **isEndProduct:** Flag CRITIQUE pour éviter de splitter les produits finaux
- **activityType:** Détermine si c'est une reaction (20 slots) ou manufacturing (30 slots)
- **productionTimeDays:** Temps en jours (plus lisible pour l'utilisateur)

#### Étape 8: Récursion sur les Matériaux
```javascript
for (const material of materials) {
  calculateProductionTree(
    material.typeID,
    material.quantity,
    stock,
    blacklist,
    materialsNeeded,
    jobs,
    depth + 1 // IMPORTANT: incrémenter la profondeur
  );
}
```

**Récursion:**
- Pour chaque matériau nécessaire, appeler récursivement `calculateProductionTree`
- **depth + 1:** Les composants ont une profondeur supérieure
- Exemple d'arbre:
  ```
  Avatar (depth=0, isEndProduct=true)
  ├─ Capital Core Temperature Regulator (depth=1)
  │  ├─ Core Temperature Regulator (depth=2)
  │  │  ├─ Construction Blocks (depth=3)
  │  │  │  ├─ Tritanium (depth=4, raw material)
  │  │  │  └─ Pyerite (depth=4, raw material)
  │  │  └─ Self-Harmonizing Power Core (depth=3)
  │  └─ Fernite Carbide (depth=2)
  └─ Capital Sensor Cluster (depth=1)
  ```

### 4.3 Accumulation des Données

**Deux accumulateurs mutés:**
1. **jobs (Array):** Liste de TOUS les jobs à effectuer
2. **materialsNeeded (Map<typeID, quantity>):** Matériaux de base à acheter

**Pourquoi muter des accumulateurs plutôt que retourner des valeurs?**
- Performance: Évite de créer des milliers d'objets intermédiaires
- Simplicité: Un seul tableau/map pour tout l'arbre
- Récursion: Plus facile de passer des références mutables

---

## 5. Phase 3: Organisation des Jobs par Catégories

### 5.1 Fonction: `organizeJobs(jobs)`

**Objectif:**
Trier les jobs dans des catégories logiques qui correspondent à l'ordre de production dans EVE Online.

**Catégories (dans l'ordre):**
1. **end_product_jobs:** Produits finaux demandés par l'utilisateur (depth=0)
2. **fuel_blocks:** Fuel Blocks (si non blacklistés)
3. **intermediate_composite_reactions:** Réactions simples (matériaux de base pour composites)
4. **composite_reactions:** Réactions complexes (Composites)
5. **biochemical_reactions:** Réactions biochimiques (Boosters, Neofullerenes, etc.)
6. **hybrid_reactions:** Réactions hybrides (Polymers)
7. **construction_components:** Composants de construction (basiques)
8. **advanced_components:** Composants avancés (pour capitals)
9. **capital_components:** Composants capitals (pour supercapitals)

### 5.2 Algorithme de Catégorisation

```javascript
for (const job of jobs) {
  // RÈGLE 1: Les end products vont TOUJOURS dans end_product_jobs
  if (job.isEndProduct) {
    organized.end_product_jobs.push(job);
    continue;
  }

  // RÈGLE 2: Chercher la catégorie via le groupID
  const type = sde.getTypeById(job.productTypeID);
  if (!type) {
    organized.end_product_jobs.push(job); // fallback
    continue;
  }

  const category = productionCategories.getCategoryByGroupID(type.groupId);
  
  // RÈGLE 3: Ajouter à la catégorie correspondante
  if (organized[category]) {
    organized[category].push(job);
  } else {
    organized.end_product_jobs.push(job); // fallback
  }
}
```

### 5.3 Détermination de la Catégorie via GroupID

**Fichier:** `productionCategories.js`

**Mapping GroupID → Catégorie:**
```javascript
const GROUP_CATEGORIES = {
  intermediate_composite_reactions: [428, 436],
  fuel_blocks: [1136, 1137],
  composite_reactions: [429, 484, 1888],
  biochemical_reactions: [661, 662, 712, 1890, 4096, 4097],
  hybrid_reactions: [974, 977, 1889],
  construction_components: [334],
  advanced_components: [913, 914],
  capital_components: [873]
};
```

**Exemple:**
- "Capital Core Temperature Regulator" a groupId = 873
- 873 est dans capital_components
- MAIS si isEndProduct = true → va dans end_product_jobs

**Pourquoi cette organisation?**
- Reflète l'ordre de production naturel dans EVE Online
- Les réactions de base doivent être faites en premier
- Les composants de construction viennent ensuite
- Les composants capitals sont les derniers avant le produit final

### 5.4 Importance de la Règle "isEndProduct"

**CRITIQUE:** Si on ne vérifie pas `isEndProduct` en premier, un produit final comme "Capital Core Temperature Regulator" irait dans "capital_components" au lieu de "end_product_jobs".

**Problème si mal catégorisé:**
- L'utilisateur demande "Capital Core Temperature Regulator 1 run"
- Le système le met dans "capital_components"
- L'optimisation pourrait le splitter (car pas marqué comme end product visuellement)
- L'utilisateur voit "2 jobs de 0.075d" au lieu de "1 job de 0.15d"
- **Comportement incorrect:** L'utilisateur veut 1 job, pas 2 jobs

**Solution:**
Toujours vérifier `isEndProduct` AVANT de regarder le groupID.

---

## 6. Phase 4: Optimisation et Split des Jobs

### 6.1 Vue d'Ensemble

**Objectif:**
Optimiser l'utilisation des slots de production en:
1. Regroupant les jobs identiques (même produit, même ME/TE)
2. Splittant les jobs longs pour paralléliser la production
3. Respectant les contraintes (slots disponibles, seuil de split, end products)

**Fonction:** `optimizeJobsForCategory(jobs, config, activityType, categoryName)`

**Paramètres:**
- **jobs:** Liste des jobs à optimiser (tous de la même catégorie)
- **config:** Configuration (manufacturingSlots, reactionSlots, dontSplitShorterThan)
- **activityType:** 'reaction' ou 'manufacturing'
- **categoryName:** Nom de la catégorie (pour les logs)

**Slots disponibles:**
- Reactions: 20 slots (config.reactionSlots)
- Manufacturing: 30 slots (config.manufacturingSlots)

### 6.2 Étape 1: Regroupement des Jobs Identiques

**Objectif:**
Si plusieurs jobs produisent le même item avec les mêmes bonuses (ME/TE), les regrouper.

**Exemple:**
```
Job 1: Core Temperature Regulator, 10 runs, 2.37 jours
Job 2: Core Temperature Regulator, 15 runs, 3.55 jours
Job 3: Core Temperature Regulator, 5 runs, 1.18 jours
```

**Après regroupement:**
```
Job consolidé: Core Temperature Regulator, 30 runs, 7.1 jours
```

**Code:**
```javascript
const groupedJobs = new Map();

for (const job of jobs) {
  const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
  
  if (!groupedJobs.has(key)) {
    groupedJobs.set(key, {
      ...job,
      totalRuns: 0,
      totalQuantity: 0
    });
  }
  
  const group = groupedJobs.get(key);
  group.totalRuns += job.runs;
  group.totalQuantity += job.quantityProduced;
}
```

**Pourquoi regrouper?**
- Simplifie l'optimisation
- Permet de mieux visualiser les gros jobs
- Facilite le split intelligent

### 6.3 Étape 2: Vérification des Contraintes de Slots

**RÈGLE CRITIQUE:** Si on a plus de produits différents que de slots disponibles → ERREUR

**Code:**
```javascript
const uniqueProductCount = consolidatedJobs.length;
if (uniqueProductCount > slotsAvailable) {
  throw new Error(
    `❌ Impossible : ${uniqueProductCount} produits différents mais seulement ${slotsAvailable} slots disponibles.`
  );
}
```

**Exemple d'erreur:**
- 25 produits différents dans "construction_components"
- Seulement 20 slots de manufacturing
- **Impossible:** On ne peut pas produire 25 produits en parallèle avec 20 slots

**Pourquoi cette erreur est-elle possible?**
- Si l'arbre de production est très large (beaucoup de composants différents)
- Rare en pratique, mais possible pour des supercapitals avec beaucoup de variété

**Solution possible:**
- Augmenter le nombre de slots (config)
- Ou accepter que certains jobs se fassent en séquence (future feature)

### 6.4 Étape 3: Allocation Initiale des Slots

**Principe:**
Chaque produit a droit à **au moins 1 slot** (= 1 job minimum).

**Code:**
```javascript
const baseJobsCount = uniqueProductCount;
let bonusJobsAvailable = slotsAvailable - baseJobsCount;
```

**Exemple:**
- 15 produits différents
- 30 slots disponibles
- Allocation de base: 15 jobs (1 par produit)
- Slots bonus: 30 - 15 = 15 slots restants

**Ces slots bonus serviront à splitter les jobs longs.**

### 6.5 Étape 4: Distribution Intelligente des Slots Bonus

**Objectif:**
Distribuer les slots bonus aux jobs les plus longs pour maximiser la parallélisation.

**Algorithme:**
```javascript
// Initialiser: 1 job par produit
const jobsAllocation = new Map();
for (const job of sortedJobs) {
  const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
  jobsAllocation.set(key, {
    allocatedJobs: 1,
    productionTimeDays: job.productionTimeDays
  });
}

// Distribuer les slots bonus UN PAR UN
while (bonusJobsAvailable > 0) {
  // Trouver le job le plus long qui peut encore être splitté
  let bestJob = null;
  let bestTime = 0;
  
  for (const job of sortedJobs) {
    // RÈGLE 1: Ne JAMAIS splitter les end products
    if (job.isEndProduct) continue;
    
    const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
    const allocation = jobsAllocation.get(key);
    
    // Calculer le temps après split
    const timePerJobIfSplit = job.productionTimeDays / (allocation.allocatedJobs + 1);
    
    // RÈGLE 2: Ne splitter que si timePerJobIfSplit > dontSplitShorterThan
    if (job.runs > allocation.allocatedJobs && 
        timePerJobIfSplit > config.dontSplitShorterThan) {
      
      const currentTimePerJob = job.productionTimeDays / allocation.allocatedJobs;
      
      if (currentTimePerJob > bestTime) {
        bestTime = currentTimePerJob;
        bestJob = job;
      }
    }
  }
  
  // Si aucun job ne peut être splitté, stop
  if (!bestJob) break;
  
  // Allouer un slot bonus au meilleur job
  const key = `${bestJob.productTypeID}_${bestJob.me || 0}_${bestJob.te || 0}`;
  jobsAllocation.get(key).allocatedJobs++;
  bonusJobsAvailable--;
}
```

### 6.6 Les Deux Règles de Split CRITIQUES

#### RÈGLE 1: Ne JAMAIS Splitter les End Products

**Code:**
```javascript
if (job.isEndProduct) continue;
```

**Pourquoi?**
- L'utilisateur demande "Avatar 10 runs"
- Il veut voir "1 job de 10 runs" dans la catégorie "end_product_jobs"
- PAS "10 jobs de 1 run"
- Splitter les end products = trahir l'intention de l'utilisateur

**Exemple concret:**
- Input: "Capital Core Temperature Regulator 1 run"
- Temps: 0.15 jours
- SANS protection: Système pourrait splitter en "2 jobs de 0.075j"
- AVEC protection: Reste "1 job de 0.15j" (correct)

#### RÈGLE 2: Ne Splitter Que Si le Résultat > dontSplitShorterThan

**Code:**
```javascript
const timePerJobIfSplit = job.productionTimeDays / (allocation.allocatedJobs + 1);
if (timePerJobIfSplit > config.dontSplitShorterThan) {
  // OK pour splitter
}
```

**Valeur par défaut:** `dontSplitShorterThan = 1.2 jours`

**Pourquoi ce seuil?**
- **Performance:** Éviter de créer des centaines de tiny jobs (overhead de gestion)
- **Réalisme:** Dans EVE Online, gérer beaucoup de tiny jobs = perte de temps
- **UI:** Afficher 100 jobs de 0.5h = UI surchargée et illisible

**Exemple:**
- Job: Core Temperature Regulator, 32 runs, 2.37 jours
- Allocation actuelle: 1 job
- Si on split en 2: 2.37 / 2 = 1.185 jours
- 1.185 < 1.2 (seuil) → **NE PAS SPLITTER**
- Résultat: Reste 1 job de 2.37 jours (correct)

**Autre exemple:**
- Job: Capital Sensor Cluster, 100 runs, 15 jours
- Split en 2: 15 / 2 = 7.5 jours > 1.2 → OK
- Split en 3: 15 / 3 = 5 jours > 1.2 → OK
- Split en 4: 15 / 4 = 3.75 jours > 1.2 → OK
- Split en 13: 15 / 13 = 1.15 jours < 1.2 → STOP
- Résultat: Maximum 12 jobs

### 6.7 Étape 5: Split Effectif des Jobs

Une fois l'allocation déterminée, on split réellement les jobs:

```javascript
for (const job of consolidatedJobs) {
  const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
  const allocation = jobsAllocation.get(key);
  const allocatedJobs = allocation.allocatedJobs;
  
  const shouldSplit = allocatedJobs > 1;
  
  if (shouldSplit) {
    const runsPerJob = Math.ceil(job.runs / allocatedJobs);
    const quantityPerJob = Math.ceil(job.quantityProduced / allocatedJobs);
    
    let remainingRuns = job.runs;
    let splitIndex = 0;
    
    while (remainingRuns > 0) {
      const splitRuns = Math.min(runsPerJob, remainingRuns);
      const splitQuantity = Math.min(quantityPerJob, remainingQuantity);
      const splitTime = singleRunDurationDays * splitRuns;
      
      optimized.push({
        ...job,
        runs: splitRuns,
        quantityProduced: splitQuantity,
        productionTime: splitTime * 86400,
        productionTimeDays: splitTime,
        splitFrom: job.runs,
        splitIndex: ++splitIndex,
        splitCount: allocatedJobs
      });
      
      remainingRuns -= splitRuns;
    }
  } else {
    // Pas de split, garder le job tel quel
    optimized.push(job);
  }
}
```

**Exemple de split:**
```
Job initial: Core Temperature Regulator, 100 runs, 7.4 jours
Allocation: 3 jobs
Split:
  Job 1: 34 runs, 2.52 jours, splitIndex=1/3
  Job 2: 33 runs, 2.44 jours, splitIndex=2/3
  Job 3: 33 runs, 2.44 jours, splitIndex=3/3
```

**Champs ajoutés lors du split:**
- **splitFrom:** Nombre de runs original (pour traçabilité)
- **splitIndex:** Index de ce split (1, 2, 3, etc.)
- **splitCount:** Nombre total de splits (3 dans cet exemple)

### 6.8 Vérification Finale de Sécurité

**Code:**
```javascript
let totalJobsCount = 0;
for (const allocation of jobsAllocation.values()) {
  totalJobsCount += allocation.allocatedJobs;
}

if (totalJobsCount > slotsAvailable) {
  throw new Error(
    `❌ BUG : Allocation a créé ${totalJobsCount} jobs mais seulement ${slotsAvailable} slots disponibles !`
  );
}
```

**Pourquoi cette vérification?**
- Détecter les bugs dans l'algorithme d'allocation
- Si cette erreur se déclenche = bug dans le code, pas une erreur utilisateur
- Devrait JAMAIS arriver si l'algorithme est correct

---

## 7. Phase 5: Simulation et Timeline

### 7.1 Objectif

Calculer:
- **startTime:** Quand chaque job commence
- **endTime:** Quand chaque job se termine
- **slotUsed:** Quel slot utilise chaque job
- **totalTimeDays:** Temps total de production pour cette catégorie

### 7.2 Algorithme de Simulation

**Principe:**
On simule l'exécution des jobs comme si on avait N slots disponibles. Chaque job est assigné au slot qui se libère le plus tôt.

**Code:**
```javascript
const jobQueue = [...optimized].sort((a, b) => b.productionTimeDays - a.productionTimeDays);
const slotTimelines = Array(slotsAvailable).fill(0);

for (const job of jobQueue) {
  // Trouver le slot qui se libère le plus tôt
  const earliestSlotIndex = slotTimelines.indexOf(Math.min(...slotTimelines));
  const startTime = slotTimelines[earliestSlotIndex];
  
  // Ajouter ce job au slot
  slotTimelines[earliestSlotIndex] = startTime + job.productionTimeDays;
  
  // Mettre à jour le job
  job.startTime = startTime;
  job.endTime = startTime + job.productionTimeDays;
  job.slotUsed = earliestSlotIndex + 1;
}

// Le temps total est le maximum des timelines
totalTimeDays = Math.max(...slotTimelines);
```

### 7.3 Exemple de Simulation

**Slots disponibles:** 3  
**Jobs:**
1. Job A: 5 jours
2. Job B: 3 jours
3. Job C: 2 jours
4. Job D: 1 jour

**Timeline initiale:**
```
Slot 1: 0
Slot 2: 0
Slot 3: 0
```

**Itération 1 - Job A (5j):**
```
Slot le plus tôt: Slot 1 (0j)
Job A: startTime=0, endTime=5, slotUsed=1

Slot 1: 5
Slot 2: 0
Slot 3: 0
```

**Itération 2 - Job B (3j):**
```
Slot le plus tôt: Slot 2 (0j)
Job B: startTime=0, endTime=3, slotUsed=2

Slot 1: 5
Slot 2: 3
Slot 3: 0
```

**Itération 3 - Job C (2j):**
```
Slot le plus tôt: Slot 3 (0j)
Job C: startTime=0, endTime=2, slotUsed=3

Slot 1: 5
Slot 2: 3
Slot 3: 2
```

**Itération 4 - Job D (1j):**
```
Slot le plus tôt: Slot 3 (2j)
Job D: startTime=2, endTime=3, slotUsed=3

Slot 1: 5
Slot 2: 3
Slot 3: 3
```

**Temps total:** max(5, 3, 3) = **5 jours**

### 7.4 Pourquoi Trier par Durée Décroissante?

**Code:**
```javascript
const jobQueue = [...optimized].sort((a, b) => b.productionTimeDays - a.productionTimeDays);
```

**Algorithme:** Longest Job First (LJF)

**Avantage:**
- Minimise le temps total en plaçant les gros jobs en premier
- Les petits jobs peuvent "remplir les trous" après

**Exemple:**
Sans tri (ordre aléatoire):
```
Slot 1: Job 1 (10j) → Slot 1 total: 10j
Slot 2: Job 2 (8j) → Slot 2 total: 8j
Slot 3: Job 3 (1j) → Slot 3 total: 1j
Slot 4: Job 4 (1j) → Slot 4 total: 1j
Temps total: 10j
```

Avec tri (LJF):
```
Slot 1: Job 1 (10j) → Slot 1 total: 10j
Slot 2: Job 2 (8j) + Job 4 (1j) → Slot 2 total: 9j
Slot 3: Job 3 (1j) → Slot 3 total: 1j
Temps total: 10j (pareil mais meilleure utilisation)
```

**Note:** Dans cet exemple le temps total est le même, mais avec plus de jobs, LJF donne généralement de meilleurs résultats.

---

## 8. Système de Cache (Actuellement Désactivé)

### 8.1 Concept du Cache

**Objectif initial:**
Mémoriser les résultats de `calculateProductionTree` pour éviter de recalculer les mêmes sous-arbres.

**Exemple:**
```
Avatar nécessite:
  ├─ Capital Core Temperature Regulator (calcul A)
  └─ Capital Sensor Cluster (calcul B)

Erebus nécessite:
  ├─ Capital Core Temperature Regulator (calcul A - déjà fait!)
  └─ Capital Propulsion Engine (calcul C)
```

**Bénéfice théorique:** Calcul A fait une seule fois, réutilisé pour Avatar et Erebus.

### 8.2 Implémentation du Cache

**Classe:** `ProductionCache`

**Clé de cache:**
```javascript
generateKey(typeID, quantity, stockValue, blacklistHash) {
  return `${typeID}:${quantity}:${stockValue}:${blacklistHash}`;
}
```

**Composants de la clé:**
1. **typeID:** L'item à produire
2. **quantity:** Quantité à produire
3. **stockValue:** Stock disponible pour cet item
4. **blacklistHash:** Hash de la configuration blacklist

**Pourquoi inclure stockValue?**
Le résultat dépend du stock disponible:
- Avec 50x en stock: produire 0x
- Avec 0x en stock: produire 100x

### 8.3 Problème: Stock Mutation

**Le problème fatal:**
Le stock est **muté** pendant le calcul récursif. Chaque appel à `calculateProductionTree` modifie le stock (consommation).

**Scénario problématique:**
```
1. Calculer Avatar
   ├─ Calculer Capital Core (stockValue=10)
   │  ├─ Consommer 10x du stock
   │  ├─ Produire 0x
   │  └─ Mettre en cache: key="12345:10:10:hash" → result="produire 0x"
   │
2. Calculer Erebus
   ├─ Calculer Capital Core (stockValue=0 maintenant!)
   │  ├─ Cache lookup: key="12345:10:0:hash" → MISS (stockValue différent)
   │  ├─ Calculer: produire 10x
   │  └─ Mettre en cache: key="12345:10:0:hash" → result="produire 10x"
```

**Le cache devient inutile** car le stockValue change constamment.

**Pire:** Si on utilise le stockValue AVANT consommation dans la clé:
```
1. Premier calcul: stockValue=10, cache key="...10..."
   Résultat: "produire 0x" (car 10x en stock)
   
2. Re-calcul (sans recharger le stock): stockValue=0 (consommé)
   Cache key="...0..." (différente!)
   Cache MISS → recalcule
   
3. Résultats différents entre premier et second calcul
```

### 8.4 Pourquoi le Cache est Désactivé

**Code:**
```javascript
// Vérifier le cache (DÉSACTIVÉ : problème avec stock mutant)
// const stockValue = stock.get(productTypeID) || 0;
// const cached = productionCache.get(cacheKey);
// if (cached) { ... }
```

**Raisons:**
1. Stock mutation rend le cache peu efficace (trop de misses)
2. Complexité d'implémentation pour gérer correctement le stock
3. Gain de performance marginal pour la plupart des cas d'usage
4. Le calcul est déjà assez rapide (< 1 seconde pour la plupart des plans)

**Solution possible (future):**
- Ne pas muter le stock pendant le calcul
- Retourner la quantité consommée plutôt que muter directement
- Puis appliquer toutes les consommations à la fin
- Plus complexe mais permettrait le cache

### 8.5 Impact de la Désactivation

**Performance:**
- Pour un seul produit (ex: Avatar): aucun impact (pas de réutilisation)
- Pour plusieurs produits similaires: légère perte (quelques ms)
- Pour des calculs massifs (50+ produits): perte de ~100-500ms

**Conclusion:** Désactivation acceptable pour simplifier le code et éviter les bugs.

---

## 9. Blacklist et Filtrage

### 9.1 Concept de la Blacklist

**Objectif:**
Permettre à l'utilisateur de marquer certains items comme "à acheter" plutôt que "à produire".

**Cas d'usage:**
1. **Fuel Blocks:** Plus rentable d'acheter que de produire (si pas de setup ice)
2. **Composants basiques:** Parfois moins cher au marché
3. **Time-saving:** Éviter de produire des items longs pour un profit marginal

### 9.2 Types de Blacklist

**1. Blacklist par catégorie:**
```javascript
blacklist: {
  fuelBlocks: true,
  intermediateCompositeReactions: false,
  compositeReactions: false,
  biochemicalReactions: true,
  // ...
}
```

**2. Blacklist custom (par nom):**
```javascript
blacklist: {
  customItems: "Fuel Block\nTritanium\nPyerite"
}
```

### 9.3 Fonction de Vérification

```javascript
function isBlacklisted(typeID, blacklist) {
  const type = sde.getTypeById(typeID);
  if (!type) return false;

  // Vérifier blacklist par catégories (via groupID)
  if (productionCategories.isBlacklistedByCategory(type.groupId, blacklist)) {
    return true;
  }

  // Vérifier blacklist custom items
  if (blacklist.customItems) {
    const customItems = blacklist.customItems.split('\n')
      .map(item => item.trim())
      .filter(Boolean);
    if (customItems.some(custom => type.name.toLowerCase().includes(custom.toLowerCase()))) {
      return true;
    }
  }

  // Vérifier Fuel Blocks spécifiquement
  if (blacklist.fuelBlocks && type.name.includes('Fuel Block')) {
    return true;
  }

  return false;
}
```

### 9.4 Impact sur le Calcul

**Quand un item est blacklisté:**
1. Ne PAS chercher de blueprint pour le produire
2. Ajouter directement à `materialsNeeded` (matériaux à acheter)
3. Ne PAS descendre dans la récursion (pas de sous-composants)

**Exemple:**
```
Sans blacklist:
Avatar
├─ Capital Core Temperature Regulator
│  ├─ Core Temperature Regulator
│  │  ├─ Construction Blocks
│  │  │  ├─ Tritanium (acheter)

Avec "Construction Blocks" blacklisté:
Avatar
├─ Capital Core Temperature Regulator
│  ├─ Core Temperature Regulator
│  │  ├─ Construction Blocks (acheter, STOP la récursion)
```

**Résultat:** Moins de jobs de production, plus de matériaux à acheter.

---

## 10. Gestion du Stock

### 10.1 Parsing du Stock

**Format attendu:**
```
Tritanium	1000000
Pyerite	500000
Capital Core Temperature Regulator	5
```

**Format flexible:**
- Tabulation OU espaces multiples comme séparateur
- Insensible à la casse (cherche dans le SDE)
- Ignore les lignes vides
- Limite: 10,000 lignes max

### 10.2 Utilisation du Stock Pendant le Calcul

**Ordre de consommation:**
1. Vérifier stock disponible
2. Consommer le stock en priorité
3. Produire le reste

**Code:**
```javascript
const availableStock = stock.get(productTypeID) || 0;
let quantityToProduce = requiredQuantity - availableStock;

if (quantityToProduce <= 0) {
  // Assez en stock, consommer uniquement
  stock.set(productTypeID, availableStock - requiredQuantity);
  return; // Pas de production
}

// Utiliser tout le stock, produire le reste
if (availableStock > 0) {
  stock.set(productTypeID, 0);
}
// Continuer avec la production de quantityToProduce
```

### 10.3 Mutation du Stock

**IMPORTANT:** Le stock est muté pendant le calcul.

**Exemple:**
```
Stock initial: Core Temperature Regulator = 50x

Calcul Avatar:
  Besoin: 32x Core Temperature Regulator
  Stock après: 50 - 32 = 18x

Calcul Erebus (après Avatar):
  Besoin: 32x Core Temperature Regulator
  Stock après: 18 - 32 = -14 (clamped to 0)
  À produire: 14x
```

**Pourquoi muter?**
- Simple et efficace
- Reflète la réalité (stock consommé progressivement)
- Pas besoin de tracker "déjà consommé"

**Problème:** Nécessite le clonage du stock pour re-calculer (voir section 3.3).

---

## 11. Problèmes Potentiels et Limitations

### 11.1 Problème: Trop de Produits Différents

**Scénario:**
Un plan de production nécessite 35 produits différents dans une catégorie, mais seulement 30 slots disponibles.

**Comportement actuel:** Erreur fatale
```
❌ Impossible : 35 produits différents mais seulement 30 slots disponibles.
```

**Solutions possibles:**
1. **Augmenter les slots** (config)
2. **Production séquentielle** (pas implémenté): Produire 30 produits, puis les 5 restants
3. **Priorisation** (pas implémenté): Produire les items les plus longs en priorité

**Fréquence:** Rare, mais possible pour des supercapitals complexes.

### 11.2 Problème: Dépendances Circulaires

**Scénario théorique:**
```
Item A nécessite Item B
Item B nécessite Item A
```

**Protection actuelle:** MAX_DEPTH = 20

**Comportement:**
Si profondeur > 20 → log warning, stop la récursion

**Réalité:** Les blueprints EVE Online n'ont pas de dépendances circulaires (vérifié par CCP).

### 11.3 Problème: ME/TE Fixes

**Limitation actuelle:**
- ME = 10 (hardcodé)
- TE = 20 (hardcodé)

**Impact:**
- Pas de flexibilité pour BPC (Blueprint Copies) avec ME/TE différents
- Pas de support pour structures avec bonuses (Raitaru, Azbel, Sotiyo)

**Solution future:**
Permettre à l'utilisateur de spécifier ME/TE par job:
```javascript
jobsInput: [
  {product: "Avatar", runs: 10, me: 10, te: 20},
  {product: "Capital Core", runs: 5, me: 8, te: 16}
]
```

### 11.4 Problème: Parallélisation des Catégories

**Limitation actuelle:**
Le temps total est le **maximum** des temps de toutes les catégories.

**Hypothèse:** Toutes les catégories peuvent se produire en parallèle.

**Réalité:**
Certaines catégories ont des dépendances:
- "construction_components" doit être fait AVANT "capital_components"
- "composite_reactions" doit être fait AVANT "advanced_components"

**Impact:**
Le temps total calculé peut être **sous-estimé** si on ne respecte pas les dépendances.

**Solution future:**
- Analyser les dépendances entre catégories
- Calculer un ordre de production séquentiel
- Temps total = somme des catégories dépendantes + max des catégories indépendantes

### 11.5 Problème: Surplus de Production

**Scénario:**
Besoin de 15x d'un item, blueprint produit 10x par run.

**Calcul:**
```
runsNeeded = Math.ceil(15 / 10) = 2 runs
Production: 2 × 10 = 20x
Surplus: 20 - 15 = 5x
```

**Comportement actuel:** Le surplus est ignoré (pas ajouté au stock).

**Impact:** Si l'utilisateur calcule plusieurs plans, le surplus n'est pas réutilisé.

**Solution future:**
- Tracker le surplus par item
- Ajouter le surplus au stock pour le prochain calcul
- Option: "Ajouter surplus au stock après production"

### 11.6 Problème: Gestion du Temps Réel

**Limitation:** Le système calcule le temps "optimal" théorique.

**Pas pris en compte:**
1. **Setup time:** Temps pour installer les jobs
2. **Market delay:** Temps pour acheter les matériaux
3. **Logistics:** Temps de transport entre structures
4. **Downtime:** Arrêts de production (maintenance, attaques, etc.)

**Impact:** Le temps réel sera toujours supérieur au temps calculé.

**Solution possible:**
Ajouter un "buffer factor" configurable:
```javascript
realTimeDays = calculatedTimeDays × bufferFactor; // bufferFactor = 1.2 par exemple
```

---

## 12. Configuration et Paramètres

### 12.1 Structure de Config

```javascript
config = {
  manufacturingSlots: 30,    // Slots de manufacturing disponibles
  reactionSlots: 20,         // Slots de reaction disponibles
  dontSplitShorterThan: 1.2, // Seuil minimum en jours pour splitter un job
  blacklist: {
    fuelBlocks: false,
    intermediateCompositeReactions: false,
    compositeReactions: false,
    biochemicalReactions: false,
    hybridReactions: false,
    constructionComponents: false,
    advancedComponents: false,
    capitalComponents: false,
    customItems: "" // Items custom séparés par \n
  }
}
```

### 12.2 Manufacturing Slots

**Valeur par défaut:** 30

**Signification:**
Nombre maximum de jobs de manufacturing pouvant tourner en parallèle.

**Réalité EVE Online:**
- 1 personnage = 11 slots max (avec skills)
- 3 personnages = 33 slots
- Structures (Raitaru, Azbel, Sotiyo) = slots illimités mais on utilise nos character slots

**Recommandation:** Ajuster selon votre setup multi-character.

### 12.3 Reaction Slots

**Valeur par défaut:** 20

**Signification:**
Nombre maximum de reactions pouvant tourner en parallèle.

**Réalité EVE Online:**
- Reactions se font dans des structures spéciales (Athanor, Tatara)
- Limité par le nombre de slots de la structure + character skills
- Généralement moins de slots que manufacturing

**Recommandation:** Ajuster selon vos structures disponibles.

### 12.4 dontSplitShorterThan

**Valeur par défaut:** 1.2 jours (28.8 heures)

**Signification:**
Seuil minimum de durée pour qu'un job soit splitté.

**Exemple:**
- Job de 3 jours avec dontSplitShorterThan=1.2
  - Split en 2: 1.5j par job (> 1.2) → OK
  - Split en 3: 1.0j par job (< 1.2) → STOP à 2 splits

**Recommandation:**
- **Valeur basse (0.5j):** Beaucoup de petits jobs, parallélisation maximale
- **Valeur haute (2j):** Moins de jobs, plus facile à gérer
- **Optimal:** Entre 1-1.5 jours

### 12.5 Blacklist Options

**Par catégorie:**
- **fuelBlocks:** Fuel Blocks (Helium, Oxygen, etc.)
- **intermediateCompositeReactions:** Caesarium Cadmide, Dysporite, Prometium, etc.
- **compositeReactions:** Crystalline Carbonide, Fermionic Condensates, etc.
- **biochemicalReactions:** Boosters, Neofullerenes, etc.
- **hybridReactions:** Hybrid Polymers
- **constructionComponents:** Construction Blocks, Broadcast Node, etc.
- **advancedComponents:** Compressed Ore, etc.
- **capitalComponents:** Capital Construction Components

**Custom items:**
Liste d'items séparés par `\n` (nom complet ou partiel, insensible à la casse).

---

## Conclusion

Le Production Planner est un système complexe qui:

1. **Calcule récursivement** l'arbre de production complet pour n'importe quel item EVE Online
2. **Optimise intelligemment** l'utilisation des slots de production via un algorithme de split sophistiqué
3. **Respecte les contraintes** (end products, seuil de split, slots disponibles)
4. **Gère le stock** de façon réaliste (consommation en priorité)
5. **Permet la customisation** via blacklist et configuration

**Points critiques à surveiller:**
- ✅ Clonage du stock à chaque calcul (évite les mutations entre calculs)
- ✅ Protection des end products (ne jamais splitter)
- ✅ Respect du seuil dontSplitShorterThan (évite les tiny jobs)
- ✅ Vérification du nombre de produits vs slots (erreur si impossible)
- ⚠️ Cache désactivé (problème de mutation du stock)
- ⚠️ ME/TE fixes (pas de flexibilité)
- ⚠️ Pas de gestion des dépendances entre catégories

**Améliorations possibles:**
1. Support ME/TE configurables par job
2. Gestion du surplus de production
3. Analyse des dépendances entre catégories
4. Production séquentielle si trop de produits différents
5. Ré-activation du cache avec architecture immutable

---

**Document créé le:** 13 décembre 2025  
**Dernière mise à jour:** 13 décembre 2025  
**Version du code:** productionPlanner.js (720 lignes)
