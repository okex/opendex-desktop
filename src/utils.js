const shell = require('shelljs');
const Store = require('electron-store');
const { EventEmitter } = require('events');
const got = require('got');
const { download } = require('electron-dl');


const nodePath = shell.which('node');
if (nodePath) {
  shell.config.execPath = nodePath.toString();
  console.log(shell.config.execPath)
}


// store
const schema = {
  releaseTag: {
    type: 'string'
  }
};
const store = new Store({ schema });

// emitter
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// request
const request = got.extend({
  responseType: 'json',
  hooks: {
    afterResponse: [(response) => {
      return response;
    }],
  },
  retry: {
    limit: 5,
    maxRetryAfter: 3000
  }
});

module.exports = {
  store,
  emitter,
  request,
  shell,
  download: (name, resolve) => {
    let finishEmit = false;
    return (...args) => {
      emitter.emit(`downloadStart@${name}`);
      args[2] = args[2] || {};

      if (typeof args[2].onProgress !== 'function') {
        args[2].onProgress = async (res) => {
          emitter.emit(`downloadProgress@${name}`, res);

          if (res.percent === 1 && !finishEmit) {
            finishEmit = true;
            emitter.emit(`downloadFinish@${name}`);
            typeof resolve === 'function' && resolve(true);
          }
        }
      }
      
      download.apply(download, args);
    }
  }
}