import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NavBar from '../components/NavBar';
import ErrorBanner from '../components/ErrorBanner';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import useMiningData from '../hooks/useMiningData';
import useOreInfo from '../hooks/useOreInfo';
import './Dashboard.css';

function Dashboard() {
  const { characters, login, refreshCharacters } = useAuth();
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [discordStatus, setDiscordStatus] = useState({ connected: false, username: null });
  
  const { data: miningData, loading, refetch: loadMiningData } = useMiningData(selectedCharacter);
  const typeIds = useMemo(() => [...new Set(miningData.map(r => r.type_id))], [miningData]);
  const { oreInfo, calculateVolume } = useOreInfo(typeIds);

  useEffect(() => {
    if (characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0].character_id);
    }
  }, [characters, selectedCharacter]);

  // Load Discord status
  useEffect(() => {
    const loadDiscordStatus = async () => {
      try {
        const response = await axios.get('/api/discord/status', { withCredentials: true });
        setDiscordStatus(response.data);
      } catch (error) {
        console.error('Failed to load Discord status:', error);
      }
    };
    loadDiscordStatus();
  }, []);

  // Handle Discord OAuth
  const connectDiscord = async () => {
    try {
      const response = await axios.get('/api/discord/login', { withCredentials: true });
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Discord login failed:', error);
      addToast('Erreur lors de la connexion Discord', 'error');
    }
  };

  const disconnectDiscord = async () => {
    try {
      await axios.post('/api/discord/disconnect', {}, { withCredentials: true });
      setDiscordStatus({ connected: false, username: null });
      addToast('Discord déconnecté', 'success');
    } catch (error) {
      console.error('Discord disconnect failed:', error);
      addToast('Erreur lors de la déconnexion Discord', 'error');
    }
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => {
      const newToasts = [...prev, { id, message, type }];
      return newToasts.slice(-5);
    });
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleCharacterSelect = (characterId) => {
    setSelectedCharacter(characterId);
  };

  const deleteCharacter = (characterId) => {
    setConfirmDialog({
      title: 'Supprimer le personnage',
      message: 'Êtes-vous sûr de vouloir supprimer ce personnage ? Cette action est irréversible.',
      onConfirm: async () => {
        setConfirmDialog(null);
        setError(null);
        try {
          await axios.delete(`/api/characters/${characterId}`, { withCredentials: true });
          await refreshCharacters();
          if (selectedCharacter === characterId) {
            setSelectedCharacter(null);
          }
          addToast('Personnage supprimé avec succès', 'success');
        } catch (error) {
          console.error('Delete error:', error);
          setError(`Impossible de supprimer le personnage: ${error.response?.data?.error || error.message}`);
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const aggregateByOre = () => {
    const aggregated = {};
    miningData.forEach(record => {
      if (!aggregated[record.type_id]) {
        const info = oreInfo[record.type_id];
        aggregated[record.type_id] = {
          type_id: record.type_id,
          name: info?.name || `Type ${record.type_id}`,
          total: 0
        };
      }
      // Calculer le volume en m³ (quantité * volume unitaire)
      const volumeM3 = calculateVolume(parseInt(record.quantity), record.type_id);
      aggregated[record.type_id].total += volumeM3;
    });
    return Object.values(aggregated).sort((a, b) => b.total - a.total);
  };

  return (
    <div className="dashboard">
      <NavBar />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      
      <div className="dashboard-content">
        <aside className="characters-panel">
          <div className="panel-header">
            <h2>Mes Personnages</h2>
            <button onClick={login} className="add-character-btn" title="Ajouter un personnage">
              +
            </button>
          </div>

          <div className="discord-section">
            {discordStatus.connected ? (
              <div className="discord-connected">
                <span className="discord-icon">🟢</span>
                <div className="discord-info">
                  <div className="discord-username">{discordStatus.username}</div>
                  <button onClick={disconnectDiscord} className="discord-btn disconnect">
                    Déconnecter Discord
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={connectDiscord} className="discord-btn connect">
                <span className="discord-icon">💬</span>
                Connecter Discord
              </button>
            )}
          </div>

          <div className="characters-list">
            {characters.map(char => (
              <div 
                key={char.character_id}
                className={`character-card ${selectedCharacter === char.character_id ? 'active' : ''}`}
                onClick={() => handleCharacterSelect(char.character_id)}
              >
                <div className="character-info">
                  <img 
                    src={`https://images.evetech.net/characters/${char.character_id}/portrait?size=64`}
                    alt={char.character_name}
                    className="character-avatar"
                  />
                  <div className="character-details">
                    <div className="character-name">{char.character_name}</div>
                    <div className="character-corp">{char.corporation_name}</div>
                    {char.is_primary && <span className="primary-badge">Principal</span>}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteCharacter(char.character_id); }}
                  className="delete-btn"
                  title="Supprimer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className="main-content">
          {selectedCharacter ? (
            <>
              {miningData.length > 0 && (
                <>
                  <section className="stats-section">
                    <h2>Résumé par minerai</h2>
                    <div className="ore-stats">
                      {aggregateByOre().map(ore => (
                        <div key={ore.type_id} className="ore-stat-card">
                          <div className="ore-name">{ore.name}</div>
                          <div className="ore-quantity">{formatNumber(ore.total)} m³</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="records-section">
                    <h2>Historique détaillé ({miningData.length} enregistrements)</h2>
                    <div className="records-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Minerai</th>
                            <th>Quantité (m³)</th>
                            <th>Système solaire</th>
                          </tr>
                        </thead>
                        <tbody>
                          {miningData.slice(0, 50).map((record, index) => {
                            const info = oreInfo[record.type_id];
                            const volumeM3 = calculateVolume(parseInt(record.quantity), record.type_id);
                            return (
                              <tr key={index}>
                                <td>{formatDate(record.date)}</td>
                                <td>{info?.name || `Type ${record.type_id}`}</td>
                                <td>{formatNumber(Math.round(volumeM3))}</td>
                                <td>{record.solar_system_id}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {miningData.length === 0 && !loading && (
                <EmptyState
                  icon="⛏️"
                  title="Aucune donnée de minage"
                  description="Utilisez le bouton 'Synchroniser' dans la barre de navigation pour récupérer votre historique de minage."
                />
              )}
            </>
          ) : (
            <EmptyState 
              icon="👤"
              title="Aucun personnage sélectionné"
              description="Sélectionnez un personnage dans la liste de gauche pour voir ses données de minage."
            />
          )}
        </main>
      </div>
      
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
      
      {toasts.map((toast, index) => (
        <Toast 
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.type === 'success' ? 2500 : 3000}
          onClose={() => removeToast(toast.id)}
          style={{top: `${80 + index * 70}px`}}
        />
      ))}
      
    </div>
  );
}

export default Dashboard;
