const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const { store, request, emitter, shell, download } = require('./utils');
const RELEASE_URL = 'https://api.github.com/repos/okex/okexchain/releases/latest';

let isInitWindowReadyReceiveEvent = false;
module.exports = () => {
  let isWindowReadyReceiveEvent = false;
  const asyncEventHandlers = [];
  console.log('okexchainDirectory', store.get('okexchaindDirectory'))
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
    const releaseTag = store.get('okexchaindReleaseTag');
    const cliReleaseTag = store.get('okexchaincliReleaseTag');
    const directory = process.platform === 'win32' ? `%ProgramFiles%/OKExChain` : `${app.getPath('home')}/OKExChain`;
    const lastVersionDirectory = `${directory}/${data.tag_name}`;

    if (!Array.isArray(data.assets) || !data.assets.length) {
      console.log('github release empty')
      emitter.emit('getReleaseInfoError@download', data);
      return
    }

    // okexchaind
    const assetType = `okexchaind.${process.platform}`;
    const okexchaindObj = data.assets.filter(d => d.name.includes(assetType))[0];
    const downloadUrl = okexchaindObj.browser_download_url;
    

    // okexchaincli
    const cliType = `okexchaincli.${process.platform}`;
    const cliObj = data.assets.filter(d => d.name.includes(cliType))[0];
    const cliDownloadUrl = cliObj.browser_download_url;

    store.set('okexchaindObj', okexchaindObj);
    store.set('cliObj', cliObj);

    let okexchaindNeedUpdate = false;
    let cliNeedUpdate = false;
    let isOKExChaindDownload = true;
    let isCliDownload = true;
    let isEmitterInit = false;
    let win;

    const couldTar = {};

    const onDownloadFinished = async (name) => {
      const tarName = name === 'okexchaind' ? okexchaindObj.name : cliObj.name;
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
      store.set('okexchaindDirectory', directory);
    }

    const start = async (isRedownload = false) => {
      if (isRedownload && fs.existsSync(lastVersionDirectory)) {
        shell.rm('-f', `${lastVersionDirectory}/okexchain*`)
      }

      if (!fs.existsSync(lastVersionDirectory)) {
        isOKExChaindDownload = false;
        isCliDownload = false;
      } else {
        if (!releaseTag || !fs.existsSync(`${lastVersionDirectory}/okexchaind`)) {
          isOKExChaindDownload = false;
        }
        if (!cliReleaseTag || !fs.existsSync(`${lastVersionDirectory}/okexchaincli`)) {
          isOKExChaindDownload = false;
        }
      }

      okexchaindNeedUpdate = okexchaindNeedUpdate || (releaseTag !== data.tag_name);
      cliNeedUpdate = cliNeedUpdate || (cliReleaseTag !== data.tag_name);
      console.log(okexchaindNeedUpdate , cliNeedUpdate , !isOKExChaindDownload , !isOKExChaindDownload);

      if (okexchaindNeedUpdate || cliNeedUpdate || !isOKExChaindDownload || !isOKExChaindDownload) {
        await app.whenReady();
        win = BrowserWindow.getAllWindows()[0];

        if (okexchaindNeedUpdate || cliNeedUpdate) {
          doWhenWindowReadyRecevieEvent(() => {
            emitter.emit('newVersionFound@download', {
              okexchaindNeedUpdate,
              cliNeedUpdate,
              tagName: data.tag_name
            });
          });
        } 

        if (!isOKExChaindDownload || !isCliDownload) {
          doWhenWindowReadyRecevieEvent(() => {
            console.log('emit notDownload@Download')
            emitter.emit('notDownload@Download', {
              isOKExChaindDownload,
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
          const url = name === 'okexchaind' ? downloadUrl : cliDownloadUrl;

          console.log(`${name} downloading...`);
          couldTar[name] = true;

          return new Promise((resolve, reject) => {
            try {
              const trigger = download(name, resolve);
              trigger(win, url, {
                directory: lastVersionDirectory, // ~/OKExChain/vx.xx.xx/
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

          emitter.on('downloadOkexchaind@download', () => {
            const path = `${lastVersionDirectory}/${okexchaindObj.name}`;
            if (fs.existsSync(path)) {
              shell.rm('-f', path)
            }
            doDownload('okexchaind');
          });
  
          emitter.on('downloadOkexchaincli@download', () => {
            const path = `${lastVersionDirectory}/${cliObj.name}`;
            if (fs.existsSync(path)) {
              shell.rm('-f', path)
            }
            doDownload('okexchaincli');
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