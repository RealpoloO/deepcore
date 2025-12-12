module.exports = {
  apps: [{
    name: 'whatdidimine',
    script: './server/index.js',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1, // 1 seule instance pour Raspberry Pi
    autorestart: true,
    watch: false,
    max_memory_restart: '512M', // Limite pour Raspberry Pi
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
