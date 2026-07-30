module.exports = {
  apps: [
    {
      name: "expirely-backend",
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};