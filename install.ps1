# Claude Arabic Fix for VS Code (Claude Code extension)
# Usage:   .\install.ps1            -> install / re-install the fix
#          .\install.ps1 -Remove    -> remove the fix (restore original behavior)
# Re-run this script after every Claude Code extension update.

param([switch]$Remove)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

# Find the newest installed Claude Code extension
$ext = Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Directory -Filter "anthropic.claude-code-*" |
    Sort-Object Name -Descending | Select-Object -First 1

if (-not $ext) {
    Write-Host "Claude Code extension not found in ~/.vscode/extensions" -ForegroundColor Red
    exit 1
}
Write-Host "Target extension: $($ext.Name)" -ForegroundColor Cyan

$targets = @(
    @{ file = Join-Path $ext.FullName "webview\index.js";  patch = Join-Path $here "arabic-fix.js"  },
    @{ file = Join-Path $ext.FullName "webview\index.css"; patch = Join-Path $here "arabic-fix.css" }
)

$blockRe = '(?s)\r?\n?/\*CLAUDE-ARABIC-FIX-BEGIN\*/.*?/\*CLAUDE-ARABIC-FIX-END\*/\r?\n?'

foreach ($t in $targets) {
    if (-not (Test-Path $t.file)) {
        Write-Host "Skipping (not found): $($t.file)" -ForegroundColor Yellow
        continue
    }

    # One-time backup of the pristine file
    $bak = "$($t.file).bak"
    if (-not (Test-Path $bak)) { Copy-Item $t.file $bak }

    $content = Get-Content $t.file -Raw
    # Strip any previously installed fix block (idempotent re-install)
    $content = [regex]::Replace($content, $blockRe, "")

    if ($Remove) {
        Set-Content -Path $t.file -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Removed fix from: $(Split-Path $t.file -Leaf)" -ForegroundColor Yellow
    }
    else {
        $patch = Get-Content $t.patch -Raw
        Set-Content -Path $t.file -Value ($content + "`n" + $patch) -Encoding UTF8 -NoNewline
        Write-Host "Patched: $(Split-Path $t.file -Leaf)" -ForegroundColor Green
    }
}

if ($Remove) { Write-Host "`nDone. Arabic fix removed." -ForegroundColor Yellow }
else        { Write-Host "`nDone. Reload VS Code (Ctrl+Shift+P -> 'Developer: Reload Window') to apply." -ForegroundColor Green }
