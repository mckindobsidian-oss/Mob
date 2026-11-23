param([string]$BuildDirectory = '', [string]$Destination = '')
$ErrorActionPreference='Stop'
$project=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if(!$BuildDirectory){$BuildDirectory=Join-Path $project '.mob-build/release-1.5.5/Mob-Windows-v1.5'}
if(!$Destination){$Destination=Join-Path $project 'Mob-Setup-v1.5.5.exe'}
if(!(Test-Path -LiteralPath (Join-Path $BuildDirectory 'Mob.exe'))){& (Join-Path $PSScriptRoot 'package.ps1') -OutputDirectory $BuildDirectory}
if((Split-Path $BuildDirectory -Leaf) -ne 'Mob-Windows-v1.5'){throw 'Expected the versioned Mob-Windows-v1.5 build folder.'}
$payload=Join-Path $project '.mob-build/Mob-v1.5-payload.zip'
Compress-Archive -LiteralPath $BuildDirectory -DestinationPath $payload -CompressionLevel Fastest -Force
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 "/win32icon:$PSScriptRoot/mob.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/resource:$payload,MobPayload" "/out:$Destination" (Join-Path $PSScriptRoot 'MobSetup.cs')
if($LASTEXITCODE -ne 0){throw 'Unable to build Mob installer.'}
Write-Output $Destination
