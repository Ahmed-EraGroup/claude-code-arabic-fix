// Exercises the extension host: patching, settings rendering, removal,
// multi-version handling and failure modes.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { createEnv, loadExtension, folderName } = require("./helpers/vscode-stub");

const ext = loadExtension();

function withEnv(options, fn) {
  const h = createEnv(options);
  try {
    return fn(h);
  } finally {
    h.dispose();
  }
}

test("fresh install patches the active version and keeps the original bundle", () => {
  withEnv({}, (h) => {
    ext.activate(h.context);

    const js = h.read(h.js());
    const css = h.read(h.css());
    assert.ok(js.startsWith(h.originalJs), "original app code must stay at the top");
    assert.ok(css.startsWith(h.originalCss));
    assert.ok(js.includes("CLAUDE-ARABIC-FIX-BEGIN"));
    assert.match(js, new RegExp("CAF-v" + h.version.replace(/\./g, "\\.") + "#[0-9a-z]+"));
    assert.ok(h.exists(h.js() + ".bak"), "a one-time backup must exist");
    assert.strictEqual(h.read(h.js() + ".bak"), h.originalJs);
    assert.deepStrictEqual(h.problems(), []);
  });
});

test("re-activating without changes rewrites nothing and never stacks patches", () => {
  withEnv({}, (h) => {
    ext.activate(h.context);
    const first = h.read(h.js());
    const mtime = fs.statSync(h.js()).mtimeMs;

    ext.activate(h.context);

    assert.strictEqual(h.read(h.js()), first);
    assert.strictEqual(fs.statSync(h.js()).mtimeMs, mtime, "file must not be rewritten");
    assert.strictEqual((first.match(/CLAUDE-ARABIC-FIX-BEGIN/g) || []).length, 1);
  });
});

test("a stale patch from an older extension version is replaced, not duplicated", () => {
  withEnv({}, (h) => {
    const stale =
      h.originalJs +
      "\n/*CLAUDE-ARABIC-FIX-BEGIN*//*CAF-v0.9.0#abc*/\nconsole.log('old');\n/*CLAUDE-ARABIC-FIX-END*/\n";
    fs.writeFileSync(h.js(), stale);

    ext.activate(h.context);

    const js = h.read(h.js());
    assert.ok(!js.includes("CAF-v0.9.0"), "old stamp must be gone");
    assert.ok(!js.includes("console.log('old')"));
    assert.strictEqual((js.match(/CLAUDE-ARABIC-FIX-BEGIN/g) || []).length, 1);
  });
});

test("every installed Claude Code version folder is patched, active or not", () => {
  withEnv({ versions: ["2.1.235", "2.1.240"], activeVersion: "2.1.235" }, (h) => {
    ext.activate(h.context);

    for (const version of ["2.1.235", "2.1.240"]) {
      assert.ok(
        h.read(h.js(version)).includes("CLAUDE-ARABIC-FIX-BEGIN"),
        version + " should be patched"
      );
    }
  });
});

test("unrelated extension folders are never touched", () => {
  withEnv({}, (h) => {
    const other = path.join(h.root, "ms-python.python-2024.1.0", "webview");
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, "index.js"), "python();\n");

    ext.activate(h.context);

    assert.strictEqual(h.read(path.join(other, "index.js")), "python();\n");
  });
});

test("settings are rendered into the injected stylesheet", () => {
  withEnv({ settings: { fontFamily: "Cairo, Tahoma", lineHeight: 1.9 } }, (h) => {
    ext.activate(h.context);

    const css = h.read(h.css());
    assert.ok(css.includes("--caf-font: Cairo, Tahoma;"), css.slice(-600));
    assert.ok(css.includes("--caf-line-height: 1.9;"));
    assert.ok(!css.includes("/*CAF-VARS*/"), "the placeholder must be consumed");
    assert.ok(!css.includes("body { direction: rtl; }"), "layout mirroring is off by default");
  });
});

test("forceRtlLayout mirrors the panel but keeps code left-to-right", () => {
  withEnv({ settings: { forceRtlLayout: true } }, (h) => {
    ext.activate(h.context);

    const css = h.read(h.css());
    assert.ok(css.includes("body { direction: rtl; }"));
    assert.ok(css.includes("body pre, body code, body .monaco-editor { direction: ltr; }"));
  });
});

test("changing a style setting re-stamps the patch instead of leaving a stale one", () => {
  withEnv({}, (h) => {
    ext.activate(h.context);
    const before = h.read(h.css());

    h.set("fontFamily", "Noto Naskh Arabic");
    h.fireConfigChange();

    const after = h.read(h.css());
    assert.notStrictEqual(after, before);
    assert.ok(after.includes("--caf-font: Noto Naskh Arabic;"));
    assert.strictEqual((after.match(/CLAUDE-ARABIC-FIX-BEGIN/g) || []).length, 1);
    assert.ok(after.startsWith(h.originalCss));
  });
});

test("changing a UI-only setting does not rewrite the patched files", () => {
  withEnv({}, (h) => {
    ext.activate(h.context);
    const mtime = fs.statSync(h.css()).mtimeMs;

    h.set("showReloadPrompt", false);
    h.fireConfigChange();

    assert.strictEqual(fs.statSync(h.css()).mtimeMs, mtime);
  });
});

test("a malicious font value cannot inject CSS rules", () => {
  withEnv({ settings: { fontFamily: "Cairo; } body{display:none} .x{color:red" } }, (h) => {
    ext.activate(h.context);

    const css = h.read(h.css());
    const injected = css.slice(css.indexOf("CLAUDE-ARABIC-FIX-BEGIN"));
    assert.ok(!injected.includes("display:none"), "declaration must be sanitized: " + injected.slice(0, 300));
    assert.ok(!/--caf-font:[^;\n]*[;{}]\s*body/.test(injected));
    assert.strictEqual(
      (injected.match(/\{/g) || []).length,
      (injected.match(/\}/g) || []).length,
      "stylesheet braces must stay balanced"
    );
  });
});

test("an out-of-range line height falls back to a sane value", () => {
  withEnv({ settings: { lineHeight: 999 } }, (h) => {
    ext.activate(h.context);
    const value = Number(h.read(h.css()).match(/--caf-line-height: ([\d.]+);/)[1]);
    assert.ok(value >= 1 && value <= 3, "got " + value);
  });

  withEnv({ settings: { lineHeight: "not a number" } }, (h) => {
    ext.activate(h.context);
    assert.ok(h.read(h.css()).includes("--caf-line-height: 1.7;"));
  });
});

test("disabling the fix restores every bundle byte-for-byte", () => {
  withEnv({ versions: ["2.1.235", "2.1.240"] }, (h) => {
    ext.activate(h.context);

    h.set("enabled", false);
    h.fireConfigChange();

    for (const version of ["2.1.235", "2.1.240"]) {
      assert.strictEqual(h.read(h.js(version)), h.originalJs);
      assert.strictEqual(h.read(h.css(version)), h.originalCss);
    }
  });
});

test("the fix stays off while disabled, even on restart or a Claude Code update", () => {
  withEnv({ settings: { enabled: false } }, (h) => {
    ext.activate(h.context);
    assert.strictEqual(h.read(h.js()), h.originalJs);

    h.fireExtensionsChange();
    assert.strictEqual(h.read(h.js()), h.originalJs);
  });
});

test("apply and remove commands round-trip", async () => {
  const h = createEnv({});
  try {
    ext.activate(h.context);

    await h.commands["claudeArabicFix.remove"]();
    assert.ok(!h.read(h.js()).includes("CLAUDE-ARABIC-FIX-BEGIN"));
    assert.strictEqual(h.read(h.js()), h.originalJs);

    await h.commands["claudeArabicFix.apply"]();
    assert.ok(h.read(h.js()).includes("CLAUDE-ARABIC-FIX-BEGIN"));
    assert.deepStrictEqual(h.problems(), []);
  } finally {
    h.dispose();
  }
});

test("the remove command is safe to run twice", async () => {
  const h = createEnv({});
  try {
    ext.activate(h.context);
    await h.commands["claudeArabicFix.remove"]();
    await h.commands["claudeArabicFix.remove"]();
    assert.strictEqual(h.read(h.js()), h.originalJs);
    assert.deepStrictEqual(h.problems(), []);
  } finally {
    h.dispose();
  }
});

test("the reload prompt can be silenced", async () => {
  const h = createEnv({ settings: { showReloadPrompt: false } });
  try {
    ext.activate(h.context);
    await h.commands["claudeArabicFix.apply"]();
    assert.deepStrictEqual(
      h.messages.filter((m) => /Reload|إعادة التحميل/.test(String(m.message))),
      []
    );
  } finally {
    h.dispose();
  }
});

test("accepting the reload prompt reloads the window", async () => {
  const h = createEnv({});
  try {
    ext.activate(h.context);
    h.answerWith("Reload Window — إعادة التحميل");
    await h.commands["claudeArabicFix.apply"]();
    assert.ok(
      h.executed.some((c) => c.id === "workbench.action.reloadWindow"),
      JSON.stringify(h.executed)
    );
  } finally {
    h.dispose();
  }
});

test("status bar reflects patched, disabled and missing states", () => {
  withEnv({}, (h) => {
    ext.activate(h.context);
    assert.ok(h.statusItem.visible);
    assert.match(h.statusItem.text, /\$\(check\)/);

    h.set("enabled", false);
    h.fireConfigChange();
    assert.match(h.statusItem.text, /\$\(circle-slash\)/);

    h.set("showStatusBarItem", false);
    h.fireConfigChange();
    assert.strictEqual(h.statusItem.visible, false);
  });

  withEnv({ versions: [] }, (h) => {
    ext.activate(h.context);
    assert.match(h.statusItem.text, /\$\(warning\)/);
  });
});

test("diagnostics report lists each version folder and the active settings", async () => {
  const h = createEnv({ versions: ["2.1.235", "2.1.240"], settings: { fontFamily: "Cairo" } });
  try {
    ext.activate(h.context);
    await h.commands["claudeArabicFix.status"]();

    const report = h.messages.filter((m) => m.options && m.options.modal).pop();
    assert.ok(report, "a modal report should be shown");
    const detail = report.options.detail;
    assert.ok(detail.includes(folderName("2.1.235")));
    assert.ok(detail.includes(folderName("2.1.240")));
    assert.ok(detail.includes("patched (current)"));
    assert.ok(detail.includes("Cairo"));
    assert.ok(detail.includes(h.version));
  } finally {
    h.dispose();
  }
});

test("a missing Claude Code install is reported, not crashed on", async () => {
  const h = createEnv({ versions: [] });
  try {
    ext.activate(h.context);
    await h.commands["claudeArabicFix.apply"]();

    const errors = h.messages.filter((m) => m.level === "error");
    assert.strictEqual(errors.length, 1);
    assert.match(String(errors[0].message), /not found|لم يتم العثور/);
  } finally {
    h.dispose();
  }
});

test("a webview folder without index.css still gets the script patch", () => {
  withEnv({ cssMissing: true }, (h) => {
    ext.activate(h.context);
    assert.ok(h.read(h.js()).includes("CLAUDE-ARABIC-FIX-BEGIN"));
    assert.ok(!h.exists(h.css()));
    assert.deepStrictEqual(h.problems(), []);
  });
});

test("one unwritable version folder does not block the others", () => {
  withEnv({ versions: ["2.1.235", "2.1.240"] }, (h) => {
    // Simulate a locked file: replace it with a directory so writes throw.
    const blocked = h.js("2.1.235");
    fs.unlinkSync(blocked);
    fs.mkdirSync(blocked);

    ext.activate(h.context);

    assert.ok(
      h.read(h.js("2.1.240")).includes("CLAUDE-ARABIC-FIX-BEGIN"),
      "the healthy folder must still be patched"
    );
  });
});

test("the injected payload is valid JavaScript", () => {
  withEnv({}, (h) => {
    ext.activate(h.context);
    const js = h.read(h.js());
    assert.doesNotThrow(() => new Function(js));
  });
});

test("a folder that cannot be patched is reported to the user", () => {
  withEnv({ versions: ["2.1.235", "2.1.240"] }, (h) => {
    const blocked = h.js("2.1.240");
    fs.unlinkSync(blocked);
    fs.mkdirSync(blocked);

    ext.activate(h.context);

    const warnings = h.messages.filter((m) => m.level === "warning");
    assert.strictEqual(warnings.length, 1, JSON.stringify(h.messages));
    assert.match(String(warnings[0].message), /2\.1\.240/);
  });
});

test("a legitimate font stack survives sanitizing", () => {
  withEnv({ settings: { fontFamily: "Cairo, 'Noto Naskh Arabic', Tahoma, sans-serif" } }, (h) => {
    ext.activate(h.context);
    assert.ok(
      h.read(h.css()).includes("--caf-font: Cairo, 'Noto Naskh Arabic', Tahoma, sans-serif;")
    );
  });
});

test("diagnostics survive an unreadable folder", async () => {
  const h = createEnv({ versions: ["2.1.235", "2.1.240"] });
  try {
    ext.activate(h.context);
    const blocked = h.js("2.1.240");
    fs.rmSync(blocked);
    fs.mkdirSync(blocked);

    await h.commands["claudeArabicFix.status"]();

    const report = h.messages.filter((m) => m.options && m.options.modal).pop();
    assert.ok(report.options.detail.includes("unreadable"), report.options.detail);
  } finally {
    h.dispose();
  }
});
