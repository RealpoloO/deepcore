import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useApiError } from './useApiError';

/**
 * Hook personnalisé pour gérer les données de mining d'un personnage
 * @param {number} characterId - L'ID du personnage Eve Online
 * @returns {Object} { data, loading, error, refetch, clearData }
 */
function useMiningData(characterId) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const { handleError, clearError } = useApiError();

  const loadData = useCallback(async () => {
    if (!characterId) {
      setData([]);
      return;
    }

    setLoading(true);
    clearError();

    try {
      const response = await axios.get(`/api/mining/${characterId}`, {
        withCredentials: true
      });
      setData(response.data.records);
      setLoading(false);
      return response.data.records;
    } catch (err) {
      setLoading(false);
      setData([]);
      handleError(err, 'Impossible de charger les données de minage');
      throw err;
    }
  }, [characterId, handleError, clearError]);

  // Charger automatiquement les données quand characterId change
  useEffect(() => {
    if (characterId) {
      loadData();
    } else {
      setData([]);
    }
  }, [characterId, loadData]);

  const clearData = useCallback(() => {
    setData([]);
    clearError();
  }, [clearError]);

  return {
    data,
    loading,
    refetch: loadData,
    clearData
  };
}

export default useMiningData;
