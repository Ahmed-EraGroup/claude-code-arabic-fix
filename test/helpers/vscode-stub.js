// Minimal stand-in for the `vscode` module plus a throwaway extensions folder,
// so extension.js can be exercised exactly as VS Code would drive it.
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const EXTENSION_DIR = path.join(__dirname, "..", "..", "extension");

// One live environment at a time; the stub reads through to it so extension.js
// can stay in the require cache across tests.
let env = null;

const vscodeStub = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  window: {
    createStatusBarItem() {
      const item = {
        text: "",
        tooltip: "",
        command: "",
        visible: false,
        show() {
          this.visible = true;
        },
        hide() {
          this.visible = false;
        },
        dispose() {},
      };
      env.statusItem = item;
      return item;
    },
    showInformationMessage(message, ...rest) {
      const options = rest.length && typeof rest[0] === "object" ? rest.shift() : null;
      env.messages.push({ level: "info", message, options, actions: rest });
      const answer = env.answer;
      env.answer = undefined;
      return Promise.resolve(answer);
    },
    showErrorMessage(message) {
      env.messages.push({ level: "error", message });
      return Promise.resolve(undefined);
    },
    showWarningMessage(message) {
      env.messages.push({ level: "warning", message });
      return Promise.resolve(undefined);
    },
  },
  workspace: {
    getConfiguration() {
      return {
        get: (key, fallback) => (key in env.settings ? env.settings[key] : fallback),
      };
    },
    onDidChangeConfiguration(cb) {
      env.configListeners.push(cb);
      return { dispose() {} };
    },
  },
  commands: {
    registerCommand(id, fn) {
      env.commands[id] = fn;
      return { dispose() {} };
    },
    executeCommand(id, ...args) {
      env.executed.push({ id, args });
      return Promise.resolve();
    },
  },
  extensions: {
    get all() {
      return env.activeVersion
        ? [
            {
              id: "anthropic.claude-code",
              extensionPath: path.join(env.root, folderName(env.activeVersion)),
            },
          ]
        : [];
    },
    onDidChange(cb) {
      env.extensionListeners.push(cb);
      return { dispose() {} };
    },
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") return vscodeStub;
  return originalLoad(request, parent, isMain);
};

function folderName(version) {
  return "anthropic.claude-code-" + version + "-win32-x64";
}

const DEFAULT_SETTINGS = {
  enabled: true,
  fontFamily: "",
  lineHeight: 1.7,
  forceRtlLayout: false,
  showReloadPrompt: true,
  showStatusBarItem: true,
};

const ORIGINAL_JS = "console.log('claude webview');\n";
const ORIGINAL_CSS = "body{color:red}\n";

/**
 * Builds a fake extensions folder and returns a handle used by the tests.
 * `versions` is a list of Claude Code versions to create on disk; the first
 * one is the running (active) version unless `activeVersion` says otherwise.
 */
function createEnv(options = {}) {
  const versions = options.versions || ["2.1.235"];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "caf-test-"));

  for (const version of versions) {
    const webview = path.join(root, folderName(version), "webview");
    fs.mkdirSync(webview, { recursive: true });
    fs.writeFileSync(path.join(webview, "index.js"), ORIGINAL_JS);
    if (options.cssMissing !== true) {
      fs.writeFileSync(path.join(webview, "index.css"), ORIGINAL_CSS);
    }
  }

  env = {
    root,
    versions,
    activeVersion: options.activeVersion || versions[0],
    settings: Object.assign({}, DEFAULT_SETTINGS, options.settings),
    commands: {},
    messages: [],
    executed: [],
    configListeners: [],
    extensionListeners: [],
    statusItem: null,
    answer: undefined,
    subscriptions: [],
  };

  const context = {
    subscriptions: env.subscriptions,
    extensionPath: EXTENSION_DIR,
    extension: {
      packageJSON: JSON.parse(fs.readFileSync(path.join(EXTENSION_DIR, "package.json"), "utf8")),
    },
    asAbsolutePath: (relative) => path.join(EXTENSION_DIR, relative),
  };

  const webviewOf = (version) => path.join(root, folderName(version), "webview");

  return {
    env,
    context,
    root,
    originalJs: ORIGINAL_JS,
    originalCss: ORIGINAL_CSS,
    version: context.extension.packageJSON.version,
    webviewOf,
    js: (version) => path.join(webviewOf(version || env.activeVersion), "index.js"),
    css: (version) => path.join(webviewOf(version || env.activeVersion), "index.css"),
    read: (file) => fs.readFileSync(file, "utf8"),
    exists: (file) => fs.existsSync(file),
    set(key, value) {
      env.settings[key] = value;
    },
    fireConfigChange(affects = true) {
      for (const cb of env.configListeners) cb({ affectsConfiguration: () => affects });
    },
    fireExtensionsChange() {
      for (const cb of env.extensionListeners) cb();
    },
    get messages() {
      return env.messages;
    },
    get statusItem() {
      return env.statusItem;
    },
    get commands() {
      return env.commands;
    },
    get executed() {
      return env.executed;
    },
    answerWith(action) {
      env.answer = action;
    },
    problems() {
      return env.messages.filter((m) => m.level !== "info");
    },
    dispose() {
      for (const sub of env.subscriptions) {
        try {
          sub.dispose();
        } catch (e) {}
      }
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function loadExtension() {
  return require(path.join(EXTENSION_DIR, "extension.js"));
}

module.exports = { createEnv, loadExtension, folderName };
