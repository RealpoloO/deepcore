# Migration ESI vers SDE

## Changements effectués

### Service ESI refactorisé

Le service `esi.js` a été simplifié pour utiliser directement le service SDE au lieu de faire des appels à l'API ESI d'Eve Online.

**Avant:**
- Appels API ESI pour récupérer les noms et volumes des types
- Cache dans la table SQLite `ore_types`
- Lent et dépendant du réseau

**Après:**
- Recherche directe dans le SDE en mémoire
- Instantané (pas d'I/O réseau ou disque)
- Aucune dépendance externe

### Table `ore_types` supprimée

La table `ore_types` n'est plus nécessaire car:
- Toutes les données sont déjà dans le SDE (types.jsonl)
- Le SDE est chargé en mémoire au démarrage du serveur
- Les recherches sont instantanées

### Fichiers modifiés

1. **server/services/esi.js**
   - Suppression des imports `axios`, `dbHelpers`, `retryWithBackoff`
   - Ajout de l'import `sdeService`
   - Réécriture des méthodes pour utiliser `sdeService.getTypeById()`
   - Suppression de la méthode `getSolarSystemInfo` (non utilisée)

2. **server/routes/mining.js**
   - Ajout de l'import `sdeService`
   - Modification des requêtes SQL pour supprimer les JOIN avec `ore_types`
   - Enrichissement des résultats avec les volumes depuis le SDE

3. **server/database/init.js**
   - Suppression de la création de la table `ore_types`

4. **server/database/migrations/add-timestamps.js**
   - Ajout de vérifications pour gérer l'absence de la table `ore_types`

5. **server/database/migrations/remove-ore-types.js** (nouveau)
   - Migration pour supprimer la table `ore_types` des bases existantes

## Migration pour les bases de données existantes

Si vous avez une base de données existante avec la table `ore_types`, exécutez:

```bash
node server/database/migrations/remove-ore-types.js
```

Ou la table sera automatiquement ignorée lors des prochaines migrations.

## Avantages

✅ **Performance**: Recherches instantanées en mémoire vs appels API + DB
✅ **Fiabilité**: Pas de dépendance réseau, pas de rate limiting
✅ **Simplicité**: Moins de code, moins de complexité
✅ **Maintenance**: Une seule source de données (SDE)
✅ **Complétude**: Accès à TOUS les types d'Eve Online, pas seulement les minerais

## Notes

- Le service ESI garde son nom pour maintenir la compatibilité
- Les signatures des méthodes publiques restent identiques
- Aucun changement nécessaire côté client
