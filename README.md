# opendex-desktop

## Develope
```
npm install
```

### Setting Enviroment
This project doesn't contain any UI code, only as a shell project of UI code.  
You can set your UI project code path in the engConfig.js, which defaults to the "bundle" directory.  
Usually there are the following 3 configurations.  
- locale: Start this project and UI project locally,UI projects will be accessed using local services, such as webpack-dev-server.
- develope: Start the project locally, set the UI project path and use the file protocol to load.
- prod: Consistent with develope, can be used as an alternative to api environment expansion.

### Start Project
The following command starts with locale configuration.
```
npm run start-locale
```

The following command starts with develope configuration
```
npm run start-dev
```

## Build
Install electron-builder globally, if you have installed it before, you can ignore this step.
```
npm i electron-builder -g
```
Put the compiled code of your UI project in the bundle directory of this project.
### MacOS
```
npm run build-mac
```
### windows
```
npm run build-win
```
If you are compiling a windows application on the MipS platform, you need to install the adapted version "wine" and "mono" first

### Quick Build for opendex-ui
Put this project and [opendex-ui](https://github.com/okex/opendex-ui) 、[okline](https://github.com/okex/okline) project in the same directory.  
Run npm run desktop in the opendex-ui project.  
Run npm run release in the okline project.  
Execute npm run build-test in this project.  
The first package will download some dependencies, which may take a long time.  
After the execution is completed, the package is output in the release directory.  

