const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const { store, request, emitter, shell, download } = require('./utils');
const RELEASE_URL = 'https://api.github.com/repos/okex/okexchain/releases/latest';

let isInitWindowReadyReceiveEvent = false;
module.exports = () => {
  let isWindowReadyReceiveEvent = false;
  const asyncEventHandlers = [];

  if (!isInitWindowReadyReceiveEvent) {
    emitter.on('windowReadyReceiveEvent', () => {
      while(asyncEventHandlers.length) {
        const handler = asyncEventHandlers.shift();
        handler();
      }
      console.log('windowReadyReceiveEvent')
      isWindowReadyReceiveEvent = true;
      
    });
    isInitWindowReadyReceiveEvent = true;
  }
  
  const doWhenWindowReadyRecevieEvent = (cb) => {
    if (isWindowReadyReceiveEvent) {
      cb();
    } else {
     asyncEventHandlers.push(cb);
    }
  };

  request(RELEASE_URL).then(response => {
    const { body: data } = response;
    const releaseTag = store.get('okchaindReleaseTag');
    const cliReleaseTag = store.get('okchaincliReleaseTag');
    const directory = process.platform === 'win32' ? `%ProgramFiles%/OKChain` : `${app.getPath('home')}/OKChain`;
    const lastVersionDirectory = `${directory}/${data.tag_name}`;

    console.log(data.tag_name, releaseTag, cliReleaseTag);
    if (!Array.isArray(data.assets) || !data.assets.length) {
      emitter.emit('getReleaseInfoError@download', data);
      return
    }

    const assetType = `okchaind.${process.platform}`;
    const okchaindObj = data.assets.filter(d => d.name.includes(assetType))[0];
    const downloadUrl = okchaindObj.browser_download_url;
    
    const cliType = `okchaincli.${process.platform}`;
    const cliObj = data.assets.filter(d => d.name.includes(cliType))[0];
    const cliDownloadUrl = cliObj.browser_download_url;

    store.set('okchaindObj', okchaindObj);
    store.set('cliObj', cliObj);

    let okchaindNeedUpdate = false;
    let cliNeedUpdate = false;
    let isOkchaindDownload = true;
    let isCliDownload = true;
    let isEmitterInit = false;
    let win;

    const couldTar = {};

    const onDownloadFinished = async (name) => {
      const tarName = name === 'okchaind' ? okchaindObj.name : cliObj.name;
      const appName = tarName.split('.')[0];
      const cmd = `tar -zxvf ${tarName}`;

      shell.cd(lastVersionDirectory);
      try {
        shell.exec(cmd);
        shell.cp(`./${appName}`, '../');
        couldTar[name] = false;
        emitter.emit(`downloadFinish@${name}`);
      } catch(err) {
        console.log(err);
      }

      store.set(`${name}ReleaseTag`, data.tag_name);
      store.set('okchainDirectory', directory);
    }

    const start = async (isRedownload = false) => {
      if (isRedownload && fs.existsSync(lastVersionDirectory)) {
        shell.rm('-f', `${lastVersionDirectory}/okchain*`)
      }

      if (!fs.existsSync(lastVersionDirectory)) {
        isOkchaindDownload = false;
        isCliDownload = false;
      } else {
        if (!releaseTag || !fs.existsSync(`${lastVersionDirectory}/okchaind`)) {
          isOkchaindDownload = false;
        }
        if (!cliReleaseTag || !fs.existsSync(`${lastVersionDirectory}/okchaincli`)) {
          isOkchaindDownload = false;
        }
      }

      okchaindNeedUpdate = okchaindNeedUpdate || (releaseTag !== data.tag_name);
      cliNeedUpdate = cliNeedUpdate || (cliReleaseTag !== data.tag_name);
      console.log(okchaindNeedUpdate , cliNeedUpdate , !isOkchaindDownload , !isOkchaindDownload);

      if (okchaindNeedUpdate || cliNeedUpdate || !isOkchaindDownload || !isOkchaindDownload) {
        await app.whenReady();
        win = BrowserWindow.getAllWindows()[0];

        if (okchaindNeedUpdate || cliNeedUpdate) {
          doWhenWindowReadyRecevieEvent(() => {
            emitter.emit('newVersionFound@download', {
              okchaindNeedUpdate,
              cliNeedUpdate,
              tagName: data.tag_name
            });
          });
        } 

        if (!isOkchaindDownload || !isCliDownload) {
          doWhenWindowReadyRecevieEvent(() => {
            console.log('emit notDownload@Download')
            emitter.emit('notDownload@Download', {
              isOkchaindDownload,
              isCliDownload,
              tagName: data.tag_name,
              isRedownload
            });
          });
        }

        const genDownloadProgressHandler = (name, resolve) => {
          return async (res) => {
              console.log(name, res)
              emitter.emit(`downloadProgress@${name}`, res);
              if (res.percent === 1 && couldTar[name]) {
                onDownloadFinished(name);
                typeof resolve === 'function' && resolve(true);
              }
          }
        }
    
        const doDownload = (name) => {
          const url = name === 'okchaind' ? downloadUrl : cliDownloadUrl;

          console.log(`${name} downloading...`);
          couldTar[name] = true;

          return new Promise((resolve, reject) => {
            try {
              const trigger = download(name, resolve);
              trigger(win, url, {
                directory: lastVersionDirectory,
                onProgress: genDownloadProgressHandler(name, resolve)
              });
            } catch(err) {
              console.log('doDownload error：', err);
              emitter.emit(`downloadError`, err);
              reject(err);
            }
          })
        }
        if (!isEmitterInit) {

          emitter.on('downloadOkchaind@download', () => {
            const path = `${lastVersionDirectory}/${okchaindObj.name}`;
            if (fs.existsSync(path)) {
              shell.rm('-f', path)
            }
            doDownload('okchaind');
          });
  
          emitter.on('downloadOkchaincli@download', () => {
            const path = `${lastVersionDirectory}/${cliObj.name}`;
            if (fs.existsSync(path)) {
              shell.rm('-f', path)
            }
            doDownload('okchaincli');
          });

          emitter.on('redownload', () => {
            console.log('redownload...')
            start(true);
          });

          isEmitterInit = true;
        }

      }
    };
    start(false);
  });
}