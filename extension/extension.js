const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const BEGIN_MARK = "/*CLAUDE-ARABIC-FIX-BEGIN*/";
const BLOCK_RE = /\r?\n?\/\*CLAUDE-ARABIC-FIX-BEGIN\*\/[\s\S]*?\/\*CLAUDE-ARABIC-FIX-END\*\/\r?\n?/g;
const CFG_SECTION = "claudeArabicFix";

let statusItem;

// ---------------------------------------------------------------- settings

function readConfig() {
  const c = vscode.workspace.getConfiguration(CFG_SECTION);
  return {
    enabled: c.get("enabled", true),
    fontFamily: (c.get("fontFamily", "") || "").trim(),
    lineHeight: c.get("lineHeight", 1.7),
    forceRtlLayout: c.get("forceRtlLayout", false),
    showReloadPrompt: c.get("showReloadPrompt", true),
    showStatusBarItem: c.get("showStatusBarItem", true),
  };
}

// Only the settings baked into the injected files belong in the stamp —
// UI-only settings must not trigger a re-patch.
function styleConfig(cfg) {
  return {
    fontFamily: cfg.fontFamily,
    lineHeight: cfg.lineHeight,
    forceRtlLayout: cfg.forceRtlLayout,
  };
}

function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function versionTag(context, cfg) {
  const version = context.extension.packageJSON.version;
  return "/*CAF-v" + version + "#" + hash(JSON.stringify(styleConfig(cfg))) + "*/";
}

// Rewrites the CAF-VARS placeholder in the stylesheet with the user settings.
function renderCss(source, cfg) {
  const vars = [":root {"];
  vars.push("  --caf-line-height: " + (Number(cfg.lineHeight) || 1.7) + ";");
  vars.push("  --caf-font: " + (cfg.fontFamily ? cfg.fontFamily : "inherit") + ";");
  vars.push("}");
  if (cfg.forceRtlLayout) {
    vars.push("body { direction: rtl; }");
    vars.push("body pre, body code, body .monaco-editor { direction: ltr; }");
  }
  return source.replace("/*CAF-VARS*/", vars.join("\n"));
}

function renderPatch(patchFile, cfg) {
  const source = fs.readFileSync(patchFile, "utf8");
  return patchFile.endsWith(".css") ? renderCss(source, cfg) : source;
}

// ------------------------------------------------------------ patch targets

function findActiveClaude() {
  return vscode.extensions.all.find((e) => e.id.toLowerCase() === "anthropic.claude-code");
}

// Scan the extensions directory on disk instead of the running-extensions
// API: right after a Claude Code auto-update the new version's folder exists
// on disk but is not active until the next reload — patching it now means
// the next reload starts already fixed.
function findWebviewDirs(context) {
  const active = findActiveClaude();
  const root = path.dirname(active ? active.extensionPath : context.extensionPath);
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch (e) {
    return [];
  }
  return entries
    .filter((n) => /^anthropic\.claude-code-\d/i.test(n))
    .map((n) => path.join(root, n, "webview"))
    .filter((w) => fs.existsSync(path.join(w, "index.js")));
}

function targetsFor(webviewDir, context) {
  const media = (f) => context.asAbsolutePath(path.join("media", f));
  return [
    { file: path.join(webviewDir, "index.js"), patch: media("arabic-fix.js") },
    { file: path.join(webviewDir, "index.css"), patch: media("arabic-fix.css") },
  ].filter((t) => fs.existsSync(t.file));
}

function hasCurrentPatch(targets, tag) {
  return (
    targets.length > 0 &&
    targets.every((t) => fs.readFileSync(t.file, "utf8").includes(tag))
  );
}

function hasAnyPatch(targets) {
  return targets.some((t) => fs.readFileSync(t.file, "utf8").includes(BEGIN_MARK));
}

function applyTo(targets, tag, cfg) {
  for (const t of targets) {
    const content = fs.readFileSync(t.file, "utf8").replace(BLOCK_RE, "");
    const bak = t.file + ".bak";
    if (!fs.existsSync(bak)) fs.copyFileSync(t.file, bak);
    const patch = renderPatch(t.patch, cfg).replace(BEGIN_MARK, BEGIN_MARK + tag);
    fs.writeFileSync(t.file, content + "\n" + patch);
  }
}

function removeFrom(targets) {
  for (const t of targets) {
    const content = fs.readFileSync(t.file, "utf8");
    if (!content.includes(BEGIN_MARK)) continue;
    fs.writeFileSync(t.file, content.replace(BLOCK_RE, ""));
  }
}

// Patch every installed Claude Code version folder. Returns true when files
// of the ACTIVE version changed (only then is a reload needed).
function applyEverywhere(context, cfg, force) {
  const tag = versionTag(context, cfg);
  const active = findActiveClaude();
  const activeWebview = active ? path.join(active.extensionPath, "webview") : null;
  let activeChanged = false;
  for (const dir of findWebviewDirs(context)) {
    const targets = targetsFor(dir, context);
    if (!targets.length) continue;
    if (!force && hasCurrentPatch(targets, tag)) continue;
    applyTo(targets, tag, cfg);
    if (activeWebview && path.resolve(dir) === path.resolve(activeWebview)) {
      activeChanged = true;
    }
  }
  return activeChanged;
}

function removeEverywhere(context) {
  const active = findActiveClaude();
  const activeWebview = active ? path.join(active.extensionPath, "webview") : null;
  let activeChanged = false;
  for (const dir of findWebviewDirs(context)) {
    const targets = targetsFor(dir, context);
    if (!targets.length || !hasAnyPatch(targets)) continue;
    removeFrom(targets);
    if (activeWebview && path.resolve(dir) === path.resolve(activeWebview)) {
      activeChanged = true;
    }
  }
  return activeChanged;
}

// ------------------------------------------------------------------- status

function inspect(context, cfg) {
  const tag = versionTag(context, cfg);
  const active = findActiveClaude();
  const activeWebview = active ? path.resolve(path.join(active.extensionPath, "webview")) : null;
  const dirs = findWebviewDirs(context).map((dir) => {
    const targets = targetsFor(dir, context);
    return {
      name: path.basename(path.dirname(dir)),
      isActive: activeWebview !== null && path.resolve(dir) === activeWebview,
      files: targets.length,
      current: targets.length > 0 && hasCurrentPatch(targets, tag),
      patched: targets.length > 0 && hasAnyPatch(targets),
    };
  });
  const activeDir = dirs.find((d) => d.isActive) || dirs[0];
  return { tag, dirs, activeDir, claudeFound: dirs.length > 0 };
}

function updateStatusBar(context, cfg) {
  if (!statusItem) return;
  if (!cfg.showStatusBarItem) {
    statusItem.hide();
    return;
  }
  const state = inspect(context, cfg);
  if (!cfg.enabled) {
    statusItem.text = "$(circle-slash) عربي";
    statusItem.tooltip = "Claude Arabic Fix: disabled in settings — معطّل من الإعدادات";
  } else if (!state.claudeFound) {
    statusItem.text = "$(warning) عربي";
    statusItem.tooltip = "Claude Arabic Fix: Claude Code not found — لم يتم العثور على Claude Code";
  } else if (state.activeDir && state.activeDir.current) {
    statusItem.text = "$(check) عربي";
    statusItem.tooltip = "Claude Arabic Fix: active on " + state.activeDir.name;
  } else {
    statusItem.text = "$(warning) عربي";
    statusItem.tooltip = "Claude Arabic Fix: needs a window reload — يحتاج إعادة تحميل النافذة";
  }
  statusItem.show();
}

function statusReport(context, cfg) {
  const state = inspect(context, cfg);
  const lines = [];
  lines.push("Extension version: " + context.extension.packageJSON.version);
  lines.push("Patch stamp: " + state.tag.replace(/^\/\*|\*\/$/g, ""));
  lines.push("Enabled: " + cfg.enabled);
  lines.push("Font: " + (cfg.fontFamily || "(editor default)"));
  lines.push("Line height: " + cfg.lineHeight);
  lines.push("Force RTL layout: " + cfg.forceRtlLayout);
  lines.push("");
  if (!state.claudeFound) {
    lines.push("Claude Code extension: NOT FOUND");
  } else {
    for (const d of state.dirs) {
      const how = d.current
        ? "patched (current)"
        : d.patched
        ? "patched (outdated — reload needed)"
        : "not patched";
      lines.push((d.isActive ? "* " : "  ") + d.name + " — " + how + " — files: " + d.files);
    }
  }
  return lines.join("\n");
}

// -------------------------------------------------------------- activation

async function promptReload(cfg, message) {
  if (!cfg.showReloadPrompt) return;
  const pick = await vscode.window.showInformationMessage(
    message,
    "Reload Window — إعادة التحميل"
  );
  if (pick) vscode.commands.executeCommand("workbench.action.reloadWindow");
}

function activate(context) {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  statusItem.command = "claudeArabicFix.status";
  context.subscriptions.push(statusItem);

  const refresh = () => {
    try {
      updateStatusBar(context, readConfig());
    } catch (e) {}
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeArabicFix.apply", async () => {
      const cfg = readConfig();
      if (!findWebviewDirs(context).length) {
        vscode.window.showErrorMessage(
          "Claude Code extension not found — لم يتم العثور على إضافة Claude Code"
        );
        return;
      }
      try {
        applyEverywhere(context, cfg, true);
        refresh();
        await promptReload(cfg, "Arabic fix applied — تم تطبيق إصلاح العربي، أعد تحميل النافذة");
      } catch (err) {
        vscode.window.showErrorMessage("Claude Arabic Fix failed: " + err.message);
      }
    }),

    vscode.commands.registerCommand("claudeArabicFix.remove", async () => {
      const cfg = readConfig();
      try {
        removeEverywhere(context);
        refresh();
        await promptReload(cfg, "Arabic fix removed — تمت إزالة الإصلاح، أعد تحميل النافذة");
      } catch (err) {
        vscode.window.showErrorMessage("Claude Arabic Fix failed: " + err.message);
      }
    }),

    vscode.commands.registerCommand("claudeArabicFix.status", async () => {
      const cfg = readConfig();
      let report;
      try {
        report = statusReport(context, cfg);
      } catch (err) {
        report = "Diagnostics failed: " + err.message;
      }
      const pick = await vscode.window.showInformationMessage(
        "Claude Arabic Fix — حالة الإصلاح",
        { modal: true, detail: report },
        "Re-apply — إعادة التطبيق",
        "Settings — الإعدادات"
      );
      if (pick && pick.indexOf("Re-apply") === 0) {
        vscode.commands.executeCommand("claudeArabicFix.apply");
      } else if (pick) {
        vscode.commands.executeCommand("workbench.action.openSettings", CFG_SECTION);
      }
    })
  );

  const autoApply = (prompt) => {
    const cfg = readConfig();
    try {
      if (!cfg.enabled) {
        const changed = removeEverywhere(context);
        updateStatusBar(context, cfg);
        if (changed && prompt) {
          promptReload(cfg, "Claude Arabic Fix disabled — تم تعطيل الإصلاح، أعد تحميل النافذة");
        }
        return;
      }
      const activeChanged = applyEverywhere(context, cfg, false);
      updateStatusBar(context, cfg);
      if (activeChanged && prompt) {
        promptReload(
          cfg,
          "Claude Arabic Fix: patch applied — تم تطبيق إصلاح العربي تلقائيًا، أعد تحميل النافذة"
        );
      }
    } catch (err) {
      vscode.window.showWarningMessage("Claude Arabic Fix could not auto-apply: " + err.message);
    }
  };

  // Startup: covers fresh installs, our own updates (version-tagged patch),
  // and Claude Code updates that happened while VS Code was closed.
  autoApply(true);

  // Extension list changed (e.g. Claude Code installed or updated live).
  context.subscriptions.push(vscode.extensions.onDidChange(() => autoApply(true)));

  // The injected stylesheet is rendered from settings, so re-stamp on change.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CFG_SECTION)) autoApply(true);
    })
  );

  // Safety net for auto-updates that drop a new folder mid-session without
  // firing onDidChange: silently patch it so the next reload starts fixed.
  const timer = setInterval(() => autoApply(false), 10 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

function deactivate() {}

module.exports = { activate, deactivate };
