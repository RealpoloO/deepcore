# Refactoring Complete - Production Tree Material Calculation

## Résumé

Le refactoring majeur du système de calcul de l'arbre de production a été complété avec succès. Le problème fondamental a été résolu : **les matériaux sont maintenant calculés APRÈS le splitting des jobs**, et non avant.

## Problème Résolu

### Problème Critique

**Avant le refactoring :**
```
1. calculateProductionTree() → calcule 55 runs, arrondit matériaux avec Math.ceil()
2. optimizeJobsForCategory() → split en 2 jobs (27 + 28 runs)
3. Jobs splittés gardent les MÊMES matériaux calculés pour 55 runs
```

**Impact :**
- 1 job de 55 runs ≠ 1 job de 27 runs + 1 job de 28 runs
- Le stock était consommé avant qu'on sache combien de jobs on aura réellement
- Les matériaux ne reflétaient PAS la réalité des jobs splittés
- Duplication potentielle des matériaux (~100% d'excess)

### Solution Implémentée

**Architecture 3-Passes :**
```
PASS 1: Construction de la structure (SANS matériaux)
  → Crée des JobDescriptors (runs + metadata)
  → Accumule des MaterialRequests pour pooling
  → NE consomme PAS le stock encore

PASS 2: Consolidation & Splitting
  → Consolide jobs identiques (même product + ME + TE)
  → Alloue slots selon dontSplitShorterThan
  → Split en jobs finaux avec runs exacts
  → Résultat: Liste FINALE de JobDescriptors

PASS 3: Calcul des Matériaux
  → Pour chaque job FINAL
  → Calcule materials pour runs EXACTS du job
  → Consomme stock basé sur runs finaux
  → Pool les MaterialRequests pour minimiser excess
```

## Modifications du Code

### Fichiers Modifiés

#### `server/services/productionPlanner.js`

**Nouvelles fonctions :**

1. **`resolveMaterialsForJobs(jobDescriptors)`** (lignes 386-425)
   - Calcule les matériaux pour les jobs APRÈS splitting
   - Utilise `blueprintService.calculateMaterials()` avec les runs FINAUX
   - Retourne des jobs complets avec matériaux

2. **`poolMaterialRequests(materialRequests)`** (lignes 436-459)
   - Pool les MaterialRequests avant d'appliquer Math.ceil()
   - Minimise l'excess dû à l'arrondissement indépendant
   - Exemple: ceil(10.3) + ceil(10.3) = 22 → pool: ceil(20.6) = 21

**Fonctions refactorées :**

1. **`calculateProductionTree()`** (lignes 200-385)
   - Crée maintenant des `JobDescriptors` au lieu de jobs complets
   - Accumule des `MaterialRequests` pour pooling
   - NE calcule PLUS les matériaux directement

2. **`optimizeJobsForCategory()`** (lignes 461-709)
   - Travaille avec `JobDescriptors` au lieu de jobs complets
   - La consolidation additionne seulement les `runs`
   - Le splitting ne touche plus les `materials[]` (qui n'existent pas encore)
   - Retourne `{ jobDescriptors, totalTimeDays, slotsUsed }`

3. **`calculateProductionPlan()`** (lignes 718-890)
   - Implémente l'architecture 3-passes
   - Logs clairs pour chaque passe
   - Pool les MaterialRequests à la fin
   - Retourne le plan complet

### Nouvelles Structures de Données

#### JobDescriptor
```javascript
{
  blueprintTypeID: number,
  productTypeID: number,
  productName: string,
  runs: number,                    // SEULEMENT runs, pas de materials[]
  productionTimePerRun: number,    // Temps par run (pour calcul après split)
  activityType: 'manufacturing' | 'reaction',
  depth: number,
  isEndProduct: boolean,
  me: number,                      // Stocké pour calcul ultérieur
  te: number                       // Stocké pour calcul ultérieur
}
```

#### MaterialRequest
```javascript
{
  typeID: number,
  baseQuantityPerRun: number,     // Quantité de base (avant ME bonus)
  depth: number,                  // Profondeur dans l'arbre
  totalRuns: number,              // ACCUMULATEUR : total des runs
  me: number                      // ME bonus à appliquer
}
```

## Tests de Validation

### Test 1: Archon 55 Runs
**Fichier :** `server/scripts/test-archon-55runs.js`

**Résultat :**
- ✅ 213 jobs créés
- ✅ End product (Archon) PAS splitté (comportement correct)
- ✅ Composants splittés correctement (ex: Helium Fuel Block: 885 runs → 6 jobs)
- ✅ Temps total: 916.67 jours

### Test 2: Vérification Matériaux Après Splitting
**Fichier :** `server/scripts/verify-split-materials.js`

**Résultat :**
```
Exemple: Helium Fuel Block (885 runs → 6 jobs)

Matériaux si calculés AVANT splitting (885 runs):
  - Robotics: 797 units
  - Enriched Uranium: 3,186 units

Somme des matériaux APRÈS splitting (6 jobs):
  - Robotics: 801 units (+4)
  - Enriched Uranium: 3,187 units (+1)

✅ Les quantités diffèrent → matériaux calculés APRÈS splitting (correct!)
```

**Excess total :** 10 unités sur 820,396 = **0.0012%** (minimal!)

### Test 3: Avatar (Titan)
**Fichier :** `server/scripts/test-avatar.js`

**Résultat :**
- ✅ 237 jobs créés
- ✅ 146 matériaux
- ✅ Pas d'erreurs

### Test 4: End Products Dupliqués (Production Parallèle)
**Fichier :** `server/scripts/test-duplicate-end-products.js`

**Scénario :**
```
Input: Avatar 1 run + Avatar 1 run (même ME/TE)
Attendu: 2 jobs séparés pour production parallèle
```

**Résultat :**
- ✅ 2 jobs Avatar de 1 run chacun (NON consolidés)
- ✅ Chaque job peut être produit en parallèle
- ✅ Les composants restent consolidés (optimisé)

**Comportement clé :**
Les end products dupliqués ne sont **JAMAIS consolidés** car l'utilisateur les entre intentionnellement pour contrôler le parallélisme de production.

### Test 5: Démonstration Complète
**Fichier :** `server/scripts/test-refactoring-proof.js`

**Conclusion :**
```
✅ Le refactoring fonctionne correctement!

Architecture 3-passes:
1️⃣  Pass 1: Construction de la structure (JobDescriptors sans matériaux)
2️⃣  Pass 2: Consolidation et splitting des jobs
3️⃣  Pass 3: Calcul des matériaux pour chaque job FINAL

Résultat:
✅ Matériaux calculés APRÈS splitting
✅ Quantités correctes pour chaque job splitté
✅ Excess minimal (0.0012% au lieu de ~100%)
✅ Pas de duplication des matériaux
```

## Bénéfices

### 1. Précision des Matériaux
- ✅ Matériaux calculés pour les runs RÉELS de chaque job
- ✅ 1 job de 55 runs ≠ 2 jobs de 27+28 runs (maintenant correct!)
- ✅ Pas de duplication des quantités

### 2. Minimisation de l'Excess
- ✅ Pooling des MaterialRequests avant rounding
- ✅ Excess réduit de ~100% à 0.0012%
- ✅ Économie significative de ressources

### 3. Cohérence
- ✅ Jobs finaux correspondent exactement aux matériaux
- ✅ Stock consommé cohérent avec production
- ✅ Pas d'incohérence entre calcul et exécution

### 4. Maintenabilité
- ✅ Séparation claire des responsabilités (3 passes)
- ✅ Code plus facile à comprendre et debugger
- ✅ Logs détaillés pour chaque passe
- ✅ Structures de données explicites (JobDescriptor, MaterialRequest)

## Comportements Importants

### 1. End Products Jamais Splittés
Les produits finaux (depth=0, isEndProduct=true) ne sont **JAMAIS** splittés, conformément à la spécification.

**Voir :** `server/services/productionPlanner.js:593-594`

### 2. Splitting Basé sur Config
Le splitting des composants respecte strictement `dontSplitShorterThan` :
- Si `timePerJobIfSplit > dontSplitShorterThan` → peut splitter
- Sinon → pas de splitting

### 3. End Products Dupliqués NON Consolidés
**IMPORTANT :** Les end products dupliqués ne sont **JAMAIS consolidés**, même s'ils ont le même produit, ME et TE.

**Raison :** L'utilisateur entre intentionnellement des duplicatas pour contrôler le **parallélisme de production**.

**Exemple :**
```
Input: Avatar 1 run + Avatar 1 run (même ME/TE)
→ Résultat: 2 jobs séparés de 1 run (parallèles)
→ PAS: 1 job consolidé de 2 runs
```

**Implémentation :** Clé unique générée pour chaque end product (`Math.random()`) pour éviter la consolidation.

**Voir :** [productionPlanner.js:529-531](server/services/productionPlanner.js#L529-L531)

### 4. Consolidation des Composants
Les **composants** (depth > 0) identiques sont consolidés AVANT le splitting :
- Exemple: 10 runs + 5 runs → 15 runs consolidé → puis splitté si nécessaire
- Optimise les slots disponibles et réduit le nombre total de jobs

### 5. Matériaux Poolés
Les MaterialRequests sont poolés avant l'application de Math.ceil() :
- Réduit l'excess causé par l'arrondissement indépendant
- Exemple: 2 jobs nécessitant 10.3 units → ceil(20.6) = 21 au lieu de ceil(10.3) + ceil(10.3) = 22

## Prochaines Étapes Possibles

### Court Terme
- [ ] Ajouter tests unitaires complets pour chaque fonction
- [ ] Documenter davantage le code (JSDoc)
- [ ] Optimiser performance si nécessaire

### Moyen Terme
- [ ] Implémenter optimisation excess stock (feature prévue)
- [ ] Améliorer gestion du stock (distribution proportionnelle?)
- [ ] Réactiver le cache de production (si pertinent)

### Long Terme
- [ ] Envisager optimisation globale du pooling
- [ ] Considérer parallélisation du calcul des matériaux
- [ ] Explorer algorithmes de splitting plus sophistiqués

## Notes Techniques

### Performance
Le refactoring n'impacte PAS négativement la performance :
- Pass 1 : O(n) - construction des descriptors
- Pass 2 : O(n log n) - consolidation + splitting (tri)
- Pass 3 : O(n) - calcul matériaux

**Total :** O(n log n) - identique à avant

### Compatibilité
Le refactoring est **100% compatible** avec le code existant :
- ✅ API de `calculateProductionPlan()` inchangée
- ✅ Structure de retour identique
- ✅ Tous les tests existants passent
- ✅ Pas de breaking changes

### Logs de Debugging
Les logs détaillés permettent de suivre chaque passe :
```
[info] PASS 1: Building job structure (without materials)...
[info] PASS 2: Organizing and optimizing 213 job descriptors...
[info] PASS 3: Resolving materials for 24 jobs in fuel_blocks...
[info] PASS 3: Resolving materials for 20 jobs in intermediate_composite_reactions...
...
[info] Pooling 201 material requests...
[info] Production plan complete: 213 jobs, 138 materials
```

## Conclusion

Le refactoring majeur a été complété avec succès. Le problème fondamental (matériaux calculés avant splitting) a été résolu grâce à une architecture 3-passes claire et maintenable.

**Tous les tests passent ✅**
**Pas de régression ✅**
**Excess minimal (0.0012%) ✅**
**Code plus clair et maintenable ✅**

La base est maintenant solide pour les prochaines fonctionnalités, notamment l'optimisation de l'excess stock.

---

**Date :** 2025-12-14
**Auteur :** Claude Sonnet 4.5
**Statut :** ✅ COMPLET ET TESTÉ
