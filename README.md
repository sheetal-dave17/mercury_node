BitBoost Market - ecommerce redefined.

The project has 3-package.json structure. Before starting to work with the project, please run "npm install" in the same folder with the package.json:
1) /package.json stands for the electron builder, it is CI-ready (AppVeyor and Travis), just change the keys in .travis.yml and appveyor.yml files to yours and enjoy the auto-deployment process. To build the project into a dist on your machine - run "npm run build" or "npm run win/linux/mac" for a platform-specific build. You can change logo in /build folder
2) /app/package.json stands for the electron backend. Just run "npm start" to start your electron app. You can change name/version in /app/package.json
3) /app/app/package.json stands for the Angular 6 front-end webapp. Run "ng build --watch" to run the watcher for your changes or "ng build" to produce a dist to be used with electron