/*CLAUDE-ARABIC-FIX-BEGIN*/
(function () {
  "use strict";

  // ---- configuration (rewritten by the extension when settings change) ----
  var CFG = { rtlBias: 0.5, maxScan: 400 }; /*CAF-CFG*/

  // Strong RTL ranges: Arabic, Hebrew, Syriac, Thaana + Arabic presentation forms.
  // Escapes (not literal glyphs) so the file survives any re-encoding of index.js.
  var RTL_G = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/g;
  var LTR_G = /[A-Za-z\u00C0-\u024F]/g;

  // Anything code-like keeps its own direction and is never touched.
  var SKIP = "pre,code,kbd,samp,.monaco-editor,svg";
  var EDITABLE = 'textarea,[contenteditable]:not([contenteditable="false"])';
  var BUBBLE = '[class*="userMessageContainer"],[class*="userMessage"]';
  var INLINE_TAGS = /^(SPAN|A|EM|STRONG|B|I|U|S|SMALL|SUB|SUP|MARK|CITE|Q|ABBR|TIME|LABEL|CODE|KBD|SAMP|VAR|FONT|BDI|BDO|BR|IMG|SVG)$/;
  var FLEXISH = /^(inline-)?(flex|grid)$/;
  // Elements that carry layout rather than text flow. `direction` is an
  // inherited property, so flipping a box that holds any of these mirrors the
  // whole subtree — tool cards, indentation, buttons — not just the sentence.
  var STRUCTURAL =
    "div,section,article,header,footer,nav,aside,main,form,button,input,textarea,select,table,pre,hr,video,canvas,iframe,ul,ol";
  // Layout a table must not contain for us to flip its column order.
  var TABLE_BLOCKERS = "table,div,form,button,input,textarea,select,canvas,iframe,video";

  // el -> { len, dir }: lets us skip untouched nodes during streaming and
  // tells us which elements are ours (so app-set dir attributes are respected).
  var seen = new WeakMap();
  var MAX_QUEUE = 400;

  function directionOf(text) {
    var s = text.length > CFG.maxScan ? text.slice(0, CFG.maxScan) : text;
    var rtl = (s.match(RTL_G) || []).length;
    if (!rtl) return (s.match(LTR_G) || []).length ? "ltr" : "";
    var ltr = (s.match(LTR_G) || []).length;
    // A mostly-Arabic line stays RTL even when it quotes English terms.
    return rtl >= ltr * CFG.rtlBias ? "rtl" : "ltr";
  }

  function isEditable(el) {
    return el.matches && el.matches(EDITABLE);
  }

  function mark(el, dir) {
    if (dir === "rtl") {
      el.setAttribute("dir", "rtl");
      el.classList.add("caf-rtl");
    } else {
      el.setAttribute("dir", "auto");
      el.classList.remove("caf-rtl");
    }
  }

  function apply(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.closest(SKIP)) return;
    // Never fight a direction the app set itself.
    if (el.hasAttribute("dir") && !seen.has(el)) return;

    var text = el.textContent || "";
    // Cheap change signature: a same-length swap ("abcde" -> Arabic of equal
    // length) must still be re-checked, but streaming must not rescan
    // untouched nodes on every frame.
    var sig = text.length + ":" + text.charCodeAt(0) + ":" + text.charCodeAt(text.length - 1);
    var prev = seen.get(el);
    if (prev && prev.sig === sig) return;

    // The composer resolves direction per line while typing — plain dir="auto"
    // plus plaintext bidi, never a forced RTL block.
    if (isEditable(el)) {
      if (!prev) el.setAttribute("dir", "auto");
      seen.set(el, { sig: sig, dir: "auto" });
      return;
    }

    var dir = directionOf(text);
    if (!dir) {
      seen.set(el, { sig: sig, dir: "" });
      return;
    }
    // A box that wraps layout is left alone; the text blocks inside it are
    // marked on their own, so the panel's structure never gets mirrored.
    if (dir === "rtl" && !isTextOnly(el)) {
      seen.set(el, { sig: sig, dir: "" });
      alignBubble(el);
      return;
    }
    if (!prev || prev.dir !== dir) mark(el, dir);
    seen.set(el, { sig: sig, dir: dir });

    if (dir === "rtl") {
      alignBubble(el);
      alignTable(el);
    }
  }

  // User messages are inline-block bubbles pinned left by a flex parent
  // (align-items:flex-start) — direction alone cannot move them, so the row
  // and the bubble get classes the stylesheet flips.
  function alignBubble(el) {
    var bubble = el.closest(BUBBLE);
    if (!bubble || bubble.classList.contains("caf-rtl-bubble")) return;
    bubble.classList.add("caf-rtl-bubble");
    if (bubble.parentElement) bubble.parentElement.classList.add("caf-rtl-row");
  }

  // A table is only as wide as its content and a block box ignores
  // text-align, so an Arabic table would sit on the left of a right-aligned
  // answer with its first column on the wrong side. The table itself carries
  // the direction; the cells keep resolving their own text.
  function alignTable(el) {
    var tag = el.tagName;
    if (tag !== "TD" && tag !== "TH") return;
    var table = el.closest("table");
    if (!table || table.classList.contains("caf-rtl")) return;
    if (table.hasAttribute("dir") && !seen.has(table)) return;
    try {
      if (table.querySelector(TABLE_BLOCKERS)) return;
    } catch (e) {
      return;
    }
    if (directionOf(table.textContent || "") !== "rtl") return;
    mark(table, "rtl");
    seen.set(table, { sig: "table", dir: "rtl" });
  }

  // Text in this app lands in plain divs and spans as often as in <p>, so we
  // walk up from the text node to the closest element that can actually be
  // aligned (inline boxes ignore text-align).
  function displayOf(el) {
    try {
      return getComputedStyle(el).display || "";
    } catch (e) {
      return "";
    }
  }

  function isInline(el) {
    var display = displayOf(el);
    // A detached or not-yet-styled node reports no display at all; fall back
    // to the tag so the direction still lands on a real block.
    if (!display) return INLINE_TAGS.test(el.tagName || "");
    return display.indexOf("inline") === 0 || display === "contents";
  }

  // A flex/grid container whose children are only text fragments (spans,
  // bold runs, links). Its children are blockified, so marking them
  // individually leaves the fragments themselves in left-to-right order —
  // only the container can put an Arabic sentence back in the right order.
  // True when the element holds text only — no nested layout to mirror.
  function isTextOnly(el) {
    try {
      return !el.querySelector(STRUCTURAL);
    } catch (e) {
      return false;
    }
  }

  // Fragments of one sentence are painted edge to edge. A control strip (the
  // composer, a toolbar) spaces its items out — flipping that would swap the
  // buttons around, so the spacing is what tells the two apart.
  function fragmentsAreContiguous(el) {
    var kids = el.children;
    var prev = null;
    for (var i = 0; i < kids.length; i++) {
      var r;
      try {
        r = kids[i].getBoundingClientRect();
      } catch (e) {
        return false;
      }
      if (prev && Math.abs(r.top - prev.top) < 2 && r.left - prev.right > 4) return false;
      prev = r;
    }
    return true;
  }

  function isTextRow(el) {
    if (!el || !FLEXISH.test(displayOf(el))) return false;
    var kids = el.children;
    if (!kids || kids.length < 2) return false;
    for (var i = 0; i < kids.length; i++) {
      if (!INLINE_TAGS.test(kids[i].tagName || "")) return false;
    }
    return isTextOnly(el) && fragmentsAreContiguous(el);
  }

  function blockAncestor(el) {
    var hops = 0;
    while (el && el !== document.body && hops < 6) {
      if (!isInline(el)) break;
      // A child of a flex/grid container is blockified: it can be aligned on
      // its own, and climbing past it would hand the direction to a layout
      // row that only wants its items left where they are.
      if (el.parentElement && FLEXISH.test(displayOf(el.parentElement))) break;
      el = el.parentElement;
      hops++;
    }
    if (!el || el === document.body) return null;
    // Climb out of a fragmented text row so the whole sentence is ordered as
    // one run instead of a row of independently-aligned pieces.
    var guard = 0;
    while (
      el.parentElement &&
      el.parentElement !== document.body &&
      isTextRow(el.parentElement) &&
      guard < 4
    ) {
      el = el.parentElement;
      guard++;
    }
    return el;
  }

  function applyFromText(node) {
    if (!node || !node.parentElement) return;
    if (!(node.nodeValue || "").trim()) return;
    var el = blockAncestor(node.parentElement);
    if (el) apply(el);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    var touched = new Set();
    while ((node = walker.nextNode())) {
      if (!(node.nodeValue || "").trim()) continue;
      if (!node.parentElement) continue;
      var el = blockAncestor(node.parentElement);
      if (el && !touched.has(el)) {
        touched.add(el);
        apply(el);
      }
    }
    // Empty containers that will stream text later still need the composer rule.
    var editables = root.querySelectorAll ? root.querySelectorAll(EDITABLE) : [];
    for (var i = 0; i < editables.length; i++) apply(editables[i]);
    if (root.matches && root.matches(EDITABLE)) apply(root);
  }

  var queue = [];
  var pending = false;

  function flush() {
    pending = false;
    var batch = queue;
    queue = [];
    try {
      // A very large batch (chat switch, history load) is cheaper to handle as
      // one pass over the container than as hundreds of individual updates.
      if (batch.length > MAX_QUEUE) {
        scan(document.body);
        return;
      }
      for (var i = 0; i < batch.length; i++) {
        var m = batch[i];
        if (m.type === "characterData") {
          applyFromText(m.target);
        } else {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1) scan(n);
            else if (n.nodeType === 3) applyFromText(n);
          }
        }
      }
    } catch (e) {
      // Never let a DOM shape change in Claude Code break the chat panel.
    }
  }

  function start() {
    try {
      scan(document.body);
    } catch (e) {}
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) queue.push(mutations[i]);
      if (!pending) {
        pending = true;
        requestAnimationFrame(flush);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
/*CLAUDE-ARABIC-FIX-END*/
