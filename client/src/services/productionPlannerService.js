import axios from 'axios';

const API_BASE_URL = '/api/production-planner';

/**
 * Calcule un plan de production
 * @param {Array} jobs - Liste des jobs [{product, runs, me, te}]
 * @param {string} stock - Stock existant (format texte)
 * @param {Object} config - Configuration (slots, blacklist, etc.)
 * @returns {Promise<Object>} Plan de production
 */
export async function calculateProductionPlan(jobs, stock, config) {
  try {
    const response = await axios.post(`${API_BASE_URL}/calculate`, {
      jobs,
      stock,
      config
    });
    return response.data;
  } catch (error) {
    console.error('Error calculating production plan:', error);
    throw new Error(error.response?.data?.error || 'Failed to calculate production plan');
  }
}

/**
 * Récupère un blueprint par typeID du produit
 * @param {number} typeId - Type ID du produit
 * @returns {Promise<Object>} Blueprint data
 */
export async function getBlueprintByProduct(typeId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/blueprint/${typeId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching blueprint:', error);
    throw new Error(error.response?.data?.error || 'Failed to fetch blueprint');
  }
}

/**
 * Recherche un produit par nom
 * @param {string} query - Nom du produit
 * @returns {Promise<Object>} Produit trouvé
 */
export async function searchProduct(query) {
  try {
    const response = await axios.post(`${API_BASE_URL}/search-product`, {
      query
    });
    return response.data;
  } catch (error) {
    console.error('Error searching product:', error);
    throw new Error(error.response?.data?.error || 'Product not found');
  }
}

/**
 * Vérifie le status du service
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    console.error('Error checking health:', error);
    throw new Error('Service unavailable');
  }
}
