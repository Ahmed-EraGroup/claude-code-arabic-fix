# Changelog

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
