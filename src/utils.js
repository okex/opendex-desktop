const shell = require('shelljs');
const Store = require('electron-store');
const { EventEmitter } = require('events');
const { net } = require('electron');

const nodePath = (shell.which('node').toString());
shell.config.execPath = nodePath;

// store
const schema = {
  releaseTag: {
    type: 'string'
  }
};
const store = new Store({schema});

// emitter
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// request
const request = (option) => {
  return new Promise((resolve, reject) => {
    const request = net.request(option);
    let res = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        res += chunk
      });

      response.on('end', () => {
        resolve(JSON.parse(res))
      });
      response.on('error', (err) => {
        reject(err);
      })
    });

    request.end();
  });
};

module.exports = {
  store,
  emitter,
  request,
  shell: new Proxy(shell, {
    get : function(target, prop ) {
      if (prop === 'exec') {
        const func = target[prop];
        return function (cmd, cb) {
          return new Promise((resolve, reject) => {
            if (typeof cb === 'function') {
              func(cmd, cb)
            } else {
              func(cmd, (code, stdout, stderr) => {
                if (code !== 0) {
                  return reject(stderr);
                }
                resolve(stdout);
              })
            }
          });
        }
      }
      
      return target[prop];
  },
  })
}