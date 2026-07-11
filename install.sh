#!/bin/bash
# Claude Arabic Fix for VS Code (Claude Code extension) — macOS / Linux
# Usage:   ./install.sh            -> install / re-install the fix
#          ./install.sh --remove   -> remove the fix (restore original behavior)
# Re-run this script after every Claude Code extension update.

set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REMOVE=0
[ "$1" = "--remove" ] && REMOVE=1

# Patch every installed Claude Code version folder (auto-updates can leave
# a new, not-yet-active folder next to the running one)
EXTS=$(ls -d "$HOME/.vscode/extensions"/anthropic.claude-code-* 2>/dev/null)

if [ -z "$EXTS" ]; then
  echo "ERROR: Claude Code extension not found in ~/.vscode/extensions"
  exit 1
fi

patch_file() {
  local target="$1" patch="$2"
  if [ ! -f "$target" ]; then
    echo "Skipping (not found): $target"
    return
  fi

  # One-time backup of the pristine file
  [ -f "$target.bak" ] || cp "$target" "$target.bak"

  # Strip any previously installed fix block (idempotent re-install)
  perl -0777 -pi -e 's{\n?/\*CLAUDE-ARABIC-FIX-BEGIN\*/.*?/\*CLAUDE-ARABIC-FIX-END\*/\n?}{}gs' "$target"

  if [ "$REMOVE" = "1" ]; then
    echo "Removed fix from: $(basename "$target")"
  else
    printf '\n' >> "$target"
    cat "$patch" >> "$target"
    echo "Patched: $(basename "$target")"
  fi
}

for EXT in $EXTS; do
  echo "Target extension: $(basename "$EXT")"
  patch_file "$EXT/webview/index.js"  "$HERE/arabic-fix.js"
  patch_file "$EXT/webview/index.css" "$HERE/arabic-fix.css"
done

if [ "$REMOVE" = "1" ]; then
  echo ""
  echo "Done. Arabic fix removed."
else
  echo ""
  echo "Done. Quit VS Code completely (Cmd+Q) and reopen it to apply."
fi
