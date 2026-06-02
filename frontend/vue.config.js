const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,

  devServer: {
    allowedHosts: [
      'transcendence.koreacentral.cloudapp.azure.com',
      '4.218.8.163',
    ],
  },
})