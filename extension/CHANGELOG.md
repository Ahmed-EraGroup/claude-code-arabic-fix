# Changelog

## 1.2.3

- **Fixed:** a regression from 1.2.2 — the panel layout itself could be mirrored: tool cards drifted to the right in a staircase, indentation flipped and code blocks were clipped. `direction` is inherited, so flipping a box flips everything inside it. The direction is now only ever applied to boxes that contain text alone, never to boxes that hold layout (tool cards, buttons, code, nested containers).
- **Improved:** an English tool row sitting next to an Arabic message is left alone instead of being pulled right.

## 1.2.2

- **Fixed:** an Arabic sentence split into sibling fragments (a bold word, a link, a streamed run) inside a flex row came out scrambled — each fragment was aligned on its own while the fragments themselves stayed in left-to-right order. The row is now flipped as one sentence. Reproduced in a real browser and covered by tests.
- **Fixed:** layout rows (avatar, buttons, toolbars) are explicitly left alone — only rows made purely of text fragments are turned around.

## 1.2.1

Found and fixed by a new automated test suite (43 tests: extension-host behaviour on a simulated extensions folder, plus the injected script running in a real DOM).

- **Fixed:** a text replacement of the same length (e.g. an English word swapped for an Arabic one of equal length) was skipped and kept the wrong direction
- **Fixed:** text inside nested inline elements could get the direction on the inline box instead of the block, so the alignment did nothing — the payload no longer depends on the browser reporting a computed display
- **Fixed:** a font value containing CSS syntax could break or inject rules into the panel stylesheet; settings are now sanitized and the line height is clamped
- **Fixed:** one locked or read-only Claude Code folder no longer stops the running version from being patched — failures are reported per folder and the diagnostics screen shows them

## 1.2.0

- **New:** settings — pick the Arabic font (`claudeArabicFix.fontFamily`), line height, mirror the whole panel layout to RTL (`forceRtlLayout`), and turn the fix, the reload prompt or the status-bar item off
- **New:** status-bar indicator showing whether the fix is live on the running Claude Code version, with a Status / Diagnostics command (which versions are patched, which patch stamp, current settings)
- **Improved:** direction now follows the dominant script of a line, so an Arabic sentence quoting English terms no longer flips to LTR
- **Improved:** quotes, nested lists and table cells align and indent correctly in RTL; links, file paths and inline code are bidi-isolated so Arabic punctuation lands on the right side
- **Improved:** much lighter during streaming — each element is re-evaluated only when its text actually changes, and large DOM bursts collapse into a single pass
- **Fixed:** the fix no longer overrides a direction Claude Code set itself
- **Fixed:** patch code is written with unicode escapes so re-encoding of the bundle can never corrupt the RTL detection
- **Fixed:** removing or disabling the fix restores the original bundle byte-for-byte

## 1.1.0

- **Fixed:** updating this extension now refreshes the injected fix — previously an old patch stayed in place forever (patches are now version-stamped)
- **Fixed:** Claude Code auto-updates are now patched the moment the new version lands on disk (startup + live extension changes + a 10-minute safety check), so the next reload starts already fixed — no broken window in between
- **Fixed:** all installed Claude Code version folders are patched, not just one
- **Improved:** composer detection covers all `contenteditable` variants
- **Improved:** table cells (`td`/`th`) now get RTL auto-direction
- **Improved:** Arabic lists indent correctly from the right (the app uses physical `padding-left` in places)
- **Improved:** English lines inside the composer are no longer forced to right alignment

## 1.0.4

- Marketplace description and keywords update (Hebrew, BiDi); no code changes

## 1.0.3

- Arabic user message bubbles are pinned to the right (inline styles override the app's flex alignment)

## 1.0.2

- Right-align user messages: climb past inline wrappers to the nearest block container

## 1.0.1

- Fix RTL detection for user messages rendered in plain divs

## 1.0.0

- Initial release
