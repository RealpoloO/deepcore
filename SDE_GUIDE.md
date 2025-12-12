# EVE Online Static Data Export (SDE)

## 📦 Qu'est-ce que le SDE ?

Le SDE (Static Data Export) est une base de données statique fournie par CCP Games contenant toutes les informations sur les items, groupes, types, etc. d'EVE Online.

## 🔄 Mise à jour du SDE

### 1. Télécharger le SDE

Téléchargez la dernière version du SDE au format JSON Lines depuis :
- **Fuzzwork** : https://www.fuzzwork.co.uk/dump/
- **CCP Official** : https://developers.eveonline.com/resource/resources

Choisissez le format **JSONL** (JSON Lines).

### 2. Remplacer le dossier

1. Supprimez l'ancien dossier `eve-online-static-data-*-jsonl/`
2. Extrayez le nouveau SDE téléchargé à la racine du projet
3. Renommez le dossier pour qu'il corresponde au chemin dans le script d'import

### 3. Importer les données

Exécutez la commande d'import :

```bash
npm run import:sde
```

Cette commande va :
- ✅ Lire le fichier `types.jsonl`
- ✅ Filtrer uniquement les minerais (par groupID)
- ✅ Importer ~278+ minerais dans la base de données
- ✅ Remplacer les anciennes données

## 📊 Données importées

Le script importe tous les types d'items qui appartiennent aux groupes suivants :

- **Minerais T1** : Veldspar, Scordite, Pyroxeres, Plagioclase, Omber, Kernite, Jaspet, Hemorphite, Hedbergite, Gneiss, Dark Ochre, Spodumain, Crokite, Bistot, Arkonor
- **Minerais T2** : Versions compressées (II-Grade, III-Grade)
- **Minerais spéciaux** : Mercoxit, Ice, Abyssal Ores

### Informations stockées

Pour chaque minerai :
- `type_id` : ID unique EVE Online
- `name` : Nom en anglais
- `volume` : Volume en m³
- `cached_at` : Date d'import

## 🚀 Avantages

- **Performance** : Pas d'appels API pour récupérer les noms/volumes
- **Fiabilité** : Données toujours disponibles (pas de rate limiting)
- **Offline** : Fonctionne sans connexion à l'API ESI
- **Complet** : Toutes les données statiques en local

## 🔧 Fréquence de mise à jour

Le SDE est mis à jour par CCP Games à chaque patch majeur d'EVE Online.

Mettez à jour le SDE :
- ✅ Après chaque expansion majeure
- ✅ Quand de nouveaux minerais sont ajoutés
- ⚠️ Optionnel pour les patchs mineurs

## 📁 Structure

```
eve-online-static-data-3133773-jsonl/
  ├── types.jsonl          # ← Utilisé par le script d'import
  ├── groups.jsonl
  ├── categories.jsonl
  └── ... (autres fichiers non utilisés)
```

## 🔍 Fallback API

Si un type n'est pas trouvé dans le SDE (types très récents), le système fait automatiquement un fallback sur l'API ESI et met en cache le résultat.

## ⚡ Performance

- **Avant** : ~500ms par type (appel API ESI)
- **Après** : ~5ms pour plusieurs types (query SQL unique)
- **Gain** : ~100x plus rapide ! 🚀
