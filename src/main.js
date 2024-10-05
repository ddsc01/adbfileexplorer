const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Adb } = require('@devicefarmer/adbkit');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const client = Adb.createClient();

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
    const device = client.getDevice(deviceId);
    const files = await device.readdir(target);

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
    const device = client.getDevice(deviceId);

    for (const file of files) {
      const remotePath = `${dir}/${file}`;
      const localPath = path.join(destDir, path.basename(file));
      await device.pull(remotePath)
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

ipcMain.handle('preview', async (event, deviceId, dir, file) => {
  try {
    const device = client.getDevice(deviceId);
    const remotePath = `${dir}/${file}`;
    const localPath = path.join(app.getPath("temp"), path.basename(file));
    await device.pull(remotePath)
        .then(transfer => new Promise((resolve, reject) => {
          transfer.on('end', resolve);
          transfer.on('error', reject);
          transfer.pipe(fs.createWriteStream(localPath));
        }));
    return Buffer.from(fs.readFileSync(localPath)).toString('base64');
  } catch(error) {
    console.error('Error previewing file:', error);
    return false;
  }
});

ipcMain.handle('delete', async (event, deviceId, dir, file) => {
  try {
    const device = client.getDevice(deviceId);
    const remotePath = `${dir}/${file}`;
    const success = await device.shell(`rm -f ${remotePath}`);
    return true;
  } catch(error) {
    console.error('Error previewing file:', error);
    return false;
  }
});

ipcMain.handle('upload', async (event, deviceId, dir) => {
  try {
    const device = client.getDevice(deviceId);
    const file = await dialog.showOpenDialogSync(mainWindow, {
      properties: ['openFile']
    })[0];
    if(file && file.length > 0) {
      const transfer = await device.push(file, dir + '/' + path.basename(file));
      transfer.on('progress', (stats) =>
          console.log(`[${deviceId}] Pushed ${stats.bytesTransferred} bytes so far`),
      );
      transfer.on('end', () => {
        console.log(`[${deviceId}] Push complete`);
      });
      return file;
    }
  } catch(error) {
    console.log('upload error', error);
  }
  return false;
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