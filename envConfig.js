const path = require('path');

const staticLocalPath = 'http://127.0.0.1:5200/dex-test/spot/trade';
const staticBundlePath = `file://${path.resolve(__dirname, './bundle')}`;

module.exports = {
  staticLocalPath,
  staticBundlePath,
  locale: {
    staticPath: staticLocalPath,
    entryTplName: ''
  },
  develope: {
    staticPath: staticBundlePath,
    entryTplName: 'index.html'
  },
  prod: {
    staticPath: staticBundlePath,
    entryTplName: 'index.html'
  }
};
