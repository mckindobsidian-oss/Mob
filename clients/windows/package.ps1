$ErrorActionPreference = 'Stop'
$project = Resolve-Path (Join-Path $PSScriptRoot '../..')
$output = Join-Path $project '.mob-build/Mob-Windows'
if (Test-Path -LiteralPath $output) { throw "Move the existing build folder before packaging again: $output" }
$runtime = Join-Path $PSScriptRoot 'node_modules/electron/dist'
New-Item -ItemType Directory -Path $output | Out-Null
Copy-Item -Path (Join-Path $runtime '*') -Destination $output -Recurse
Rename-Item -LiteralPath (Join-Path $output 'electron.exe') -NewName 'Mob.exe'
$resources = Join-Path $output 'resources/app'
New-Item -ItemType Directory -Path $resources | Out-Null
Copy-Item -LiteralPath @(
    (Join-Path $PSScriptRoot 'main.cjs'), (Join-Path $PSScriptRoot 'preload.cjs'), (Join-Path $PSScriptRoot 'package.json')
) -Destination $resources
Copy-Item -LiteralPath (Join-Path $project 'dist') -Destination (Join-Path $resources 'web') -Recurse
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe /platform:x64 "/out:$resources/MobActivity.exe" (Join-Path $PSScriptRoot 'MobActivity.cs')
if ($LASTEXITCODE -ne 0) { throw 'Unable to compile foreground activity helper.' }
Write-Output (Join-Path $output 'Mob.exe')
