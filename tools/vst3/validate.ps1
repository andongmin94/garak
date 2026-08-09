[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$presetName = if ($Configuration -eq 'Debug') { 'vst3-debug' } else { 'vst3-release' }
$buildRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "out\build\$presetName"))
$outRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'out'))

if (-not $buildRoot.StartsWith($outRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "Build root escaped repository output: $buildRoot"
}
if (-not (Test-Path -LiteralPath $buildRoot -PathType Container)) {
    throw "Build directory does not exist: $buildRoot"
}

$validators = @(
    Get-ChildItem -LiteralPath $buildRoot -Recurse -File -Filter 'validator.exe'
)
if ($validators.Count -ne 1) {
    throw "Expected exactly one validator.exe under $buildRoot; found $($validators.Count)."
}

$bundles = @(
    Get-ChildItem -LiteralPath $buildRoot -Recurse -Directory -Filter 'Garak Gain Spike.vst3'
)
if ($bundles.Count -ne 1) {
    throw "Expected exactly one Garak Gain Spike.vst3 under $buildRoot; found $($bundles.Count)."
}

$validatorPath = $validators[0].FullName
$bundlePath = $bundles[0].FullName
$reportRoot = Join-Path $repositoryRoot 'out\reports\vst3'
$null = New-Item -ItemType Directory -Force -Path $reportRoot
$reportPrefix = $Configuration.ToLowerInvariant()

function Invoke-ValidatorRun {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$ReportPath
    )

    $renderedArguments = @($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    Write-Output "Command: `"$validatorPath`" $renderedArguments"
    & $validatorPath @Arguments 2>&1 | Tee-Object -FilePath $ReportPath
    $validatorExitCode = $LASTEXITCODE
    Write-Output "Exit code: $validatorExitCode"
    if ($validatorExitCode -ne 0) {
        throw "Official VST3 validator failed with exit code $validatorExitCode. Report: $ReportPath"
    }
}

Write-Output "Validator: $validatorPath"
Write-Output "Plugin: $bundlePath"

$standardReport = Join-Path $reportRoot "$reportPrefix-validator-standard.txt"
Invoke-ValidatorRun -Arguments @($bundlePath) -ReportPath $standardReport

$extensiveReport = Join-Path $reportRoot "$reportPrefix-validator-extensive.txt"
Invoke-ValidatorRun -Arguments @('-e', $bundlePath) -ReportPath $extensiveReport
