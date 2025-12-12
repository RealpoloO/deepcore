# Guide Rapide : Nouvelles Améliorations

## 🚀 Démarrage Rapide

Les améliorations ont été intégrées de manière transparente. Aucune configuration supplémentaire n'est nécessaire pour les utiliser.

### Démarrer le serveur

```bash
cd server
npm install  # Installe les nouvelles dépendances
npm run dev  # Mode développement
```

Les nouvelles fonctionnalités sont automatiquement actives :
- ✅ Rate limiting sur toutes les routes `/api`
- ✅ Validation automatique des inputs
- ✅ Logs structurés dans `logs/`

---

## 📊 Visualiser les Logs

Les logs sont maintenant écrits dans le dossier `logs/` :

```bash
# Voir les logs en temps réel
tail -f logs/combined.log

# Voir uniquement les erreurs
tail -f logs/error.log

# Chercher un terme spécifique
grep "Mining sync" logs/combined.log
```

### Format des logs

```
[2025-12-11 14:32:15] info: Mining sync completed
{
  "characterId": 123456,
  "totalRecords": 45,
  "inserted": 10,
  "updated": 2
}
```

---

## 🔒 Rate Limiting

### Limites par défaut

| Endpoint | Limite | Fenêtre |
|----------|--------|---------|
| Toutes les API | 100 req | 15 min |
| Sync mining/industry | 10 req | 15 min |
| Auth (login/callback) | 5 req | 15 min |
| Discord OAuth | 20 req | 15 min |

### Réponse quand limité

```json
{
  "error": "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
  "retryAfter": "15 minutes"
}
```

Headers de réponse :
- `RateLimit-Limit` : Nombre total de requêtes autorisées
- `RateLimit-Remaining` : Nombre de requêtes restantes
- `RateLimit-Reset` : Timestamp de réinitialisation

### Ajuster les limites (développement)

Modifiez `server/middleware/rateLimiter.js` :

```javascript
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Augmenter pour le dev
  // ...
});
```

---

## ✅ Validation des Inputs

La validation est automatique et retourne des erreurs claires :

### Exemple d'erreur de validation

```json
{
  "error": "Données invalides",
  "details": [
    {
      "field": "characterId",
      "message": "Character ID doit être un nombre"
    }
  ]
}
```

### Routes avec validation

- ✅ `POST /api/mining/sync/:characterId`
- ✅ `GET /api/mining/:characterId`
- ✅ `POST /api/mining/ore-names`
- ✅ `POST /api/mining/ore-info`

---

## 🐛 Gestion d'Erreurs Frontend

### Utiliser le hook useApiError

```javascript
import { useApiError } from './hooks/useApiError';

function MyComponent() {
  const { executeAsync, isLoading, error, isRateLimited } = useApiError();

  const handleSync = async () => {
    const result = await executeAsync(
      () => axios.post('/api/mining/sync/123'),
      'Échec de la synchronisation'
    );

    if (result) {
      console.log('Succès !', result);
    }
  };

  if (isRateLimited) {
    return <div>Trop de requêtes, patientez...</div>;
  }

  return (
    <button onClick={handleSync} disabled={isLoading}>
      {isLoading ? 'Chargement...' : 'Synchroniser'}
    </button>
  );
}
```

### Propriétés disponibles

```javascript
{
  error: {
    message: "Message d'erreur",
    details: {...},
    status: 429,
    timestamp: "2025-12-11T14:32:15.000Z"
  },
  isLoading: boolean,
  handleError: (err, defaultMessage) => void,
  clearError: () => void,
  executeAsync: (asyncFn, errorMessage) => Promise,
  isUnauthorized: boolean,  // 401
  isForbidden: boolean,     // 403
  isNotFound: boolean,      // 404
  isRateLimited: boolean,   // 429
  isServerError: boolean    // 5xx
}
```

---

## 🧪 Tester les Améliorations

### 1. Tester le Rate Limiting

```bash
# Envoyer plusieurs requêtes rapidement
for i in {1..15}; do
  curl http://localhost:3000/api/health
done

# La 11ème requête devrait être rate-limited (si max=10)
```

### 2. Tester la Validation

```bash
# ID invalide (non numérique)
curl -X POST http://localhost:3000/api/mining/sync/invalid-id

# Devrait retourner 400 avec détails de validation
```

### 3. Voir les Logs

```bash
# Déclencher une erreur et voir le log
curl http://localhost:3000/api/mining/999999

# Vérifier logs/error.log
cat logs/error.log | grep "Mining sync error"
```

---

## 🔧 Désactiver Temporairement (Dev)

### Rate Limiting

Dans `server/index.js`, commentez :

```javascript
// app.use('/api', generalLimiter);  // Commenté pour le dev
```

### Validation

Dans les routes, retirez le middleware :

```javascript
router.post('/sync/:characterId',
  requireAuth,
  // validate(characterIdSchema, 'params'),  // Commenté
  async (req, res) => { ... }
);
```

### Logging

Changez le niveau de log dans `server/utils/logger.js` :

```javascript
const level = () => {
  return 'error';  // Ne loggue que les erreurs
};
```

---

## 📚 Documentation Complète

Pour plus de détails, consultez :
- [IMPROVEMENTS.md](./IMPROVEMENTS.md) : Documentation complète des améliorations
- [server/middleware/rateLimiter.js](./server/middleware/rateLimiter.js) : Configuration du rate limiting
- [server/middleware/validation.js](./server/middleware/validation.js) : Schémas de validation
- [server/utils/logger.js](./server/utils/logger.js) : Configuration du logging

---

## ❓ FAQ

### Les logs prennent-ils beaucoup d'espace ?
Non, ils sont automatiquement limités à 5 fichiers de 5MB maximum (25MB total).

### Puis-je désactiver les logs en production ?
Oui, mais ce n'est pas recommandé. Ajustez plutôt le niveau de log à `info` ou `warn`.

### Le rate limiting affecte-t-il les performances ?
Non, l'impact est négligeable (< 1ms par requête).

### Comment voir les requêtes HTTP en temps réel ?
Les requêtes HTTP sont loguées au niveau `http` :
```bash
tail -f logs/combined.log | grep "http"
```

---

**Besoin d'aide ?** Consultez [IMPROVEMENTS.md](./IMPROVEMENTS.md) ou les commentaires dans le code.
