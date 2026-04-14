const { app } = require('electron');
app.whenReady().then(() => {
  console.log("Docs:", app.moveToApplicationsFolder.toString());
  process.exit(0);
});
