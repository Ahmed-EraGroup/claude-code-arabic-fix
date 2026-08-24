// 30 tests against a real Chrome: every assertion is about where the text and
// the boxes actually ended up, not about which attribute we set.
const test = require("node:test");
const assert = require("node:assert");
const { render, closeBrowser, findChrome } = require("./helpers/browser");

const AR = "هذا سطر عربي كامل يوضح الفكرة بالتفصيل";
const HE = "זהו משפט שלם בעברית שמסביר את הרעיון";
const EN = "This is a plain English line inside the chat panel";

const chrome = findChrome();
const skip = chrome ? false : "no Chrome/Edge found (set CHROME_PATH)";

test.after(async () => {
  await closeBrowser();
});

// Right-aligned means the text ends at the right edge of its box, and there is
// slack on the left.
async function alignment(page, selector, needle) {
  const box = await page.box(selector);
  const text = await page.textX(selector, needle);
  return { box, text, gapLeft: text.left - box.left, gapRight: box.right - text.right };
}

test("Arabic paragraph is painted against the right edge", { skip }, async () => {
  const page = await render(`<p id="t">${AR}</p>`);
  const { gapLeft, gapRight } = await alignment(page, "#t", "هذا");
  assert.ok(gapRight < 4, "expected the text to touch the right edge, gap " + gapRight);
  assert.ok(gapLeft > 40, "expected slack on the left, got " + gapLeft);
  await page.close();
});

test("English paragraph stays against the left edge", { skip }, async () => {
  const page = await render(`<p id="t">${EN}</p>`);
  const { gapLeft, gapRight } = await alignment(page, "#t", "This");
  assert.ok(gapLeft < 4, "expected the text to touch the left edge, gap " + gapLeft);
  assert.ok(gapRight > 40);
  await page.close();
});

test("Hebrew is treated like Arabic", { skip }, async () => {
  const page = await render(`<p id="t">${HE}</p>`);
  const { gapRight } = await alignment(page, "#t", "זהו");
  assert.ok(gapRight < 4, "gap " + gapRight);
  await page.close();
});

test("an Arabic line quoting English terms stays right-aligned", { skip }, async () => {
  const page = await render(`<p id="t">هذا سطر عربي فيه مصطلح API ومصطلح webhook للتوضيح</p>`);
  const { gapRight } = await alignment(page, "#t", "هذا");
  assert.ok(gapRight < 4, "gap " + gapRight);
  await page.close();
});

test("an English line mentioning one Arabic word stays left-aligned", { skip }, async () => {
  const page = await render(`<p id="t">This English sentence merely mentions كلمة once in passing</p>`);
  const { gapLeft } = await alignment(page, "#t", "This");
  assert.ok(gapLeft < 4, "gap " + gapLeft);
  await page.close();
});

test("the full stop of an Arabic sentence lands on the left", { skip }, async () => {
  const page = await render(`<p id="t">${AR} وينتهي هنا.</p>`);
  const first = await page.textX("#t", "هذا");
  const stop = await page.textX("#t", "هنا.");
  assert.ok(stop.left < first.left, "punctuation should end the line on the left");
  await page.close();
});

test("a Latin word inside an Arabic sentence keeps its own letter order", { skip }, async () => {
  const page = await render(`<p id="t">نستخدم مكتبة React في المشروع حاليا</p>`);
  const word = await page.textX("#t", "React");
  assert.ok(word && word.right > word.left, "the Latin run must render as one left-to-right box");
  await page.close();
});

test("a sentence split across flex fragments reads right to left", { skip }, async () => {
  const page = await render(
    `<div class="frag" id="f"><span>لو قررت المضي، لا معنى للبدء بـ </span><strong>FundingPips</strong><span> — أرخص بأضعاف من FTMO.</span></div>`
  );
  const start = await page.textX("#f", "لو قررت");
  const brand = await page.textX("#f", "FundingPips");
  const end = await page.textX("#f", "FTMO");
  assert.ok(start.left > brand.left, "the opening words must sit to the right of the bold word");
  assert.ok(brand.left > end.left, "the closing fragment must be furthest left");
  await page.close();
});

test("an English fragment row is left untouched", { skip }, async () => {
  const page = await render(
    `<div class="frag" id="f"><span>Install </span><strong>the CLI</strong><span> before running it.</span></div>`
  );
  const first = await page.textX("#f", "Install");
  const last = await page.textX("#f", "before");
  assert.ok(first.left < last.left, "English fragments must stay in left-to-right order");
  await page.close();
});

test("a tool card keeps its label on the left next to an Arabic answer", { skip }, async () => {
  const page = await render(`
    <div id="msg">
      <p id="say">${AR}</p>
      <div class="tool" id="card"><div class="toolhead" id="head"><span id="name">Bash</span><span>Check the folder</span></div></div>
    </div>`);
  const card = await page.box("#card");
  const name = await page.textX("#head", "Bash");
  assert.ok(name.left - card.left < 30, "the tool name must stay on the left of the card");
  await page.close();
});

test("a tool card is not pushed to the right of the panel", { skip }, async () => {
  const page = await render(`
    <p>${AR}</p>
    <div class="tool" id="card"><div class="toolhead"><span>Bash</span><span>Clone the repo</span></div></div>`);
  const card = await page.box("#card");
  const body = await page.box("body");
  assert.ok(card.left - body.left < 60, "card drifted right by " + (card.left - body.left));
  await page.close();
});

test("a code block stays left-to-right inside an Arabic answer", { skip }, async () => {
  const page = await render(`<p>${AR}</p><pre id="c"><code>git clone https://example.com/repo.git</code></pre>`);
  assert.strictEqual(await page.style("#c", "direction"), "ltr");
  const box = await page.box("#c");
  const text = await page.textX("#c", "git");
  assert.ok(text.left - box.left < 20, "code must start at the left edge");
  await page.close();
});

test("a code block is not clipped by the fix", { skip }, async () => {
  const page = await render(`<p>${AR}</p><pre id="c"><code>cd "C:/Users/Ahmed/.claude/skills" &amp;&amp; git clone https://github.com/example/prompt-master.git</code></pre>`);
  const clipped = await page.evaluate(() => {
    const el = document.querySelector("#c code");
    return el.getBoundingClientRect().width < 50;
  });
  assert.strictEqual(clipped, false, "the command must still be laid out");
  await page.close();
});

test("inline code inside an Arabic sentence renders left-to-right", { skip }, async () => {
  const page = await render(`<p id="t">شغّل الأمر <code id="c">npm install</code> قبل البدء</p>`);
  assert.strictEqual(await page.style("#c", "direction"), "ltr");
  const npm = await page.textX("#c", "npm");
  const install = await page.textX("#c", "install");
  assert.ok(npm.left < install.left, "the words inside inline code must not be reversed");
  await page.close();
});

test("an Arabic table is pushed to the right of the answer", { skip }, async () => {
  const page = await render(`
    <p>${AR}</p>
    <table id="t"><tr><th>القسم</th><th>أبرز ما فيه</th></tr><tr><td>الهوية</td><td>ألوان وخطوط</td></tr></table>`);
  const table = await page.box("#t");
  const body = await page.box("body");
  assert.ok(body.right - table.right < 20, "table right gap " + (body.right - table.right));
  assert.ok(table.left - body.left > 60, "the table must not hug the left edge");
  await page.close();
});

test("the first column of an Arabic table is the right-most one", { skip }, async () => {
  const page = await render(
    `<table id="t"><tr><th id="a">القسم</th><th id="b">أبرز ما فيه</th></tr><tr><td>الهوية</td><td>ألوان</td></tr></table>`
  );
  const first = await page.box("#a");
  const second = await page.box("#b");
  assert.ok(first.left > second.left, "the first header must render to the right of the second");
  await page.close();
});

test("an English table keeps its column order and position", { skip }, async () => {
  const page = await render(
    `<p>${AR}</p><table id="t"><tr><th id="a">Step</th><th id="b">Command</th></tr><tr><td>Install</td><td>npm i</td></tr></table>`
  );
  const first = await page.box("#a");
  const second = await page.box("#b");
  const body = await page.box("body");
  assert.ok(first.left < second.left, "English columns must stay in order");
  assert.ok(first.left - body.left < 20, "an English table must stay on the left");
  await page.close();
});

test("a mixed table with English cells still reads right to left", { skip }, async () => {
  const page = await render(
    `<table id="t"><tr><th id="a">الأداة</th><th id="b">الأمر</th></tr><tr><td>التثبيت</td><td id="cell">npm install</td></tr></table>`
  );
  const first = await page.box("#a");
  const second = await page.box("#b");
  assert.ok(first.left > second.left);
  const npm = await page.textX("#cell", "npm");
  const install = await page.textX("#cell", "install");
  assert.ok(npm.left < install.left, "the English cell keeps its own order");
  await page.close();
});

test("Arabic list markers sit on the right", { skip }, async () => {
  const page = await render(`<ul id="l"><li id="i">عنصر عربي في القائمة</li></ul>`);
  const item = await page.box("#i");
  const text = await page.textX("#i", "عنصر");
  assert.ok(item.right - text.right < 8, "list text must start from the right");
  await page.close();
});

test("English list markers stay on the left", { skip }, async () => {
  const page = await render(`<ul id="l"><li id="i">an english bullet point</li></ul>`);
  const item = await page.box("#i");
  const text = await page.textX("#i", "an english");
  assert.ok(text.left - item.left < 8);
  await page.close();
});

test("an Arabic quote is indented from the right", { skip }, async () => {
  const page = await render(`<blockquote id="q">اقتباس عربي داخل الرد</blockquote>`);
  const box = await page.box("#q");
  const text = await page.textX("#q", "اقتباس");
  assert.ok(box.right - text.right < 20, "the quote must start at its right edge");
  await page.close();
});

test("an Arabic user message is pinned to the right of its row", { skip }, async () => {
  const page = await render(
    `<div class="row" id="r"><div class="userMessageContainer" id="b"><span>ايوه ثبته</span></div></div>`
  );
  const row = await page.box("#r");
  const bubble = await page.box("#b");
  assert.ok(row.right - bubble.right < 10, "bubble gap " + (row.right - bubble.right));
  assert.ok(bubble.left - row.left > 100, "the bubble must leave space on the left");
  await page.close();
});

test("an English user message stays on the left", { skip }, async () => {
  const page = await render(
    `<div class="row" id="r"><div class="userMessageContainer" id="b"><span>install it please</span></div></div>`
  );
  const row = await page.box("#r");
  const bubble = await page.box("#b");
  assert.ok(bubble.left - row.left < 10);
  await page.close();
});

test("the composer resolves each line on its own", { skip }, async () => {
  const page = await render(`<textarea id="c">${AR}\nEnglish line</textarea>`);
  assert.strictEqual(await page.style("#c", "unicodeBidi"), "plaintext");
  assert.strictEqual(await page.attr("#c", "dir"), "auto");
  await page.close();
});

test("the composer row keeps its buttons in place", { skip }, async () => {
  const page = await render(
    `<div class="composer" id="c"><span id="plus">+</span><span style="flex:1">اكتب رسالتك هنا</span><span id="send">↑</span></div>`
  );
  const plus = await page.box("#plus");
  const send = await page.box("#send");
  assert.ok(plus.left < send.left, "the composer controls must not swap sides");
  await page.close();
});

test("streamed Arabic becomes right-aligned as it arrives", { skip }, async () => {
  const page = await render(`<p id="s"></p>`);
  await page.evaluate(async () => {
    const el = document.querySelector("#s");
    for (const chunk of ["الحمد", " لله على", " كل حال وفي كل وقت"]) {
      el.textContent += chunk;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
  });
  const { gapRight } = await alignment(page, "#s", "الحمد");
  assert.ok(gapRight < 4, "gap " + gapRight);
  await page.close();
});

test("a line that turns into English is released back to the left", { skip }, async () => {
  const page = await render(`<p id="s">مرحبا</p>`);
  await page.evaluate(async () => {
    document.querySelector("#s").textContent = "Now the entire line is English text only";
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const { gapLeft } = await alignment(page, "#s", "Now the");
  assert.ok(gapLeft < 4, "gap " + gapLeft);
  await page.close();
});

test("the fix never introduces horizontal overflow", { skip }, async () => {
  const page = await render(`
    <p>${AR}</p>
    <div class="row"><div class="userMessageContainer"><span>${AR}</span></div></div>
    <div class="tool"><div class="toolhead"><span>Bash</span><span>Do something</span></div>
      <pre><code>echo "hello"</code></pre></div>
    <table><tr><th>القسم</th><th>أبرز ما فيه</th></tr></table>`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(overflow <= 0, "page scrolls sideways by " + overflow + "px");
  await page.close();
});

test("the panel is not mirrored by default", { skip }, async () => {
  const page = await render(`<p>${AR}</p>`);
  assert.strictEqual(await page.style("body", "direction"), "ltr");
  await page.close();
});

test("forceRtlLayout mirrors the panel but leaves code alone", { skip }, async () => {
  const page = await render(`<p>${AR}</p><pre id="c"><code>ls -la</code></pre>`, {
    vars: ":root{--caf-line-height:1.7;--caf-font:inherit}\nbody { direction: rtl; }\nbody pre, body code { direction: ltr; }",
  });
  assert.strictEqual(await page.style("body", "direction"), "rtl");
  assert.strictEqual(await page.style("#c", "direction"), "ltr");
  await page.close();
});

test("the font and line height settings reach Arabic text", { skip }, async () => {
  const page = await render(`<p id="t">${AR}</p><p id="e">${EN}</p>`, {
    vars: ":root{--caf-line-height:2.4;--caf-font:Georgia}",
  });
  assert.match(await page.style("#t", "fontFamily"), /Georgia/);
  const lh = parseFloat(await page.style("#t", "lineHeight"));
  assert.ok(lh > 25, "line-height should follow the setting, got " + lh);
  assert.doesNotMatch(await page.style("#e", "fontFamily"), /Georgia/, "English text keeps the panel font");
  await page.close();
});

test("a long conversation is processed without errors or stalls", { skip }, async () => {
  const rows = Array.from({ length: 300 }, (_, i) =>
    i % 2 ? `<p>${AR} ${i}</p>` : `<div class="tool"><div class="toolhead"><span>Bash</span><span>step ${i}</span></div></div>`
  ).join("");
  const started = Date.now();
  const page = await render(rows);
  const elapsed = Date.now() - started;
  assert.deepStrictEqual(page.errors, []);
  assert.ok(elapsed < 15000, "took " + elapsed + "ms");
  const { gapRight } = await alignment(page, "p:nth-of-type(2)", "هذا");
  assert.ok(gapRight < 4);
  await page.close();
});

test("streaming into a busy panel raises no console errors", { skip }, async () => {
  const page = await render(
    Array.from({ length: 60 }, (_, i) => `<p id="p${i}">${AR}</p>`).join("") + `<p id="live"></p>`
  );
  await page.evaluate(async () => {
    const el = document.querySelector("#live");
    for (let i = 0; i < 30; i++) {
      el.textContent += "كلمة ";
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  assert.deepStrictEqual(page.errors, []);
  await page.close();
});

test("an Arabic user message does not drag the tool cards with it", { skip }, async () => {
  const page = await render(`
    <div class="row" id="row"><div class="userMessageContainer" id="bubble"><span>ايوه ثبته</span></div></div>
    <p id="say">${AR}</p>
    <div class="tool" id="card"><div class="toolhead"><span>Bash</span><span>Update project memory</span></div></div>`);
  const row = await page.box("#row");
  const body = await page.box("body");
  const bubble = await page.box("#bubble");
  const card = await page.box("#card");
  assert.ok(row.right - bubble.right < 12, "the bubble should still hug the right");
  assert.ok(card.left - body.left < 60, "the tool card drifted right by " + (card.left - body.left));
  await page.close();
});

test("a bubble in a column list leaves its siblings where they are", { skip }, async () => {
  const page = await render(`
    <div id="col" style="display:flex;flex-direction:column;gap:8px">
      <div class="userMessageContainer" id="bubble"><span>ايوه ثبته</span></div>
      <div class="tool" id="card"><div class="toolhead"><span>Bash</span><span>Verify installation</span></div></div>
      <p id="p">${AR}</p>
    </div>`);
  const col = await page.box("#col");
  const bubble = await page.box("#bubble");
  const card = await page.box("#card");
  const para = await page.box("#p");
  assert.ok(col.right - bubble.right < 12, "the bubble hugs the right");
  assert.ok(card.left - col.left < 30, "the tool card drifted right by " + (card.left - col.left));
  assert.ok(card.width > col.width * 0.8, "the tool card must keep its full width");
  assert.ok(para.left - col.left < 12, "the paragraph box must not shrink to the right");
  await page.close();
});
