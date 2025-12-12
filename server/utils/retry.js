/**
 * Effectue un appel HTTP avec retry et exponential backoff
 * @param {Function} requestFn - Fonction qui retourne une Promise d'appel axios
 * @param {number} retries - Nombre de tentatives restantes
 * @param {number} delay - Délai avant la prochaine tentative (ms)
 * @returns {Promise} Résultat de la requête
 */
export async function retryWithBackoff(requestFn, retries = 3, delay = 1000) {
  try {
    return await requestFn();
  } catch (error) {
    // Ne pas retry si l'erreur n'est pas transiente
    if (error.response) {
      const status = error.response.status;
      // 4xx errors (sauf 429) ne doivent pas être retry
      if (status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
    }

    // Si plus de retries, throw l'erreur
    if (retries <= 0) {
      throw error;
    }

    // Calculer le délai avec jitter
    const jitter = Math.random() * 200; // 0-200ms de jitter
    const waitTime = delay + jitter;

    console.log(`⏳ Retry in ${Math.round(waitTime)}ms (${retries} attempts left)...`);
    
    // Attendre avant de retry
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Retry avec exponential backoff (délai * 2)
    return retryWithBackoff(requestFn, retries - 1, delay * 2);
  }
}
