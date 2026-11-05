# Developer-only offline build. Never use an execution-policy bypass for users.
# Prerequisites must already be installed from trusted sources: Godot 4.7.2
# Standard + matching export templates, NSIS 3.x, and Python 3 for static checks.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$GodotExe,
    [Parameter(Mandatory=$true)][string]$MakeNsisExe,
    [Parameter(Mandatory=$true)][string]$PythonExe,
    [Parameter(Mandatory=$true)][string]$GodotCopyrightFile,
    [switch]$AcknowledgedUnreviewedBuild
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $AcknowledgedUnreviewedBuild) {
    throw 'This creates an unsigned review build, not a security-approved release. Pass -AcknowledgedUnreviewedBuild only on a developer machine.'
}
$Root = Split-Path -Parent $PSScriptRoot
$Build = Join-Path $Root 'build'
$Payload = Join-Path $Build 'windows'
$Installer = Join-Path $Build 'MochiPetRPG-0.4.1-Review-Setup.exe'
foreach ($Path in @($GodotExe, $MakeNsisExe, $PythonExe, $GodotCopyrightFile)) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing prerequisite: $Path" }
}
$Version = (& $GodotExe --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $Version.StartsWith('4.7.2.stable')) {
    throw "Expected reviewed target Godot 4.7.2.stable, got: $Version"
}
if (Test-Path -LiteralPath $Payload) {
    # Do not recursively delete arbitrary build output. Review/remove it yourself.
    throw "Build output already exists: $Payload. Move it aside before a new build."
}
New-Item -ItemType Directory -Path $Payload -Force | Out-Null
function Invoke-CheckedGodot {
    param([string[]]$Arguments, [string]$LogName)
    $Log = Join-Path $Build $LogName
    & $GodotExe @Arguments 2>&1 | Tee-Object -FilePath $Log
    $Result = $LASTEXITCODE
    if ($Result -ne 0) { throw "Godot failed ($Result): $LogName" }
    if (Select-String -Path $Log -Pattern 'SCRIPT ERROR:|Parse Error:|ERROR:' -Quiet) {
        throw "Godot reported errors: $LogName"
    }
}
# No download/HTTP calls, Invoke-Expression, elevation, or policy modification.
& $PythonExe (Join-Path $Root 'tests\static_audit.py') --root $Root
if ($LASTEXITCODE -ne 0) { throw 'Static policy/resource audit failed.' }
Invoke-CheckedGodot -Arguments @('--headless','--path',$Root,'--editor','--import','--quit') -LogName 'import.log'
Invoke-CheckedGodot -Arguments @('--headless','--path',$Root,'--check-only','--script','res://scripts/main.gd') -LogName 'parse-main.log'
Invoke-CheckedGodot -Arguments @('--headless','--path',$Root,'--script','res://tests/test_save_store.gd') -LogName 'save-tests.log'
Invoke-CheckedGodot -Arguments @('--headless','--path',$Root,'--script','res://tests/test_resources.gd') -LogName 'resource-tests.log'
Invoke-CheckedGodot -Arguments @('--headless','--path',$Root,'--export-release','Windows Review',(Join-Path $Payload 'MochiPetRPG.exe')) -LogName 'export.log'
foreach ($Name in @('MochiPetRPG.exe','MochiPetRPG.pck')) {
    $File = Join-Path $Payload $Name
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) { throw "Export missing $Name" }
    if ((Get-Item -LiteralPath $File).Length -eq 0) { throw "Export is empty: $Name" }
}
# Include Godot's complete copyright/third-party license notices supplied by
# the developer from the exact engine release. Do not substitute a URL only.
$Copyright = Get-Content -LiteralPath $GodotCopyrightFile -Raw
if ($Copyright.Length -lt 1000 -or $Copyright -notmatch 'Godot') {
    throw 'Supply the full copyright.txt from the exact Godot release, not a placeholder.'
}
Copy-Item -LiteralPath $GodotCopyrightFile -Destination (Join-Path $Payload 'GODOT_COPYRIGHT.txt')
@"
MochiPet RPG 0.4.1-review
Engine: $Version
Build time UTC: $([DateTime]::UtcNow.ToString('o'))
Unsigned development review build. No independent security certification.
Installer: offline, per-user, no elevated privilege request.
Game: no application-level networking or auto-update logic.
Default: normal window; experimental desktop overlay disabled.
Saved data: %APPDATA%\MochiPetRPG\desktop-v041
Do not publicly distribute until native runtime and antivirus tests pass.
"@ | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $Payload 'BUILD_INFO.txt')
$Hashes = foreach ($Name in @('MochiPetRPG.exe','MochiPetRPG.pck','BUILD_INFO.txt','GODOT_COPYRIGHT.txt')) {
    $Hash = (Get-FileHash -LiteralPath (Join-Path $Payload $Name) -Algorithm SHA256).Hash.ToLowerInvariant()
    "$Hash  $Name"
}
$Hashes | Set-Content -Encoding ASCII -LiteralPath (Join-Path $Payload 'PAYLOAD_SHA256.txt')
# The installer contains the engine and assets; it downloads nothing on users' PCs.
& $MakeNsisExe "/DPAYLOAD_DIR=$Payload" "/DOUTPUT_FILE=$Installer" (Join-Path $PSScriptRoot 'installer.nsi')
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Installer)) { throw 'NSIS build failed.' }
$SetupHash = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
"$SetupHash  $([IO.Path]::GetFileName($Installer))" | Set-Content -Encoding ASCII -LiteralPath ($Installer + '.sha256')
Write-Host "Created UNSIGNED REVIEW installer: $Installer"
Write-Host 'Native Windows execution, offline network monitoring, Defender scan, and signature/reputation checks are STILL required.'
