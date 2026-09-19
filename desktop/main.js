import { app, BrowserWindow, session, desktopCapturer, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0e14',
    title: 'Concord',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Permite acesso automático a microfone e captura de tela
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'display-capture') {
      return true;
    }
    return false;
  });

  // Habilita captura de tela nativa no Electron (Screen Share)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      if (sources && sources.length > 0) {
        // Prioriza captura da tela inteira (monitor primário)
        const primaryScreen = sources.find(s => s.id.startsWith('screen')) || sources[0];
        callback({ video: primaryScreen, audio: 'loopback' });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('Erro ao capturar telas no Electron:', err);
      callback({});
    }
  });

  const CLOUD_URL = process.env.CONCORD_URL || 'https://concord-l08s.onrender.com';
  const localUiPath = path.join(__dirname, 'ui', 'index.html');
  const fallbackDistPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');

  // Carrega diretamente a versão da nuvem (garante atualizações instantâneas automáticas para todos)
  mainWindow.loadURL(CLOUD_URL).catch((err) => {
    console.log('Sem conexão com a nuvem, carregando interface local...', err);
    if (fs.existsSync(localUiPath)) {
      mainWindow.loadFile(localUiPath);
    } else if (fs.existsSync(fallbackDistPath)) {
      mainWindow.loadFile(fallbackDistPath);
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }
  });

  // Atalho F12 para abrir ferramentas de desenvolvedor se necessário
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
