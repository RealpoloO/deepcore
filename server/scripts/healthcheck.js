import http from 'http';

/**
 * Script de healthcheck pour Docker
 * Vérifie que le serveur répond correctement
 */
const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 5000,
  method: 'GET'
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    console.error(`Health check failed with status code: ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.error('Health check request failed:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('Health check request timed out');
  request.destroy();
  process.exit(1);
});

request.end();
