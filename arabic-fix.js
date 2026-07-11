/*CLAUDE-ARABIC-FIX-BEGIN*/
(function () {
  "use strict";
  // Strong RTL characters: Arabic, Hebrew, Arabic presentation forms
  var RTL_RE = /[֑-߿ࡰ-ࣿיִ-﷽ﹰ-ﻼ]/;
  var TAGS = 'p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,td,th,textarea,[contenteditable]:not([contenteditable="false"])';
  var handledBubbles = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function fixEl(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.hasAttribute("dir")) return;
    if (el.closest("pre,code")) return;
    el.setAttribute("dir", "auto");
  }

  // True when the first strong-direction character is RTL (Arabic/Hebrew)
  function firstStrongIsRTL(text) {
    var m = (text || "").match(/[A-Za-z]|[֑-߿ࡰ-ࣿיִ-﷽ﹰ-ﻼ]/);
    return !!(m && RTL_RE.test(m[0]));
  }

  function fixTextParent(node) {
    if (!node || !node.parentElement) return;
    if (!RTL_RE.test(node.nodeValue || "")) return;
    var p = node.parentElement;
    if (p.closest("pre,code")) return;
    if (!p.hasAttribute("dir")) p.setAttribute("dir", "auto");

    // User message bubbles are inline-blocks pinned left by their flex
    // parent (align-items:flex-start) — dir/text-align can't move them,
    // so pin the alignment with inline styles when the message is RTL.
    if (firstStrongIsRTL(node.nodeValue)) {
      var bubble = p.closest('[class*="userMessageContainer"]');
      if (bubble && (!handledBubbles || !handledBubbles.has(bubble))) {
        bubble.style.textAlign = "right";
        bubble.setAttribute("dir", "rtl");
        if (bubble.parentElement) bubble.parentElement.style.alignItems = "flex-end";
        if (handledBubbles) handledBubbles.add(bubble);
      }
    }
    // Climb past inline wrappers to the nearest block container, otherwise
    // text-align has no effect (e.g. spans inside flex message bubbles).
    var hops = 0;
    while (p && hops < 6 && p !== document.body) {
      var d;
      try { d = getComputedStyle(p).display; } catch (e) { break; }
      if (d.indexOf("inline") !== 0 && d !== "contents") {
        if (!p.hasAttribute("dir")) p.setAttribute("dir", "auto");
        break;
      }
      p = p.parentElement;
      hops++;
    }
  }

  function walkText(root) {
    // Covers user messages and any text rendered in plain divs/spans
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) fixTextParent(n);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(TAGS)) fixEl(root);
    var els = root.querySelectorAll ? root.querySelectorAll(TAGS) : [];
    for (var i = 0; i < els.length; i++) fixEl(els[i]);
    walkText(root);
  }

  var pending = false;
  var queue = [];

  function flush() {
    pending = false;
    var q = queue;
    queue = [];
    for (var i = 0; i < q.length; i++) {
      var m = q[i];
      if (m.type === "characterData") {
        fixTextParent(m.target);
      } else if (m.type === "childList") {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) scan(n);
          else if (n.nodeType === 3) fixTextParent(n);
        }
      }
    }
  }

  function start() {
    scan(document.body);
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) queue.push(muts[i]);
      if (!pending) {
        pending = true;
        requestAnimationFrame(flush);
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
/*CLAUDE-ARABIC-FIX-END*/
