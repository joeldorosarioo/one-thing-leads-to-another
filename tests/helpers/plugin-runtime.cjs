'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pluginPath = path.resolve(__dirname, '../../main.js');
const example = path.resolve(__dirname, '../../examples/connected-notes');

class TFile {
  constructor(path) {
    this.path = path;
    this.extension = path.slice(path.lastIndexOf('.') + 1);
  }
}

class PluginStub {
  constructor(app) {
    this.app = app;
    this.data = {};
  }

  async loadData() {
    return this.data;
  }

  async saveData(value) {
    this.data = value;
  }

  registerView(_type, viewFactory) {
    this.viewFactory = viewFactory;
  }

  addRibbonIcon() {}
  addCommand() {}
  addSettingTab(tab) {
    this.settingTab = tab;
  }
  registerEvent() {}
}

class FuzzySuggestModal {}
class Modal {}
class PluginSettingTab {}
class ItemView {}
const notices = [];

class Notice {
  constructor(message) {
    notices.push(String(message));

    if (String(message).startsWith('Note Template Sync:')) throw new Error('Plugin error: ' + message);
  }
}

function createVault(files) {
  const content = new Map(Object.entries(files));
  const events = new Map();

  const vault = {
    configDir: '.obsidian',
    content,
    events,

    on(eventName, handler) {
      events.set(eventName, handler);
      return {};
    },

    getAbstractFileByPath(filePath) {
      if (content.has(filePath)) return new TFile(filePath);
      const isFolder = [...content.keys()].some(path => path.startsWith(`${filePath}/`));
      return isFolder ? { path: filePath } : null;
    },

    getFiles() {
      return [...content.keys()].map(filePath => new TFile(filePath));
    },

    async read(file) {
      return content.get(file.path);
    },

    async modify(file, value) {
      content.set(file.path, value);
      events.get('modify')?.(file);
    },

    async create(filePath, value) {
      const file = new TFile(filePath);

      content.set(filePath, value);
      events.get('create')?.(file);

      return file;
    },

    async createFolder() {}
  };

  return vault;
}

function loadPlugin(apiVersion) {
  const exported = {
    exports: {}
  };

  const context = {
    module: exported,
    exports: exported.exports,
    console,
    setTimeout,
    clearTimeout,
    window: { setTimeout, clearTimeout },
    Intl,

    require(name) {
      if (name === 'obsidian')
        return {
          Plugin: PluginStub,
          Notice,
          TFile,
          FuzzySuggestModal,
          Modal,
          PluginSettingTab,
          ItemView,
          Setting: class {},
          requireApiVersion: version => version.localeCompare(apiVersion, undefined, { numeric: true }) <= 0
        };

      throw new Error(name);
    }
  };

  vm.runInNewContext(fs.readFileSync(pluginPath, 'utf8'), context);
  return exported.exports;
}

function readExample(filename) {
  return fs.readFileSync(path.join(example, filename), 'utf8');
}

function createPlugin({ vault, workspace = {}, apiVersion = '1.14.4' }) {
  const Plugin = loadPlugin(apiVersion);

  return new Plugin({
    vault,

    workspace: {
      onLayoutReady() {},

      getLeavesOfType() {
        return [];
      },

      detachLeavesOfType() {},
      ...workspace
    }
  });
}

module.exports = { createPlugin, createVault, readExample, TFile, notices };
