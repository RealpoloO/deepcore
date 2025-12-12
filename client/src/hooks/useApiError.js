import { useState, useCallback } from 'react';
import { useToast } from './useToast';

/**
 * Hook personnalisé pour gérer les erreurs API de manière cohérente
 * @returns {Object} Objet contenant l'état d'erreur et les fonctions de gestion
 */
export function useApiError() {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  /**
   * Gère une erreur d'API et l'affiche à l'utilisateur
   * @param {Error} err - L'erreur à traiter
   * @param {string} defaultMessage - Message par défaut si l'erreur n'a pas de message
   */
  const handleError = useCallback((err, defaultMessage = 'Une erreur est survenue') => {
    console.error('API Error:', err);

    let errorMessage = defaultMessage;
    let errorDetails = null;

    if (err.response) {
      // Erreur de réponse du serveur
      const { data, status } = err.response;

      // Gestion des codes d'erreur spécifiques
      switch (status) {
        case 400:
          errorMessage = data.error || 'Requête invalide';
          errorDetails = data.details;
          break;
        case 401:
          errorMessage = 'Non authentifié. Veuillez vous reconnecter.';
          break;
        case 403:
          errorMessage = 'Accès refusé';
          break;
        case 404:
          errorMessage = 'Ressource non trouvée';
          break;
        case 429:
          errorMessage = data.error || 'Trop de requêtes. Veuillez patienter.';
          break;
        case 500:
          errorMessage = data.error || 'Erreur serveur';
          if (data.details) {
            errorDetails = data.details;
          }
          break;
        default:
          errorMessage = data.error || defaultMessage;
      }
    } else if (err.request) {
      // La requête a été faite mais pas de réponse
      errorMessage = 'Pas de réponse du serveur. Vérifiez votre connexion.';
    } else {
      // Erreur lors de la configuration de la requête
      errorMessage = err.message || defaultMessage;
    }

    const fullError = {
      message: errorMessage,
      details: errorDetails,
      status: err.response?.status,
      timestamp: new Date().toISOString()
    };

    setError(fullError);

    // Afficher un toast avec l'erreur
    showToast(errorMessage, 'error');

    return fullError;
  }, [showToast]);

  /**
   * Efface l'erreur actuelle
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Wrapper pour exécuter une fonction asynchrone avec gestion d'erreur
   * @param {Function} asyncFn - Fonction asynchrone à exécuter
   * @param {string} errorMessage - Message d'erreur personnalisé
   * @returns {Promise<any>} Le résultat de la fonction ou null en cas d'erreur
   */
  const executeAsync = useCallback(async (asyncFn, errorMessage) => {
    setIsLoading(true);
    clearError();

    try {
      const result = await asyncFn();
      setIsLoading(false);
      return result;
    } catch (err) {
      setIsLoading(false);
      handleError(err, errorMessage);
      return null;
    }
  }, [handleError, clearError]);

  /**
   * Vérifie si une erreur est d'un type spécifique
   * @param {number} statusCode - Code de statut HTTP à vérifier
   * @returns {boolean} True si l'erreur a ce code de statut
   */
  const isErrorType = useCallback((statusCode) => {
    return error?.status === statusCode;
  }, [error]);

  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeAsync,
    isErrorType,
    // Helpers pour des types d'erreurs courants
    isUnauthorized: isErrorType(401),
    isForbidden: isErrorType(403),
    isNotFound: isErrorType(404),
    isRateLimited: isErrorType(429),
    isServerError: error?.status >= 500
  };
}
