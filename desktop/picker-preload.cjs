// Ponte segura entre a janela de escolha de tela e o processo principal do Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('concordPicker', {
  getSources: () => ipcRenderer.invoke('picker:get-sources'),
  choose: (id, audio) => ipcRenderer.send('picker:choose', { id, audio: Boolean(audio) }),
  cancel: () => ipcRenderer.send('picker:choose', null)
});
