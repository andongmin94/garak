[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release',

    [string]$OutputDirectory,

    [string]$ReportPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Test-Path -LiteralPath 'variable:PSNativeCommandUseErrorActionPreference') {
    $PSNativeCommandUseErrorActionPreference = $false
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$configurationSlug = $Configuration.ToLowerInvariant()
$artifactRoot = Join-Path $repositoryRoot "out\build\product-runtime-$configurationSlug"
$templateBundle = Join-Path $artifactRoot "VST3\$Configuration\Garak Product Runtime v1.vst3"
$templateInner = Join-Path $templateBundle `
    'Contents\x86_64-win\Garak Product Runtime v1.vst3'
$compiler = Join-Path $repositoryRoot 'tools\product-compiler\src\cli.ts'
$warmProject = Join-Path $repositoryRoot `
    'examples\products\artist-gain-warm.garak'
$brightProject = Join-Path $repositoryRoot `
    'examples\products\artist-gain-bright.garak'

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $repositoryRoot `
        "out\exports\phase-1c1\$configurationSlug"
}
else {
    $OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
}

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $repositoryRoot `
        "out\reports\vst3\product-runtime\no-native-build-$configurationSlug.json"
}
else {
    $ReportPath = [IO.Path]::GetFullPath($ReportPath)
}

function Get-TreeManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath
    )

    if (-not (Test-Path -LiteralPath $RootPath -PathType Container)) {
        throw "Manifest root does not exist: $RootPath"
    }

    $entries = [System.Collections.Generic.List[object]]::new()
    foreach ($directory in @(
            Get-ChildItem -LiteralPath $RootPath -Force -Recurse -Directory
        )) {
        $relative = $directory.FullName.Substring($RootPath.Length).TrimStart('\', '/')
        $entries.Add([ordered]@{
                kind = 'directory'
                path = $relative.Replace('\', '/')
            })
    }
    foreach ($file in @(
            Get-ChildItem -LiteralPath $RootPath -Force -Recurse -File
        )) {
        $relative = $file.FullName.Substring($RootPath.Length).TrimStart('\', '/')
        $entries.Add([ordered]@{
                kind = 'file'
                path = $relative.Replace('\', '/')
                bytes = $file.Length
                sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
                lastWriteTimeUtcTicks = $file.LastWriteTimeUtc.Ticks
            })
    }
    return @($entries | Sort-Object kind, path)
}

function Get-BundleEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundlePath
    )

    $leaf = [IO.Path]::GetFileName($BundlePath)
    $expected = [string[]]@(
        'Contents/Resources/graph.garakbin',
        'Contents/Resources/moduleinfo.json',
        'Contents/Resources/product.garakbin',
        "Contents/x86_64-win/$leaf"
    )
    $actual = [string[]]@(
        Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -File |
            ForEach-Object {
                $_.FullName.Substring($BundlePath.Length).TrimStart('\', '/').Replace('\', '/')
            }
    )
    [Array]::Sort($expected, [StringComparer]::Ordinal)
    [Array]::Sort($actual, [StringComparer]::Ordinal)
    if (($expected -join "`n") -cne ($actual -join "`n")) {
        throw "Unexpected bundle inventory: $BundlePath"
    }

    $inner = Join-Path $BundlePath "Contents\x86_64-win\$leaf"
    $graph = Join-Path $BundlePath 'Contents\Resources\graph.garakbin'
    $compiled = Join-Path $BundlePath 'Contents\Resources\product.garakbin'
    $moduleInfo = Join-Path $BundlePath 'Contents\Resources\moduleinfo.json'
    return [ordered]@{
        path = $BundlePath
        inventory = $actual
        runtimeSha256 = (Get-FileHash -LiteralPath $inner -Algorithm SHA256).Hash
        graphSha256 = (Get-FileHash -LiteralPath $graph -Algorithm SHA256).Hash
        compiledSha256 = (Get-FileHash -LiteralPath $compiled -Algorithm SHA256).Hash
        moduleInfoSha256 = (Get-FileHash -LiteralPath $moduleInfo -Algorithm SHA256).Hash
    }
}

function Invoke-ProductExport {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectPath
    )

    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $arguments = [string[]]@(
        $compiler,
        'export',
        '--project',
        $ProjectPath,
        '--configuration',
        $Configuration,
        '--output',
        $OutputDirectory,
        '--force',
        '--validate'
    )
    $previousErrorActionPreference = $ErrorActionPreference
    $lines = @()
    $exitCode = $null
    try {
        $ErrorActionPreference = 'Continue'
        $global:LASTEXITCODE = $null
        $lines = @(& $node @arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($null -eq $exitCode -or $exitCode -ne 0) {
        throw "Headless export failed with exit code $exitCode for $ProjectPath"
    }

    $childProcesses = [System.Collections.Generic.List[object]]::new()
    foreach ($line in $lines) {
        $text = [string]$line
        if (-not $text.StartsWith('CHILD_PROCESS ', [StringComparison]::Ordinal)) {
            continue
        }
        $record = $text.Substring('CHILD_PROCESS '.Length) | ConvertFrom-Json
        $leaf = [IO.Path]::GetFileName([string]$record.executable).ToLowerInvariant()
        if ($leaf -notin @('moduleinfotool.exe', 'garak_product_inspector.exe', 'validator.exe')) {
            throw "Unexpected native child process in export log: $leaf"
        }
        if ($leaf -in @('cl.exe', 'link.exe', 'cmake.exe', 'ninja.exe', 'msbuild.exe')) {
            throw "Forbidden native build process in export log: $leaf"
        }
        if ([int]$record.exitCode -ne 0) {
            throw "Child process did not exit zero: $leaf"
        }
        $childProcesses.Add($record)
    }
    if ($childProcesses.Count -ne 5) {
        throw "Expected exactly five native validation child processes; found $($childProcesses.Count)."
    }
    return [pscustomobject]@{
        nodeProcess = "$node $($arguments -join ' ')"
        transcript = [string[]]@($lines | ForEach-Object { [string]$_ })
        childProcesses = $childProcesses.ToArray()
    }
}

if (-not (Test-Path -LiteralPath $templateInner -PathType Leaf)) {
    throw "Prebuilt Product Runtime is missing: $templateInner"
}

$beforeManifest = @(Get-TreeManifest -RootPath $artifactRoot)
$beforeManifestJson = $beforeManifest | ConvertTo-Json -Depth 8 -Compress
$templateHashBefore = (Get-FileHash -LiteralPath $templateInner -Algorithm SHA256).Hash

$warmFirstRun = Invoke-ProductExport -ProjectPath $warmProject
$brightFirstRun = Invoke-ProductExport -ProjectPath $brightProject
foreach ($run in @($warmFirstRun, $brightFirstRun)) {
    Write-Output "NODE_PROCESS $($run.nodeProcess)"
    foreach ($line in $run.transcript) {
        Write-Output $line
    }
}
$firstChildLog = [System.Collections.Generic.List[object]]::new()
foreach ($entry in $warmFirstRun.childProcesses) {
    $firstChildLog.Add($entry)
}
foreach ($entry in $brightFirstRun.childProcesses) {
    $firstChildLog.Add($entry)
}

$warmBundle = Join-Path $OutputDirectory 'Artist Gain Warm.vst3'
$brightBundle = Join-Path $OutputDirectory 'Artist Gain Bright.vst3'
$warmFirst = Get-BundleEvidence -BundlePath $warmBundle
$brightFirst = Get-BundleEvidence -BundlePath $brightBundle

$warmSecondRun = Invoke-ProductExport -ProjectPath $warmProject
$brightSecondRun = Invoke-ProductExport -ProjectPath $brightProject
foreach ($run in @($warmSecondRun, $brightSecondRun)) {
    Write-Output "NODE_PROCESS $($run.nodeProcess)"
    foreach ($line in $run.transcript) {
        Write-Output $line
    }
}
$secondChildLog = [System.Collections.Generic.List[object]]::new()
foreach ($entry in $warmSecondRun.childProcesses) {
    $secondChildLog.Add($entry)
}
foreach ($entry in $brightSecondRun.childProcesses) {
    $secondChildLog.Add($entry)
}
$warmSecond = Get-BundleEvidence -BundlePath $warmBundle
$brightSecond = Get-BundleEvidence -BundlePath $brightBundle

foreach ($field in @('runtimeSha256', 'graphSha256', 'compiledSha256', 'moduleInfoSha256')) {
    if ($warmFirst.$field -cne $warmSecond.$field) {
        throw "Warm repeated export changed $field."
    }
    if ($brightFirst.$field -cne $brightSecond.$field) {
        throw "Bright repeated export changed $field."
    }
}
if ($warmSecond.runtimeSha256 -cne $templateHashBefore -or
    $brightSecond.runtimeSha256 -cne $templateHashBefore) {
    throw 'Exported Runtime hashes do not match the immutable prebuilt template.'
}
if ($warmSecond.graphSha256 -cne $brightSecond.graphSha256) {
    throw 'Warm and Bright compiled graph data must be identical.'
}
if ($warmSecond.compiledSha256 -ceq $brightSecond.compiledSha256) {
    throw 'Warm and Bright compiled product data must differ.'
}
if ($warmSecond.moduleInfoSha256 -ceq $brightSecond.moduleInfoSha256) {
    throw 'Warm and Bright moduleinfo must differ.'
}

$afterManifest = @(Get-TreeManifest -RootPath $artifactRoot)
$afterManifestJson = $afterManifest | ConvertTo-Json -Depth 8 -Compress
$templateHashAfter = (Get-FileHash -LiteralPath $templateInner -Algorithm SHA256).Hash
if ($beforeManifestJson -cne $afterManifestJson) {
    throw 'Prebuilt artifact tree bytes, hashes, sizes, or timestamps changed during export.'
}
if ($templateHashBefore -cne $templateHashAfter) {
    throw 'Prebuilt Product Runtime hash changed during export.'
}

$report = [ordered]@{
    schemaVersion = 1
    configuration = $Configuration
    artifactRoot = $artifactRoot
    outputDirectory = $OutputDirectory
    forbiddenNativeBuildInvocationCount = 0
    templateRuntimeSha256Before = $templateHashBefore
    templateRuntimeSha256After = $templateHashAfter
    artifactManifestEntryCount = $beforeManifest.Count
    artifactTreeUnchanged = $true
    firstExportChildProcesses = $firstChildLog.ToArray()
    secondExportChildProcesses = $secondChildLog.ToArray()
    warm = $warmSecond
    bright = $brightSecond
}

$reportParent = [IO.Path]::GetDirectoryName($ReportPath)
$null = New-Item -ItemType Directory -Force -Path $reportParent
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReportPath -Encoding utf8
Write-Output "No-native-build evidence: $ReportPath"
Write-Output "Template Runtime SHA-256: $templateHashAfter"
Write-Output "Warm compiled SHA-256: $($warmSecond.compiledSha256)"
Write-Output "Bright compiled SHA-256: $($brightSecond.compiledSha256)"
