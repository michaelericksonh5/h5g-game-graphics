# build-skills.ps1 — repack src/<name> trees back into <name>.skill ZIP artifacts.
# Source of truth is src/. The .skill files are build outputs; never hand-edit them.
# Usage:  pwsh -File build-skills.ps1            (repack all)
#         pwsh -File build-skills.ps1 -Name slot-state-machine   (repack one)

param([string]$Name = "*")

Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root "src"

if (-not (Test-Path $src)) { throw "src/ not found at $src" }

Get-ChildItem $src -Directory | Where-Object { $_.Name -like $Name } | ForEach-Object {
    $skillDir = $_.FullName                                   # src\<name>  (contains folder <name>)
    $inner    = Join-Path $skillDir $_.Name                   # src\<name>\<name>
    if (-not (Test-Path (Join-Path $inner "SKILL.md"))) {
        Write-Warning "Skipping $($_.Name): no $($_.Name)\SKILL.md inside"
        return
    }
    $out = Join-Path $root ("{0}.skill" -f $_.Name)
    if (Test-Path $out) { Remove-Item $out -Force }
    # CreateFromDirectory roots entries at the contents of $skillDir => "<name>/SKILL.md", matching originals.
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $skillDir, $out,
        [System.IO.Compression.CompressionLevel]::Optimal, $false)
    "{0,-38} -> {1:N0} bytes" -f $_.Name, (Get-Item $out).Length
}
