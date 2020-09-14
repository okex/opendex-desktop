const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const { store, request, emitter, shell, download } = require('./utils');
const RELEASE_URL = 'https://api.github.com/repos/okex/okexchain/releases/latest';

const shellPrm = new Proxy(shell, {
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
});

module.exports = () => {
  request(RELEASE_URL).then(response => {
    const { body: data } = response;
    const releaseTag = store.get('okchaindReleaseTag');
    const cliReleaseTag = store.get('okchaincliReleaseTag');
    const directory = process.platform === 'win32' ? '%ProgramFiles%/OKChain' : `${app.getPath('home')}/OKChain`;


    if (!Array.isArray(data.assets) || !data.assets.length) {
      emitter.emit('getReleaseInfoError@download', data);
      return
    }

    // okchaind
    const assetType = `okchaind.${process.platform}`;
    const okchaindObj = data.assets.filter(d => d.name.includes(assetType))[0];
    const downloadUrl = okchaindObj.browser_download_url;
    const absAssetPath = `${directory}/${okchaindObj.name}`;
    
    // okchaincli
    const cliType = `okchaincli.${process.platform}`;
    const cliObj = data.assets.filter(d => d.name.includes(cliType))[0];
    const cliDownloadUrl = cliObj.browser_download_url;
    const cliAbsAssetPath = `${directory}/${cliObj.name}`;

    let okchaindNeedUpdate = false;
    let cliNeedUpdate = false;
    let isOkchaindDownload = true;
    let isCliDownload = true;
    let win;
    const couldTar = {};


    (async () => {

      if (!fs.existsSync(directory)) {
        await shellPrm.mkdir(directory);
        isOkchaindDownload = false;
        isCliDownload = false;
        store.delete('okchaindReleaseTag')
        store.delete('okchaincliReleaseTag')
      }

      if (!fs.existsSync(cliAbsAssetPath)) {
        isCliDownload = false;
      }

      if (!fs.existsSync(absAssetPath)) {
        isOkchaindDownload = false;
      }

      okchaindNeedUpdate = okchaindNeedUpdate || (!releaseTag || releaseTag !== data.tag_name)
      cliNeedUpdate = cliNeedUpdate || (!cliReleaseTag || cliReleaseTag !== data.tag_name)

      if (okchaindNeedUpdate || cliNeedUpdate || !isOkchaindDownload || !isOkchaindDownload) {
        await app.whenReady();
        win = BrowserWindow.getAllWindows()[0];
        
        if (okchaindNeedUpdate || cliNeedUpdate) {
          emitter.emit('newVersionFound@download', {
            okchaindNeedUpdate,
            cliNeedUpdate,
            tagName: data.tag_name
          });
        } 

        if (!isOkchaindDownload || !isCliDownload) {
          emitter.emit('notDownload@Download', {
            isOkchaindDownload,
            isCliDownload,
            tagName: data.tag_name
          });
        }



        const genDownloadProgressHandler = (name, resolve) => {
          return async (res) => {
              console.log(name, res)
              emitter.emit(`downloadProgress@${name}`, res);
              if (res.percent === 1 && couldTar[name]) {

                  couldTar[name] = false;  
                  const cmd = `tar -zxvf ${name === 'okchaind' ? okchaindObj.name : cliObj.name}`;
    
                  await shellPrm.cd(directory);
                  try {
                    await shellPrm.exec(cmd);
                    couldTar[name] = false;

                  } catch(err) {
                    console.log(err)
                  }
                  
                  store.set(`${name}ReleaseTag`, data.tag_name);
                  store.set('okchainDirectory', directory);
                  store.set(`${name}AbsAssetPath`, name === 'okchaind' ? absAssetPath : cliAbsAssetPath);
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
                directory,
                onProgress: genDownloadProgressHandler(name, resolve)
              });
            } catch(err) {
              console.log('doDownload error：', err);
              reject(err);
              emitter.emit(`downloadError@${name}`, err);
            }
          })
        }

        emitter.on('downloadOkchaind@download', async () => {
          if (fs.existsSync(absAssetPath)) {
            await shellPrm.rm(absAssetPath)
          }
          // await doDownload('okchaind');
        });

        emitter.on('downloadOkchaincli@download', async () => {
          if (fs.existsSync(cliAbsAssetPath)) {
            await shellPrm.rm(absAssetPath)
          }
          await doDownload('okchaincli');
        });

      }
    })();
  });
}