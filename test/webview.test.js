// Runs the injected webview script inside a jsdom copy of the chat panel and
// asserts the direction decisions it makes on realistic markup.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SCRIPT = fs.readFileSync(
  path.join(__dirname, "..", "extension", "media", "arabic-fix.js"),
  "utf8"
);

const AR = "مرحبا كيف حالك اليوم";
const HE = "שלום מה שלומך היום";

function panel(html) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="chat">${html}</div></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.eval(SCRIPT);
  const $ = (id) => dom.window.document.getElementById(id);
  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    $,
    dir: (id) => $(id).getAttribute("dir"),
    isRtl: (id) => $(id).classList.contains("caf-rtl"),
    chat: () => $("chat"),
    // Mutations are coalesced into a rAF callback; wait for it to run.
    settle: () =>
      new Promise((resolve) =>
        dom.window.requestAnimationFrame(() => dom.window.requestAnimationFrame(resolve))
      ),
    close: () => dom.window.close(),
  };
}

test("Arabic and Hebrew paragraphs become RTL, English stays automatic", () => {
  const p = panel(`
    <p id="ar">${AR}</p>
    <p id="he">${HE}</p>
    <p id="en">This is a plain English paragraph in the chat</p>
  `);
  assert.strictEqual(p.dir("ar"), "rtl");
  assert.ok(p.isRtl("ar"));
  assert.strictEqual(p.dir("he"), "rtl");
  assert.strictEqual(p.dir("en"), "auto");
  assert.ok(!p.isRtl("en"));
  p.close();
});

test("direction follows the dominant script, not the first word", () => {
  const p = panel(`
    <p id="mixed1">Note: هذا شرح عربي طويل يوضح الفكرة بالتفصيل الممل</p>
    <p id="mixed2">هذا سطر عربي فيه مصطلح API ومصطلح webhook</p>
    <p id="mixed3">This English sentence merely mentions كلمة once in passing</p>
  `);
  assert.strictEqual(p.dir("mixed1"), "rtl", "Arabic-dominant line starting in English");
  assert.strictEqual(p.dir("mixed2"), "rtl", "Arabic line quoting English terms");
  assert.strictEqual(p.dir("mixed3"), "auto", "English-dominant line stays LTR");
  p.close();
});

test("code, terminal output and SVG are never touched", () => {
  const p = panel(`
    <pre id="pre1"><code id="code1">const رسالة = "مرحبا";</code></pre>
    <div class="monaco-editor" id="editor"><span id="line">مرحبا</span></div>
    <svg id="icon"><title id="t">أيقونة</title></svg>
  `);
  for (const id of ["pre1", "code1", "editor", "line", "icon", "t"]) {
    assert.strictEqual(p.$(id).hasAttribute("dir"), false, id + " must keep its own direction");
    assert.strictEqual(p.$(id).classList.contains("caf-rtl"), false, id);
  }
  p.close();
});

test("a direction Claude Code set itself is respected", () => {
  const p = panel(`<p id="fixed" dir="ltr">${AR}</p>`);
  assert.strictEqual(p.dir("fixed"), "ltr");
  assert.ok(!p.isRtl("fixed"));
  p.close();
});

test("lists, quotes and table cells follow their own text", () => {
  const p = panel(`
    <ul id="list"><li id="li-ar">عنصر عربي في القائمة</li><li id="li-en">an english bullet</li></ul>
    <blockquote id="quote">اقتباس عربي داخل الرد</blockquote>
    <table><tr><td id="td-ar">القيمة المطلوبة</td><td id="td-en">expected value</td></tr></table>
  `);
  assert.strictEqual(p.dir("li-ar"), "rtl");
  assert.strictEqual(p.dir("li-en"), "auto");
  assert.strictEqual(p.dir("quote"), "rtl");
  assert.strictEqual(p.dir("td-ar"), "rtl");
  assert.strictEqual(p.dir("td-en"), "auto");
  p.close();
});

test("the composer resolves direction per line instead of flipping the box", () => {
  const p = panel(`
    <textarea id="composer">${AR}</textarea>
    <div id="editable" contenteditable="true">${AR}</div>
    <div id="readonly" contenteditable="false">${AR}</div>
  `);
  assert.strictEqual(p.dir("composer"), "auto");
  assert.ok(!p.isRtl("composer"), "a forced RTL box would misplace English lines");
  assert.strictEqual(p.dir("editable"), "auto");
  assert.ok(!p.isRtl("editable"));
  assert.strictEqual(p.dir("readonly"), "rtl", "non-editable text is normal content");
  p.close();
});

test("Arabic user messages are pinned to the right of the flex row", () => {
  const p = panel(`
    <div class="messageRow" id="row-ar"><div class="userMessageContainer" id="bub-ar"><span>${AR}</span></div></div>
    <div class="messageRow" id="row-en"><div class="userMessageContainer" id="bub-en"><span>hello there</span></div></div>
  `);
  assert.ok(p.$("bub-ar").classList.contains("caf-rtl-bubble"));
  assert.ok(p.$("row-ar").classList.contains("caf-rtl-row"));
  assert.ok(!p.$("bub-en").classList.contains("caf-rtl-bubble"));
  assert.ok(!p.$("row-en").classList.contains("caf-rtl-row"));
  p.close();
});

test("text buried in nested inline spans still reaches an alignable block", () => {
  const p = panel(`<div id="block"><span><span><em id="inner">${AR}</em></span></span></div>`);
  const marked = ["block", "inner"].filter((id) => p.$(id).getAttribute("dir") === "rtl");
  assert.ok(marked.includes("block"), "the block container must carry the direction");
  p.close();
});

test("streamed text is re-evaluated as it grows", async () => {
  const p = panel(`<p id="stream"></p>`);
  const stream = p.$("stream");

  stream.textContent = "الحمد";
  await p.settle();
  assert.strictEqual(stream.getAttribute("dir"), "rtl");

  stream.textContent = "الحمد لله رب العالمين والصلاة على النبي";
  await p.settle();
  assert.strictEqual(stream.getAttribute("dir"), "rtl");

  stream.textContent = "Now the whole line is plain English text only";
  await p.settle();
  assert.strictEqual(stream.getAttribute("dir"), "auto");
  assert.ok(!stream.classList.contains("caf-rtl"), "the RTL class must be dropped again");
  p.close();
});

test("a replacement of the same length is not mistaken for unchanged text", async () => {
  const p = panel(`<p id="swap">abcde</p>`);
  const swap = p.$("swap");
  assert.strictEqual(swap.getAttribute("dir"), "auto");

  swap.textContent = "مرحبا"; // same character count as "abcde"
  await p.settle();

  assert.strictEqual(swap.getAttribute("dir"), "rtl", "same-length edits must still be re-checked");
  p.close();
});

test("a whole message subtree appended at once is processed", async () => {
  const p = panel("");
  const block = p.document.createElement("div");
  block.innerHTML = `<div class="messageRow"><div class="userMessageContainer" id="new-bub"><span id="new-txt">شكرا جزيلا لك</span></div></div>`;
  p.chat().appendChild(block);
  await p.settle();

  assert.ok(p.$("new-bub").classList.contains("caf-rtl-bubble"));
  assert.strictEqual(p.$("new-txt").closest("[dir]").getAttribute("dir"), "rtl");
  p.close();
});

test("streamed code stays left-to-right", async () => {
  const p = panel(`<pre id="pre"><code id="code"></code></pre>`);
  p.$("code").textContent = 'const رسالة = "مرحبا";';
  await p.settle();

  assert.strictEqual(p.$("pre").hasAttribute("dir"), false);
  assert.strictEqual(p.$("code").hasAttribute("dir"), false);
  p.close();
});

test("neutral text (numbers, punctuation) is left alone", () => {
  const p = panel(`<p id="num">12345 — 67.89 (100%)</p>`);
  assert.strictEqual(p.$("num").hasAttribute("dir"), false);
  p.close();
});

test("a large burst of nodes is handled without losing direction", async () => {
  const p = panel("");
  const chat = p.chat();
  for (let i = 0; i < 600; i++) {
    const line = p.document.createElement("p");
    line.id = "burst-" + i;
    line.textContent = i % 2 === 0 ? AR : "english line number " + i;
    chat.appendChild(line);
  }
  await p.settle();

  assert.strictEqual(p.dir("burst-0"), "rtl");
  assert.strictEqual(p.dir("burst-599"), "auto");
  assert.strictEqual(p.dir("burst-298"), "rtl");
  p.close();
});

test("the script survives a DOM shape it does not expect", async () => {
  const p = panel(`<p id="ok">${AR}</p>`);
  const errors = [];
  p.window.addEventListener("error", (e) => errors.push(e.message));

  const detached = p.document.createElement("p");
  detached.textContent = AR; // mutation on a node outside the observed tree
  const frag = p.document.createDocumentFragment();
  frag.appendChild(p.document.createTextNode(AR));
  p.chat().appendChild(frag);
  p.chat().appendChild(p.document.createComment("مرحبا"));
  await p.settle();

  assert.deepStrictEqual(errors, []);
  assert.strictEqual(p.dir("ok"), "rtl");
  p.close();
});

test("the payload carries its markers and no literal RTL characters", () => {
  assert.ok(SCRIPT.startsWith("/*CLAUDE-ARABIC-FIX-BEGIN*/"));
  assert.ok(SCRIPT.trimEnd().endsWith("/*CLAUDE-ARABIC-FIX-END*/"));
  // Literal Arabic/Hebrew in the payload would break if the bundle is
  // re-encoded; the detection ranges must be written as escapes.
  assert.ok(
    !/[֐-ࣿיִ-﷿ﹰ-ﻼ]/.test(SCRIPT),
    "detection must use unicode escapes, not literal glyphs"
  );
});

test("streaming does not rescan the whole panel on every frame", async () => {
  const rows = Array.from(
    { length: 200 },
    (_, i) => `<p id="old-${i}">${i % 2 ? AR : "an english line " + i}</p>`
  ).join("");
  const p = panel(rows + `<p id="live"></p>`);
  const live = p.$("live");

  // Count layout queries after the initial scan: they must scale with the
  // node being streamed, not with the size of the conversation.
  let calls = 0;
  const original = p.window.getComputedStyle.bind(p.window);
  p.window.getComputedStyle = (...args) => {
    calls++;
    return original(...args);
  };

  let text = "";
  for (let i = 0; i < 40; i++) {
    text += "كلمة ";
    live.textContent = text;
    await p.settle();
  }

  assert.strictEqual(live.getAttribute("dir"), "rtl");
  assert.ok(calls < 200, "expected a bounded number of layout queries, got " + calls);
  p.close();
});

test("a sentence split across sibling fragments in a flex row stays in order", () => {
  const p = panel(`
    <div id="row" style="display:flex">
      <span id="f1">لو قررت المضي، لا معنى للبدء بـ </span><strong id="f2">FundingPips</strong><span id="f3"> — أرخص بأضعاف من FTMO.</span>
    </div>
  `);
  // Only the row can reorder the fragments; marking them one by one leaves
  // the pieces themselves running left to right.
  assert.strictEqual(p.dir("row"), "rtl");
  assert.strictEqual(p.$("f1").hasAttribute("dir"), false);
  assert.strictEqual(p.$("f2").hasAttribute("dir"), false);
  assert.strictEqual(p.$("f3").hasAttribute("dir"), false);
  p.close();
});

test("a structural flex row (avatar, buttons) is not turned around", () => {
  const p = panel(`
    <div id="toolbar" style="display:flex">
      <div id="avatar">${AR}</div><button id="btn">إرسال</button>
    </div>
  `);
  assert.strictEqual(p.$("toolbar").hasAttribute("dir"), false, "layout rows must keep their order");
  assert.strictEqual(p.dir("avatar"), "rtl");
  p.close();
});
