const shell = require('shelljs');
const Store = require('electron-store');
const { EventEmitter } = require('events');
const got = require('got');

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
  shell
}