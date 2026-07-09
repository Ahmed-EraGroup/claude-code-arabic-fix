/*CLAUDE-ARABIC-FIX-BEGIN*/
(function () {
  "use strict";
  // Strong RTL characters: Arabic, Hebrew, Arabic presentation forms
  var RTL_RE = /[֑-߿ࡰ-ࣿיִ-﷽ﹰ-ﻼ]/;
  var TAGS = "p,li,ul,ol,h1,h2,h3,h4,h5,h6,blockquote,textarea";

  function fixEl(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.hasAttribute("dir")) return;
    if (el.closest("pre,code")) return;
    el.setAttribute("dir", "auto");
  }

  function fixTextParent(node) {
    if (!node || !node.parentElement) return;
    if (!RTL_RE.test(node.nodeValue || "")) return;
    var p = node.parentElement;
    if (p.closest("pre,code")) return;
    if (!p.hasAttribute("dir")) p.setAttribute("dir", "auto");
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
