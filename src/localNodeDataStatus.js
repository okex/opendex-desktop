const fs = require('fs');
const { app } = require('electron');

function getStatusJson(filename,initData) {
  if(!fs.existsSync(filename)) return initData;
  const str = fs.readFileSync(filename,'utf-8');
  try {
    return JSON.parse(str);
  } catch(e) {
    console.log('not json');
  }
  return initData;
}

function writeStatusJson(dataDir,statusDir,initData) {
  if(!fs.existsSync(dataDir)) return;
  try {
    fs.writeFileSync(statusDir,JSON.stringify(initData));
  } catch(e) {
    console.log('write data err');
  }
  return;
}

class LocalNodeDataStatus {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.statusDir = `${dataDir}/status.json`;
    let init = false;
    if(fs.existsSync(dataDir) && !fs.existsSync(this.statusDir)) init = true;
    this.dataSet = getStatusJson(this.statusDir,{hasInitData:init,hasDownloadGenesis:init,hasDownloadSeeds:init,hasSetSeeds:init});
    this.bindEvent();
  }

  setSatus(status = {}) {
    this.dataSet = Object.assign(this.dataSet, status);
    const dataSet = this.dataSet;
    if(dataSet.hasInitData && dataSet.hasDownloadGenesis && dataSet.hasDownloadSeeds && dataSet.hasSetSeeds) 
    this.writeStatusJson();
  }

  bindEvent() {
    process.on('uncaughtException', (err) => {
      this.writeStatusJson();
    });
    app.on('window-all-closed', () => {
      this.writeStatusJson();
    });
  }

  writeStatusJson() {
    writeStatusJson(this.dataDir,this.statusDir,this.dataSet);
  }

}

module.exports = {
  getInstance(datadir) {
    const instance = new LocalNodeDataStatus(datadir);
    return {
      get() {
        return {...instance.dataSet};
      },
      set(obj) {
        instance.setSatus(obj);
      }
    };
  }
}