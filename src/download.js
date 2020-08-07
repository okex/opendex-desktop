const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const { download } = require('electron-dl');
const { store, request, emitter, shell } = require('./utils');

const RELEASE_URL = 'https://api.github.com/repos/okex/okchain/releases/latest';

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

    let needDownload = false;
    let cliNeedDownload = false;
    let win;
    
    const genDownloadProgressHandler = (name, resolve) => {
      return async (res) => {
        console.log(name, res)
          emitter.emit(`${name}DownloadProgress`, res);

          if (res.percent === 1) {
              
              const cmd = `tar -zxvf ${name === 'okchaind' ? okchaindObj.name : cliObj.name}`;

              await shellPrm.cd(directory);
              try {
                await shellPrm.exec(cmd);
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
      return new Promise((resolve, reject) => {
        try {
          download(win, url, {
            directory,
            onProgress: genDownloadProgressHandler(name, resolve)
          });
        } catch(err) {
          console.log('doDownload error：', err);
          reject(err);
          emitter.emit(`download${name}dErr`, err);
        }
      })
    }

    (async () => {
      if (!fs.existsSync(directory)) {
        await shellPrm.mkdir(directory);
        needDownload = true;
        cliNeedDownload = true;
      }

      needDownload = needDownload || (!releaseTag || releaseTag !== data.tag_name)
      cliNeedDownload = cliNeedDownload || (!cliReleaseTag || cliReleaseTag !== data.tag_name)

      if (needDownload || cliNeedDownload) {
        await app.whenReady();
        win = BrowserWindow.getAllWindows()[0];
        
        if (cliNeedDownload) {
          console.log(cliAbsAssetPath)
          if (fs.existsSync(cliAbsAssetPath)) {
            await shellPrm.rm(absAssetPath)
          }
          await doDownload('okchaincli');
        }

        if (needDownload) {
          if (fs.existsSync(absAssetPath)) {
            await shellPrm.rm(absAssetPath)
          }
          await doDownload('okchaind');
        }

        
      }
    })();
  });
}