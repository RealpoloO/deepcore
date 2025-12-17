import { useState, useEffect } from 'react';
import axios from 'axios';
import NavBar from '../components/NavBar';
import ErrorBanner from '../components/ErrorBanner';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { formatPrice, formatLargeNumber } from '../utils/formatters';
import './Ware.css';

function Ware() {
  const [importText, setImportText] = useState('');
  const [importCost, setImportCost] = useState(() => {
    const saved = localStorage.getItem('ware_import_cost');
    return saved ? parseFloat(saved) : 1200;
  });
  const [items, setItems] = useState([]);
  const [jitaItems, setJitaItems] = useState([]);
  const [cjItems, setCjItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast, showToast } = useToast();

  // Sauvegarder le coût d'import dans localStorage
  useEffect(() => {
    localStorage.setItem('ware_import_cost', importCost.toString());
  }, [importCost]);

  // Parser le texte importé
  const parseImportText = (text) => {
    const lines = text.trim().split('\n');
    const parsed = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const quantity = parseInt(parts[1].trim());
        
        if (name && !isNaN(quantity) && quantity > 0) {
          parsed.push({ name, quantity });
        }
      }
    }

    return parsed;
  };



  // Calculer les prix et répartir les items
  const calculatePrices = async () => {
    if (!importText.trim()) {
      showToast('Veuillez coller des données à importer', 'warning');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsedItems = parseImportText(importText);
      
      if (parsedItems.length === 0) {
        showToast('Aucun item valide trouvé', 'warning');
        setLoading(false);
        return;
      }

      showToast(`Recherche de ${parsedItems.length} items...`, 'info');

      // Utiliser la route batch pour tout récupérer en une seule requête
      const batchRes = await axios.post('/api/market/batch', {
        items: parsedItems
      }, { withCredentials: true });

      const processedItems = batchRes.data.items.map(item => {
        const jitaSell = item.jitaSell || 0;
        const cjSell = item.cjSell || 0;
        const volume = item.volume || 0;

        // Log pour débugger les prix à 0
        if (jitaSell === 0 && cjSell === 0 && !item.error) {
          console.warn(`⚠️ Aucun prix pour "${item.name}" (typeId: ${item.typeId})`);
        }

        // Calculer le coût d'import DEPUIS Jita VERS C-J
        const importCostTotal = volume * item.quantity * importCost;
        const jitaTotalPrice = (jitaSell * item.quantity) + importCostTotal;
        const cjTotalPrice = cjSell * item.quantity;

        return {
          name: item.name,
          quantity: item.quantity,
          typeId: item.typeId,
          volume,
          iconID: item.iconID,
          jitaSellPrice: jitaSell,
          cjSellPrice: cjSell,
          jitaTotalPrice,
          cjTotalPrice,
          cheaperMarket: jitaTotalPrice <= cjTotalPrice ? 'jita' : 'cj',
          error: item.error
        };
      });

      const foundCount = processedItems.filter(i => !i.error).length;

      setItems(processedItems);

      // Répartir les items dans les deux tableaux
      const jita = processedItems.filter(item => item.cheaperMarket === 'jita');
      const cj = processedItems.filter(item => item.cheaperMarket === 'cj');

      setJitaItems(jita);
      setCjItems(cj);

      showToast(`${foundCount}/${processedItems.length} items analysés`, 'success');
    } catch (err) {
      console.error('Calculate error:', err);
      setError(`Erreur lors du calcul: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export vers clipboard
  const exportToClipboard = async (marketItems, marketName) => {
    if (marketItems.length === 0) {
      showToast(`Aucun item à acheter sur ${marketName}`, 'warning');
      return;
    }

    const exportText = marketItems
      .map(item => `${item.name}\t${item.quantity}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(exportText);
      showToast(`${marketItems.length} items copiés pour ${marketName}`, 'success');
    } catch (err) {
      console.error('Clipboard error:', err);
      showToast('Erreur lors de la copie', 'error');
    }
  };

  // Calculer les totaux
  const jitaTotal = jitaItems.reduce((sum, item) => sum + item.jitaTotalPrice, 0);
  const cjTotal = cjItems.reduce((sum, item) => sum + item.cjTotalPrice, 0);
  const grandTotal = jitaTotal + cjTotal;
  
  // Calculer le coût d'import total (seulement pour les items de Jita)
  const totalImportCost = jitaItems.reduce((sum, item) => {
    return sum + (item.volume * item.quantity * importCost);
  }, 0);
  
  // Calculer le volume total en m³
  const totalVolume = jitaItems.reduce((sum, item) => {
    return sum + (item.volume * item.quantity);
  }, 0);
  
  // Prix Jita sans import
  const jitaTotalWithoutImport = jitaItems.reduce((sum, item) => {
    return sum + (item.jitaSellPrice * item.quantity);
  }, 0);

  return (
    <div className="page-container">
      <NavBar />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      
      <div className="ware-container">
        <div className="ware-header">
          <h1>Market Comparison</h1>
          <p>Comparez les prix entre Jita et C-J6MT avec coût d'import</p>
        </div>

        {/* Configuration */}
        <div className="ware-config">
          <div className="config-item">
            <label htmlFor="import-cost">Coût d'import (ISK/m³)</label>
            <input
              id="import-cost"
              type="number"
              value={importCost}
              onChange={(e) => setImportCost(parseFloat(e.target.value) || 0)}
              min="0"
              step="100"
            />
          </div>
        </div>

        {/* Import zone */}
        <div className="ware-import">
          <label htmlFor="import-text">Importer depuis le clipboard (Format: Nom Quantité)</label>
          <textarea
            id="import-text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Amber Mykoserocin	1096&#10;Azure Mykoserocin	4932&#10;Tritanium	30189988"
            rows="10"
          />
          <button 
            className="btn btn-primary"
            onClick={calculatePrices}
            disabled={loading}
          >
            {loading ? '⏳ Calcul en cours...' : '🔍 Analyser les prix'}
          </button>
        </div>

        {/* Résultats */}
        {items.length > 0 && (
          <div className="ware-results">
            {/* Résumé */}
            <div className="ware-summary">
              <div className="summary-card">
                <h3>💰 Résumé</h3>
                <p>Total Jita: <strong>{formatPrice(jitaTotal)}</strong> ({jitaItems.length} items)</p>
                <p>Total C-J6MT: <strong>{formatPrice(cjTotal)}</strong> ({cjItems.length} items)</p>
                <p>Coût d'import total: <strong>{formatPrice(totalImportCost)}</strong> ({formatLargeNumber(totalVolume)} m³)</p>
                <p className="grand-total">Total: <strong>{formatPrice(grandTotal)}</strong></p>
              </div>
            </div>

            {/* Tableaux côte à côte */}
            <div className="ware-tables">
              {/* Jita */}
              <div className="market-table">
                <div className="market-table-header">
                  <h3>🟦 Jita ({jitaItems.length} items)</h3>
                  <button
                    className="btn btn-secondary"
                    onClick={() => exportToClipboard(jitaItems, 'Jita')}
                    disabled={jitaItems.length === 0}
                  >
                    📋 Export Jita
                  </button>
                </div>
                
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Quantité</th>
                        <th>Prix Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jitaItems.map((item, idx) => (
                        <tr key={idx} className={item.jitaSellPrice === 0 ? 'no-price' : ''}>
                          <td>
                            <div className="item-with-icon">
                              {item.typeId && (
                                <img
                                  src={`https://images.evetech.net/types/${item.typeId}/icon?size=32`}
                                  alt={item.name}
                                  className="item-icon"
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                              <span>
                                {item.name}
                                {item.jitaSellPrice === 0 && <span className="badge-warning">Prix non dispo</span>}
                              </span>
                            </div>
                          </td>
                          <td>{formatLargeNumber(item.quantity)}</td>
                          <td>{item.jitaSellPrice === 0 ? '—' : formatPrice(item.jitaTotalPrice)}</td>
                        </tr>
                      ))}
                      {jitaItems.length === 0 && (
                        <tr>
                          <td colSpan="3" className="text-center text-muted">
                            Aucun item à acheter sur Jita
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2"><strong>Total Jita</strong></td>
                        <td><strong>{formatPrice(jitaTotal)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* C-J6MT */}
              <div className="market-table">
                <div className="market-table-header">
                  <h3>🟥 C-J6MT ({cjItems.length} items)</h3>
                  <button
                    className="btn btn-secondary"
                    onClick={() => exportToClipboard(cjItems, 'C-J6MT')}
                    disabled={cjItems.length === 0}
                  >
                    📋 Export C-J
                  </button>
                </div>
                
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Quantité</th>
                        <th>Prix Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cjItems.map((item, idx) => (
                        <tr key={idx} className={item.cjSellPrice === 0 ? 'no-price' : ''}>
                          <td>
                            <div className="item-with-icon">
                              {item.typeId && (
                                <img
                                  src={`https://images.evetech.net/types/${item.typeId}/icon?size=32`}
                                  alt={item.name}
                                  className="item-icon"
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                              <span>
                                {item.name}
                                {item.cjSellPrice === 0 && <span className="badge-warning">Prix non dispo</span>}
                              </span>
                            </div>
                          </td>
                          <td>{formatLargeNumber(item.quantity)}</td>
                          <td>{item.cjSellPrice === 0 ? '—' : formatPrice(item.cjTotalPrice)}</td>
                        </tr>
                      ))}
                      {cjItems.length === 0 && (
                        <tr>
                          <td colSpan="3" className="text-center text-muted">
                            Aucun item à acheter sur C-J6MT
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2"><strong>Total C-J6MT</strong></td>
                        <td><strong>{formatPrice(cjTotal)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default Ware;
