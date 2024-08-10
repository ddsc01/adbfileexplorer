const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Adb } = require('@devicefarmer/adbkit');
const client = Adb.createClient();

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    icon: './images/icon.png',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('check-adb-installed', async () => {
  try {
    await client.version();
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('list-devices', async () => {
  try {
    return await client.listDevices();
  } catch (error) {
    console.error('Error listing devices:', error);
    return [];
  }
});

ipcMain.handle('list-files', async (event, deviceId, dir) => {
  try {
    const target = dir + '/';
    const files = await client.readdir(deviceId, target);

    const unordered = files.map(file => ({
      name: file.name,
      isDir: file.isDirectory() || file.name === 'sdcard',
      size: file.size,
      date: file.mtime,
    }));

    return unordered.sort((a, b) => a.name.localeCompare(b.name));;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
});

let destDir;

ipcMain.handle('download-files', async (event, deviceId, dir, files) => {
  try {
    if (!destDir) {
      openDirectory();
    }

    for (const file of files) {
      const remotePath = `${dir}/${file}`;
      const localPath = path.join(destDir, path.basename(file));
      await client.pull(deviceId, remotePath)
          .then(transfer => new Promise((resolve, reject) => {
            transfer.on('end', resolve);
            transfer.on('error', reject);
            transfer.pipe(fs.createWriteStream(localPath));
          }));
    }

    return true;
  } catch (error) {
    console.error('Error downloading files:', error);
    return false;
  }
});

ipcMain.handle('connect-ip', async (event, ip) => {
  try {
    const split = ip.split(':');
    let port = 5555;
    if(split.length > 1) {
      ip = split[0];
      port = parseInt(split[1]);
    } else {
      ip = split.join(':');
    }
    return client.connect(ip, port, (e) => {
      if(e && typeof e !== undefined) {
        return e.message;
      }
    })
  } catch(e) {
    return e;
  }
});

function openDirectory() {
  destDir = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openDirectory'],
  })[0];

  if (!destDir) {
    throw new Error('No destination directory selected');
  }
}