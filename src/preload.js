const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (target, ...$arguments) => {
        return ipcRenderer.invoke(target, ...$arguments);
    }
});