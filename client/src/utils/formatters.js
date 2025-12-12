/**
 * Formate un grand nombre avec des espaces comme séparateurs
 * @param {number} num - Le nombre à formater
 * @returns {string} Le nombre formaté
 */
export function formatLargeNumber(num) {
  if (!num && num !== 0) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Formate une date au format français
 * @param {string|Date} dateStr - La date à formater
 * @returns {string} La date formatée
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formate une date avec heure au format français
 * @param {string|Date} dateStr - La date à formater
 * @returns {string} La date avec heure formatée
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formate un prix en ISK
 * @param {number} price - Le prix à formater
 * @returns {string} Le prix formaté avec ISK
 */
export function formatPrice(price) {
  if (!price && price !== 0) return '0 ISK';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price) + ' ISK';
}

/**
 * Formate une durée entre deux dates
 * @param {string|Date} startDate - Date de début
 * @param {string|Date} endDate - Date de fin
 * @returns {string} La durée formatée (ex: "2j 5h")
 */
export function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = end - start;
  
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days}j ${hours}h`;
  }
  return `${hours}h`;
}

/**
 * Formate un temps restant
 * @param {string|Date} endDate - Date de fin
 * @returns {string} Le temps restant formaté
 */
export function formatTimeRemaining(endDate) {
  const end = new Date(endDate);
  const now = new Date();
  const remaining = end - now;

  if (remaining <= 0) {
    return 'Terminé';
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}j ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Formate un volume en m³
 * @param {number} volume - Le volume à formater
 * @returns {string} Le volume formaté avec m³
 */
export function formatVolume(volume) {
  return `${formatLargeNumber(volume)} m³`;
}

/**
 * Calcule le pourcentage
 * @param {number} part - La partie
 * @param {number} total - Le total
 * @returns {string} Le pourcentage formaté
 */
export function formatPercentage(part, total) {
  if (!total || total === 0) return '0%';
  const percentage = (part / total) * 100;
  return percentage.toFixed(1) + '%';
}
