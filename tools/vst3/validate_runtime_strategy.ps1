[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration,

    [Parameter(Mandatory = $true)]
    [string]$ArtifactRootPath,

    [Parameter(Mandatory = $true)]
    [string]$ValidatorPath,

    [Parameter(Mandatory = $true)]
    [string]$GainSpikeBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$DataAlphaBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$DataBetaBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$ThinAlphaBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$ThinBetaBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$ReportDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Test-Path -LiteralPath 'variable:PSNativeCommandUseErrorActionPreference') {
    $PSNativeCommandUseErrorActionPreference = $false
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$outRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'out'))
$pathComparison = [StringComparison]::OrdinalIgnoreCase
$utf8NoBom = New-Object Text.UTF8Encoding -ArgumentList $false

function ConvertTo-RepositoryAbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if ([IO.Path]::IsPathRooted($Path)) {
        return [IO.Path]::GetFullPath($Path)
    }

    return [IO.Path]::GetFullPath((Join-Path $repositoryRoot $Path))
}

function Test-PathContainedBy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CandidatePath,

        [Parameter(Mandatory = $true)]
        [string]$BoundaryPath,

        [switch]$AllowBoundary
    )

    $candidate = [IO.Path]::GetFullPath($CandidatePath)
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

function Assert-PathUnderOut {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [switch]$AllowOutRoot
    )

    if (-not (Test-PathContainedBy -CandidatePath $Path -BoundaryPath $outRoot `
            -AllowBoundary:$AllowOutRoot)) {
        throw "$Description must be inside the repository out directory: $Path"
    }
}

function Assert-NoReparsePointInOutPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    Assert-PathUnderOut -Path $Path -Description $Description -AllowOutRoot
    $boundary = $outRoot.TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $boundaryItem = Get-Item -LiteralPath $boundary -Force
    if (($boundaryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "$Description uses a reparse-point out directory: $boundary"
    }

    $candidate = [IO.Path]::GetFullPath($Path)
    if ($candidate.Equals($boundary, $pathComparison)) {
        return
    }

    $relative = $candidate.Substring($boundary.Length).TrimStart('\', '/')
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

function Resolve-OutArtifact {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ValidateSet('File', 'Container')]
        [string]$Kind,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $absolutePath = ConvertTo-RepositoryAbsolutePath -Path $Path
    Assert-PathUnderOut -Path $absolutePath -Description $Description
    $pathType = if ($Kind -eq 'File') { 'Leaf' } else { 'Container' }
    if (-not (Test-Path -LiteralPath $absolutePath -PathType $pathType)) {
        throw "$Description does not exist as a $Kind`: $absolutePath"
    }
    Assert-NoReparsePointInOutPath -Path $absolutePath -Description $Description
    return [IO.Path]::GetFullPath((Get-Item -LiteralPath $absolutePath -Force).FullName)
}

function Assert-BundleInput {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundlePath,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedProductName
    )

    $expectedLeaf = $ExpectedProductName + '.vst3'
    if ([IO.Path]::GetFileName($BundlePath) -cne $expectedLeaf) {
        throw "Expected bundle leaf '$expectedLeaf': $BundlePath"
    }

    $reparsePoints = @(
        Get-ChildItem -LiteralPath $BundlePath -Force -Recurse |
            Where-Object {
                ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
            }
    )
    if ($reparsePoints.Count -ne 0) {
        throw "Bundle contains a reparse point: $($reparsePoints[0].FullName)"
    }

    $innerModule = Join-Path $BundlePath "Contents\x86_64-win\$expectedLeaf"
    if (-not (Test-Path -LiteralPath $innerModule -PathType Leaf)) {
        throw "Bundle inner module is missing: $innerModule"
    }
}

function Invoke-ValidatorRun {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$ReportPath,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedProductName,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedControllerName,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedProcessorFuid,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedControllerFuid,

        [Parameter(Mandatory = $true)]
        [string]$Mode
    )

    $renderedArguments = @($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    Write-Output "Command: `"$ExecutablePath`" $renderedArguments"

    $previousErrorActionPreference = $ErrorActionPreference
    $nativeOutput = @()
    $validatorExitCode = $null
    try {
        $ErrorActionPreference = 'Continue'
        $global:LASTEXITCODE = $null
        $nativeOutput = @(& $ExecutablePath @Arguments 2>&1)
        $validatorExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $reportLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $nativeOutput) {
        $renderedLine = [string]$line
        $reportLines.Add($renderedLine)
        Write-Output $renderedLine
    }
    $reportText = $reportLines -join "`n"
    if ($reportText.Length -ne 0) {
        $reportText += "`n"
    }
    Assert-NoReparsePointInOutPath -Path $ReportPath -Description 'Validator report'
    [IO.File]::WriteAllText($ReportPath, $reportText, $utf8NoBom)

    Write-Output "Exit code: $validatorExitCode"
    if ($null -eq $validatorExitCode -or $validatorExitCode -ne 0) {
        throw "Validator $Mode run failed with exit code $validatorExitCode. Raw report: $ReportPath"
    }
    $resultMatches = [Text.RegularExpressions.Regex]::Matches(
        $reportText,
        '(?m)^Result: ([0-9]+) tests passed, 0 tests failed\r?$'
    )
    $expectedPassedTests = if ($Mode -ceq 'standard') { 47 } else { 537 }
    if ($resultMatches.Count -ne 1 -or
        [int]$resultMatches[0].Groups[1].Value -ne $expectedPassedTests) {
        throw "Validator $Mode report must contain exactly one $expectedPassedTests-pass/zero-failure result: $ReportPath"
    }
    if ([Text.RegularExpressions.Regex]::IsMatch(
            $reportText,
            '(?im)^\s*(?:(?:Info:\s+)?Warning:|Error:|\[[^\]]*Failed[^\]]*\])'
        )) {
        throw "Validator $Mode report contains a warning or failure marker: $ReportPath"
    }
    if (-not [Text.RegularExpressions.Regex]::IsMatch(
            $reportText,
            '(?m)^\s*vendor = Garak\r?$'
        )) {
        throw "Validator $Mode report did not discover the Garak factory: $ReportPath"
    }
    $processorNameMatches = [Text.RegularExpressions.Regex]::Matches(
        $reportText,
        '(?m)^\s*name = ' +
            [Text.RegularExpressions.Regex]::Escape($ExpectedProductName) + '\r?$'
    )
    $controllerNameMatches = [Text.RegularExpressions.Regex]::Matches(
        $reportText,
        '(?m)^\s*name = ' +
            [Text.RegularExpressions.Regex]::Escape($ExpectedControllerName) + '\r?$'
    )
    if ($processorNameMatches.Count -ne 1 -or $controllerNameMatches.Count -ne 1) {
        throw "Validator $Mode report did not discover the exact product/controller names: $ReportPath"
    }
    $classInfoMatches = [Text.RegularExpressions.Regex]::Matches(
        $reportText,
        '(?m)^\s*Class Info [0-9]+:\r?$'
    )
    if ($classInfoMatches.Count -ne 2 -or
        -not [Text.RegularExpressions.Regex]::IsMatch(
            $reportText,
            '(?m)^\s*category = Audio Module Class\r?$'
        ) -or
        -not [Text.RegularExpressions.Regex]::IsMatch(
            $reportText,
            '(?m)^\s*category = Component Controller Class\r?$'
        ) -or
        [Text.RegularExpressions.Regex]::Matches(
            $reportText,
            '(?m)^\s*cid = ' +
                [Text.RegularExpressions.Regex]::Escape($ExpectedProcessorFuid) + '\r?$'
        ).Count -ne 1 -or
        [Text.RegularExpressions.Regex]::Matches(
            $reportText,
            '(?m)^\s*cid = ' +
                [Text.RegularExpressions.Regex]::Escape($ExpectedControllerFuid) + '\r?$'
        ).Count -ne 1) {
        throw "Validator $Mode report did not discover exactly two expected classes/FUIDs: $ReportPath"
    }
}

$artifactRoot = Resolve-OutArtifact -Path $ArtifactRootPath -Kind Container `
    -Description 'Runtime strategy artifact root'
$validator = Resolve-OutArtifact -Path $ValidatorPath -Kind File -Description 'Validator'
if ([IO.Path]::GetFileName($validator) -ine 'validator.exe') {
    throw "Expected an explicit validator.exe path: $validator"
}
if (-not (Test-PathContainedBy -CandidatePath $validator -BoundaryPath $artifactRoot)) {
    throw "Validator must be inside the explicit artifact root: $validator"
}

$bundleInputs = @(
    [pscustomobject]@{
        ProductName = 'Garak Gain Spike'
        ControllerName = 'Garak Gain Spike Controller'
        ProcessorFuid = '3D6F3C09296D49EF99334C4688F484EE'
        ControllerFuid = '2CD50BAE587A4F3E812399E550F352D4'
        Slug = 'gain-spike'
        Path = Resolve-OutArtifact -Path $GainSpikeBundlePath -Kind Container `
            -Description 'Garak Gain Spike bundle'
    },
    [pscustomobject]@{
        ProductName = 'Garak Data Alpha'
        ControllerName = 'Garak Data Alpha Controller'
        ProcessorFuid = '4B2B557251D44CE9914F9B105136FB7E'
        ControllerFuid = '7A90454628B34A3497F05E7CC718F8A1'
        Slug = 'data-alpha'
        Path = Resolve-OutArtifact -Path $DataAlphaBundlePath -Kind Container `
            -Description 'Garak Data Alpha bundle'
    },
    [pscustomobject]@{
        ProductName = 'Garak Data Beta'
        ControllerName = 'Garak Data Beta Controller'
        ProcessorFuid = 'C29B7245261642668ADAC664B6817678'
        ControllerFuid = '1DE08859308F4A0A8473EA5CB70771D2'
        Slug = 'data-beta'
        Path = Resolve-OutArtifact -Path $DataBetaBundlePath -Kind Container `
            -Description 'Garak Data Beta bundle'
    },
    [pscustomobject]@{
        ProductName = 'Garak Thin Alpha'
        ControllerName = 'Garak Thin Alpha Controller'
        ProcessorFuid = '93952A37BFA84FF1AC06CE58B9FA87EA'
        ControllerFuid = 'E08F3ACCD825424AB238BBAB6B0248CC'
        Slug = 'thin-alpha'
        Path = Resolve-OutArtifact -Path $ThinAlphaBundlePath -Kind Container `
            -Description 'Garak Thin Alpha bundle'
    },
    [pscustomobject]@{
        ProductName = 'Garak Thin Beta'
        ControllerName = 'Garak Thin Beta Controller'
        ProcessorFuid = '44BFB8B6F56946FF9F6F193529BCB967'
        ControllerFuid = '826C362FA2784F719351912BE834F9AB'
        Slug = 'thin-beta'
        Path = Resolve-OutArtifact -Path $ThinBetaBundlePath -Kind Container `
            -Description 'Garak Thin Beta bundle'
    }
)

$seenPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($bundle in $bundleInputs) {
    Assert-BundleInput -BundlePath $bundle.Path -ExpectedProductName $bundle.ProductName
    if (-not (Test-PathContainedBy -CandidatePath $bundle.Path -BoundaryPath $artifactRoot)) {
        throw "Bundle must be inside the explicit artifact root: $($bundle.Path)"
    }
    if (-not $seenPaths.Add($bundle.Path)) {
        throw "Bundle paths must be distinct: $($bundle.Path)"
    }
}

$reportRoot = ConvertTo-RepositoryAbsolutePath -Path $ReportDirectory
Assert-PathUnderOut -Path $reportRoot -Description 'Report directory'
Assert-NoReparsePointInOutPath -Path $reportRoot -Description 'Report directory'
foreach ($bundle in $bundleInputs) {
    if (Test-PathContainedBy -CandidatePath $reportRoot -BoundaryPath $bundle.Path `
            -AllowBoundary) {
        throw "Report directory must not be inside a plugin bundle: $($bundle.Path)"
    }
}
$null = New-Item -ItemType Directory -Force -Path $reportRoot

$configurationSlug = $Configuration.ToLowerInvariant()
$runCount = 0
foreach ($bundle in $bundleInputs) {
    $standardReport = Join-Path $reportRoot (
        "$configurationSlug-$($bundle.Slug)-validator-standard.txt"
    )
    Invoke-ValidatorRun -ExecutablePath $validator -Arguments @($bundle.Path) `
        -ReportPath $standardReport -ExpectedProductName $bundle.ProductName `
        -ExpectedControllerName $bundle.ControllerName `
        -ExpectedProcessorFuid $bundle.ProcessorFuid `
        -ExpectedControllerFuid $bundle.ControllerFuid -Mode 'standard'
    ++$runCount

    $extensiveReport = Join-Path $reportRoot (
        "$configurationSlug-$($bundle.Slug)-validator-extensive.txt"
    )
    Invoke-ValidatorRun -ExecutablePath $validator -Arguments @('-e', $bundle.Path) `
        -ReportPath $extensiveReport -ExpectedProductName $bundle.ProductName `
        -ExpectedControllerName $bundle.ControllerName `
        -ExpectedProcessorFuid $bundle.ProcessorFuid `
        -ExpectedControllerFuid $bundle.ControllerFuid -Mode 'extensive'
    ++$runCount
}

Write-Output "Validated configuration: $Configuration"
Write-Output "Validator runs: $runCount"
Write-Output "Raw reports: $reportRoot"
