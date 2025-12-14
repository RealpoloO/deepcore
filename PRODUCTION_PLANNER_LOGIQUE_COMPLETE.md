# LOGIQUE COMPLÈTE DU PRODUCTION PLANNER
## Documentation technique exhaustive

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble du système](#1-vue-densemble-du-système)
2. [Architecture et flux de données](#2-architecture-et-flux-de-données)
3. [Parsing et validation des entrées](#3-parsing-et-validation-des-entrées)
4. [Système de stock](#4-système-de-stock)
5. [Système de blacklist](#5-système-de-blacklist)
6. [Arbre de production récursif](#6-arbre-de-production-récursif)
7. [Organisation par catégories](#7-organisation-par-catégories)
8. [Optimisation et split des jobs](#8-optimisation-et-split-des-jobs)
9. [Calcul des temps de production](#9-calcul-des-temps-de-production)
10. [Système de cache (désactivé)](#10-système-de-cache-désactivé)
11. [Problèmes potentiels et bugs](#11-problèmes-potentiels-et-bugs)

---

## 1. VUE D'ENSEMBLE DU SYSTÈME

### 1.1 Objectif principal

Le Production Planner est un système de planification de production pour EVE Online qui :
- Prend en entrée une liste de produits à fabriquer
- Calcule récursivement tous les composants intermédiaires nécessaires
- Organise les jobs de production par catégories
- Optimise l'utilisation des slots de production
- Génère une liste de matériaux bruts à acheter

### 1.2 Fichiers principaux

1. **`server/services/productionPlanner.js`** (720 lignes)
   - Cœur de la logique de calcul
   - Fonctions de parsing, calcul récursif, organisation, optimisation

2. **`server/services/productionPlannerOptimized.js`** (637 lignes)
   - Version alternative avec différences dans l'optimisation
   - **⚠️ ATTENTION : Il existe DEUX versions différentes du code**

3. **`server/services/blueprintService.js`** (178 lignes)
   - Gestion des blueprints (BPs et BPOs)
   - Calcul des matériaux avec bonus ME
   - Calcul des temps avec bonus TE

4. **`server/services/productionCategories.js`** (147 lignes)
   - Catégorisation des items par groupID
   - Gestion de la blacklist par catégories

5. **`server/routes/productionPlanner.js`** (184 lignes)
   - API REST pour le frontend
   - Cache des items producibles

6. **`client/src/pages/ProductionPlanner.jsx`** (750 lignes)
   - Interface utilisateur React
   - Gestion d'état avec reducer
   - Affichage des résultats

7. **`client/src/services/productionPlannerService.js`** (71 lignes)
   - Appels API vers le backend

---

## 2. ARCHITECTURE ET FLUX DE DONNÉES

### 2.1 Flow complet (du frontend au backend)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (ProductionPlanner.jsx)                         │
│    User input → Jobs + Stock + Config                        │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. API CALL (productionPlannerService.js)                   │
│    POST /api/production-planner/calculate                    │
│    Body: { jobs, stock, config }                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. BACKEND ROUTE (routes/productionPlanner.js)              │
│    Validation + Config par défaut                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. PRODUCTION PLANNER SERVICE                                │
│    (services/productionPlanner.js)                           │
│                                                               │
│    A. parseStock(stockText)                                  │
│       → Map<typeID, quantity>                                │
│                                                               │
│    B. Pour chaque job demandé:                               │
│       calculateProductionTree(...)                           │
│       → Récursion sur tous les composants                    │
│                                                               │
│    C. organizeJobs(allJobs)                                  │
│       → Jobs groupés par catégories                          │
│                                                               │
│    D. Pour chaque catégorie:                                 │
│       optimizeJobsForCategory(...)                           │
│       → Jobs consolidés et splittés                          │
│                                                               │
│    E. Génération du plan final                               │
│       → { materials, jobs, timings, errors }                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. RETOUR AU FRONTEND                                        │
│    Affichage dans les onglets Materials / Jobs               │
│    Timeline de production                                     │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Structure de données clés

#### Entrée utilisateur (jobs)
```javascript
[
  {
    product: "Archon",
    runs: 1,
    me: 10,   // Material Efficiency du BPO
    te: 20    // Time Efficiency du BPO
  }
]
```

#### Stock (format texte)
```
Tritanium    1000000
Pyerite      500000
Capital Armor Plates    10
```

#### Configuration
```javascript
{
  reactionSlots: 20,              // Nombre de slots de réaction
  manufacturingSlots: 30,         // Nombre de slots de manufacturing
  dontSplitShorterThan: 1.2,     // Durée minimale (jours) pour splitter
  blacklist: {
    intermediateCompositeReactions: false,
    fuelBlocks: true,
    compositeReactions: false,
    biochemicalReactions: false,
    hybridReactions: false,
    advancedComponents: false,
    capitalComponents: false,
    customItems: "Fuel Block\nOzone"  // Items custom blacklistés
  }
}
```

---

## 3. PARSING ET VALIDATION DES ENTRÉES

### 3.1 Validation des quantités

**Fichier**: `productionPlanner.js` lignes 73-81

```javascript
function validateQuantity(quantity, fieldName = 'quantity') {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (quantity < 1 || quantity > MAX_QUANTITY) {  // MAX_QUANTITY = 1 milliard
    throw new Error(`${fieldName} must be between 1 and ${MAX_QUANTITY.toLocaleString()}`);
  }
  return Math.floor(quantity);  // ⚠️ Arrondi vers le bas
}
```

**Limites de sécurité**:
- `MAX_QUANTITY = 1_000_000_000` (1 milliard)
- `MAX_DEPTH = 20` (profondeur de récursion max)
- `MAX_STOCK_LINES = 10000` (lignes de stock max)
- `MAX_ITEM_NAME_LENGTH = 200` (caractères max pour un nom)

### 3.2 Parsing du stock

**Fichier**: `productionPlanner.js` lignes 99-150

**Format accepté**:
- `"Item Name\tQuantity"` (avec tabulation)
- `"Item Name  Quantity"` (avec espaces)

**Processus**:
```javascript
async function parseStock(stockText) {
  const stock = new Map();  // typeID → quantity
  const errors = [];        // Liste des erreurs

  // 1. Split en lignes (max 10000 lignes)
  const lines = stockText.split('\n').slice(0, MAX_STOCK_LINES);

  for (let i = 0; i < lines.length; i++) {
    // 2. Regex pour extraire nom + quantité
    const match = trimmed.match(/^(.+?)\s+(\d+)$/);

    if (!match) {
      // ERREUR: Format invalide
      errors.push({
        line: i + 1,
        text: line,
        error: `Format invalide. Format attendu: "Item Name  Quantity"`
      });
      continue;
    }

    // 3. Sanitization du nom
    const itemName = sanitizeItemName(match[1]);
    const quantity = validateQuantity(parseInt(match[2], 10));

    // 4. Lookup du typeID via SDE
    const type = sde.findTypeByName(itemName);

    if (type) {
      // 5. Accumulation (si plusieurs lignes pour le même item)
      stock.set(type.typeId, (stock.get(type.typeId) || 0) + quantity);
    } else {
      // ERREUR: Item introuvable
      errors.push({
        line: i + 1,
        text: line,
        error: `Item "${itemName}" introuvable dans la base de données EVE`
      });
    }
  }

  return { stock, errors };
}
```

**✅ NOUVEAU COMPORTEMENT** :
- Si des erreurs de parsing de stock sont détectées, le calcul est **IMMÉDIATEMENT BLOQUÉ**
- L'utilisateur voit un message d'erreur détaillé avec le numéro de ligne et le texte problématique
- **AUCUN résultat n'est affiché** tant que le stock n'est pas valide

### 3.3 Parsing des jobs dans le frontend

**Fichier**: `ProductionPlanner.jsx` lignes 294-347

Le frontend accepte plusieurs formats :
- `"Product runs"` → ME=10, TE=20 par défaut
- `"Product runs me"` → TE=20 par défaut
- `"Product runs me te"` → Tous les paramètres
- `"Product Name runs me te"` → Nom avec espaces

**Logique** :
```javascript
const parts = trimmedLine.split(/\s+/);

if (parts.length >= 4) {
  // Les 3 derniers éléments sont runs, me, te
  te = parseInt(parts[parts.length - 1], 10);
  me = parseInt(parts[parts.length - 2], 10);
  runs = parseInt(parts[parts.length - 3], 10);

  // Tout le reste = nom du produit
  product = parts.slice(0, parts.length - 3).join(' ');
}
```

**⚠️ PROBLÈME POTENTIEL** : Si le nom du produit contient des chiffres à la fin (exemple: "Structure 500"), le parsing peut être ambigu.

---

## 4. SYSTÈME DE STOCK

### 4.1 Consommation du stock

**Fichier**: `productionPlanner.js` lignes 229-246

Le stock est géré comme une `Map<typeID, quantity>` **MUTABLE** qui est modifiée pendant le calcul récursif.

**Processus de consommation**:
```javascript
// 1. Vérifier le stock disponible
const availableStock = stock.get(productTypeID) || 0;
let quantityToProduce = requiredQuantity - availableStock;

if (quantityToProduce <= 0) {
  // Cas 1: On a assez en stock
  // → Consommer le stock et ne rien produire
  stock.set(productTypeID, availableStock - requiredQuantity);
  return;  // ✅ Pas de job créé
}

// Cas 2: Stock insuffisant
if (availableStock > 0) {
  // → Utiliser tout le stock disponible
  stock.set(productTypeID, 0);
  // → Produire le reste (quantityToProduce)
}
```

**⚠️ COMPORTEMENT CLEF** : Le stock est consommé de manière globale. Si vous demandez:
- 100x Archon
- 50x Archon

Et que vous avez 120x Capital Armor Plates en stock:

1. Le premier Archon consommera une partie du stock
2. Le deuxième Archon bénéficiera du reste du stock
3. **L'ORDRE DES JOBS DEMANDÉS AFFECTE L'UTILISATION DU STOCK**

### 4.2 Clonage du stock

**Fichier**: `productionPlanner.js` ligne 585

```javascript
// Parser le stock UNE SEULE FOIS (ne pas le modifier pendant le calcul)
const originalStock = await parseStock(stockText);

// Cloner le stock pour chaque calcul (éviter la mutation entre calculs)
const stock = new Map(originalStock);
```

**✅ BONNE PRATIQUE** : Le stock original n'est jamais modifié. Un clone est créé pour chaque calcul.

**⚠️ PROBLÈME POTENTIEL** : Si l'utilisateur lance plusieurs calculs simultanés, chaque calcul a son propre clone du stock. Mais dans un usage normal (un calcul à la fois), cela fonctionne bien.

---

## 5. SYSTÈME DE BLACKLIST

### 5.1 Catégories de blacklist

**Fichier**: `productionCategories.js` lignes 6-59

Les items sont groupés par **groupID** (identifiant de groupe dans le SDE d'EVE Online):

```javascript
const GROUP_CATEGORIES = {
  intermediate_composite_reactions: [428, 436],
  fuel_blocks: [1136, 1137],
  composite_reactions: [429, 484, 1888],
  biochemical_reactions: [661, 662, 712, 1890, 4096, 4097],
  hybrid_reactions: [974, 977, 1889],
  advanced_components: [913, 914],
  capital_components: [873],
  construction_components: [334]
};
```

### 5.2 Vérification de blacklist

**Fichier**: `productionPlanner.js` lignes 141-164

**Processus en 3 étapes**:

```javascript
function isBlacklisted(typeID, blacklist) {
  const type = sde.getTypeById(typeID);

  // ÉTAPE 1: Vérifier par catégorie (groupID)
  if (productionCategories.isBlacklistedByCategory(type.groupId, blacklist)) {
    return true;
  }

  // ÉTAPE 2: Vérifier custom items (texte libre)
  if (blacklist.customItems) {
    const customItems = blacklist.customItems.split('\n');
    if (customItems.some(custom =>
      type.name.toLowerCase().includes(custom.toLowerCase())
    )) {
      return true;
    }
  }

  // ÉTAPE 3: Vérifier Fuel Blocks spécifiquement
  if (blacklist.fuelBlocks && type.name.includes('Fuel Block')) {
    return true;
  }

  return false;
}
```

**⚠️ ATTENTION** : L'étape 3 est **redondante** car les Fuel Blocks sont déjà dans les catégories (groupIDs 1136, 1137). Cette vérification supplémentaire existe probablement pour s'assurer qu'aucun Fuel Block ne passe à travers.

### 5.3 Effet de la blacklist

**Fichier**: `productionPlanner.js` lignes 248-256

Si un item est blacklisté:
1. Il **n'est PAS fabriqué**
2. Il est ajouté directement dans `materialsNeeded` (matériaux à acheter)
3. **Aucun job de production n'est créé** pour cet item

**Exemple**:
- Vous demandez 1x Archon
- Archon nécessite Capital Armor Plates
- Capital Armor Plates sont blacklistés
- **Résultat** : Archon sera produit, mais Capital Armor Plates apparaîtront dans la liste "Materials to Buy"

---

## 6. ARBRE DE PRODUCTION RÉCURSIF

### 6.1 Fonction principale : calculateProductionTree

**Fichier**: `productionPlanner.js` lignes 177-317

C'est le **CŒUR** du système. Cette fonction est appelée récursivement pour descendre dans l'arbre de production.

**Paramètres**:
```javascript
function calculateProductionTree(
  productTypeID,      // ID du produit à fabriquer
  requiredQuantity,   // Quantité requise
  stock,              // Map mutable du stock (modifiée par la fonction)
  blacklist,          // Config de blacklist
  materialsNeeded,    // Map mutable des matériaux (accumulateur)
  jobs,               // Array mutable des jobs (accumulateur)
  depth = 0           // Profondeur de récursion (protection contre boucles infinies)
)
```

### 6.2 Flow de la fonction (étape par étape)

#### ÉTAPE 1: Validation de profondeur
```javascript
if (depth > MAX_DEPTH) {  // MAX_DEPTH = 20
  logger.warn(`Max depth (${MAX_DEPTH}) reached for typeID ${productTypeID}`);
  return;  // ⚠️ Arrêt silencieux, pas d'erreur levée
}
```

#### ÉTAPE 2: Gestion du stock
```javascript
const availableStock = stock.get(productTypeID) || 0;
let quantityToProduce = requiredQuantity - availableStock;

if (quantityToProduce <= 0) {
  // On a assez en stock → consommer et terminer
  stock.set(productTypeID, availableStock - requiredQuantity);
  return;
}

// Stock partiel → consommer tout le stock
if (availableStock > 0) {
  stock.set(productTypeID, 0);
}
```

#### ÉTAPE 3: Vérification blacklist
```javascript
if (isBlacklisted(productTypeID, blacklist)) {
  // Item blacklisté → ajouter aux matériaux à acheter
  materialsNeeded.set(productTypeID,
    (materialsNeeded.get(productTypeID) || 0) + quantityToProduce
  );
  return;  // ✅ Pas de récursion, pas de job
}
```

#### ÉTAPE 4: Lookup du blueprint
```javascript
const blueprint = blueprintService.getBlueprintByProduct(productTypeID);

if (!blueprint) {
  // AUCUN BLUEPRINT = ERREUR CRITIQUE OU MATÉRIAU DE BASE

  const type = sde.getTypeById(productTypeID);
  const productName = type?.name || `Unknown (${productTypeID})`;

  // Si c'est un item de profondeur 0 (demandé directement par l'utilisateur)
  if (depth === 0) {
    // ❌ ERREUR CRITIQUE: L'utilisateur demande de produire un item sans blueprint
    errors.push({
      type: 'NO_BLUEPRINT',
      productTypeID: productTypeID,
      productName: productName,
      error: `❌ "${productName}" ne peut pas être produit (aucun blueprint disponible). ` +
             `Seuls les items avec blueprint peuvent être ajoutés aux jobs de production.`,
      critical: true
    });
    return;  // ⛔ Arrêt immédiat, pas de calcul
  }

  // Si c'est un composant intermédiaire (depth > 0)
  // → C'est un matériau de base (Tritanium, Pyerite, etc.)
  materialsNeeded.set(productTypeID,
    (materialsNeeded.get(productTypeID) || 0) + quantityToProduce
  );
  return;  // ✅ Matériau brut à acheter
}
```

**✅ NOUVEAU COMPORTEMENT** :
- Les items sans blueprint **demandés directement** (depth=0) génèrent une **ERREUR CRITIQUE**
- Le calcul est **BLOQUÉ** et aucun résultat n'est affiché
- Les items sans blueprint **dans la chaîne de production** (depth>0) sont considérés comme des matériaux bruts à acheter (comportement normal)

#### ÉTAPE 5: Calcul des runs nécessaires
```javascript
const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
const productsPerRun = activity.products[0]?.quantity || 1;
const runsNeeded = Math.ceil(quantityToProduce / productsPerRun);
```

**⚠️ IMPORTANT** : `Math.ceil()` signifie qu'on **surproduit** toujours.
- Besoin de 15 items
- Blueprint produit 10 items par run
- `runsNeeded = Math.ceil(15 / 10) = 2 runs`
- **Production réelle = 20 items** (5 de trop)

#### ÉTAPE 6: Calcul des matériaux avec ME
```javascript
// Bonus ME (Material Efficiency) appliqué
const materials = blueprintService.calculateMaterials(blueprint, runsNeeded, 10);
```

**Dans blueprintService.js** (lignes 95-118):
```javascript
function calculateMaterials(blueprint, runs = 1, me = 0) {
  const activityType = getActivityType(blueprint);

  // ⚠️ ME NE S'APPLIQUE PAS AUX RÉACTIONS
  const meBonus = activityType === 'reaction' ? 0 : (me / 100);

  const materials = [];
  for (const material of activity.materials) {
    const baseQuantity = material.quantity;
    const adjustedQuantity = Math.ceil(baseQuantity * (1 - meBonus) * runs);

    materials.push({
      typeID: material.typeID,
      quantity: adjustedQuantity
    });
  }

  return materials;
}
```

**Exemple avec ME 10 (10% de réduction)**:
- Matériau de base: 1000 Tritanium par run
- Runs: 5
- Calcul: `Math.ceil(1000 * (1 - 0.10) * 5) = Math.ceil(4500) = 4500`
- **Résultat: 4500 Tritanium** (au lieu de 5000 sans ME)

#### ÉTAPE 7: Calcul du temps avec TE
```javascript
const productionTime = blueprintService.calculateProductionTime(blueprint, runsNeeded, 20);
```

**Dans blueprintService.js** (lignes 127-141):
```javascript
function calculateProductionTime(blueprint, runs = 1, te = 0) {
  const activityType = getActivityType(blueprint);

  // ⚠️ TE NE S'APPLIQUE PAS AUX RÉACTIONS
  const teBonus = activityType === 'reaction' ? 0 : (te / 100);

  const baseTime = activity.time;  // en secondes
  const adjustedTime = Math.ceil(baseTime * (1 - teBonus) * runs);

  return adjustedTime;
}
```

**⚠️ HARDCODÉ** : Dans `calculateProductionTree`, le ME est toujours **10** et le TE est toujours **20** (lignes 275-278). Les valeurs ME/TE entrées par l'utilisateur **NE SONT PAS UTILISÉES** à ce niveau.

#### ÉTAPE 8: Création du job
```javascript
const job = {
  blueprintTypeID: blueprint.blueprintTypeID,
  productTypeID: productTypeID,
  productName: type?.name || `Unknown (${productTypeID})`,
  runs: runsNeeded,
  quantityProduced: runsNeeded * productsPerRun,
  activityType: activityType,  // 'manufacturing' ou 'reaction'
  productionTime: productionTime,  // en secondes
  productionTimeDays: productionTime / 86400,  // en jours
  materials: materials,
  depth: depth,
  isEndProduct: depth === 0  // ✅ Marque les produits finaux demandés par l'utilisateur
};

jobs.push(job);  // Ajout au tableau global
```

**⚠️ FLAG IMPORTANT** : `isEndProduct` marque les jobs de profondeur 0 (les produits demandés par l'utilisateur). Ce flag est utilisé plus tard pour **empêcher le split** des produits finaux.

#### ÉTAPE 9: Récursion sur les matériaux
```javascript
for (const material of materials) {
  calculateProductionTree(
    material.typeID,
    material.quantity,
    stock,              // ⚠️ Même Map (mutable)
    blacklist,
    materialsNeeded,    // ⚠️ Même Map (mutable)
    jobs,               // ⚠️ Même Array (mutable)
    depth + 1           // ✅ Incrémenter la profondeur
  );
}
```

**⚠️ MUTATION PARTAGÉE** : Tous les appels récursifs partagent les mêmes objets `stock`, `materialsNeeded`, et `jobs`. C'est comme ça que les résultats sont accumulés.

### 6.3 Exemple d'arbre de production

**Demande**: 1x Archon (supercapital)

```
Archon (depth=0, isEndProduct=true)
├─ Capital Ship Assembly Array (depth=1)
│  ├─ Mexallon (depth=2) → MATÉRIAU BRUT
│  └─ Pyerite (depth=2) → MATÉRIAU BRUT
├─ Capital Armor Plates (depth=1)
│  ├─ Armor Plates (depth=2)
│  │  ├─ Tritanium (depth=3) → MATÉRIAU BRUT
│  │  └─ Mexallon (depth=3) → MATÉRIAU BRUT
│  └─ Carbonides (depth=2) → BLACKLISTÉ → MATÉRIAU À ACHETER
└─ Capital Drone Bay (depth=1)
   └─ Drone Bays (depth=2)
      ├─ Tritanium (depth=3) → MATÉRIAU BRUT
      └─ Pyerite (depth=3) → MATÉRIAU BRUT
```

**Résultat**:
- **Jobs créés**: Archon, Capital Ship Assembly Array, Capital Armor Plates, Armor Plates, Capital Drone Bay, Drone Bays
- **Matériaux à acheter**: Tritanium, Pyerite, Mexallon, Carbonides (blacklisté)

---

## 7. ORGANISATION PAR CATÉGORIES

### 7.1 Fonction : organizeJobs

**Fichier**: `productionPlanner.js` lignes 322-361

**Objectif** : Regrouper les jobs dans des catégories prédéfinies pour un affichage structuré.

**Catégories** (dans l'ordre):
1. `fuel_blocks` - Fuel Blocks (Helium, Oxygen, etc.)
2. `intermediate_composite_reactions` - Réactions simples (Prometium, Dysporite)
3. `composite_reactions` - Réactions complexes (Fermionic Condensates)
4. `biochemical_reactions` - Réactions biochimiques (Neofullerenes)
5. `hybrid_reactions` - Polymères hybrides
6. `construction_components` - Composants de construction (Armor Plates)
7. `advanced_components` - Composants avancés (Capital Ship Assembly Array)
8. `capital_components` - Composants capitaux (Capital Armor Plates)
9. `end_product_jobs` - Produits finaux (Archon, Titan, etc.)

**Processus**:
```javascript
function organizeJobs(jobs) {
  const organized = {
    fuel_blocks: [],
    intermediate_composite_reactions: [],
    // ... (toutes les catégories initialisées à [])
  };

  for (const job of jobs) {
    // CAS 1: End product (depth=0)
    if (job.isEndProduct) {
      organized.end_product_jobs.push(job);
      continue;
    }

    // CAS 2: Déterminer la catégorie via groupID
    const type = sde.getTypeById(job.productTypeID);
    const category = productionCategories.getCategoryByGroupID(type.groupId);

    // CAS 3: Si catégorie trouvée, ajouter dans la bonne catégorie
    if (organized[category]) {
      organized[category].push(job);
    } else {
      // CAS 4: Catégorie inconnue → end_product_jobs par défaut
      organized.end_product_jobs.push(job);
    }
  }

  return organized;
}
```

**⚠️ DIFFÉRENCE ENTRE VERSIONS** :

**Version normale** (`productionPlanner.js` ligne 339):
```javascript
if (job.isEndProduct) {
  organized.end_product_jobs.push(job);
  continue;
}
```

**Version optimized** (`productionPlannerOptimized.js` ligne 335):
```javascript
// Pas de vérification de isEndProduct
// Tous les jobs sont catégorisés uniquement par groupID
```

**⚠️ IMPACT** : Dans la version normale, les produits finaux sont **TOUJOURS** dans `end_product_jobs`, même s'ils ont un groupID qui les mettrait ailleurs. Dans la version optimized, le groupID prime.

---

## 8. OPTIMISATION ET SPLIT DES JOBS

### 8.1 Objectif de l'optimisation

Le système doit:
1. **Regrouper** les jobs identiques (même produit, même ME/TE)
2. **Splitter** les jobs longs en plusieurs jobs parallèles pour réduire le temps total
3. **Respecter** le nombre de slots disponibles (20 pour reactions, 30 pour manufacturing)
4. **Ne pas splitter** les jobs plus courts que `dontSplitShorterThan` (1.2 jours par défaut)
5. **Ne jamais splitter** les end products (produits finaux demandés)

### 8.2 Fonction : optimizeJobsForCategory

**Fichier**: `productionPlanner.js` lignes 371-569

**Paramètres**:
```javascript
function optimizeJobsForCategory(
  jobs,          // Jobs de la catégorie
  config,        // { reactionSlots, manufacturingSlots, dontSplitShorterThan }
  activityType,  // 'reaction' ou 'manufacturing'
  categoryName   // Pour les erreurs
)
```

### 8.3 ÉTAPE 1 : Regroupement des jobs identiques

**Lignes 377-393**

```javascript
const groupedJobs = new Map();

for (const job of jobs) {
  // Clé = productTypeID + ME + TE
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

**Exemple**:
- Job 1: Armor Plates, 10 runs, 100 qty
- Job 2: Armor Plates, 5 runs, 50 qty
- **Résultat après grouping**: Armor Plates, 15 runs, 150 qty (1 seul job)

### 8.4 ÉTAPE 2 : Consolidation des jobs

**Lignes 395-412**

```javascript
const consolidatedJobs = [];

for (const group of groupedJobs.values()) {
  const singleRunTime = group.productionTime / group.runs;
  const totalTime = singleRunTime * group.totalRuns;
  const totalDurationDays = totalTime / 86400;

  consolidatedJobs.push({
    ...group,
    runs: group.totalRuns,
    quantityProduced: group.totalQuantity,
    productionTime: totalTime,
    productionTimeDays: totalDurationDays,
    singleRunDurationDays: singleRunTime / 86400,
    isEndProduct: group.isEndProduct || false
  });
}
```

**⚠️ CALCUL IMPORTANT** : `singleRunDurationDays` est le temps pour **UN SEUL RUN**. Cela sera utilisé plus tard pour calculer le temps des jobs splittés.

### 8.5 ÉTAPE 3 : Vérification du nombre de slots

**Lignes 414-422**

```javascript
const uniqueProductCount = consolidatedJobs.length;

if (uniqueProductCount > slotsAvailable) {
  throw new Error(
    `❌ Impossible : ${uniqueProductCount} produits différents ` +
    `mais seulement ${slotsAvailable} slots disponibles en ${categoryName}.\n` +
    `Il faut au minimum ${uniqueProductCount} slots pour produire ` +
    `tous ces produits en parallèle.`
  );
}
```

**⚠️ RÈGLE FONDAMENTALE** : **On ne peut PAS produire plus de produits DIFFÉRENTS que de slots disponibles.**

**Exemple d'erreur**:
- 25 produits différents en Reaction
- Seulement 20 slots de Reaction disponibles
- **ERREUR** : Impossible de tous les faire en parallèle

**✅ C'EST CORRECT** : Chaque produit différent occupe au moins 1 slot. On ne peut pas "multiplexer" plusieurs produits sur le même slot.

### 8.6 ÉTAPE 4 : Allocation des slots

**Lignes 424-481**

**Principe**:
1. Chaque produit a droit à **AU MOINS 1 slot**
2. Les slots restants sont distribués aux jobs les plus longs pour les splitter

**Code**:
```javascript
const baseJobsCount = uniqueProductCount;
let bonusJobsAvailable = slotsAvailable - baseJobsCount;

// Trier par temps décroissant
const sortedJobs = [...consolidatedJobs].sort((a, b) =>
  b.productionTimeDays - a.productionTimeDays
);

// Initialiser : 1 job par produit
const jobsAllocation = new Map();
for (const job of sortedJobs) {
  const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
  jobsAllocation.set(key, {
    allocatedJobs: 1,
    productionTimeDays: job.productionTimeDays
  });
}

// Distribuer les jobs bonus UN PAR UN
while (bonusJobsAvailable > 0) {
  let bestJob = null;
  let bestTime = 0;

  for (const job of sortedJobs) {
    // NE JAMAIS splitter les end products
    if (job.isEndProduct) continue;

    const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
    const allocation = jobsAllocation.get(key);

    // Calculer le temps APRÈS split
    const timePerJobIfSplit = job.productionTimeDays / (allocation.allocatedJobs + 1);

    // RÈGLE: Ne splitter que si temps APRÈS split > dontSplitShorterThan
    if (job.runs > allocation.allocatedJobs &&
        timePerJobIfSplit > config.dontSplitShorterThan) {

      const currentTimePerJob = job.productionTimeDays / allocation.allocatedJobs;

      if (currentTimePerJob > bestTime) {
        bestTime = currentTimePerJob;
        bestJob = job;
      }
    }
  }

  // Si aucun job ne peut accepter de split, stop
  if (!bestJob) break;

  // Allouer un job bonus
  const key = `${bestJob.productTypeID}_${bestJob.me || 0}_${bestJob.te || 0}`;
  jobsAllocation.get(key).allocatedJobs++;
  bonusJobsAvailable--;
}
```

**⚠️ RÈGLES DE SPLIT**:

1. **End products ne sont JAMAIS splittés** (`if (job.isEndProduct) continue`)
   - Raison: L'utilisateur a demandé spécifiquement ce produit, il doit apparaître comme un seul job

2. **Jobs trop courts ne sont pas splittés** (`timePerJobIfSplit > config.dontSplitShorterThan`)
   - Par défaut: 1.2 jours minimum
   - Raison: Splitter un job de 1 jour en 2 jobs de 0.5 jours n'a pas de sens pratique

3. **Pas plus de splits que de runs** (`job.runs > allocation.allocatedJobs`)
   - Exemple: Un job de 5 runs ne peut pas être splitté en 10 jobs
   - Chaque split doit avoir au moins 1 run

4. **Distribution greedy des slots bonus** : On donne les slots bonus au job le plus long qui peut encore en bénéficier

**Exemple de distribution**:
```
Slots disponibles: 30 (manufacturing)
Produits différents: 5

Produit A: 100 jours, 20 runs
Produit B: 80 jours, 15 runs
Produit C: 50 jours, 10 runs
Produit D: 20 jours, 8 runs
Produit E: 10 jours, 5 runs

ÉTAPE 1: Base allocation (1 slot par produit)
A: 1 slot (100 jours)
B: 1 slot (80 jours)
C: 1 slot (50 jours)
D: 1 slot (20 jours)
E: 1 slot (10 jours)
→ 25 slots bonus restants

ÉTAPE 2: Distribuer les 25 slots bonus
Tour 1: A reçoit 1 slot → A: 2 slots (50 jours)
Tour 2: B reçoit 1 slot → B: 2 slots (40 jours)
Tour 3: A reçoit 1 slot → A: 3 slots (33.3 jours)
Tour 4: C reçoit 1 slot → C: 2 slots (25 jours)
Tour 5: B reçoit 1 slot → B: 3 slots (26.7 jours)
...
(Continue jusqu'à épuisement des 25 slots bonus)

RÉSULTAT FINAL:
A: 10 slots, 2 runs/job, 10 jours/job
B: 8 slots, 2 runs/job, 10 jours/job
C: 5 slots, 2 runs/job, 10 jours/job
D: 4 slots, 2 runs/job, 5 jours/job
E: 3 slots, 2 runs/job, 3.3 jours/job
→ Total: 30 slots utilisés
```

### 8.7 ÉTAPE 5 : Vérification finale

**Lignes 484-493**

```javascript
let totalJobsCount = 0;
for (const allocation of jobsAllocation.values()) {
  totalJobsCount += allocation.allocatedJobs;
}

if (totalJobsCount > slotsAvailable) {
  throw new Error(
    `❌ BUG : Allocation a créé ${totalJobsCount} jobs ` +
    `mais seulement ${slotsAvailable} slots disponibles !`
  );
}
```

**✅ SÉCURITÉ** : Cette vérification garantit que l'algorithme d'allocation n'a pas dépassé le nombre de slots disponibles.

### 8.8 ÉTAPE 6 : Création des jobs splittés

**Lignes 496-538**

```javascript
const optimized = [];

for (const job of consolidatedJobs) {
  const key = `${job.productTypeID}_${job.me || 0}_${job.te || 0}`;
  const allocation = jobsAllocation.get(key);
  const allocatedJobs = allocation.allocatedJobs;
  const singleRunDurationDays = job.singleRunDurationDays;

  const shouldSplit = allocatedJobs > 1;

  if (shouldSplit) {
    const runsPerJob = Math.ceil(job.runs / allocatedJobs);
    const quantityPerJob = Math.ceil(job.quantityProduced / allocatedJobs);

    let remainingRuns = job.runs;
    let remainingQuantity = job.quantityProduced;
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
      remainingQuantity -= splitQuantity;
    }
  } else {
    // Garder le job tel quel
    optimized.push(job);
  }
}
```

**⚠️ CALCUL DES RUNS PAR JOB** : `Math.ceil(job.runs / allocatedJobs)`

**Exemple**:
- Total runs: 17
- Allocated jobs: 5
- `runsPerJob = Math.ceil(17 / 5) = 4`

**Résultat**:
- Job 1: 4 runs
- Job 2: 4 runs
- Job 3: 4 runs
- Job 4: 4 runs
- Job 5: 1 run (reste)
- **Total: 17 runs** ✅

**⚠️ ATTENTION** : Si `Math.floor` était utilisé au lieu de `Math.ceil`, le dernier job aurait 5 runs, ce qui déséquilibrerait la répartition.

### 8.9 ÉTAPE 7 : Simulation de l'exécution

**Lignes 540-568**

**Objectif** : Calculer le temps total de production en simulant l'utilisation des slots.

**Algorithme** : **Greedy Slot Assignment**

```javascript
let totalTimeDays = 0;

if (optimized.length > 0) {
  // Trier les jobs par temps décroissant (les plus longs d'abord)
  const jobQueue = [...optimized].sort((a, b) =>
    b.productionTimeDays - a.productionTimeDays
  );

  // Initialiser les timelines des slots (tous à 0 au départ)
  const slotTimelines = Array(slotsAvailable).fill(0);

  for (const job of jobQueue) {
    // Trouver le slot qui se libère le plus tôt
    const earliestSlotIndex = slotTimelines.indexOf(Math.min(...slotTimelines));
    const startTime = slotTimelines[earliestSlotIndex];

    // Ajouter ce job au slot
    slotTimelines[earliestSlotIndex] = startTime + job.productionTimeDays;

    // Mettre à jour le timing du job
    job.startTime = startTime;
    job.endTime = startTime + job.productionTimeDays;
    job.slotUsed = earliestSlotIndex + 1;
  }

  // Le temps total est le max des timelines
  totalTimeDays = Math.max(...slotTimelines);
}
```

**Exemple avec 3 slots et 5 jobs**:

```
Jobs (triés par temps décroissant):
A: 10 jours
B: 8 jours
C: 6 jours
D: 4 jours
E: 2 jours

SIMULATION:

Étape 1: Assigner job A
  Slot 1: [0-10] → 10
  Slot 2: [0-0] → 0
  Slot 3: [0-0] → 0
  → Job A va dans Slot 2 (le plus tôt disponible après Slot 1)
  → Job A: startTime=0, endTime=10, slotUsed=2

Étape 2: Assigner job B
  Slot 1: 0
  Slot 2: 10 (occupé par A)
  Slot 3: 0
  → Job B va dans Slot 1 (le plus tôt disponible)
  → Job B: startTime=0, endTime=8, slotUsed=1

Étape 3: Assigner job C
  Slot 1: 8 (fin de B)
  Slot 2: 10 (fin de A)
  Slot 3: 0
  → Job C va dans Slot 3 (le plus tôt disponible)
  → Job C: startTime=0, endTime=6, slotUsed=3

Étape 4: Assigner job D
  Slot 1: 8
  Slot 2: 10
  Slot 3: 6
  → Job D va dans Slot 3 (le plus tôt disponible = 6)
  → Job D: startTime=6, endTime=10, slotUsed=3

Étape 5: Assigner job E
  Slot 1: 8
  Slot 2: 10
  Slot 3: 10 (fin de D)
  → Job E va dans Slot 1 (le plus tôt disponible = 8)
  → Job E: startTime=8, endTime=10, slotUsed=1

RÉSULTAT FINAL:
Slot 1: [B: 0-8] [E: 8-10] → 10 jours
Slot 2: [A: 0-10] → 10 jours
Slot 3: [C: 0-6] [D: 6-10] → 10 jours

Temps total: 10 jours
```

**⚠️ OPTIMISATION** : En triant les jobs par temps décroissant, on assure que les jobs longs sont placés en premier, ce qui minimise le temps total.

**✅ PROPRIÉTÉ** : Cet algorithme est optimal pour le **bin packing problem** quand on veut minimiser le makespan (temps total).

---

## 9. CALCUL DES TEMPS DE PRODUCTION

### 9.1 Temps par catégorie

**Fichier**: `productionPlanner.js` lignes 645-678

Pour chaque catégorie, on sépare les jobs par **activityType** (reaction vs manufacturing) car ils utilisent des pools de slots différents.

```javascript
for (const category in organizedJobs) {
  if (organizedJobs[category].length === 0) continue;

  // Séparer reactions et manufacturing
  const reactionJobs = organizedJobs[category].filter(j => j.activityType === 'reaction');
  const manufacturingJobs = organizedJobs[category].filter(j => j.activityType === 'manufacturing');

  let allOptimizedJobs = [];
  let maxTimeDays = 0;

  // Optimiser séparément
  if (reactionJobs.length > 0) {
    const optimized = optimizeJobsForCategory(reactionJobs, config, 'reaction');
    allOptimizedJobs.push(...optimized.jobs);
    maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
  }

  if (manufacturingJobs.length > 0) {
    const optimized = optimizeJobsForCategory(manufacturingJobs, config, 'manufacturing');
    allOptimizedJobs.push(...optimized.jobs);
    maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
  }

  organizedJobs[category] = allOptimizedJobs;
  categoryTimings[category] = {
    totalTimeDays: maxTimeDays,
    slotsUsed: allOptimizedJobs.length,
    jobCount: allOptimizedJobs.length
  };

  // Le temps total est le max de toutes les catégories
  totalProductionTime = Math.max(totalProductionTime, maxTimeDays);
}
```

**⚠️ COMPORTEMENT IMPORTANT** : Les catégories peuvent se chevaucher dans le temps.

**Exemple**:
```
Intermediate Reactions: 5 jours
Composite Reactions: 10 jours
Construction Components: 8 jours

Temps total = 10 jours (PAS 5+10+8=23 jours)
```

**Raison** : Les catégories sont **indépendantes** et peuvent s'exécuter **en parallèle**.

### 9.2 ⚠️ PROBLÈME POTENTIEL : Parallélisation réelle des catégories

**Hypothèse du code** : Toutes les catégories peuvent s'exécuter en parallèle complet.

**Réalité dans EVE Online** : Cela dépend de la structure de production utilisée.

**Cas 1** : Structure avec slots de Reaction ET de Manufacturing séparés
- Reactions et Manufacturing peuvent se faire **en parallèle**
- Temps total = `max(reactionTime, manufacturingTime)`

**Cas 2** : Structure avec seulement des slots de Manufacturing
- Reactions ET Manufacturing doivent partager les mêmes slots
- Temps total = `reactionTime + manufacturingTime`

**⚠️ LE CODE SUPPOSE LE CAS 1** : Il calcule le temps total comme le max des catégories, pas leur somme.

### 9.3 Temps total de production

**Fichier**: `productionPlanner.js` ligne 677

```javascript
totalProductionTime = Math.max(totalProductionTime, maxTimeDays);
```

**Formule finale**:
```
Temps Total = MAX(
  fuel_blocks_time,
  intermediate_composite_reactions_time,
  composite_reactions_time,
  biochemical_reactions_time,
  hybrid_reactions_time,
  construction_components_time,
  advanced_components_time,
  capital_components_time,
  end_product_jobs_time
)
```

**⚠️ IMPLICATION** : Si vous avez:
- Reactions: 2 jours
- Manufacturing: 10 jours
- **Temps total affiché: 10 jours**

Mais si les reactions doivent se terminer AVANT le manufacturing (dépendances), alors le temps réel serait 12 jours.

**🐛 BUG POTENTIEL** : Le code ne prend PAS en compte les dépendances entre catégories. Il suppose qu'elles sont toutes parallèles.

---

## 10. SYSTÈME DE CACHE (DÉSACTIVÉ)

### 10.1 Implémentation du cache

**Fichier**: `productionPlanner.js` lignes 9-63

```javascript
class ProductionCache {
  constructor(ttlMs = 300000) {  // 5 minutes TTL
    this.cache = new Map();
    this.ttl = ttlMs;
    this.maxSize = 1000;
  }

  generateKey(typeID, quantity, stockValue, blacklistHash) {
    return `${typeID}:${quantity}:${stockValue}:${blacklistHash}`;
  }

  // ... méthodes get, set, clear
}
```

### 10.2 Problème avec le cache

**Fichier**: `productionPlanner.js` lignes 200-221

```javascript
// Vérifier le cache (DÉSACTIVÉ : problème avec stock mutant)
// const stockValue = stock.get(productTypeID) || 0;
// const blacklistHash = productionCache.hashBlacklist(blacklist);
// const cacheKey = productionCache.generateKey(productTypeID, requiredQuantity, stockValue, blacklistHash);

// const cached = productionCache.get(cacheKey);
// if (cached) {
//   // Appliquer les résultats du cache
//   for (const [typeID, qty] of cached.materials) {
//     const current = materialsNeeded.get(typeID) || 0;
//     materialsNeeded.set(typeID, current + qty);
//   }
//   jobs.push(...cached.jobs);

//   // Mettre à jour le stock
//   if (cached.stockConsumed > 0) {
//     const currentStock = stock.get(productTypeID) || 0;
//     stock.set(productTypeID, Math.max(0, currentStock - cached.stockConsumed));
//   }

//   return;
// }
```

**⚠️ RAISON DE LA DÉSACTIVATION** : "problème avec stock mutant"

**Explication** :
- Le stock est une `Map` **MUTABLE** partagée entre tous les appels récursifs
- Quand le cache est utilisé, il modifie le stock (ligne 216)
- Mais si le stock a changé entre deux appels au même item, le cache devient invalide
- **RACE CONDITION** : Le cache pourrait retourner des résultats basés sur un état de stock qui n'est plus valide

**Exemple de problème**:
```
Calcul 1:
  - Stock: Armor Plates = 100
  - Cache key: typeID=123:quantity=50:stock=100:blacklist=...
  - Résultat: Utilise 50 en stock, produit 0
  - Cache: Sauvegarde { stockConsumed: 50 }

Calcul 2 (plus tard dans la même récursion):
  - Stock: Armor Plates = 50 (déjà consommé)
  - Cache key: typeID=123:quantity=50:stock=100:blacklist=...  ← MÊME CLÉ
  - Cache HIT ← MAUVAIS !
  - Applique { stockConsumed: 50 }
  - Résultat: stock devient 0 (au lieu de produire 0 items)
```

**✅ SOLUTION ACTUELLE** : Cache complètement désactivé dans `productionPlanner.js`.

**⚠️ VERSION OPTIMIZED** : Le cache est **ACTIVÉ** dans `productionPlannerOptimized.js` (lignes 199-220).

**🐛 BUG POTENTIEL** : Si la version optimized est utilisée, le cache pourrait causer des calculs incorrects.

---

## 11. PROBLÈMES POTENTIELS ET BUGS

### 11.1 🐛 ME et TE hardcodés

**Fichier**: `productionPlanner.js` lignes 275-278

```javascript
const materials = blueprintService.calculateMaterials(blueprint, runsNeeded, 10);
const productionTime = blueprintService.calculateProductionTime(blueprint, runsNeeded, 20);
```

**PROBLÈME** : ME est toujours **10** et TE est toujours **20**, peu importe ce que l'utilisateur entre.

**Impact**:
- L'utilisateur peut entrer ME=0 et TE=0 dans le frontend
- Les valeurs sont parsées et stockées dans les jobs
- Mais elles **NE SONT PAS UTILISÉES** dans le calcul

**Solution potentielle** : Passer `job.me` et `job.te` à ces fonctions au lieu de 10 et 20 hardcodés.

### 11.2 🐛 Deux versions du code

**Fichiers**:
- `productionPlanner.js` (720 lignes)
- `productionPlannerOptimized.js` (637 lignes)

**Différences principales**:

1. **Organisation des end products**:
   - Normal: Les end products vont TOUJOURS dans `end_product_jobs`
   - Optimized: Les end products sont catégorisés par groupID

2. **Cache**:
   - Normal: Cache désactivé
   - Optimized: Cache activé

3. **Format de stock**:
   - Normal: `"Item  Quantity"` (espaces ou tabulation)
   - Optimized: `"Item: Quantity"` (double-point) OU espaces

4. **Algorithme de split**:
   - Normal: Distribution greedy avec vérification de `dontSplitShorterThan`
   - Optimized: Distribution différente (à vérifier ligne par ligne)

**⚠️ PROBLÈME** : Quelle version est utilisée en production ?

**Vérification** : Regarder `routes/productionPlanner.js` ligne 2:
```javascript
import productionPlanner from '../services/productionPlanner.js';
```

**✅ RÉPONSE** : La version **NORMALE** est utilisée (pas la version optimized).

**⚠️ RISQUE** : Si quelqu'un modifie le code, il pourrait modifier la mauvaise version.

### 11.3 🐛 Surproduction non comptabilisée

**Fichier**: `productionPlanner.js` ligne 272

```javascript
const runsNeeded = Math.ceil(quantityToProduce / productsPerRun);
```

**PROBLÈME** : Le système surproduit toujours, mais ne comptabilise pas le surplus.

**Exemple**:
- Besoin: 15x Armor Plates
- Blueprint: 10x par run
- Runs: `Math.ceil(15/10) = 2`
- **Production: 20x** (5 de trop)

**Impact**:
- Le surplus n'est pas ajouté au stock pour être réutilisé
- Si le même item est demandé plus tard, il sera reproductif inutilement

**Solution potentielle**:
```javascript
const actualProduction = runsNeeded * productsPerRun;
const surplus = actualProduction - quantityToProduce;
if (surplus > 0) {
  stock.set(productTypeID, (stock.get(productTypeID) || 0) + surplus);
}
```

### 11.4 🐛 Dépendances entre catégories ignorées

**Fichier**: `productionPlanner.js` ligne 677

```javascript
totalProductionTime = Math.max(totalProductionTime, maxTimeDays);
```

**PROBLÈME** : Le temps total est calculé comme le MAX des catégories, pas leur somme.

**Hypothèse implicite** : Toutes les catégories peuvent s'exécuter en parallèle.

**Réalité** : Certaines catégories ont des dépendances.

**Exemple**:
```
1. Intermediate Reactions (5 jours) → Produit Prometium
2. Composite Reactions (10 jours) → Utilise Prometium
3. Construction Components (8 jours) → Utilise les Composites

Dépendances:
  Intermediate → Composite → Construction

Temps RÉEL:
  5 + 10 + 8 = 23 jours

Temps AFFICHÉ:
  max(5, 10, 8) = 10 jours ← FAUX
```

**⚠️ IMPACT MAJEUR** : Le temps total affiché est **TRÈS optimiste** et ne reflète pas la réalité.

**Solution potentielle** : Analyser l'arbre de dépendances et calculer le chemin critique.

### 11.5 🐛 Fuel Blocks blacklist redondante

**Fichier**: `productionPlanner.js` lignes 158-161

```javascript
if (blacklist.fuelBlocks && type.name.includes('Fuel Block')) {
  return true;
}
```

**PROBLÈME** : Les Fuel Blocks sont déjà dans `GROUP_CATEGORIES.fuel_blocks` (groupIDs 1136, 1137).

**Impact** : Code redondant, mais pas de bug fonctionnel.

### 11.6 🐛 Parsing de jobs ambigu pour noms avec chiffres

**Fichier**: `ProductionPlanner.jsx` lignes 324-329

```javascript
if (parts.length >= 4) {
  te = parseInt(parts[parts.length - 1], 10);
  me = parseInt(parts[parts.length - 2], 10);
  runs = parseInt(parts[parts.length - 3], 10);
  product = parts.slice(0, parts.length - 3).join(' ');
}
```

**PROBLÈME** : Si le nom du produit se termine par un chiffre valide.

**Exemple**:
- Input: `"Structure 500 10 5 0"`
- Parsing attendu: product="Structure 500", runs=10, me=5, te=0
- Parsing réel: product="Structure", runs=500, me=10, te=5 ❌

**Solution potentielle** : Utiliser un séparateur explicite (virgule, pipe, etc.).

### 11.7 🐛 Stock lookup case-sensitive

**Fichier**: `productionPlanner.js` ligne 121

```javascript
const type = sde.findTypeByName(itemName);
```

**PROBLÈME** : La recherche est probablement case-sensitive (dépend de `sde.findTypeByName`).

**Impact**:
- `"Tritanium"` ✅
- `"tritanium"` ❌ (pas trouvé)

**Solution potentielle** : Normaliser en lowercase avant la recherche.

### 11.8 🐛 Slots de reaction et manufacturing séparés

**Fichier**: `productionPlanner.js` lignes 656-667

```javascript
if (reactionJobs.length > 0) {
  const optimized = optimizeJobsForCategory(reactionJobs, config, 'reaction');
  maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
}

if (manufacturingJobs.length > 0) {
  const optimized = optimizeJobsForCategory(manufacturingJobs, config, 'manufacturing');
  maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
}
```

**HYPOTHÈSE** : Dans une même catégorie, reactions et manufacturing sont parallèles.

**Exemple**:
```
Catégorie: construction_components
  - Reaction jobs: 5 jours
  - Manufacturing jobs: 10 jours
  - Temps affiché: 10 jours (max)
```

**⚠️ QUESTION** : Dans EVE Online, peut-on vraiment faire des reactions ET du manufacturing en parallèle dans la même structure ?

**Réponse** : Dépend de la structure (Tatara vs Raitaru, etc.).

### 11.9 🐛 Erreurs silencieuses

**Fichier**: `productionPlanner.js` ligne 189

```javascript
if (depth > MAX_DEPTH) {
  logger.warn(`Max depth (${MAX_DEPTH}) reached for typeID ${productTypeID}`);
  return;  // ⚠️ Arrêt silencieux
}
```

**PROBLÈME** : Si la profondeur max est atteinte, le calcul s'arrête **sans erreur visible pour l'utilisateur**.

**Impact**:
- Les matériaux manquants ne seront pas comptabilisés
- Le plan de production sera **incomplet**
- L'utilisateur ne le saura pas (sauf s'il lit les logs)

**Solution potentielle** : Ajouter une erreur dans le résultat final pour alerter l'utilisateur.

### 11.10 ✅ Items non trouvés dans le SDE (RÉSOLU)

**Fichier**: `productionPlanner.js` lignes 124-139

```javascript
if (type) {
  stock.set(type.typeId, (stock.get(type.typeId) || 0) + quantity);
} else {
  // ERREUR: Item introuvable
  errors.push({
    line: i + 1,
    text: line,
    error: `Item "${itemName}" introuvable dans la base de données EVE`
  });
}
```

**✅ RÉSOLU** :
- Les items non trouvés génèrent désormais une erreur visible
- Le calcul est **BLOQUÉ** tant que toutes les lignes de stock ne sont pas valides
- L'utilisateur voit exactement quelle ligne pose problème

### 11.11 🐛 Split avec reste déséquilibré

**Fichier**: `productionPlanner.js` lignes 507-509

```javascript
const runsPerJob = Math.ceil(job.runs / allocatedJobs);
const quantityPerJob = Math.ceil(job.quantityProduced / allocatedJobs);
```

**PROBLÈME** : Utilisation de `Math.ceil` peut créer une surproduction.

**Exemple**:
- Total runs: 10
- Allocated jobs: 3
- `runsPerJob = Math.ceil(10/3) = 4`
- Split: 4 + 4 + 4 = 12 runs (2 de trop) ❌

**⚠️ MAIS** : Le code ajuste avec `Math.min(runsPerJob, remainingRuns)` (ligne 516), donc pas de bug réel.

**✅ CORRECTION** : Le code gère bien ce cas.

---

## 12. RÉSUMÉ EXÉCUTIF

### Points forts

1. **Architecture récursive élégante** : L'arbre de production est calculé de manière récursive et efficace.

2. **Gestion du stock** : Le stock est correctement consommé et partagé entre les jobs.

3. **Blacklist flexible** : Système de blacklist par catégories et items custom.

4. **Optimisation des slots** : Algorithme greedy intelligent pour minimiser le temps total.

5. **Sécurités** : Validations de quantités, profondeur max, vérifications de slots.

6. **✅ Validation stricte (NOUVEAU)** : Les erreurs de stock et jobs invalides bloquent le calcul.

7. **✅ Messages d'erreur détaillés (NOUVEAU)** : L'utilisateur voit exactement ce qui ne va pas.

### Points faibles

1. **🐛 ME et TE hardcodés** : Les valeurs utilisateur ne sont pas utilisées.

2. **🐛 Deux versions du code** : Risque de confusion et de modifications sur la mauvaise version.

3. **🐛 Temps total optimiste** : Les dépendances entre catégories ne sont pas prises en compte.

4. **🐛 Surproduction non réutilisée** : Le surplus n'est pas ajouté au stock.

5. **🐛 Cache désactivé** : Le cache est commenté car problématique (stock mutant).

### Améliorations récentes (2025-12-13)

1. **✅ Parsing du stock avec gestion d'erreurs**
   - Les erreurs de format sont maintenant détectées et affichées
   - Chaque ligne problématique est identifiée avec son numéro
   - Le calcul est bloqué si le stock contient des erreurs

2. **✅ Blocage des items sans blueprint**
   - Si l'utilisateur demande de produire Tritanium (raw material), une erreur critique est levée
   - Seuls les items avec blueprint peuvent être demandés en production
   - Les matériaux bruts dans la chaîne (depth>0) restent acceptés

3. **✅ Affichage amélioré des erreurs**
   - Section d'erreurs critiques très visible (rouge, avec gradient)
   - Messages d'aide contextuelle pour guider l'utilisateur
   - Aucun résultat affiché tant que des erreurs existent

### Recommandations

1. **Priorité 1** : Fixer le ME/TE hardcodé pour utiliser les valeurs utilisateur.

2. **Priorité 2** : Supprimer ou consolider la version "optimized" pour éviter la confusion.

3. **✅ Priorité 3 (RÉSOLU)** : Système de gestion des erreurs visible pour l'utilisateur.

4. **Priorité 4** : Implémenter un calcul de temps réaliste avec dépendances.

5. **Priorité 5** : Ajouter le surplus de production au stock pour réutilisation.

---

## ANNEXES

### A. Formules importantes

**Quantité de matériaux avec ME**:
```
adjustedQuantity = CEIL(baseQuantity × (1 - ME/100) × runs)
```

**Temps de production avec TE**:
```
adjustedTime = CEIL(baseTime × (1 - TE/100) × runs)
```

**Runs nécessaires**:
```
runsNeeded = CEIL(quantityToProduce / productsPerRun)
```

**Temps total d'une catégorie**:
```
totalTime = MAX(timeline de tous les slots utilisés)
```

**Temps total global**:
```
totalTime = MAX(temps de toutes les catégories)
```

### B. Limites de sécurité

| Paramètre | Valeur | Fichier |
|-----------|--------|---------|
| MAX_QUANTITY | 1 000 000 000 | productionPlanner.js:68 |
| MAX_DEPTH | 20 | productionPlanner.js:69 |
| MAX_STOCK_LINES | 10 000 | productionPlanner.js:70 |
| MAX_ITEM_NAME_LENGTH | 200 | productionPlanner.js:71 |
| MAX_JOBS (frontend) | 1 000 | ProductionPlanner.jsx:11 |
| MAX_RUNS (frontend) | 100 000 | ProductionPlanner.jsx:12 |
| MAX_ME (frontend) | 10 | ProductionPlanner.jsx:13 |
| MAX_TE (frontend) | 20 | ProductionPlanner.jsx:14 |
| Cache TTL | 300 000 ms (5 min) | productionPlanner.js:10 |
| Cache Max Size | 1 000 entrées | productionPlanner.js:13 |

### C. Catégories de production (ordre)

1. `fuel_blocks` - Fuel Blocks
2. `intermediate_composite_reactions` - Réactions simples
3. `composite_reactions` - Réactions complexes
4. `biochemical_reactions` - Réactions biochimiques
5. `hybrid_reactions` - Polymères hybrides
6. `construction_components` - Composants de construction
7. `advanced_components` - Composants avancés
8. `capital_components` - Composants capitaux
9. `end_product_jobs` - Produits finaux

---

**FIN DU DOCUMENT**

*Document créé le 2025-12-13*
*Total : ~11 000 mots*
