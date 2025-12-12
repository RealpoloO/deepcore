import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

/**
 * Hook personnalisé pour récupérer les informations complètes des minerais (nom + volume)
 * @param {number[]} typeIds - Array d'IDs de types de minerais
 * @returns {Object} { oreInfo, loading, error, calculateVolume }
 */
function useOreInfo(typeIds = []) {
  const [oreInfo, setOreInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOreInfo = useCallback(async (ids) => {
    if (!ids || ids.length === 0) {
      setOreInfo({});
      return {};
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/mining/ore-info',
        { typeIds: ids },
        { withCredentials: true }
      );
      setOreInfo(response.data.oreInfo);
      return response.data.oreInfo;
    } catch (err) {
      const errorMessage = `Erreur chargement infos minerais: ${err.response?.data?.error || err.message}`;
      setError(errorMessage);
      console.error('Ore info fetch error:', err);
      
      // Fallback: créer des infos par défaut
      const fallback = {};
      ids.forEach(id => {
        fallback[id] = { name: `Type ${id}`, volume: 1 };
      });
      setOreInfo(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch quand typeIds change
  useEffect(() => {
    if (typeIds && typeIds.length > 0) {
      fetchOreInfo(typeIds);
    }
  }, [JSON.stringify(typeIds), fetchOreInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Calcule le volume en m³ pour une quantité et un type de minerai
   * @param {number} quantity - Quantité en unités
   * @param {number} typeId - ID du type de minerai
   * @returns {number} Volume en m³
   */
  const calculateVolume = useCallback((quantity, typeId) => {
    const info = oreInfo[typeId];
    const volume = info?.volume || 1;
    return quantity * volume;
  }, [oreInfo]);

  return {
    oreInfo,
    loading,
    error,
    refetch: fetchOreInfo,
    calculateVolume
  };
}

export default useOreInfo;
