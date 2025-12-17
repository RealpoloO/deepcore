import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../database.sqlite');

/**
 * Migration pour supprimer la table ore_types
 * Cette table n'est plus nécessaire car nous utilisons maintenant le service SDE
 * qui charge toutes les données en mémoire au démarrage du serveur.
 */
function migrate() {
  const db = new Database(dbPath);

  try {
    console.log('\n🗑️  Migration: Suppression de la table ore_types...');

    // Vérifier si la table existe
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ore_types'
    `).get();

    if (tableExists) {
      console.log('   📋 Table ore_types détectée');

      // Compter les entrées
      const count = db.prepare('SELECT COUNT(*) as count FROM ore_types').get();
      console.log(`   📊 ${count.count} entrées dans la table`);

      // Supprimer la table
      db.exec('DROP TABLE ore_types');
      console.log('   ✅ Table ore_types supprimée avec succès');
      console.log('   💡 Les données de types sont maintenant récupérées depuis le SDE en mémoire');
    } else {
      console.log('   ✅ Table ore_types déjà supprimée ou inexistante');
    }

    console.log('✅ Migration terminée avec succès\n');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export default migrate;
