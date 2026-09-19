import { app, BrowserWindow, session, desktopCapturer, globalShortcut, dialog, ipcMain, screen } from 'electron';
import updaterPkg from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { autoUpdater } = updaterPkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Perfil separado (ex.: CONCORD_PROFILE=teste) para rodar outra conta/cópia no mesmo PC
if (process.env.CONCORD_PROFILE) {
  app.setPath('userData', path.join(app.getPath('appData'), `concord-desktop-${process.env.CONCORD_PROFILE}`));
}

// Uma única janela do Concord: abrir de novo só traz a existente para frente
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let pickerWindow = null;

// Janela de escolha do que compartilhar. Resolve com { id, audio } ou null se cancelar.
function showScreenPicker(sources) {
  return new Promise((resolve) => {
    if (pickerWindow) {
      pickerWindow.focus();
      resolve(null);
      return;
    }

    // Não oferece a própria janela do Concord (daria efeito de espelho infinito)
    const ownWindowId = mainWindow?.getMediaSourceId();
    const items = sources
      .filter(s => s.id !== ownWindowId)
      .map(s => ({
        id: s.id,
        name: s.name,
        isScreen: s.id.startsWith('screen:'),
        thumbnail: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : null,
        icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null
      }));

    pickerWindow = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      width: 880,
      height: 640,
      minWidth: 600,
      minHeight: 440,
      backgroundColor: '#0b0e14',
      title: 'Compartilhar tela',
      icon: path.join(__dirname, 'icon.ico'),
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'picker-preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    });

    let settled = false;
    const finish = (choice) => {
      if (settled) return;
      settled = true;
      ipcMain.removeHandler('picker:get-sources');
      ipcMain.removeAllListeners('picker:choose');
      resolve(choice && items.some(i => i.id === choice.id) ? choice : null);
      if (pickerWindow && !pickerWindow.isDestroyed()) pickerWindow.close();
    };

    ipcMain.handle('picker:get-sources', () => items);
    ipcMain.on('picker:choose', (event, choice) => finish(choice));
    pickerWindow.on('closed', () => {
      pickerWindow = null;
      finish(null);
    });
    pickerWindow.loadFile(path.join(__dirname, 'picker.html'));
  });
}

// Atualização automática pelas Releases do GitHub (só no app instalado)
function setupAutoUpdates() {
  if (!app.isPackaged) return;

  let promptShown = false;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('Erro na atualização automática:', err?.message || err);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    if (promptShown) return;
    promptShown = true;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização do Concord',
      message: `A versão ${info.version} do Concord está pronta!`,
      detail: 'Reinicie para aplicar. Se escolher "Depois", ela será instalada quando você fechar o Concord.'
    });
    if (response === 0) {
      autoUpdater.quitAndInstall(true, true);
    }
  });

  const check = () => autoUpdater.checkForUpdates().catch((err) => {
    console.error('Falha ao procurar atualizações:', err?.message || err);
  });
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

// Lembra tamanho, posição e se a janela estava maximizada
const windowStatePath = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    // Só reaproveita a posição se ela ainda cair em algum monitor (ex.: monitor desconectado)
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      state.x < a.x + a.width && state.x + state.width > a.x && state.y < a.y + a.height && state.y + state.height > a.y
    );
    return visible ? state : { width: state.width, height: state.height, isMaximized: state.isMaximized };
  } catch {
    return { width: 1280, height: 800 };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getNormalBounds();
    fs.writeFileSync(windowStatePath(), JSON.stringify({ ...bounds, isMaximized: mainWindow.isMaximized() }));
  } catch (err) {
    console.error('Não foi possível salvar o tamanho da janela:', err);
  }
}

function createWindow() {
  const windowState = loadWindowState();
  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width || 1280,
    height: windowState.height || 800,
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

  // Captura de tela: abre a janela de escolha (monitor ou janela/app + som do PC)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 384, height: 216 },
        fetchWindowIcons: true
      });
      const choice = await showScreenPicker(sources);
      const source = choice && sources.find(s => s.id === choice.id);
      if (!source) {
        callback({}); // cancelado
        return;
      }
      callback(choice.audio ? { video: source, audio: 'loopback' } : { video: source });
    } catch (err) {
      console.error('Erro ao capturar telas no Electron:', err);
      callback({});
    }
  });

  // Identifica o app para o site (ex.: saber que existe a janela de escolha de tela)
  mainWindow.webContents.setUserAgent(`${mainWindow.webContents.getUserAgent()} ConcordDesktop/${app.getVersion()}`);

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

  if (windowState.isMaximized) mainWindow.maximize();
  mainWindow.on('close', saveWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!hasInstanceLock) return; // outra janela do Concord já está aberta
  createWindow();
  setupAutoUpdates();
});

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
