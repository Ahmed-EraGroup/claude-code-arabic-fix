const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const BEGIN_MARK = "/*CLAUDE-ARABIC-FIX-BEGIN*/";
const BLOCK_RE = /\r?\n?\/\*CLAUDE-ARABIC-FIX-BEGIN\*\/[\s\S]*?\/\*CLAUDE-ARABIC-FIX-END\*\/\r?\n?/g;

function findClaudeCode() {
  return vscode.extensions.all.find(
    (e) => /(^|\.)anthropic\.claude-code$/i.test(e.id) || e.id.toLowerCase() === "anthropic.claude-code"
  );
}

function getTargets(context) {
  const claude = findClaudeCode();
  if (!claude) return null;
  const webview = path.join(claude.extensionPath, "webview");
  const media = (f) => context.asAbsolutePath(path.join("media", f));
  return [
    { file: path.join(webview, "index.js"), patch: media("arabic-fix.js") },
    { file: path.join(webview, "index.css"), patch: media("arabic-fix.css") },
  ].filter((t) => fs.existsSync(t.file));
}

function isPatched(targets) {
  return targets.every((t) => fs.readFileSync(t.file, "utf8").includes(BEGIN_MARK));
}

function applyFix(targets) {
  for (const t of targets) {
    let content = fs.readFileSync(t.file, "utf8").replace(BLOCK_RE, "");
    const bak = t.file + ".bak";
    if (!fs.existsSync(bak)) fs.copyFileSync(t.file, bak);
    const patch = fs.readFileSync(t.patch, "utf8");
    fs.writeFileSync(t.file, content + "\n" + patch);
  }
}

function removeFix(targets) {
  for (const t of targets) {
    const content = fs.readFileSync(t.file, "utf8").replace(BLOCK_RE, "");
    fs.writeFileSync(t.file, content);
  }
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
      const targets = getTargets(context);
      if (!targets || !targets.length) {
        vscode.window.showErrorMessage("Claude Code extension not found — لم يتم العثور على إضافة Claude Code");
        return;
      }
      try {
        applyFix(targets);
        await promptReload("Arabic fix applied — تم تطبيق إصلاح العربي، أعد تحميل النافذة");
      } catch (err) {
        vscode.window.showErrorMessage("Claude Arabic Fix failed: " + err.message);
      }
    }),

    vscode.commands.registerCommand("claudeArabicFix.remove", async () => {
      const targets = getTargets(context);
      if (!targets || !targets.length) return;
      try {
        removeFix(targets);
        await promptReload("Arabic fix removed — تمت إزالة الإصلاح، أعد تحميل النافذة");
      } catch (err) {
        vscode.window.showErrorMessage("Claude Arabic Fix failed: " + err.message);
      }
    })
  );

  // Auto-apply on startup: covers fresh installs AND Claude Code updates
  // (an update replaces the webview files, wiping the previous patch).
  try {
    const targets = getTargets(context);
    if (targets && targets.length && !isPatched(targets)) {
      applyFix(targets);
      promptReload("Claude Arabic Fix: patch applied — تم تطبيق إصلاح العربي تلقائيًا، أعد تحميل النافذة");
    }
  } catch (err) {
    vscode.window.showWarningMessage("Claude Arabic Fix could not auto-apply: " + err.message);
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
