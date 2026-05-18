"use strict";

const {
  app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const fs = require("fs");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Finds a free TCP port on 127.0.0.1. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Polls until the given port accepts connections (or times out). */
function waitForPort(port, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.once("connect", () => { sock.destroy(); resolve(); });
      sock.once("timeout", retry);
      sock.once("error", retry);
      sock.connect(port, "127.0.0.1");
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error(`Timed out waiting for port ${port}`));
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

// ── State ─────────────────────────────────────────────────────────────────────

const isProd = app.isPackaged;
const dataDir = app.getPath("userData");

// ── Logging ───────────────────────────────────────────────────────────────────
const logDir  = path.join(dataDir, "logs");
const logFile = path.join(logDir, "startup.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, line);
  } catch {}
}

function pipeToLog(proc, label) {
  proc.stdout?.on("data", d => log(`[${label}] ${d.toString().trim()}`));
  proc.stderr?.on("data", d => log(`[${label}] ERR: ${d.toString().trim()}`));
  proc.on("exit", code => log(`[${label}] exited with code ${code}`));
}

let mainWin = null;
let splashWin = null;
let tray = null;
let apiProc = null;
let nextProc = null;

// ── Windows ───────────────────────────────────────────────────────────────────

function createSplash() {
  splashWin = new BrowserWindow({
    width: 440,
    height: 280,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWin.loadFile(path.join(__dirname, "splash.html"));
}

function createMain(webPort) {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  mainWin.loadURL(`http://127.0.0.1:${webPort}`);

  mainWin.once("ready-to-show", () => {
    if (splashWin) { splashWin.close(); splashWin = null; }
    mainWin.show();
    mainWin.focus();
  });

  // On macOS, closing the window hides it instead of quitting.
  mainWin.on("close", (e) => {
    if (process.platform === "darwin" && !app.isQuiting) {
      e.preventDefault();
      mainWin.hide();
    }
  });

  mainWin.on("closed", () => { mainWin = null; });
}

function createTray(webPort) {
  const iconFile = process.platform === "win32"
    ? "icon.ico"
    : process.platform === "darwin"
      ? "icon.png"
      : "icon.png";

  const iconPath = path.join(__dirname, "assets", iconFile);
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("LoreWeaver");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open LoreWeaver", click: () => { mainWin?.show(); mainWin?.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuiting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => { mainWin?.show(); mainWin?.focus(); });
}

// ── Server startup ────────────────────────────────────────────────────────────

async function startServers() {
  const apiPort = await findFreePort();
  const webPort = await findFreePort();

  if (isProd) {
    // ── FastAPI sidecar ───────────────────────────────────────────────────────
    const apiExe = path.join(
      process.resourcesPath, "api",
      process.platform === "win32" ? "loreweaver-api.exe" : "loreweaver-api"
    );
    log(`[api] exe path: ${apiExe}`);
    log(`[api] dataDir: ${dataDir}`);
    apiProc = spawn(apiExe, [], {
      env: {
        ...process.env,
        LW_API_PORT: String(apiPort),
        LW_API_HOST: "127.0.0.1",
        LW_DATA_DIR: dataDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    pipeToLog(apiProc, "api");
    apiProc.on("error", (err) => log(`[api] spawn error: ${err.message}`));

    // ── Next.js standalone ────────────────────────────────────────────────────
    // ELECTRON_RUN_AS_NODE=1 makes Electron behave as plain Node.js,
    // allowing us to reuse the bundled runtime without shipping a separate node binary.
    const nextServer = path.join(process.resourcesPath, "web", "server.js");
    log(`[web] server path: ${nextServer}`);
    log(`[web] execPath: ${process.execPath}`);
    nextProc = spawn(
      process.execPath,
      [nextServer],
      {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          PORT: String(webPort),
          HOSTNAME: "127.0.0.1",
          LW_API_PORT: String(apiPort),
          NODE_ENV: "production",
        },
        cwd: path.dirname(nextServer),
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    pipeToLog(nextProc, "web");
    nextProc.on("error", (err) => log(`[web] spawn error: ${err.message}`));

    // Wait for both servers to be ready before showing the window.
    log(`Waiting for api:${apiPort} and web:${webPort}...`);
    await Promise.all([waitForPort(apiPort), waitForPort(webPort)]);
    log("Both servers ready.");
  }

  return {
    apiPort: isProd ? apiPort : 8000,
    webPort: isProd ? webPort : 3000,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function killServers() {
  try { apiProc?.kill(); } catch {}
  try { nextProc?.kill(); } catch {}
}

app.on("before-quit", killServers);
process.on("exit", killServers);

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log(`LoreWeaver starting — isProd=${isProd} dataDir=${dataDir}`);
  createSplash();

  try {
    const { webPort, apiPort } = await startServers();
    createMain(webPort);
    createTray(webPort);

    if (isProd) {
      // Auto-updater — requires a `publish` config in electron-builder.yml.
      // Silently ignored if not configured.
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }
  } catch (err) {
    if (splashWin) { splashWin.close(); splashWin = null; }
    log(`Startup failed: ${err}`);
    dialog.showErrorBox(
      "LoreWeaver — Startup Error",
      `${err}\n\nDiagnostics log:\n${logFile}`
    );
    app.quit();
  }
});

app.on("activate", () => {
  // macOS: re-open window when clicking dock icon.
  if (mainWin) mainWin.show();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
