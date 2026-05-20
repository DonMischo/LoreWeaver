"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  getDataDir:           ()        => ipcRenderer.invoke("lw:get-data-dir"),
  pickDataDir:          ()        => ipcRenderer.invoke("lw:pick-data-dir"),
  setDataDir:           (newPath) => ipcRenderer.invoke("lw:set-data-dir", newPath),
  restart:              ()        => ipcRenderer.send("lw:restart"),
  setSpellcheckLanguage:(lang)    => ipcRenderer.send("lw:set-spellcheck-language", lang),
});
