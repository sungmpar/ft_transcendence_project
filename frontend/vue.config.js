const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,

  devServer: {
    allowedHosts: [
      'transcendence.koreacentral.cloudapp.azure.com',
      '4.218.8.163',
    ],
    // Follow the browser origin through proxies unless an explicit URL is set.
    client: {
      webSocketURL: process.env.VUE_APP_DEV_WEBSOCKET_URL || 'auto://0.0.0.0:0/ws',
    },
  },
})
