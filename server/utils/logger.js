import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Définir les niveaux de log personnalisés
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Déterminer le niveau de log basé sur l'environnement
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Définir les couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Format pour les logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, ...meta } = info;
      let metaString = '';

      // Ajouter les métadonnées si présentes
      if (Object.keys(meta).length > 0) {
        // Enlever les propriétés internes de winston
        const cleanMeta = { ...meta };
        delete cleanMeta.stack;
        delete cleanMeta[Symbol.for('level')];
        delete cleanMeta[Symbol.for('message')];
        delete cleanMeta[Symbol.for('splat')];

        if (Object.keys(cleanMeta).length > 0) {
          metaString = '\n' + JSON.stringify(cleanMeta, null, 2);
        }
      }

      // Ajouter la stack trace pour les erreurs
      if (info.stack) {
        metaString += '\n' + info.stack;
      }

      return `[${timestamp}] ${level}: ${message}${metaString}`;
    }
  )
);

// Définir les transports (où les logs sont écrits)
const transports = [
  // Console pour tous les logs
  new winston.transports.Console(),

  // Fichier pour les erreurs
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Fichier pour tous les logs
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Créer le logger
const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  format,
  transports,
  // Ne pas quitter sur les erreurs non gérées
  exitOnError: false,
});

// Créer un stream pour Morgan (logging HTTP)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

export default logger;
