# build-plugin.ps1 — sync the src/ source of truth into the plugin's single-nested skills/ tree.
# src layout is double-nested (src\<name>\<name>\...) to match the .skill ZIP format; a Claude Code
# plugin auto-discovers skills/<name>/SKILL.md (single nest). This copies the inner dir across so the
# plugin and the standalone .skill artifacts stay in sync from one source.
# Usage:  pwsh -File build-plugin.ps1

$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$src   = Join-Path $root "src"
$skills= Join-Path $root "skills"

if (-not (Test-Path $src)) { throw "src/ not found at $src" }

# Rebuild skills/ cleanly so deletions in src/ propagate.
if (Test-Path $skills) { Remove-Item $skills -Recurse -Force }
New-Item -ItemType Directory -Force $skills | Out-Null

$count = 0
Get-ChildItem $src -Directory | ForEach-Object {
    $name  = $_.Name
    $inner = Join-Path $_.FullName $name              # src\<name>\<name>
    if (-not (Test-Path (Join-Path $inner "SKILL.md"))) {
        Write-Warning "Skipping ${name}: no $name\SKILL.md inside"
        return
    }
    $dest = Join-Path $skills $name                   # skills\<name>
    Copy-Item $inner $dest -Recurse -Force
    $count++
    "{0,-38} -> skills\{0}" -f $name
}
"Synced $count skills into $skills"
