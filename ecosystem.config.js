module.exports = {
  apps: [
    {
      name: 'iptv-hotel-panel',
      script: './backend/src/app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      log_file: './backend/logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'public/uploads']
    },
    {
      name: 'iptv-mock-pms',
      script: './mock-pms/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        MOCK_PMS_PORT: 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './mock-pms/logs/pm2-error.log',
      out_file: './mock-pms/logs/pm2-out.log',
      log_file: './mock-pms/logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      restart_delay: 4000
    }
  ]
};
