const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,

  devServer: {
    allowedHosts: [
      'transcendence.koreacentral.cloudapp.azure.com',
      '4.218.8.163',
    ],
    // Default to this dev server. A reverse proxy can explicitly set its URL.
    ...(process.env.VUE_APP_DEV_WEBSOCKET_URL ? {
      client: { webSocketURL: process.env.VUE_APP_DEV_WEBSOCKET_URL },
    } : {}),
  },
})
