const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const url = require('url');
const open = require('open');

const envConfig = require('./envConfig');

const nodeEnv = process.env.NODE_ENV ? process.env.NODE_ENV.replace(/(^\s*)|(\s*$)/g, '') : 'builder';
const sourceEnv = nodeEnv === 'builder' ? require('./package.json').configEnv : nodeEnv;

const configRes = envConfig[sourceEnv];
const { entryTplName } =  envConfig[sourceEnv];
const sourceHost = nodeEnv === 'builder' ? envConfig.staticBundlePath : configRes.staticPath || envConfig.staticLocalPath;

const indexPageURL = `${sourceHost}/${entryTplName}`;

if (!nodeEnv.includes('prod')) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    minWidth: 1280,
    height: 800,
    minHeight: 800,
    x: 0,
    y: 0,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false
    }
  });
  
  console.log('indexPageURL', indexPageURL)
  
  win.loadURL(indexPageURL);
  win.once('ready-to-show', () => {
    win.show();
  });

  if (nodeEnv === 'develope') {
    win.webContents.openDevTools();
  }

  win.on('closed', () => {
    win = null;
  });

  win.webContents.on('will-navigate', (event, a) => {
    console.log('will-navigate', a);
    // event.preventDefault();
  });

  win.webContents.on('new-window', function(event, link){
    event.preventDefault();
    const { protocol } = url.parse(link);
    if (protocol === 'http:' || protocol === 'https:') {
      open(link);
    }
  });
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!win) {
    createWindow();
  }
});
app.on('ready', () => {
  protocol.interceptFileProtocol('file', (request, callback) => {
    const uri = request.url.substr(8); //file://{url}
    let { hash, pathname } = url.parse(uri);
    
    const isOklinePath = uri.includes('okline/');
    const bundlePath = path.resolve(__dirname, './bundle');
    const isDexCommon = uri.includes('dex-test/spot');
    const isAbsPath = pathname.includes(bundlePath.slice(1));

    let filePath = `/${uri}`;
    if (isAbsPath) {
      pathname = pathname.replace(bundlePath.slice(1), '');

    }

    if (isOklinePath || isAbsPath) {
      pathname = pathname.startsWith('/') ? pathname.slice(1) : pathname
      filePath = path.resolve(bundlePath, pathname)
    }

    if (isDexCommon) {
      const commonPath = pathname.replace('dex-test/spot/', '');
      filePath = path.resolve(bundlePath, commonPath)
    }

    if (hash) {
      filePath = filePath.replace(hash, '');
    }
    
    callback({ path: filePath })
  });

  createWindow();
});

