// PM2 process definition for the Angular SSR server.
//
// Secrets (API_KEY, etc.) are NOT stored here. They are loaded at runtime from
// a git-ignored env file via Node's --env-file flag. Copy .env.example to .env,
// fill in real values, then start with:
//
//   pm2 start ecosystem.config.cjs
//
// Non-secret defaults can live in the `env` block below.
module.exports = {
  apps: [
    {
      name: 'bergportal-web',
      script: 'dist/web/server/server.mjs',
      // Load environment variables from ./.env (keep real secrets out of git).
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        // Non-secret defaults; override in .env as needed.
        PORT: 4000,
        API_BASE_URL: 'http://127.0.0.1:3000',
      },
    },
  ],
};
