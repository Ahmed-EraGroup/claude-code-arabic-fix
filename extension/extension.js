const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const BEGIN_MARK = "/*CLAUDE-ARABIC-FIX-BEGIN*/";
const BLOCK_RE = /\r?\n?\/\*CLAUDE-ARABIC-FIX-BEGIN\*\/[\s\S]*?\/\*CLAUDE-ARABIC-FIX-END\*\/\r?\n?/g;

function versionTag(context) {
  return "/*CAF-v" + context.extension.packageJSON.version + "*/";
}

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

function applyTo(targets, tag) {
  for (const t of targets) {
    const content = fs.readFileSync(t.file, "utf8").replace(BLOCK_RE, "");
    const bak = t.file + ".bak";
    if (!fs.existsSync(bak)) fs.copyFileSync(t.file, bak);
    const patch = fs
      .readFileSync(t.patch, "utf8")
      .replace(BEGIN_MARK, BEGIN_MARK + tag);
    fs.writeFileSync(t.file, content + "\n" + patch);
  }
}

function removeFrom(targets) {
  for (const t of targets) {
    const content = fs.readFileSync(t.file, "utf8").replace(BLOCK_RE, "");
    fs.writeFileSync(t.file, content);
  }
}

// Patch every installed Claude Code version folder. Returns true when files
// of the ACTIVE version changed (only then is a reload needed).
function applyEverywhere(context, force) {
  const tag = versionTag(context);
  const active = findActiveClaude();
  const activeWebview = active ? path.join(active.extensionPath, "webview") : null;
  let activeChanged = false;
  for (const dir of findWebviewDirs(context)) {
    const targets = targetsFor(dir, context);
    if (!targets.length) continue;
    if (!force && hasCurrentPatch(targets, tag)) continue;
    applyTo(targets, tag);
    if (activeWebview && path.resolve(dir) === path.resolve(activeWebview)) {
      activeChanged = true;
    }
  }
  return activeChanged;
}

async function promptReload(message) {
  const pick = await vscode.window.showInformationMessage(
    message,
    "Reload Window — إعادة التحميل"
  );
  if (pick) vscode.commands.executeCommand("workbench.action.reloadWindow");
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("claudeArabicFix.apply", async () => {
      if (!findWebviewDirs(context).length) {
        vscode.window.showErrorMessage(
          "Claude Code extension not found — لم يتم العثور على إضافة Claude Code"
        );
        return;
      }
      try {
        applyEverywhere(context, true);
        await promptReload("Arabic fix applied — تم تطبيق إصلاح العربي، أعد تحميل النافذة");
      } catch (err) {
        vscode.window.showErrorMessage("Claude Arabic Fix failed: " + err.message);
      }
    }),

    vscode.commands.registerCommand("claudeArabicFix.remove", async () => {
      try {
        for (const dir of findWebviewDirs(context)) {
          removeFrom(targetsFor(dir, context));
        }
        await promptReload("Arabic fix removed — تمت إزالة الإصلاح، أعد تحميل النافذة");
      } catch (err) {
        vscode.window.showErrorMessage("Claude Arabic Fix failed: " + err.message);
      }
    })
  );

  const autoApply = (prompt) => {
    try {
      const activeChanged = applyEverywhere(context, false);
      if (activeChanged && prompt) {
        promptReload(
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

  // Safety net for auto-updates that drop a new folder mid-session without
  // firing onDidChange: silently patch it so the next reload starts fixed.
  const timer = setInterval(() => autoApply(false), 10 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

function deactivate() {}

module.exports = { activate, deactivate };
