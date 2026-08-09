[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration,

    [string]$OutputRoot,

    [string]$ReportPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Test-Path -LiteralPath 'variable:PSNativeCommandUseErrorActionPreference') {
    $PSNativeCommandUseErrorActionPreference = $false
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$outRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'out'))
$configurationSlug = $Configuration.ToLowerInvariant()
$phaseOutputBoundary = [IO.Path]::GetFullPath((Join-Path $outRoot 'phase2a'))
$phaseReportBoundary = [IO.Path]::GetFullPath((Join-Path $outRoot 'reports\phase-2a'))
$artifactRoot = [IO.Path]::GetFullPath((
        Join-Path $outRoot "build\product-runtime-$configurationSlug"
    ))
$templateBundle = Join-Path $artifactRoot `
    "VST3\$Configuration\Garak Product Runtime v1.vst3"
$templateInner = Join-Path $templateBundle `
    'Contents\x86_64-win\Garak Product Runtime v1.vst3'
$moduleInfoTool = Join-Path $artifactRoot 'bin\moduleinfotool.exe'
$inspector = Join-Path $artifactRoot 'bin\garak_product_inspector.exe'
$validator = Join-Path $artifactRoot 'bin\validator.exe'
$compilerCli = Join-Path $repositoryRoot 'tools\product-compiler\src\cli.ts'
$pathComparison = [StringComparison]::OrdinalIgnoreCase

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $phaseOutputBoundary `
        "project-migration-parity\$configurationSlug"
}
elseif ([IO.Path]::IsPathRooted($OutputRoot)) {
    $OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
}
else {
    $OutputRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputRoot))
}

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $phaseReportBoundary `
        "project-migration-parity-$configurationSlug.json"
}
elseif ([IO.Path]::IsPathRooted($ReportPath)) {
    $ReportPath = [IO.Path]::GetFullPath($ReportPath)
}
else {
    $ReportPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ReportPath))
}

$fixtures = @(
    [pscustomobject][ordered]@{
        productKey = 'warm'
        productLabel = 'Warm'
        projectLeaf = 'artist-gain-warm.garak'
        productName = 'Artist Gain Warm'
        productId = '6f0e50f1-a2d4-4b37-8c9e-1f2a3b4c5d6e'
        processorFuid = '3BA93DD6A062C97D89EC78F3652F83C4'
        controllerFuid = '00DD9000A50F7F28F4AE084CD29C4330'
        gainDb = [double]-6.0
        gainNormalized = '0.75'
        compiledBytes = [long]177
        compiledSha256 = `
            '3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9'
    },
    [pscustomobject][ordered]@{
        productKey = 'bright'
        productLabel = 'Bright'
        projectLeaf = 'artist-gain-bright.garak'
        productName = 'Artist Gain Bright'
        productId = 'c8a56d90-7e4b-4af1-91d3-2b6c8e0f1357'
        processorFuid = 'FCB1FDAED3D981A2AE3AE5A20898C449'
        controllerFuid = '32D933DFBD3C8110E014829EF5D62EA3'
        gainDb = [double]3.0
        gainNormalized = '0.875'
        compiledBytes = [long]179
        compiledSha256 = `
            'ABBA7E49FAA8504FD07AF161EA8C18285A8E073E9D31F969EB7665FE5DF47E52'
    }
)

$sourceKinds = @(
    [pscustomobject][ordered]@{
        key = 'legacy-v1'
        schemaVersion = 1
        relativeRoot = 'examples\products\legacy\v1'
    },
    [pscustomobject][ordered]@{
        key = 'current-v2'
        schemaVersion = 2
        relativeRoot = 'examples\products'
    }
)

$forbiddenNativeBuildCommands = @(
    'cl.exe',
    'link.exe',
    'cmake.exe',
    'ninja.exe',
    'msbuild.exe',
    'devenv.exe',
    'clang.exe',
    'clang++.exe',
    'gcc.exe',
    'g++.exe',
    'ld.exe',
    'lld-link.exe'
)
$expectedChildTools = @(
    $moduleInfoTool,
    $moduleInfoTool,
    $inspector,
    $validator,
    $validator
)
$script:forbiddenNativeBuildInvocationCount = 0

function Test-PathContainedBy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CandidatePath,

        [Parameter(Mandatory = $true)]
        [string]$BoundaryPath,

        [switch]$AllowBoundary
    )

    $candidate = [IO.Path]::GetFullPath($CandidatePath).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $boundary = [IO.Path]::GetFullPath($BoundaryPath).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    if ($AllowBoundary -and $candidate.Equals($boundary, $pathComparison)) {
        return $true
    }
    return $candidate.StartsWith(
        $boundary + [IO.Path]::DirectorySeparatorChar,
        $pathComparison
    )
}

function Assert-PathContainedBy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CandidatePath,

        [Parameter(Mandatory = $true)]
        [string]$BoundaryPath,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [switch]$AllowBoundary
    )

    if (-not (Test-PathContainedBy -CandidatePath $CandidatePath `
            -BoundaryPath $BoundaryPath -AllowBoundary:$AllowBoundary)) {
        throw "$Description escaped its allowed boundary: $CandidatePath"
    }
}

function Test-PathsOverlap {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FirstPath,

        [Parameter(Mandatory = $true)]
        [string]$SecondPath
    )

    return (Test-PathContainedBy -CandidatePath $FirstPath -BoundaryPath $SecondPath `
            -AllowBoundary) -or
        (Test-PathContainedBy -CandidatePath $SecondPath -BoundaryPath $FirstPath `
            -AllowBoundary)
}

function Assert-NoReparsePointInPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CandidatePath,

        [Parameter(Mandatory = $true)]
        [string]$BoundaryPath,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    Assert-PathContainedBy -CandidatePath $CandidatePath -BoundaryPath $BoundaryPath `
        -Description $Description -AllowBoundary
    $boundary = [IO.Path]::GetFullPath($BoundaryPath).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    if (-not (Test-Path -LiteralPath $boundary -PathType Container)) {
        throw "$Description boundary does not exist as a directory: $boundary"
    }
    $boundaryItem = Get-Item -LiteralPath $boundary -Force
    if (($boundaryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Description uses a reparse-point boundary: $boundary"
    }

    $candidate = [IO.Path]::GetFullPath($CandidatePath)
    if ($candidate.Equals($boundary, $pathComparison)) {
        return
    }
    $relative = $candidate.Substring($boundary.Length).TrimStart(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $current = $boundary
    foreach ($segment in @($relative -split '[\\/]')) {
        if ([string]::IsNullOrEmpty($segment)) {
            continue
        }
        $current = Join-Path $current $segment
        if (-not (Test-Path -LiteralPath $current)) {
            break
        }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "$Description traverses a reparse point: $current"
        }
    }
}

function Assert-NoReparsePointsBelow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $reparsePoints = @(
        Get-ChildItem -LiteralPath $RootPath -Force -Recurse |
            Where-Object {
                ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
            }
    )
    if ($reparsePoints.Count -ne 0) {
        throw "$Description contains a reparse point: $($reparsePoints[0].FullName)"
    }
}

function Resolve-PhysicalPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ValidateSet('File', 'Container')]
        [string]$Kind,

        [Parameter(Mandatory = $true)]
        [string]$BoundaryPath,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $absolute = [IO.Path]::GetFullPath($Path)
    Assert-PathContainedBy -CandidatePath $absolute -BoundaryPath $BoundaryPath `
        -Description $Description -AllowBoundary
    $pathType = if ($Kind -eq 'File') { 'Leaf' } else { 'Container' }
    if (-not (Test-Path -LiteralPath $absolute -PathType $pathType)) {
        throw "$Description does not exist as a $Kind`: $absolute"
    }
    Assert-NoReparsePointInPath -CandidatePath $absolute -BoundaryPath $BoundaryPath `
        -Description $Description
    $item = Get-Item -LiteralPath $absolute -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Description must be a physical path: $absolute"
    }
    return [IO.Path]::GetFullPath($item.FullName)
}

function Get-TreeManifest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $RootPath -PathType Container)) {
        throw "$Description manifest root does not exist: $RootPath"
    }
    Assert-NoReparsePointsBelow -RootPath $RootPath -Description $Description

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
                bytes = [long]$file.Length
                sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
                lastWriteTimeUtcTicks = [long]$file.LastWriteTimeUtc.Ticks
            })
    }
    return @($entries.ToArray() | Sort-Object kind, path)
}

function ConvertTo-ManifestJson {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Manifest
    )

    return ConvertTo-Json -InputObject @($Manifest) -Depth 8 -Compress
}

function Assert-StringArraysEqual {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Expected,

        [Parameter(Mandatory = $true)]
        [string[]]$Actual,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if ($Expected.Count -ne $Actual.Count) {
        throw "$Description count mismatch. Expected $($Expected.Count), found $($Actual.Count)."
    }
    for ($index = 0; $index -lt $Expected.Count; ++$index) {
        if ($Expected[$index] -cne $Actual[$index]) {
            throw "$Description mismatch at index $index. Expected '$($Expected[$index])', found '$($Actual[$index])'."
        }
    }
}

function Test-FilesByteEqual {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FirstPath,

        [Parameter(Mandatory = $true)]
        [string]$SecondPath
    )

    $firstBytes = [IO.File]::ReadAllBytes($FirstPath)
    $secondBytes = [IO.File]::ReadAllBytes($SecondPath)
    return [Collections.StructuralComparisons]::StructuralEqualityComparer.Equals(
        $firstBytes,
        $secondBytes
    )
}

function Get-FileEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $file = Get-Item -LiteralPath $Path -Force
    return [pscustomobject][ordered]@{
        path = [IO.Path]::GetFullPath($file.FullName)
        bytes = [long]$file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
}

function Read-SourceEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectPath,

        [Parameter(Mandatory = $true)]
        [int]$ExpectedSchemaVersion,

        [Parameter(Mandatory = $true)]
        [pscustomobject]$Fixture
    )

    $productJsonPath = Join-Path $ProjectPath 'product.json'
    $productJson = Resolve-PhysicalPath -Path $productJsonPath -Kind File `
        -BoundaryPath $repositoryRoot -Description 'Product source file'
    $source = Get-Content -LiteralPath $productJson -Raw | ConvertFrom-Json
    if ([int]$source.schemaVersion -ne $ExpectedSchemaVersion) {
        throw "$($Fixture.productLabel) source schema mismatch at $ProjectPath. Expected $ExpectedSchemaVersion."
    }
    if ([string]$source.productId -cne [string]$Fixture.productId -or
        [string]$source.name -cne [string]$Fixture.productName -or
        [string]$source.vendor -cne 'Garak Test Artist' -or
        [string]$source.version -cne '0.1.0' -or
        [string]$source.category -cne 'Fx' -or
        [double]$source.defaults.gainDb -ne [double]$Fixture.gainDb) {
        throw "$($Fixture.productLabel) source metadata/default does not match the normative fixture."
    }

    if ($ExpectedSchemaVersion -eq 1) {
        if ([string]$source.template -cne 'garak.gain-v1') {
            throw "$($Fixture.productLabel) legacy source does not use template garak.gain-v1."
        }
    }
    elseif ([string]$source.template.id -cne 'garak.gain' -or
        [int]$source.template.version -ne 1) {
        throw "$($Fixture.productLabel) current source does not use template garak.gain version 1."
    }

    return [pscustomobject][ordered]@{
        projectPath = $ProjectPath
        productJson = Get-FileEvidence -Path $productJson
        schemaVersion = $ExpectedSchemaVersion
        productId = [string]$source.productId
        vendor = [string]$source.vendor
        name = [string]$source.name
        version = [string]$source.version
        category = [string]$source.category
        templateId = 'garak.gain'
        templateVersion = 1
        gainDb = [double]$source.defaults.gainDb
        gainParameterId = 1001
        bypassParameterId = 1002
    }
}

function Get-BundleEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundlePath,

        [Parameter(Mandatory = $true)]
        [pscustomobject]$CliResult
    )

    if (-not (Test-Path -LiteralPath $BundlePath -PathType Container)) {
        throw "Export bundle does not exist: $BundlePath"
    }
    Assert-NoReparsePointsBelow -RootPath $BundlePath -Description 'Export bundle'
    $bundleLeaf = [IO.Path]::GetFileName($BundlePath)
    $expectedDirectories = [string[]]@(
        'Contents',
        'Contents/Resources',
        'Contents/x86_64-win'
    )
    $actualDirectories = [string[]]@(
        Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -Directory |
            ForEach-Object {
                $_.FullName.Substring($BundlePath.Length).TrimStart('\', '/').Replace('\', '/')
            }
    )
    [Array]::Sort($expectedDirectories, [StringComparer]::Ordinal)
    [Array]::Sort($actualDirectories, [StringComparer]::Ordinal)
    Assert-StringArraysEqual -Expected $expectedDirectories -Actual $actualDirectories `
        -Description 'Bundle directory inventory'

    $expectedInventory = [string[]]@(
        'Contents/Resources/moduleinfo.json',
        'Contents/Resources/product.garakbin',
        "Contents/x86_64-win/$bundleLeaf"
    )
    $actualInventory = [string[]]@(
        Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -File |
            ForEach-Object {
                $_.FullName.Substring($BundlePath.Length).TrimStart('\', '/').Replace('\', '/')
            }
    )
    [Array]::Sort($expectedInventory, [StringComparer]::Ordinal)
    [Array]::Sort($actualInventory, [StringComparer]::Ordinal)
    Assert-StringArraysEqual -Expected $expectedInventory -Actual $actualInventory `
        -Description 'Bundle file inventory'

    $reportedInventory = [string[]]@(
        $CliResult.inventory | ForEach-Object { [string]$_ }
    )
    [Array]::Sort($reportedInventory, [StringComparer]::Ordinal)
    Assert-StringArraysEqual -Expected $actualInventory -Actual $reportedInventory `
        -Description 'CLI/result bundle inventory'

    $runtimePath = Join-Path $BundlePath "Contents\x86_64-win\$bundleLeaf"
    $compiledPath = Join-Path $BundlePath 'Contents\Resources\product.garakbin'
    $moduleInfoPath = Join-Path $BundlePath 'Contents\Resources\moduleinfo.json'
    $runtimeEvidence = Get-FileEvidence -Path $runtimePath
    $compiledEvidence = Get-FileEvidence -Path $compiledPath
    $moduleInfoEvidence = Get-FileEvidence -Path $moduleInfoPath
    if ([string]$CliResult.runtimeSha256 -cne $runtimeEvidence.sha256 -or
        [string]$CliResult.compiledSha256 -cne $compiledEvidence.sha256 -or
        [long]$CliResult.compiledBytes -ne $compiledEvidence.bytes -or
        [string]$CliResult.moduleInfoSha256 -cne $moduleInfoEvidence.sha256 -or
        [long]$CliResult.moduleInfoBytes -ne $moduleInfoEvidence.bytes) {
        throw "CLI result hashes or sizes do not match bundle bytes: $BundlePath"
    }

    return [pscustomobject][ordered]@{
        bundlePath = $BundlePath
        inventoryCount = $actualInventory.Count
        inventory = $actualInventory
        runtime = $runtimeEvidence
        compiled = $compiledEvidence
        moduleInfo = $moduleInfoEvidence
    }
}

function Assert-ChildRecord {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Record,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedExecutable,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $actualExecutable = [IO.Path]::GetFullPath([string]$Record.executable)
    $leaf = [IO.Path]::GetFileName($actualExecutable).ToLowerInvariant()
    if ($forbiddenNativeBuildCommands -contains $leaf) {
        $script:forbiddenNativeBuildInvocationCount += 1
        throw "$Description invoked forbidden native build command: $actualExecutable"
    }
    if (-not $actualExecutable.Equals(
            [IO.Path]::GetFullPath($ExpectedExecutable),
            $pathComparison
        )) {
        throw "$Description used an unexpected or non-repository-local child executable: $actualExecutable"
    }
    if ($null -eq $Record.exitCode -or [int]$Record.exitCode -ne 0) {
        throw "$Description child process did not exit zero: $actualExecutable"
    }
}

function Get-RequiredArgumentValue {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$Option,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $indices = [System.Collections.Generic.List[int]]::new()
    for ($index = 0; $index -lt $Arguments.Count; ++$index) {
        if ($Arguments[$index] -ceq $Option) {
            $indices.Add($index)
        }
    }
    if ($indices.Count -ne 1) {
        throw "$Description must contain option '$Option' exactly once."
    }
    $valueIndex = $indices[0] + 1
    if ($valueIndex -ge $Arguments.Count) {
        throw "$Description option '$Option' is missing its value."
    }
    return $Arguments[$valueIndex]
}

function Invoke-ProductExport {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Fixture,

        [Parameter(Mandatory = $true)]
        [pscustomobject]$SourceKind,

        [Parameter(Mandatory = $true)]
        [string]$ProjectPath,

        [Parameter(Mandatory = $true)]
        [string]$OutputDirectory,

        [Parameter(Mandatory = $true)]
        [string]$NodePath
    )

    Assert-PathContainedBy -CandidatePath $OutputDirectory `
        -BoundaryPath $phaseOutputBoundary -Description 'Parity export output'
    Assert-NoReparsePointInPath -CandidatePath $OutputDirectory -BoundaryPath $outRoot `
        -Description 'Parity export output'
    if (Test-PathsOverlap -FirstPath $OutputDirectory -SecondPath $artifactRoot) {
        throw "Parity export output must not overlap the prebuilt artifact tree: $OutputDirectory"
    }

    $arguments = [string[]]@(
        $compilerCli,
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
        $lines = @(& $NodePath @arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($null -eq $exitCode -or $exitCode -ne 0) {
        $tail = @($lines | Select-Object -Last 20) -join ' '
        throw "Headless parity export failed with exit code $exitCode for $ProjectPath. $tail"
    }

    $childLogs = [System.Collections.Generic.List[object]]::new()
    $jsonLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $lines) {
        $text = [string]$line
        if ($text.StartsWith('CHILD_PROCESS ', [StringComparison]::Ordinal)) {
            $record = $text.Substring('CHILD_PROCESS '.Length) | ConvertFrom-Json
            $childLogs.Add($record)
        }
        else {
            $jsonLines.Add($text)
        }
    }
    if ($childLogs.Count -ne 5) {
        throw "Expected exactly five CLI child logs; found $($childLogs.Count) for $ProjectPath."
    }
    for ($index = 0; $index -lt $expectedChildTools.Count; ++$index) {
        Assert-ChildRecord -Record $childLogs[$index] `
            -ExpectedExecutable $expectedChildTools[$index] `
            -Description "CLI child log $index"
    }
    $createArguments = [string[]]@($childLogs[0].arguments)
    $validateArguments = [string[]]@($childLogs[1].arguments)
    $inspectArguments = [string[]]@($childLogs[2].arguments)
    $standardArguments = [string[]]@($childLogs[3].arguments)
    $extensiveArguments = [string[]]@($childLogs[4].arguments)
    if ($createArguments.Count -lt 1 -or $createArguments[0] -cne '-create' -or
        $validateArguments.Count -lt 1 -or $validateArguments[0] -cne '-validate' -or
        $inspectArguments.Count -lt 1 -or $inspectArguments[0] -cne '--bundle' -or
        $standardArguments.Count -ne 1 -or $standardArguments[0] -ceq '-e' -or
        $extensiveArguments.Count -ne 2 -or $extensiveArguments[0] -cne '-e' -or
        $standardArguments[0] -cne $extensiveArguments[1]) {
        throw "Export CLI child logs do not contain the exact create/validate/inspect/standard/extensive sequence."
    }
    $createBundleArgument = Get-RequiredArgumentValue -Arguments $createArguments `
        -Option '-path' -Description 'moduleinfotool create arguments'
    $validateBundleArgument = Get-RequiredArgumentValue -Arguments $validateArguments `
        -Option '-path' -Description 'moduleinfotool validate arguments'
    $inspectBundleArgument = Get-RequiredArgumentValue -Arguments $inspectArguments `
        -Option '--bundle' -Description 'inspector arguments'
    if ($createBundleArgument -cne $validateBundleArgument -or
        $createBundleArgument -cne $inspectBundleArgument -or
        $createBundleArgument -cne $standardArguments[0] -or
        $createBundleArgument -cne $extensiveArguments[1]) {
        throw 'All five export validation children must inspect the same staged bundle.'
    }
    $stagedBundleArgument = [IO.Path]::GetFullPath(
        $createBundleArgument.Replace('/', '\')
    )
    Assert-PathContainedBy -CandidatePath $stagedBundleArgument `
        -BoundaryPath $OutputDirectory -Description 'Staged parity bundle'

    $expectedInspectorArguments = [ordered]@{
        '--product-id' = [string]$Fixture.productId
        '--vendor' = 'Garak Test Artist'
        '--name' = [string]$Fixture.productName
        '--version' = '0.1.0'
        '--category' = 'Fx'
        '--template' = 'garak.gain-v1'
        '--processor-fuid' = [string]$Fixture.processorFuid
        '--controller-fuid' = [string]$Fixture.controllerFuid
        '--gain-id' = '1001'
        '--gain-default-normalized' = [string]$Fixture.gainNormalized
        '--bypass-id' = '1002'
        '--bypass-default-normalized' = '0'
    }
    foreach ($option in $expectedInspectorArguments.Keys) {
        $actualValue = Get-RequiredArgumentValue -Arguments $inspectArguments `
            -Option $option -Description 'inspector arguments'
        if ($actualValue -cne $expectedInspectorArguments[$option]) {
            throw "Inspector argument '$option' changed for $($Fixture.productLabel). Expected '$($expectedInspectorArguments[$option])', found '$actualValue'."
        }
    }

    $jsonText = $jsonLines.ToArray() -join "`n"
    if ([string]::IsNullOrWhiteSpace($jsonText)) {
        throw "Export CLI did not emit a JSON result for $ProjectPath."
    }
    try {
        $result = $jsonText | ConvertFrom-Json
    }
    catch {
        throw "Export CLI emitted non-JSON output outside child logs for $ProjectPath."
    }
    $resultChildren = @($result.childProcesses)
    if ($resultChildren.Count -ne 5) {
        throw "Export JSON must contain exactly five child processes; found $($resultChildren.Count)."
    }
    for ($index = 0; $index -lt $expectedChildTools.Count; ++$index) {
        Assert-ChildRecord -Record $resultChildren[$index] `
            -ExpectedExecutable $expectedChildTools[$index] `
            -Description "JSON child result $index"
        $loggedArguments = [string[]]@(
            $childLogs[$index].arguments | ForEach-Object { [string]$_ }
        )
        $resultArguments = [string[]]@(
            $resultChildren[$index].arguments | ForEach-Object { [string]$_ }
        )
        Assert-StringArraysEqual -Expected $loggedArguments -Actual $resultArguments `
            -Description "CLI/JSON child arguments $index"
    }
    if (@($result.cleanupDiagnostics).Count -ne 0) {
        throw "Parity export returned a cleanup diagnostic for $ProjectPath."
    }

    $expectedBundle = [IO.Path]::GetFullPath((
            Join-Path $OutputDirectory "$($Fixture.productName).vst3"
        ))
    if (-not ([IO.Path]::GetFullPath([string]$result.bundlePath)).Equals(
            $expectedBundle,
            $pathComparison
        )) {
        throw "Export JSON reported an unexpected bundle path for $ProjectPath."
    }
    if ([string]$result.processorFuid -cne [string]$Fixture.processorFuid -or
        [string]$result.controllerFuid -cne [string]$Fixture.controllerFuid) {
        throw "Export identity does not match the normative $($Fixture.productLabel) FUIDs."
    }

    $outputEntries = @(
        Get-ChildItem -LiteralPath $OutputDirectory -Force
    )
    if ($outputEntries.Count -ne 1 -or
        -not $outputEntries[0].PSIsContainer -or
        $outputEntries[0].Name -cne "$($Fixture.productName).vst3" -or
        ($outputEntries[0].Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Parity output directory must contain only the expected physical bundle: $OutputDirectory"
    }

    $bundle = Get-BundleEvidence -BundlePath $expectedBundle -CliResult $result
    return [pscustomobject][ordered]@{
        productKey = [string]$Fixture.productKey
        productLabel = [string]$Fixture.productLabel
        sourceKind = [string]$SourceKind.key
        sourceSchemaVersion = [int]$SourceKind.schemaVersion
        projectPath = $ProjectPath
        outputDirectory = $OutputDirectory
        nodeProcess = [ordered]@{
            executable = $NodePath
            arguments = $arguments
            exitCode = [int]$exitCode
        }
        processorFuid = [string]$result.processorFuid
        controllerFuid = [string]$result.controllerFuid
        childProcessCount = $childLogs.Count
        childProcesses = $childLogs.ToArray()
        bundle = $bundle
    }
}

function Get-ExportResult {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Exports,

        [Parameter(Mandatory = $true)]
        [string]$ProductKey,

        [Parameter(Mandatory = $true)]
        [string]$SourceKind
    )

    $matches = @(
        $Exports | Where-Object {
            $_.productKey -ceq $ProductKey -and $_.sourceKind -ceq $SourceKind
        }
    )
    if ($matches.Count -ne 1) {
        throw "Expected one export result for $ProductKey/$SourceKind; found $($matches.Count)."
    }
    return $matches[0]
}

Assert-PathContainedBy -CandidatePath $OutputRoot -BoundaryPath $phaseOutputBoundary `
    -Description 'Phase 2A parity output' -AllowBoundary
Assert-PathContainedBy -CandidatePath $ReportPath -BoundaryPath $phaseReportBoundary `
    -Description 'Phase 2A parity report'

$artifactRoot = Resolve-PhysicalPath -Path $artifactRoot -Kind Container `
    -BoundaryPath $outRoot -Description 'Product Runtime artifact root'
$templateBundle = Resolve-PhysicalPath -Path $templateBundle -Kind Container `
    -BoundaryPath $artifactRoot -Description 'Product Runtime template bundle'
$templateInner = Resolve-PhysicalPath -Path $templateInner -Kind File `
    -BoundaryPath $artifactRoot -Description 'Product Runtime template module'
$moduleInfoTool = Resolve-PhysicalPath -Path $moduleInfoTool -Kind File `
    -BoundaryPath $artifactRoot -Description 'moduleinfotool'
$inspector = Resolve-PhysicalPath -Path $inspector -Kind File `
    -BoundaryPath $artifactRoot -Description 'Product Runtime inspector'
$validator = Resolve-PhysicalPath -Path $validator -Kind File `
    -BoundaryPath $artifactRoot -Description 'official VST3 validator'
$compilerCli = Resolve-PhysicalPath -Path $compilerCli -Kind File `
    -BoundaryPath $repositoryRoot -Description 'Product Compiler CLI'
Assert-NoReparsePointsBelow -RootPath $artifactRoot -Description 'Product Runtime artifact tree'

$expectedChildTools = @(
    $moduleInfoTool,
    $moduleInfoTool,
    $inspector,
    $validator,
    $validator
)
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction Stop
$nodePath = [IO.Path]::GetFullPath($nodeCommand.Source)
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) {
    throw "Node.js executable does not exist as a file: $nodePath"
}
$nodeItem = Get-Item -LiteralPath $nodePath -Force
if (($nodeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Node.js executable must not be a reparse point: $nodePath"
}
$nodePath = [IO.Path]::GetFullPath($nodeItem.FullName)

$sourceRecords = [System.Collections.Generic.List[object]]::new()
foreach ($fixture in $fixtures) {
    foreach ($sourceKind in $sourceKinds) {
        $projectPath = [IO.Path]::GetFullPath((
                Join-Path $repositoryRoot `
                    (Join-Path $sourceKind.relativeRoot $fixture.projectLeaf)
            ))
        $projectPath = Resolve-PhysicalPath -Path $projectPath -Kind Container `
            -BoundaryPath $repositoryRoot `
            -Description "$($fixture.productLabel) $($sourceKind.key) project"
        $manifest = @(Get-TreeManifest -RootPath $projectPath `
                -Description "$($fixture.productLabel) $($sourceKind.key) source")
        if ($manifest.Count -ne 1 -or $manifest[0].kind -cne 'file' -or
            $manifest[0].path -cne 'product.json') {
            throw "$($fixture.productLabel) $($sourceKind.key) source must contain only product.json."
        }
        $sourceRecords.Add([pscustomobject][ordered]@{
                productKey = [string]$fixture.productKey
                productLabel = [string]$fixture.productLabel
                sourceKind = [string]$sourceKind.key
                sourceSchemaVersion = [int]$sourceKind.schemaVersion
                projectPath = $projectPath
                evidence = Read-SourceEvidence -ProjectPath $projectPath `
                    -ExpectedSchemaVersion $sourceKind.schemaVersion -Fixture $fixture
                beforeManifest = $manifest
                beforeManifestJson = ConvertTo-ManifestJson -Manifest $manifest
            })
    }
}
if ($sourceRecords.Count -ne 4) {
    throw "Expected exactly four v1/v2 Warm/Bright source records; found $($sourceRecords.Count)."
}

$buildManifestBefore = @(Get-TreeManifest -RootPath $artifactRoot `
        -Description 'Product Runtime artifact tree')
$buildManifestBeforeJson = ConvertTo-ManifestJson -Manifest $buildManifestBefore
$templateBefore = Get-FileEvidence -Path $templateInner

$exports = [System.Collections.Generic.List[object]]::new()
foreach ($fixture in $fixtures) {
    foreach ($sourceKind in $sourceKinds) {
        $source = @(
            $sourceRecords | Where-Object {
                $_.productKey -ceq $fixture.productKey -and
                $_.sourceKind -ceq $sourceKind.key
            }
        )
        if ($source.Count -ne 1) {
            throw "Expected one source record for $($fixture.productKey)/$($sourceKind.key)."
        }
        $outputDirectory = [IO.Path]::GetFullPath((
                Join-Path $OutputRoot `
                    (Join-Path $fixture.productKey $sourceKind.key)
            ))
        $exports.Add((Invoke-ProductExport -Fixture $fixture -SourceKind $sourceKind `
                -ProjectPath $source[0].projectPath -OutputDirectory $outputDirectory `
                -NodePath $nodePath))
    }
}
if ($exports.Count -ne 4) {
    throw "Expected exactly four v1/v2 Warm/Bright exports; found $($exports.Count)."
}

$pairReports = [System.Collections.Generic.List[object]]::new()
foreach ($fixture in $fixtures) {
    $legacy = Get-ExportResult -Exports $exports.ToArray() `
        -ProductKey $fixture.productKey -SourceKind 'legacy-v1'
    $current = Get-ExportResult -Exports $exports.ToArray() `
        -ProductKey $fixture.productKey -SourceKind 'current-v2'

    foreach ($entry in @($legacy, $current)) {
        if ($entry.bundle.compiled.bytes -ne [long]$fixture.compiledBytes -or
            $entry.bundle.compiled.sha256 -cne [string]$fixture.compiledSha256) {
            throw "$($fixture.productLabel) $($entry.sourceKind) GARAKCPD bytes/hash changed."
        }
        if ($entry.bundle.runtime.sha256 -cne $templateBefore.sha256 -or
            $entry.bundle.runtime.bytes -ne $templateBefore.bytes -or
            -not (Test-FilesByteEqual -FirstPath $entry.bundle.runtime.path `
                -SecondPath $templateBefore.path)) {
            throw "$($fixture.productLabel) $($entry.sourceKind) Runtime does not match the prebuilt template bytes."
        }
    }

    foreach ($component in @('compiled', 'runtime', 'moduleInfo')) {
        $legacyFile = $legacy.bundle.$component
        $currentFile = $current.bundle.$component
        if ($legacyFile.bytes -ne $currentFile.bytes -or
            $legacyFile.sha256 -cne $currentFile.sha256 -or
            -not (Test-FilesByteEqual -FirstPath $legacyFile.path `
                -SecondPath $currentFile.path)) {
            throw "$($fixture.productLabel) v1/v2 $component bytes are not identical."
        }
    }
    Assert-StringArraysEqual -Expected $legacy.bundle.inventory `
        -Actual $current.bundle.inventory `
        -Description "$($fixture.productLabel) v1/v2 inventory"
    if ($legacy.processorFuid -cne $current.processorFuid -or
        $legacy.controllerFuid -cne $current.controllerFuid) {
        throw "$($fixture.productLabel) v1/v2 export identity changed."
    }

    $pairReports.Add([ordered]@{
            product = [string]$fixture.productLabel
            productId = [string]$fixture.productId
            processorFuid = [string]$fixture.processorFuid
            controllerFuid = [string]$fixture.controllerFuid
            gainParameterId = 1001
            bypassParameterId = 1002
            defaultGainDb = [double]$fixture.gainDb
            legacySchemaVersion = 1
            currentSchemaVersion = 2
            compiledNormativeBytes = [long]$fixture.compiledBytes
            compiledNormativeSha256 = [string]$fixture.compiledSha256
            compiledByteParity = $true
            runtimeByteParity = $true
            moduleInfoByteParity = $true
            identityParity = $true
            inventoryParity = $true
            legacy = $legacy.bundle
            current = $current.bundle
        })
}
if ($pairReports.Count -ne 2) {
    throw "Expected exactly two Warm/Bright parity pairs; found $($pairReports.Count)."
}

$sourceReports = [System.Collections.Generic.List[object]]::new()
foreach ($source in $sourceRecords) {
    $afterManifest = @(Get-TreeManifest -RootPath $source.projectPath `
            -Description "$($source.productLabel) $($source.sourceKind) source")
    $afterManifestJson = ConvertTo-ManifestJson -Manifest $afterManifest
    if ($source.beforeManifestJson -cne $afterManifestJson) {
        throw "$($source.productLabel) $($source.sourceKind) source tree changed during export."
    }
    $sourceReports.Add([ordered]@{
            product = [string]$source.productLabel
            sourceKind = [string]$source.sourceKind
            schemaVersion = [int]$source.sourceSchemaVersion
            projectPath = [string]$source.projectPath
            semantics = $source.evidence
            beforeManifest = $source.beforeManifest
            afterManifest = $afterManifest
            unchanged = $true
        })
}

$buildManifestAfter = @(Get-TreeManifest -RootPath $artifactRoot `
        -Description 'Product Runtime artifact tree')
$buildManifestAfterJson = ConvertTo-ManifestJson -Manifest $buildManifestAfter
$templateAfter = Get-FileEvidence -Path $templateInner
if ($buildManifestBeforeJson -cne $buildManifestAfterJson) {
    throw 'Prebuilt Product Runtime artifact tree changed during parity exports.'
}
if ($templateBefore.bytes -ne $templateAfter.bytes -or
    $templateBefore.sha256 -cne $templateAfter.sha256 -or
    -not (Test-FilesByteEqual -FirstPath $templateBefore.path `
        -SecondPath $templateAfter.path)) {
    throw 'Prebuilt Product Runtime template changed during parity exports.'
}
if ($script:forbiddenNativeBuildInvocationCount -ne 0) {
    throw "Parity exports invoked $script:forbiddenNativeBuildInvocationCount forbidden native build commands."
}

$report = [ordered]@{
    schemaVersion = 1
    result = 'PASS'
    configuration = $Configuration
    repositoryRoot = $repositoryRoot
    outputRoot = $OutputRoot
    artifactRoot = $artifactRoot
    forbiddenNativeBuildInvocationCount = 0
    exportCount = $exports.Count
    sourceTreesUnchanged = $true
    artifactTreeUnchanged = $true
    templateRuntime = [ordered]@{
        before = $templateBefore
        after = $templateAfter
        unchanged = $true
    }
    buildTree = [ordered]@{
        beforeEntryCount = $buildManifestBefore.Count
        afterEntryCount = $buildManifestAfter.Count
        beforeManifest = $buildManifestBefore
        afterManifest = $buildManifestAfter
        unchanged = $true
    }
    sources = $sourceReports.ToArray()
    exports = $exports.ToArray()
    pairs = $pairReports.ToArray()
}

$reportParent = [IO.Path]::GetDirectoryName($ReportPath)
Assert-PathContainedBy -CandidatePath $reportParent -BoundaryPath $phaseReportBoundary `
    -Description 'Phase 2A parity report parent' -AllowBoundary
Assert-NoReparsePointInPath -CandidatePath $reportParent -BoundaryPath $outRoot `
    -Description 'Phase 2A parity report parent'
$null = New-Item -ItemType Directory -Force -Path $reportParent
if (Test-Path -LiteralPath $ReportPath) {
    if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
        throw "Phase 2A parity report path exists but is not a file: $ReportPath"
    }
    $existingReport = Get-Item -LiteralPath $ReportPath -Force
    if (($existingReport.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Phase 2A parity report must not replace a reparse point: $ReportPath"
    }
}
$reportJson = ConvertTo-Json -InputObject $report -Depth 20
$utf8WithoutBom = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText($ReportPath, $reportJson + "`n", $utf8WithoutBom)

Write-Output "Project migration export parity: PASS ($Configuration)"
Write-Output "Evidence report: $ReportPath"
Write-Output "Template Runtime SHA-256: $($templateAfter.sha256)"
foreach ($pair in $pairReports) {
    Write-Output "$($pair.product) GARAKCPD SHA-256: $($pair.compiledNormativeSha256)"
}
