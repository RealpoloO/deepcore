import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import NavBar from '../components/NavBar';
import ErrorBanner from '../components/ErrorBanner';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import useOreInfo from '../hooks/useOreInfo';
import { useToast } from '../hooks/useToast';
import { formatLargeNumber } from '../utils/formatters';
import './Stats.css';

function Stats() {
  const { characters } = useAuth();
  const [loading, setLoading] = useState(false);
  const [globalStats, setGlobalStats] = useState(null);
  const [oreStats, setOreStats] = useState([]);
  const [characterStats, setCharacterStats] = useState([]);
  const [period, setPeriod] = useState('all'); // all, 7days, 30days, thisMonth, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [error, setError] = useState(null);
  const { toast, showToast } = useToast();
  
  const typeIds = useMemo(() => [...new Set(oreStats.map(o => o.type_id))], [oreStats]);
  const { oreInfo } = useOreInfo(typeIds);

  useEffect(() => {
    if (characters.length > 0) {
      loadStats();
    }
  }, [characters, period]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = null;
    let endDate = now.toISOString().split('T')[0];

    switch (period) {
      case '7days':
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        break;
      case '30days':
        startDate = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = null;
        endDate = null;
    }

    return { startDate, endDate };
  };

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange();
      
      // Valider les dates custom
      if (period === 'custom') {
        if (!customStartDate || !customEndDate) {
          setError('Veuillez sélectionner une date de début et de fin');
          setLoading(false);
          return;
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
          setError('La date de début doit être antérieure à la date de fin');
          setLoading(false);
          return;
        }
      }
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // Charger les stats par minerai
      const oreResponse = await axios.get(`/api/mining/stats/by-ore?${params}`, { 
        withCredentials: true 
      });
      setOreStats(oreResponse.data.oreStats);

      // Charger les stats par personnage
      const charResponse = await axios.get(`/api/mining/stats/all?${params}`, { 
        withCredentials: true 
      });
      
      // Agréger par personnage
      const charMap = {};
      charResponse.data.stats.forEach(stat => {
        if (!charMap[stat.character_id]) {
          charMap[stat.character_id] = {
            character_id: stat.character_id,
            character_name: stat.character_name,
            total_quantity: 0,
            mining_days: stat.mining_days,
            ores: []
          };
        }
        charMap[stat.character_id].total_quantity += parseInt(stat.total_quantity);
        charMap[stat.character_id].ores.push({
          type_id: stat.type_id,
          quantity: parseInt(stat.total_quantity)
        });
      });
      
      const charArray = Object.values(charMap).sort((a, b) => b.total_quantity - a.total_quantity);
      setCharacterStats(charArray);

      // Calculer les stats globales avec les vraies données du backend
      const totalVolume = oreResponse.data.oreStats.reduce((sum, ore) => sum + parseInt(ore.total_quantity), 0);
      const totalDays = oreResponse.data.globalStats.total_days;
      const activeChars = oreResponse.data.globalStats.active_characters;
      
      setGlobalStats({
        totalVolume,
        totalDays,
        activeCharacters: activeChars,
        uniqueOres: oreResponse.data.globalStats.unique_ores
      });

    } catch (error) {
      console.error('Load stats error:', error);
      setError(`Impossible de charger les statistiques: ${error.response?.data?.error || error.message}`);
      setGlobalStats(null);
      setOreStats([]);
      setCharacterStats([]);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  return (
    <div className="dashboard">
      <NavBar />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      
      <div className="stats-container">
        <div className="stats-header">
          <h2>📊 Statistiques Globales</h2>
          
          <div className="period-selector">
            <button 
              className={period === 'all' ? 'active' : ''} 
              onClick={() => setPeriod('all')}
            >
              Tout
            </button>
            <button 
              className={period === '7days' ? 'active' : ''} 
              onClick={() => setPeriod('7days')}
            >
              7 jours
            </button>
            <button 
              className={period === '30days' ? 'active' : ''} 
              onClick={() => setPeriod('30days')}
            >
              30 jours
            </button>
            <button 
              className={period === 'thisMonth' ? 'active' : ''} 
              onClick={() => setPeriod('thisMonth')}
            >
              Ce mois
            </button>
            <button 
              className={period === 'custom' ? 'active' : ''} 
              onClick={() => setPeriod('custom')}
            >
              Personnalisé
            </button>
          </div>

          {period === 'custom' && (
            <div className="custom-date-range">
              <input 
                type="date" 
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span>à</span>
              <input 
                type="date" 
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              <button onClick={loadStats} className="apply-btn">Appliquer</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-stats">⏳ Chargement des statistiques...</div>
        ) : globalStats ? (
          <>
            {/* Vue d'ensemble */}
            <section className="overview-section">
              <h3>📈 Vue d'ensemble</h3>
              <div className="overview-cards">
                <div className="stat-card">
                  <div className="stat-icon">📦</div>
                  <div className="stat-value">{formatLargeNumber(globalStats.totalVolume)} m³</div>
                  <div className="stat-label">Volume total miné</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-value">{globalStats.activeCharacters}</div>
                  <div className="stat-label">Personnages actifs</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📅</div>
                  <div className="stat-value">{globalStats.totalDays}</div>
                  <div className="stat-label">Jours de minage</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💎</div>
                  <div className="stat-value">{globalStats.uniqueOres}</div>
                  <div className="stat-label">Types de minerais</div>
                </div>
              </div>
            </section>

            {/* Top Minerais */}
            <section className="top-ores-section">
              <h3>💎 Top Minerais</h3>
              <div className="top-ores-list">
                {oreStats.slice(0, 10).map((ore, index) => {
                  const percentage = (parseInt(ore.total_quantity) / globalStats.totalVolume * 100).toFixed(1);
                  return (
                    <div key={ore.type_id} className="ore-bar-item">
                      <div className="ore-rank">#{index + 1}</div>
                      <div className="ore-info">
                        <div className="ore-bar-name">{oreInfo[ore.type_id]?.name || `Type ${ore.type_id}`}</div>
                        <div className="ore-bar-stats">
                          {formatLargeNumber(ore.total_quantity)} m³ ({percentage}%)
                        </div>
                      </div>
                      <div className="ore-bar-container">
                        <div 
                          className="ore-bar-fill" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Classement des personnages */}
            <section className="characters-ranking-section">
              <h3>🏆 Classement des Personnages</h3>
              <div className="ranking-table">
                <table>
                  <thead>
                    <tr>
                      <th>Rang</th>
                      <th>Personnage</th>
                      <th>Volume Total</th>
                      <th>Jours Actifs</th>
                      <th>Moyenne/Jour</th>
                      <th>% du Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {characterStats.map((char, index) => {
                      const avgPerDay = char.mining_days > 0 ? char.total_quantity / char.mining_days : 0;
                      const percentage = (char.total_quantity / globalStats.totalVolume * 100).toFixed(1);
                      return (
                        <tr key={char.character_id}>
                          <td>
                            <span className={`rank-badge rank-${index + 1}`}>
                              {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                            </span>
                          </td>
                          <td className="character-cell">
                            <img 
                              src={`https://images.evetech.net/characters/${char.character_id}/portrait?size=32`}
                              alt={char.character_name}
                              className="char-avatar-small"
                            />
                            {char.character_name}
                          </td>
                          <td>{formatLargeNumber(char.total_quantity)} m³</td>
                          <td>{char.mining_days}</td>
                          <td>{formatLargeNumber(Math.round(avgPerDay))} m³</td>
                          <td>
                            <div className="percentage-bar">
                              <div 
                                className="percentage-fill" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                              <span className="percentage-text">{percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tableau détaillé des minerais */}
            <section className="detailed-ores-section">
              <h3>📋 Détail par Minerai</h3>
              <div className="detailed-table">
                <table>
                  <thead>
                    <tr>
                      <th>Minerai</th>
                      <th>Volume Total</th>
                      <th>Personnages</th>
                      <th>Jours Minés</th>
                      <th>Moyenne/Jour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oreStats.map(ore => {
                      const avgPerDay = ore.days_mined > 0 ? parseInt(ore.total_quantity) / ore.days_mined : 0;
                      return (
                        <tr key={ore.type_id}>
                          <td>{oreInfo[ore.type_id]?.name || `Type ${ore.type_id}`}</td>
                          <td>{formatLargeNumber(ore.total_quantity)} m³</td>
                          <td>{ore.characters_mined}</td>
                          <td>{ore.days_mined}</td>
                          <td>{formatLargeNumber(Math.round(avgPerDay))} m³</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <EmptyState 
            icon="📊"
            title="Aucune statistique disponible"
            description="Synchronisez vos personnages depuis l'onglet 'Gestion de compte' pour voir les statistiques de minage."
          />
        )}
      </div>
      
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default Stats;
