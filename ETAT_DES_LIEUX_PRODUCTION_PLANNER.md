# État des Lieux - Production Planner (14 Décembre 2025)

## 🚨 STATUT ACTUEL : CASSÉ / INUTILISABLE

Le production planner est actuellement **non fonctionnel** et nécessite une refonte complète de sa logique.

---

## 📊 ANALYSE DU CODE ACTUEL

### Fichier : `server/services/productionPlanner.js`
- **Taille** : 1089 lignes
- **Complexité** : TRÈS ÉLEVÉE
- **Maintenabilité** : FAIBLE

---

## 🔍 ARCHITECTURE ACTUELLE (3-PASSES)

Le système utilise une architecture en 3 passes qui était censée résoudre le problème de calcul des matériaux :

### PASS 1 : Construction de la Structure (SANS matériaux)
```
calculateProductionTree()
├── Crée des JobDescriptors (runs + metadata)
├── Accumule des MaterialRequests pour pooling
├── NE consomme PAS le stock
└── Résultat: jobDescriptors[] + materialRequests[]
```

**Problème identifié** : Cette passe crée une structure complexe avec multiples accumulateurs qui rendent le code difficile à suivre et à débugger.

### PASS 2 : Consolidation & Splitting
```
organizeJobs() + optimizeJobsForCategory()
├── Consolide jobs identiques (même product + ME + TE)
├── Alloue slots selon dontSplitShorterThan
├── Split en jobs finaux avec runs exacts
└── Résultat: JobDescriptors finaux (toujours SANS matériaux)
```

**Problèmes identifiés** :
1. **Consolidation complexe** : Multiples clés avec Math.random() pour end products
2. **Logic de splitting** : Distribution de jobs bonus avec boucles while imbriquées
3. **Isolation des composants** : Système `endProductID` censé empêcher consolidation entre end products différents

### PASS 3 : Résolution des Matériaux
```
resolveMaterialsForJobs()
├── Pour chaque job FINAL
├── Calcule materials pour runs EXACTS
└── Résultat: Jobs complets avec matériaux
```

**Problème identifié** : Le pooling des MaterialRequests se fait SÉPARÉMENT pour chaque end product, puis les résultats sont additionnés. Cela crée une complexité supplémentaire sans bénéfice clair.

---

## 🐛 PROBLÈMES MAJEURS IDENTIFIÉS

### 1. BUG CRITIQUE : ME (Material Efficiency) Non Fonctionnel

**Symptôme** : Changer ME de 0 à 10 ne modifie PAS les quantités de matériaux dans l'interface.

**Cause potentielle** :
- Tests unitaires montrent que le calcul fonctionne (3200 vs 2880 unités)
- Interface ne reflète pas les changements
- Possibles causes :
  - Cache frontend non invalidé
  - Nodemon ne recharge pas correctement le serveur
  - Code différent entre tests et production
  - Réactions (~90% des matériaux de Titans) non affectées par ME

**Impact** : L'utilisateur ne peut pas optimiser ses productions en fonction de ses blueprints recherchés.

### 2. COMPLEXITÉ EXCESSIVE : Architecture 3-Passes

**Structures de données multiples** :
- `JobDescriptor` (sans matériaux)
- `MaterialRequest` (pour pooling)
- `Job` complet (avec matériaux)
- Maps de consolidation avec clés complexes

**Flux de données fragmenté** :
```
Input Jobs
  → calculateProductionTree (récursif)
    → JobDescriptors[]
    → MaterialRequests Map
      → Consolidation Map
        → organizeJobs
          → optimizeJobsForCategory
            → Split descriptors
              → resolveMaterialsForJobs
                → Complete Jobs
```

**Problème** : Chaque transformation ajoute de la complexité et des points de défaillance potentiels.

### 3. SYSTÈME DE POOLING COMPLEXE

**Objectif** : Minimiser l'excess stock dû à Math.ceil()

**Implémentation actuelle** :
```javascript
// Un Map par end product
allMaterialRequestMaps.push(materialRequests);

// Pool chaque end product séparément
for (const materialRequestMap of allMaterialRequestMaps) {
  const pooledMaterialsForThisEndProduct = poolMaterialRequests(materialRequestMap);
  // Additionner aux matériaux finaux
}
```

**Problème** : 
- Complexité ajoutée pour bénéfice minimal (excess de 0.0012%)
- Code difficile à comprendre et maintenir
- Possibilité de bugs dans l'agrégation finale

### 4. ISOLATION DES COMPOSANTS (endProductID)

**Intention** : Empêcher les composants de différents end products d'être consolidés ensemble.

**Implémentation** :
```javascript
// Chaque composant est marqué avec l'endProductID
calculateProductionTree(..., endProductID)

// Clé de consolidation inclut endProductID
key = `${jobDesc.productTypeID}_${jobDesc.me}_${jobDesc.te}_${jobDesc.depth}_endProd_${jobDesc.endProductID}`;
```

**Problème** : 
- Raison de cette isolation pas claire (pourquoi ne pas consolider des composants identiques ?)
- Peut créer des jobs dupliqués inutilement
- Augmente le nombre total de jobs sans bénéfice évident

### 5. END PRODUCTS NON CONSOLIDÉS

**Comportement actuel** : Les end products dupliqués ne sont JAMAIS consolidés.

```javascript
if (jobDesc.isEndProduct) {
  // Clé unique pour chaque occurrence
  key = `${jobDesc.productTypeID}_${jobDesc.me}_${jobDesc.te}_${jobDesc.depth}_end_${endProductSequence++}`;
}
```

**Justification (selon REFACTORING_COMPLETE.md)** :
> "L'utilisateur entre intentionnellement des duplicatas pour contrôler le parallélisme de production."

**Problème** : 
- Cette logique n'est pas évidente et peut surprendre l'utilisateur
- Si l'utilisateur veut 2x Avatar avec même ME/TE, il obtient 2 jobs séparés au lieu d'1 job de 2 runs
- Peut monopoliser des slots inutilement

### 6. SYSTÈME DE SPLITTING COMPLEXE

**Algorithme actuel** :
```javascript
// 1. Calculer slots bonus disponibles
let bonusJobsAvailable = slotsAvailable - uniqueProductCount;

// 2. Distribuer UN PAR UN aux jobs les plus longs
while (bonusJobsAvailable > 0) {
  // Trouver le job le plus long qui peut accepter un split
  let bestJobDesc = null;
  let bestTime = 0;
  
  for (const jobDesc of sortedDescriptors) {
    if (jobDesc.isEndProduct) continue;  // NE JAMAIS splitter end products
    
    const timePerJobIfSplit = jobDesc.productionTimeDays / (allocation.allocatedJobs + 1);
    
    if (timePerJobIfSplit > config.dontSplitShorterThan) {
      // Prendre le job le plus long
    }
  }
}
```

**Problèmes** :
- Boucle while avec recherche linéaire à chaque itération (O(n²))
- Logic complexe avec multiples conditions
- End products protégés du splitting (cohérent mais complexifie la logique)

### 7. DÉTERMINISME FORCÉ

**Multiples points de tri** :
- jobsInput triés par nom au début
- jobDescriptors triés avant consolidation
- Chaque catégorie triée après organisation
- Jobs triés avant splitting
- Clés de consolidation triées pour pooling

**Problème** : 
- Tri excessif qui ralentit les calculs
- Code verbeux avec répétition des critères de tri
- Commentaires `✅ DÉTERMINISME` partout (signe de sur-ingénierie)

### 8. GESTION DU STOCK INCOHÉRENTE

**Comportement actuel** :
```javascript
// PASS 1: Le stock est lu mais PAS consommé
const availableStock = stock.get(productTypeID) || 0;
let quantityToProduce = requiredQuantity - availableStock;

// Note: On NE consomme PAS le stock ici
// Le stock sera consommé APRÈS le splitting
```

**Problème** :
- Commentaire dit "sera consommé après" mais le code ne le fait jamais
- Stock cloné au début (`new Map(stockResult.stock)`) mais jamais muté
- Incohérence entre l'intention et l'implémentation

### 9. CACHE DÉSACTIVÉ

```javascript
class ProductionCache {
  // ... implémentation complète ...
}

// Dans calculateProductionTree()
// TODO: Cache sera réactivé dans Phase 2 avec nouvelle stratégie
```

**Problème** :
- Cache implémenté (60 lignes) mais jamais utilisé
- Code mort qui pollue le fichier
- Performance non optimisée

### 10. LOGS EXCESSIFS

```javascript
logger.info(`Calculating production plan for ${jobsInput.length} jobs`);
logger.info(`✅ Jobs sorted deterministically: ${sortedJobsInput.map(j => j.product).join(', ')}`);
logger.info('PASS 1: Building job structure (without materials)...');
logger.info(`PASS 2: Consolidating and organizing ${jobDescriptors.length} job descriptors...`);
logger.info(`Consolidated ${jobDescriptors.length} descriptors into ${consolidatedJobDescriptors.length} unique jobs`);
logger.info(`PASS 3: Resolving materials for ${allOptimizedDescriptors.length} jobs in ${category}...`);
logger.info(`Pooling ${totalRequests} material requests (${allMaterialRequestMaps.length} end products)...`);
logger.info(`Production plan complete: ${jobDescriptors.length} jobs, ${materials.length} materials`);
```

**Problème** :
- Logs à chaque étape qui noient l'information importante
- Mode debug permanent sans flag de contrôle
- Performance impactée par construction de strings inutiles

---

## 📈 MÉTRIQUES DE COMPLEXITÉ

### Cyclomatic Complexity (estimation)
- `calculateProductionTree()` : **~20** (TRÈS ÉLEVÉ - limite recommandée : 10)
- `optimizeJobsForCategory()` : **~25** (EXTRÊME - refactoring obligatoire)
- `calculateProductionPlan()` : **~15** (ÉLEVÉ)

### Profondeur d'Imbrication
- Maximum : **6 niveaux** (boucles dans boucles dans conditions)
- Recommandé : 3 niveaux maximum

### Lignes par Fonction
- `calculateProductionTree()` : 186 lignes
- `optimizeJobsForCategory()` : 249 lignes
- `calculateProductionPlan()` : 172 lignes
- **Recommandé** : 50 lignes maximum par fonction

### Couplage
- **Fort couplage** avec `blueprintService`, `sde`, `productionCategories`
- Dépendances implicites (ordre d'appel des fonctions critique)
- Mutations d'état via maps/arrays partagés

---

## 🎯 PROBLÈMES CONCEPTUELS FONDAMENTAUX

### 1. Sur-Ingénierie

Le système essaie de résoudre un problème simple (calculer une BOM) avec une architecture complexe en 3 passes qui ajoute plus de problèmes qu'elle n'en résout.

**Exemple** : Pooling des MaterialRequests
- Bénéfice : Économie de 0.0012% de matériaux
- Coût : +200 lignes de code complexe, bugs potentiels, maintenabilité réduite

### 2. Architecture Contre-Intuitive

Le flux de données n'est pas naturel :
```
Jobs Input → JobDescriptors → MaterialRequests → Consolidation → Splitting → Descriptors → Complete Jobs
```

Une approche simple serait :
```
Jobs Input → Calculate BOM → Optimize & Split → Complete Jobs
```

### 3. Séparation Artificielle des Passes

Les 3 passes créent des dépendances implicites :
- PASS 1 crée des structures que PASS 2 doit comprendre
- PASS 2 crée des descriptors que PASS 3 doit résoudre
- Erreur dans une passe = tout le plan échoue

### 4. Optimisation Prématurée

Multiples optimisations (cache, pooling, déterminisme) implémentées AVANT que le système de base fonctionne correctement.

**Principe** : "Make it work, make it right, make it fast" - le code est bloqué à "make it work".

### 5. Documentation vs Réalité

- `REFACTORING_COMPLETE.md` : "Tous les tests passent ✅"
- **Réalité** : L'utilisateur rapporte que le système est "complètement faux/inutilisable"

Signe d'un **disconnect entre les tests unitaires et le comportement réel**.

---

## 🔧 DÉPENDANCES EXTERNES

### blueprintService.js
```javascript
- getBlueprintByProduct(productTypeID)
- getBlueprintById(blueprintTypeID)
- calculateMaterials(blueprint, runs, me)
- calculateProductionTime(blueprint, runs, te)
- getActivityType(blueprint)
```

**Dépendance** : FORTE - le production planner ne peut rien faire sans blueprintService.

### sde.js
```javascript
- findTypeByName(itemName)
- getTypeById(typeID)
```

**Dépendance** : FORTE - nécessaire pour la résolution des noms.

### productionCategories.js
```javascript
- isBlacklistedByCategory(groupId, blacklist)
- getCategoryByGroupID(groupId)
```

**Dépendance** : MOYENNE - utilisé pour organisation et blacklist.

---

## ⚠️ BUGS CONNUS

### 1. ME non fonctionnel dans l'interface
- **Sévérité** : CRITIQUE
- **Reproductible** : OUI
- **Workaround** : AUCUN

### 2. Reactions non affectées par ME
- **Sévérité** : MOYENNE (c'est le comportement EVE Online)
- **Problème** : Pas clairement communiqué à l'utilisateur
- **Impact** : Confusion (Titans = 90% reactions)

### 3. End products dupliqués non consolidés
- **Sévérité** : MOYENNE
- **Reproductible** : OUI
- **Comportement** : Intentionnel mais surprenant

### 4. Stock jamais consommé
- **Sévérité** : ÉLEVÉE
- **Problème** : Code dit "consommé après" mais ne le fait jamais
- **Impact** : Stock ignoré dans les calculs ?

---

## 📊 TESTS EXISTANTS

### Tests Créés (dans server/scripts/)
- `test-archon-55runs.js` : Test de splitting
- `test-avatar.js` : Test Titan
- `test-duplicate-end-products.js` : Test end products séparés
- `test-me-te-impact.js` : Test ME/TE (ÉCHOUE dans l'interface)
- `verify-split-materials.js` : Test excess

**Problème** : Les tests passent mais l'interface ne reflète pas les résultats → **disconnect entre tests et réalité**.

---

## 💡 POINTS POSITIFS

1. **Validation robuste** : `validateQuantity()`, `sanitizeItemName()` bien implémentées
2. **Gestion d'erreurs** : Erreurs collectées et retournées proprement
3. **Parsing de stock** : Fonction `parseStock()` solide
4. **Tri déterministe** : Garantit reproductibilité (mais peut-être excessif)

---

## 🎯 RECOMMANDATIONS POUR REFONTE

### Option A : Simplification Radicale

**Supprimer** :
- Architecture 3-passes
- JobDescriptors / MaterialRequests séparés
- Pooling des matériaux (bénéfice marginal)
- Cache (non utilisé)
- Isolation des composants (endProductID)

**Garder** :
- Calcul récursif de la BOM
- Splitting selon slots disponibles
- Validation robuste
- Gestion d'erreurs

**Résultat attendu** : Code 50% plus court, plus facile à comprendre.

### Option B : Refonte Complète

**Approche** : Repartir de zéro avec architecture simple

```
1. Input Validation
2. Recursive BOM Calculation (avec ME/TE)
3. Consolidation (jobs identiques)
4. Slot Allocation & Splitting
5. Timeline Calculation
6. Output Formatting
```

**Avantages** :
- Pas de dette technique héritée
- Architecture claire et linéaire
- Plus facile à tester et débugger

### Option C : Fix Incrémental

**Phase 1** : Corriger ME bug (priorité absolue)
**Phase 2** : Simplifier pooling
**Phase 3** : Réduire complexité splitting
**Phase 4** : Nettoyer logs et code mort

**Avantage** : Progression par étapes
**Inconvénient** : Garde l'architecture complexe

---

## 🚨 DÉCISION REQUISE

**Question critique** : Quelle approche adopter ?

1. **Simplification radicale** (recommandé) - 2-3 jours
2. **Refonte complète** - 5-7 jours
3. **Fix incrémental** - 1-2 semaines (mais garde la complexité)

---

## 📝 NOTES ADDITIONNELLES

### Fichiers de Backup
- `productionPlanner.backup.js` : Version corrompue (appelle fonction inexistante)
- `productionPlanner.v2.js` : Version refactorée (561 lignes) - PLUS SIMPLE
- `productionPlanner.broken.js` : Version actuelle (1089 lignes) - COMPLEXE

**Observation** : La version **v2** (561 lignes) est 50% plus petite que la version actuelle. Peut-être une meilleure base de départ ?

### Impact Utilisateur

**Frustration maximale** : 
- Plusieurs heures de debugging
- Système déclaré "inutilisable"
- Perte de confiance dans la codebase

**Priorité absolue** : Restaurer un système fonctionnel RAPIDEMENT.

---

## 🎬 CONCLUSION

Le production planner actuel souffre de **sur-ingénierie massive**. L'architecture en 3 passes censée résoudre le problème de calcul des matériaux a créé plus de complexité qu'elle n'en a résolu.

**Recommandation** : **Simplification radicale** ou **refonte complète** avec architecture linéaire simple.

**Objectif** : Système qui FONCTIONNE d'abord, optimisations ensuite.

---

**Date** : 14 Décembre 2025  
**Auteur** : Analyse par Claude Sonnet 4.5  
**Statut** : 🚨 CRITIQUE - Action immédiate requise
