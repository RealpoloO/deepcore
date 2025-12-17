import { useSyncManager } from '../hooks/useSyncManager';
import { useToast } from '../hooks/useToast';
import './SyncButton.css';

function SyncButton() {
  const { syncing, syncAll, timeUntilNextSync, lastSync } = useSyncManager();
  const { showToast } = useToast();

  const handleSync = async () => {
    if (syncing) return;

    const result = await syncAll((characterName, success) => {
      if (success) {
        showToast(`✅ ${characterName} synchronisé avec succès!`, 'success');
      } else {
        showToast(`❌ Erreur: ${characterName}`, 'error');
      }
    });

    // Toast final avec résumé
    if (result.success) {
      showToast(`🎉 Tous les personnages synchronisés! (${result.totalCharacters}/${result.totalCharacters})`, 'success');
    } else if (result.error) {
      showToast(`Erreur de synchronisation: ${result.error}`, 'error');
    } else {
      const totalErrors = result.miningError + result.industryError;
      const totalSuccess = result.totalCharacters - Math.floor(totalErrors / 2);
      if (totalErrors > 0) {
        showToast(`⚠️ Sync terminée: ${totalSuccess} succès, ${totalErrors} erreur(s)`, 'warning');
      }
    }
  };

  // Calculer le pourcentage de progression vers la prochaine sync
  const getProgressPercentage = () => {
    if (!lastSync) return 0;
    const twoHours = 2 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastSync;
    return Math.min(100, (elapsed / twoHours) * 100);
  };

  const progressPercentage = getProgressPercentage();

  return (
    <button
      className={`sync-button ${syncing ? 'syncing' : ''}`}
      onClick={handleSync}
      disabled={syncing}
      title="Synchroniser les données mining et industrie"
    >
      <span className="sync-icon">{syncing ? '⏳' : '🔄'}</span>
      <div className="sync-info">
        <span className="sync-label">
          {syncing ? 'Synchronisation...' : 'Synchroniser'}
        </span>
        {!syncing && timeUntilNextSync && (
          <span className="sync-countdown">{timeUntilNextSync}</span>
        )}
      </div>
      {!syncing && lastSync && (
        <div className="sync-progress-bar">
          <div
            className="sync-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}
    </button>
  );
}

export default SyncButton;
