const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const { download } = require('electron-dl');
const { store, request, emitter, shell } = require('./utils');

const RELEASE_URL = 'https://api.github.com/repos/okex/okchain/releases/latest';

module.exports = () => {
  request(RELEASE_URL).then(response => {
    const { body: data } = response;
    const localReleaseTag = store.get('releaseTag');
    const assetType = `okchaind.${process.platform}`;
    const okchaindObj = data.assets.filter(d => d.name.includes(assetType))[0];
    const downloadUrl = okchaindObj.browser_download_url;
    const directory = process.platform === 'win32' ? '%ProgramFiles%/OKChain' : `${app.getPath('home')}/OKChain`;
    const absAssetPath = `${directory}/${okchaindObj.name}`;

    let needDownload = false;

    (async () => {
      if (!fs.existsSync(directory)) {
        await shell.mkdir(directory);
        needDownload = true;
      }

      needDownload = needDownload || (!localReleaseTag || localReleaseTag !== data.tag_name)

      if (needDownload) {
        let win;
        store.set('isOkchaindSetup', false);
        (async () => {
          await app.whenReady();
          win = BrowserWindow.getAllWindows()[0];
  
          if (fs.existsSync(absAssetPath)) {
            await shell.rm(absAssetPath)
          }
          emitter.emit('downloadOkchainStart');
          download(win, downloadUrl, {
            directory,
            onProgress: (res) => {
              console.log(res)
              emitter.emit('downloadOkchainProgress', res);
              if (res.percent === 1) {
                (async () => {
                  store.set('releaseTag', data.tag_name);
                  const cmd = `tar -zxvf ${okchaindObj.name}`;
                  shell.cd(directory);

                  try {
                    await shell.exec(cmd);
                    store.set('isOkchaindSetup', true);
                    if (store.get('okchaindDirectory') === undefined) {
                      store.set('okchaindDirectory', directory);
                      store.set('okchaindAbsAssetPath', absAssetPath);
                    }

                  } catch(err) {
                    emitter.emit('downloadOkchainErr');
                    console.log('err', err);
                  }
                })()
              }
            }
          });
        })();
      }
    })();
  });
}