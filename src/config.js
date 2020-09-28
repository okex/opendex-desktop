const { app } = require('electron');

module.exports = {
  OKExchainDir: process.platform === 'win32' ? `%ProgramFiles%/OKExChain` : `${app.getPath('home')}/OKExChain`,
}