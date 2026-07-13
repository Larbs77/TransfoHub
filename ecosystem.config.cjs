/**
 * PM2 process file for TransfoHub (production).
 * Usage on server: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "transfohub",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Load secrets from .env via dotenv in app; do not put passwords here.
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
