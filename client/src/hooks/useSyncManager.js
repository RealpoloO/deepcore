import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

/**
 * Custom hook to manage unified sync for both mining data and industry jobs
 * Auto-refreshes every 2 hours
 */
export function useSyncManager() {
  const { characters } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => {
    const saved = localStorage.getItem('last_sync_time');
    return saved ? parseInt(saved) : null;
  });
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sync all characters for both mining and industry
  const syncAll = useCallback(async (onCharacterSync) => {
    if (characters.length === 0 || syncing) return;

    setSyncing(true);

    try {
      let miningSuccess = 0;
      let miningError = 0;
      let industrySuccess = 0;
      let industryError = 0;
      const errorMessages = [];

      for (const char of characters) {
        let charMiningSuccess = false;
        let charIndustrySuccess = false;

        // Sync mining data
        try {
          await axios.post(`/api/mining/sync/${char.character_id}`, {}, { withCredentials: true });
          miningSuccess++;
          charMiningSuccess = true;
        } catch (error) {
          console.error(`Mining sync error for ${char.character_name}:`, error);
          miningError++;
          errorMessages.push(`${char.character_name} (mining): ${error.response?.data?.error || error.message}`);
        }

        // Sync industry jobs
        try {
          await axios.post(`/api/industry/sync/${char.character_id}`, {}, { withCredentials: true });
          industrySuccess++;
          charIndustrySuccess = true;
        } catch (error) {
          console.error(`Industry sync error for ${char.character_name}:`, error);
          industryError++;
          errorMessages.push(`${char.character_name} (industry): ${error.response?.data?.error || error.message}`);
        }

        // Callback pour afficher le toast par personnage
        if (onCharacterSync) {
          if (charMiningSuccess && charIndustrySuccess) {
            onCharacterSync(char.character_name, true);
          } else {
            onCharacterSync(char.character_name, false);
          }
        }

        // Petit délai pour que l'utilisateur puisse voir les toasts
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const now = Date.now();
      setLastSync(now);
      localStorage.setItem('last_sync_time', now.toString());

      return {
        success: miningError === 0 && industryError === 0,
        miningSuccess,
        miningError,
        industrySuccess,
        industryError,
        totalCharacters: characters.length,
        errorMessages
      };
    } catch (error) {
      console.error('Sync all error:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setSyncing(false);
    }
  }, [characters, syncing]);

  // Auto-sync every 2 hours
  useEffect(() => {
    if (!lastSync) return;

    const twoHours = 2 * 60 * 60 * 1000;
    const timeUntilNextSync = Math.max(0, (lastSync + twoHours) - currentTime);

    if (timeUntilNextSync === 0) {
      syncAll();
      return;
    }

    const timer = setTimeout(() => {
      syncAll();
    }, timeUntilNextSync);

    return () => clearTimeout(timer);
  }, [lastSync, currentTime, syncAll]);

  // Format time remaining until next sync
  const getTimeUntilNextSync = useCallback(() => {
    if (!lastSync) return null;

    const twoHours = 2 * 60 * 60 * 1000;
    const nextSync = lastSync + twoHours;
    const remaining = Math.max(0, nextSync - currentTime);

    if (remaining === 0) return 'Synchronisation...';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [lastSync, currentTime]);

  return {
    syncing,
    lastSync,
    syncAll,
    timeUntilNextSync: getTimeUntilNextSync()
  };
}
