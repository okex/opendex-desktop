const path = require('path');

const staticLocalPath = 'http://127.0.0.1:5300/dex-test/swap';
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
