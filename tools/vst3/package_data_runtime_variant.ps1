[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TemplateBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$DescriptorPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$ModuleInfoToolPath,

    [switch]$VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (Test-Path -LiteralPath 'variable:PSNativeCommandUseErrorActionPreference') {
    $PSNativeCommandUseErrorActionPreference = $false
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$outRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'out'))
$pathComparison = [StringComparison]::OrdinalIgnoreCase

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

    if (-not (Test-PathContainedBy -CandidatePath $CandidatePath -BoundaryPath $BoundaryPath `
            -AllowBoundary:$AllowBoundary)) {
        throw "$Description escaped its allowed boundary: $CandidatePath"
    }
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

function Resolve-ExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ValidateSet('File', 'Container')]
        [string]$Kind,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [string]$BoundaryPath
    )

    $absolutePath = ConvertTo-RepositoryAbsolutePath -Path $Path
    Assert-PathContainedBy -CandidatePath $absolutePath -BoundaryPath $BoundaryPath `
        -Description $Description

    $pathType = if ($Kind -eq 'File') { 'Leaf' } else { 'Container' }
    if (-not (Test-Path -LiteralPath $absolutePath -PathType $pathType)) {
        throw "$Description does not exist as a $Kind`: $absolutePath"
    }

    Assert-NoReparsePointInPath -CandidatePath $absolutePath -BoundaryPath $BoundaryPath `
        -Description $Description
    return [IO.Path]::GetFullPath((Get-Item -LiteralPath $absolutePath -Force).FullName)
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

function Assert-TextField {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,

        [Parameter(Mandatory = $true)]
        [int]$MaximumBytes,

        [Parameter(Mandatory = $true)]
        [string]$FieldName
    )

    if ($Value.Length -eq 0 -or $Value.Length -gt $MaximumBytes) {
        throw "$FieldName must contain 1..$MaximumBytes ASCII bytes."
    }
    if (-not [Text.RegularExpressions.Regex]::IsMatch($Value, '^[\x20-\x7E]+$')) {
        throw "$FieldName must contain printable ASCII only."
    }
    if ($Value.IndexOfAny([char[]]@('=', '/', '\')) -ge 0) {
        throw "$FieldName contains a forbidden separator or '=' character."
    }
}

function Read-ProductDescriptor {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 1024) {
        throw "Descriptor must contain 1..1024 bytes: $Path"
    }
    if ($bytes[$bytes.Length - 1] -ne 0x0A) {
        throw "Descriptor must end with one LF newline: $Path"
    }

    foreach ($byte in $bytes) {
        if ($byte -eq 0x0A) {
            continue
        }
        if ($byte -lt 0x20 -or $byte -gt 0x7E) {
            throw "Descriptor must be the strict ASCII subset with LF-only newlines: $Path"
        }
    }

    $text = [Text.Encoding]::ASCII.GetString($bytes)
    $lines = @($text.Substring(0, $text.Length - 1).Split([char]0x0A))
    if ($lines.Count -ne 11) {
        throw "Descriptor must contain exactly 11 lines; found $($lines.Count): $Path"
    }
    if ($lines[0] -cne 'GARAK_PRODUCT_SPIKE_V1') {
        throw 'Descriptor line 1 must be GARAK_PRODUCT_SPIKE_V1.'
    }
    if ($lines[1] -cne 'schema=1') {
        throw 'Descriptor line 2 must be schema=1.'
    }

    $keys = @(
        'vendor',
        'product_name',
        'semantic_version',
        'processor_fuid',
        'controller_fuid',
        'gain_parameter_id',
        'bypass_parameter_id',
        'default_gain_db',
        'category'
    )
    $values = [ordered]@{}
    for ($index = 0; $index -lt $keys.Count; ++$index) {
        $prefix = $keys[$index] + '='
        $line = $lines[$index + 2]
        if (-not $line.StartsWith($prefix, [StringComparison]::Ordinal)) {
            throw "Descriptor line $($index + 3) must begin with '$prefix'."
        }
        $values[$keys[$index]] = $line.Substring($prefix.Length)
    }

    Assert-TextField -Value $values.vendor -MaximumBytes 63 -FieldName 'vendor'
    Assert-TextField -Value $values.semantic_version -MaximumBytes 63 `
        -FieldName 'semantic_version'
    Assert-TextField -Value $values.category -MaximumBytes 31 -FieldName 'category'

    $productName = [string]$values.product_name
    if ($productName.Length -eq 0 -or $productName.Length -gt 63) {
        throw 'product_name must contain 1..63 ASCII bytes.'
    }
    if (-not [Text.RegularExpressions.Regex]::IsMatch(
            $productName,
            '^[A-Za-z0-9 ._-]+$'
        )) {
        throw 'product_name contains a character that is unsafe in a Windows bundle filename.'
    }
    if ($productName[0] -eq ' ' -or $productName[0] -eq '.' -or
        $productName[$productName.Length - 1] -eq ' ' -or
        $productName[$productName.Length - 1] -eq '.') {
        throw 'product_name must not begin or end with a space or dot.'
    }

    $fuidPattern = '^[0-9A-F]{32}$'
    if (-not [Text.RegularExpressions.Regex]::IsMatch($values.processor_fuid, $fuidPattern)) {
        throw 'processor_fuid must be exactly 32 uppercase hexadecimal characters.'
    }
    if (-not [Text.RegularExpressions.Regex]::IsMatch($values.controller_fuid, $fuidPattern)) {
        throw 'controller_fuid must be exactly 32 uppercase hexadecimal characters.'
    }
    if ($values.processor_fuid -ceq $values.controller_fuid) {
        throw 'processor_fuid and controller_fuid must be different.'
    }
    if ($values.processor_fuid -ceq ('0' * 32) -or
        $values.controller_fuid -ceq ('0' * 32)) {
        throw 'processor_fuid and controller_fuid must be non-zero.'
    }

    $gainParameterId = [long]0
    $bypassParameterId = [long]0
    $integerStyle = [Globalization.NumberStyles]::None
    $invariantCulture = [Globalization.CultureInfo]::InvariantCulture
    if (-not [Text.RegularExpressions.Regex]::IsMatch(
            $values.gain_parameter_id,
            '^[0-9]+$'
        ) -or
        -not [long]::TryParse(
            $values.gain_parameter_id,
            $integerStyle,
            $invariantCulture,
            [ref]$gainParameterId
        ) -or
        $gainParameterId -lt 1 -or $gainParameterId -gt [int]::MaxValue) {
        throw 'gain_parameter_id must be a decimal integer in 1..INT32_MAX.'
    }
    if (-not [Text.RegularExpressions.Regex]::IsMatch(
            $values.bypass_parameter_id,
            '^[0-9]+$'
        ) -or
        -not [long]::TryParse(
            $values.bypass_parameter_id,
            $integerStyle,
            $invariantCulture,
            [ref]$bypassParameterId
        ) -or
        $bypassParameterId -lt 1 -or $bypassParameterId -gt [int]::MaxValue) {
        throw 'bypass_parameter_id must be a decimal integer in 1..INT32_MAX.'
    }
    if ($gainParameterId -eq $bypassParameterId) {
        throw 'gain_parameter_id and bypass_parameter_id must be different.'
    }

    $defaultGain = [double]0.0
    $floatPattern = '^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$'
    if (-not [Text.RegularExpressions.Regex]::IsMatch(
            $values.default_gain_db,
            $floatPattern
        ) -or
        -not [double]::TryParse(
            $values.default_gain_db,
            [Globalization.NumberStyles]::Float,
            $invariantCulture,
            [ref]$defaultGain
        ) -or
        [double]::IsNaN($defaultGain) -or [double]::IsInfinity($defaultGain) -or
        $defaultGain -lt -60.0 -or $defaultGain -gt 12.0) {
        throw 'default_gain_db must be a finite decimal value in -60..+12.'
    }

    if ($values.vendor -cne 'Garak' -or $values.semantic_version -cne '0.1.0' -or
        $values.category -cne 'Fx' -or $values.gain_parameter_id -cne '1001' -or
        $values.bypass_parameter_id -cne '1002') {
        throw 'Descriptor does not match the fixed Phase 1B vendor/version/category/parameter contract.'
    }

    if ($productName -ceq 'Garak Data Alpha') {
        $expectedProduct = [pscustomobject]@{
            ProcessorFuid = '4B2B557251D44CE9914F9B105136FB7E'
            ControllerFuid = '7A90454628B34A3497F05E7CC718F8A1'
            DefaultGainText = '-6.0'
        }
    }
    elseif ($productName -ceq 'Garak Data Beta') {
        $expectedProduct = [pscustomobject]@{
            ProcessorFuid = 'C29B7245261642668ADAC664B6817678'
            ControllerFuid = '1DE08859308F4A0A8473EA5CB70771D2'
            DefaultGainText = '3.0'
        }
    }
    else {
        throw 'product_name must be exactly Garak Data Alpha or Garak Data Beta.'
    }
    if ($values.processor_fuid -cne $expectedProduct.ProcessorFuid -or
        $values.controller_fuid -cne $expectedProduct.ControllerFuid -or
        $values.default_gain_db -cne $expectedProduct.DefaultGainText) {
        throw "Descriptor identity/default does not match the fixed $productName contract."
    }

    return [pscustomobject]@{
        Vendor = [string]$values.vendor
        ProductName = $productName
        SemanticVersion = [string]$values.semantic_version
        ProcessorFuid = [string]$values.processor_fuid
        ControllerFuid = [string]$values.controller_fuid
        GainParameterId = [int]$gainParameterId
        BypassParameterId = [int]$bypassParameterId
        DefaultGainDb = $defaultGain
        Category = [string]$values.category
    }
}

function ConvertTo-ModuleInfoToolPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [IO.Path]::GetFullPath($Path).Replace('\', '/')
}

function Assert-GeneratedModuleInfoIdentity {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [pscustomobject]$Descriptor
    )

    $file = Get-Item -LiteralPath $Path -ErrorAction Stop
    if ($file.Length -le 0 -or $file.Length -gt 65536) {
        throw "moduleinfo.json must contain 1..65536 bytes: $Path"
    }

    $text = [IO.File]::ReadAllText($file.FullName)
    $regexOptions = [Text.RegularExpressions.RegexOptions]::Singleline -bor
        [Text.RegularExpressions.RegexOptions]::CultureInvariant
    $escapedProduct = [Text.RegularExpressions.Regex]::Escape($Descriptor.ProductName)
    $escapedVersion = [Text.RegularExpressions.Regex]::Escape($Descriptor.SemanticVersion)
    $escapedVendor = [Text.RegularExpressions.Regex]::Escape($Descriptor.Vendor)
    $rootPattern = '^\s*\{\s*"Name"\s*:\s*"' + $escapedProduct +
        '"\s*,\s*"Version"\s*:\s*"' + $escapedVersion +
        '"\s*,\s*"Factory Info"\s*:\s*\{\s*"Vendor"\s*:\s*"' +
        $escapedVendor + '"'
    if (-not [Text.RegularExpressions.Regex]::IsMatch(
            $text,
            $rootPattern,
            $regexOptions
        )) {
        throw 'moduleinfo.json root Name/Version/Factory Vendor does not match the descriptor.'
    }

    $cidCount = [Text.RegularExpressions.Regex]::Matches(
        $text,
        '"CID"\s*:',
        $regexOptions
    ).Count
    if ($cidCount -ne 2) {
        throw "moduleinfo.json must contain exactly two classes; found $cidCount."
    }

    foreach ($fuid in @($Descriptor.ProcessorFuid, $Descriptor.ControllerFuid)) {
        $cidPattern = '"CID"\s*:\s*"' +
            [Text.RegularExpressions.Regex]::Escape($fuid) + '"'
        if ([Text.RegularExpressions.Regex]::Matches(
                $text,
                $cidPattern,
                $regexOptions
            ).Count -ne 1) {
            throw "moduleinfo.json must contain the expected CID exactly once: $fuid"
        }
    }

    $processorNamePattern = '"Name"\s*:\s*"' + $escapedProduct + '"'
    $controllerNamePattern = '"Name"\s*:\s*"' + $escapedProduct + ' Controller"'
    if ([Text.RegularExpressions.Regex]::Matches(
            $text,
            $processorNamePattern,
            $regexOptions
        ).Count -ne 2 -or
        [Text.RegularExpressions.Regex]::Matches(
            $text,
            $controllerNamePattern,
            $regexOptions
        ).Count -ne 1) {
        throw 'moduleinfo.json class names do not match the descriptor identity.'
    }
}

function Invoke-CheckedNativeTool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$Operation
    )

    $renderedArguments = @($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    Write-Output "Command: `"$ExecutablePath`" $renderedArguments"
    $previousErrorActionPreference = $ErrorActionPreference
    $toolOutput = @()
    $exitCode = $null
    try {
        $ErrorActionPreference = 'Continue'
        $global:LASTEXITCODE = $null
        $toolOutput = @(& $ExecutablePath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    foreach ($line in $toolOutput) {
        Write-Output $line
    }
    Write-Output "Exit code: $exitCode"
    if ($null -eq $exitCode -or $exitCode -ne 0) {
        throw "$Operation failed with exit code $exitCode."
    }
}

function Assert-ExactBundleFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundlePath,

        [Parameter(Mandatory = $true)]
        [string[]]$ExpectedRelativePaths
    )

    Assert-NoReparsePointsBelow -RootPath $BundlePath -Description 'Staged bundle'
    $actualDirectories = [System.Collections.Generic.List[string]]::new()
    foreach ($directory in @(
            Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -Directory
        )) {
        $relativePath = $directory.FullName.Substring($BundlePath.Length).TrimStart('\', '/')
        $actualDirectories.Add($relativePath.Replace('/', '\'))
    }
    $actualDirectoryArray = $actualDirectories.ToArray()
    $expectedDirectories = [string[]]@(
        'Contents',
        'Contents\Resources',
        'Contents\x86_64-win'
    )
    [Array]::Sort($actualDirectoryArray, [StringComparer]::Ordinal)
    [Array]::Sort($expectedDirectories, [StringComparer]::Ordinal)
    if ($actualDirectoryArray.Count -ne $expectedDirectories.Count) {
        throw "Bundle directory count mismatch. Expected $($expectedDirectories.Count), found $($actualDirectoryArray.Count)."
    }
    for ($index = 0; $index -lt $expectedDirectories.Count; ++$index) {
        if ($actualDirectoryArray[$index] -cne $expectedDirectories[$index]) {
            throw "Unexpected bundle directory. Expected '$($expectedDirectories[$index])', found '$($actualDirectoryArray[$index])'."
        }
    }

    $actualPaths = [System.Collections.Generic.List[string]]::new()
    foreach ($file in @(Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -File)) {
        $relativePath = $file.FullName.Substring($BundlePath.Length).TrimStart('\', '/')
        $actualPaths.Add($relativePath.Replace('/', '\'))
    }

    $actual = $actualPaths.ToArray()
    $expected = [string[]]$ExpectedRelativePaths.Clone()
    [Array]::Sort($actual, [StringComparer]::Ordinal)
    [Array]::Sort($expected, [StringComparer]::Ordinal)

    if ($actual.Count -ne $expected.Count) {
        throw "Bundle file count mismatch. Expected $($expected.Count), found $($actual.Count)."
    }
    for ($index = 0; $index -lt $expected.Count; ++$index) {
        if ($actual[$index] -cne $expected[$index]) {
            throw "Unexpected bundle file. Expected '$($expected[$index])', found '$($actual[$index])'."
        }
    }
}

$templateBundle = Resolve-ExistingPath -Path $TemplateBundlePath -Kind Container `
    -Description 'Template bundle' -BoundaryPath $outRoot
$descriptorFile = Resolve-ExistingPath -Path $DescriptorPath -Kind File `
    -Description 'Descriptor source' -BoundaryPath $repositoryRoot
$moduleInfoTool = Resolve-ExistingPath -Path $ModuleInfoToolPath -Kind File `
    -Description 'moduleinfotool' -BoundaryPath $outRoot
$outputBundle = ConvertTo-RepositoryAbsolutePath -Path $OutputBundlePath

Assert-PathContainedBy -CandidatePath $outputBundle -BoundaryPath $outRoot `
    -Description 'Output bundle'
Assert-NoReparsePointInPath -CandidatePath $outputBundle -BoundaryPath $outRoot `
    -Description 'Output bundle'
Assert-NoReparsePointsBelow -RootPath $templateBundle -Description 'Template bundle'

if ([IO.Path]::GetFileName($moduleInfoTool) -ine 'moduleinfotool.exe') {
    throw "Expected an explicit moduleinfotool.exe path: $moduleInfoTool"
}
if ([IO.Path]::GetExtension($templateBundle) -ine '.vst3') {
    throw "Template bundle must have the .vst3 extension: $templateBundle"
}
if (Test-PathsOverlap -FirstPath $templateBundle -SecondPath $outputBundle) {
    throw 'Template and output bundle paths must not overlap.'
}
if (Test-PathContainedBy -CandidatePath $descriptorFile -BoundaryPath $outputBundle `
        -AllowBoundary) {
    throw 'Descriptor source must not be inside the replaceable output bundle.'
}
if (Test-PathContainedBy -CandidatePath $moduleInfoTool -BoundaryPath $outputBundle `
        -AllowBoundary) {
    throw 'moduleinfotool must not be inside the replaceable output bundle.'
}

$descriptor = Read-ProductDescriptor -Path $descriptorFile
$outputLeaf = [IO.Path]::GetFileName($outputBundle)
$expectedOutputLeaf = $descriptor.ProductName + '.vst3'
if ($outputLeaf -cne $expectedOutputLeaf) {
    throw "Output bundle leaf must be '$expectedOutputLeaf'; received '$outputLeaf'."
}

$templateLeaf = [IO.Path]::GetFileName($templateBundle)
$templateInnerModule = Join-Path $templateBundle "Contents\x86_64-win\$templateLeaf"
if (-not (Test-Path -LiteralPath $templateInnerModule -PathType Leaf)) {
    throw "Template inner module is missing: $templateInnerModule"
}
Assert-NoReparsePointInPath -CandidatePath $templateInnerModule -BoundaryPath $outRoot `
    -Description 'Template inner module'

$outputParent = [IO.Path]::GetDirectoryName($outputBundle)
Assert-PathContainedBy -CandidatePath $outputParent -BoundaryPath $outRoot `
    -Description 'Output parent' -AllowBoundary
Assert-NoReparsePointInPath -CandidatePath $outputParent -BoundaryPath $outRoot `
    -Description 'Output parent'

if ($VerifyOnly) {
    if (-not (Test-Path -LiteralPath $outputBundle -PathType Container)) {
        throw "Packaged output bundle is missing: $outputBundle"
    }
    Assert-NoReparsePointsBelow -RootPath $outputBundle -Description 'Packaged output bundle'

    $outputInnerModule = Join-Path $outputBundle "Contents\x86_64-win\$outputLeaf"
    $outputDescriptor = Join-Path $outputBundle `
        'Contents\Resources\garak-product-spike-v1.txt'
    $outputModuleInfo = Join-Path $outputBundle 'Contents\Resources\moduleinfo.json'
    Assert-ExactBundleFiles -BundlePath $outputBundle -ExpectedRelativePaths @(
        "Contents\x86_64-win\$outputLeaf",
        'Contents\Resources\garak-product-spike-v1.txt',
        'Contents\Resources\moduleinfo.json'
    )

    $templateHash = (Get-FileHash -LiteralPath $templateInnerModule -Algorithm SHA256).Hash
    $outputModuleHash = (Get-FileHash -LiteralPath $outputInnerModule -Algorithm SHA256).Hash
    if ($outputModuleHash -cne $templateHash) {
        throw 'Packaged inner module does not match the template SHA-256.'
    }

    $descriptorHash = (Get-FileHash -LiteralPath $descriptorFile -Algorithm SHA256).Hash
    $outputDescriptorHash = (Get-FileHash -LiteralPath $outputDescriptor `
            -Algorithm SHA256).Hash
    if ($outputDescriptorHash -cne $descriptorHash) {
        throw 'Packaged descriptor does not match the descriptor source SHA-256.'
    }
    if ((Get-Item -LiteralPath $outputModuleInfo).Length -eq 0) {
        throw "Packaged moduleinfo.json is empty: $outputModuleInfo"
    }

    Invoke-CheckedNativeTool -ExecutablePath $moduleInfoTool -Arguments @(
        '-validate',
        '-path',
        (ConvertTo-ModuleInfoToolPath -Path $outputBundle),
        '-infopath',
        (ConvertTo-ModuleInfoToolPath -Path $outputModuleInfo)
    ) -Operation 'moduleinfotool validate packaged bundle'
    Assert-GeneratedModuleInfoIdentity -Path $outputModuleInfo -Descriptor $descriptor

    Write-Output "Verified bundle: $outputBundle"
    Write-Output "Product: $($descriptor.ProductName)"
    Write-Output "Inner module SHA-256: $outputModuleHash"
    Write-Output "Descriptor SHA-256: $outputDescriptorHash"
    return
}

$null = New-Item -ItemType Directory -Force -Path $outputParent

if (Test-Path -LiteralPath $outputBundle) {
    if (-not (Test-Path -LiteralPath $outputBundle -PathType Container)) {
        throw "Output bundle exists but is not a directory: $outputBundle"
    }
    Assert-NoReparsePointsBelow -RootPath $outputBundle -Description 'Existing output bundle'
}

$transactionId = [Guid]::NewGuid().ToString('N')
$stageParent = Join-Path $outputParent ".runtime-strategy-package-stage-$transactionId"
$stageBundle = Join-Path $stageParent $outputLeaf
$backupBundle = Join-Path $outputParent "$outputLeaf.runtime-strategy-backup-$transactionId"
$stageInnerDirectory = Join-Path $stageBundle 'Contents\x86_64-win'
$stageResourcesDirectory = Join-Path $stageBundle 'Contents\Resources'
$stageInnerModule = Join-Path $stageInnerDirectory $outputLeaf
$stageDescriptor = Join-Path $stageResourcesDirectory 'garak-product-spike-v1.txt'
$stageModuleInfo = Join-Path $stageResourcesDirectory 'moduleinfo.json'
$backupMoved = $false
$replacementInstalled = $false
$completed = $false

try {
    $null = New-Item -ItemType Directory -Path $stageInnerDirectory
    $null = New-Item -ItemType Directory -Path $stageResourcesDirectory
    Copy-Item -LiteralPath $templateInnerModule -Destination $stageInnerModule
    Copy-Item -LiteralPath $descriptorFile -Destination $stageDescriptor

    $templateHash = (Get-FileHash -LiteralPath $templateInnerModule -Algorithm SHA256).Hash
    $stagedHash = (Get-FileHash -LiteralPath $stageInnerModule -Algorithm SHA256).Hash
    if ($templateHash -cne $stagedHash) {
        throw 'Staged inner module does not match the template SHA-256.'
    }

    Invoke-CheckedNativeTool -ExecutablePath $moduleInfoTool -Arguments @(
        '-create',
        '-version',
        $descriptor.SemanticVersion,
        '-path',
        (ConvertTo-ModuleInfoToolPath -Path $stageBundle),
        '-output',
        (ConvertTo-ModuleInfoToolPath -Path $stageModuleInfo)
    ) -Operation 'moduleinfotool create'

    if (-not (Test-Path -LiteralPath $stageModuleInfo -PathType Leaf) -or
        (Get-Item -LiteralPath $stageModuleInfo).Length -eq 0) {
        throw "moduleinfotool did not create a non-empty moduleinfo.json: $stageModuleInfo"
    }

    Invoke-CheckedNativeTool -ExecutablePath $moduleInfoTool -Arguments @(
        '-validate',
        '-path',
        (ConvertTo-ModuleInfoToolPath -Path $stageBundle),
        '-infopath',
        (ConvertTo-ModuleInfoToolPath -Path $stageModuleInfo)
    ) -Operation 'moduleinfotool validate staged bundle'
    Assert-GeneratedModuleInfoIdentity -Path $stageModuleInfo -Descriptor $descriptor

    Assert-ExactBundleFiles -BundlePath $stageBundle -ExpectedRelativePaths @(
        "Contents\x86_64-win\$outputLeaf",
        'Contents\Resources\garak-product-spike-v1.txt',
        'Contents\Resources\moduleinfo.json'
    )

    if (Test-Path -LiteralPath $outputBundle) {
        Move-Item -LiteralPath $outputBundle -Destination $backupBundle
        $backupMoved = $true
    }

    Move-Item -LiteralPath $stageBundle -Destination $outputBundle
    $replacementInstalled = $true

    Invoke-CheckedNativeTool -ExecutablePath $moduleInfoTool -Arguments @(
        '-validate',
        '-path',
        (ConvertTo-ModuleInfoToolPath -Path $outputBundle),
        '-infopath',
        (ConvertTo-ModuleInfoToolPath -Path (
                Join-Path $outputBundle 'Contents\Resources\moduleinfo.json'
            ))
    ) -Operation 'moduleinfotool validate final bundle'
    Assert-GeneratedModuleInfoIdentity -Path (
        Join-Path $outputBundle 'Contents\Resources\moduleinfo.json'
    ) -Descriptor $descriptor

    $finalInnerModule = Join-Path $outputBundle "Contents\x86_64-win\$outputLeaf"
    $finalHash = (Get-FileHash -LiteralPath $finalInnerModule -Algorithm SHA256).Hash
    if ($finalHash -cne $templateHash) {
        throw 'Final inner module does not match the template SHA-256.'
    }

    $completed = $true
}
catch {
    $failure = $_
    if ($replacementInstalled -and (Test-Path -LiteralPath $outputBundle)) {
        Remove-Item -LiteralPath $outputBundle -Recurse -Force
        $replacementInstalled = $false
    }
    if ($backupMoved -and (Test-Path -LiteralPath $backupBundle)) {
        Move-Item -LiteralPath $backupBundle -Destination $outputBundle
        $backupMoved = $false
    }
    throw $failure
}
finally {
    if (Test-Path -LiteralPath $stageParent) {
        Remove-Item -LiteralPath $stageParent -Recurse -Force
    }
    if ($completed -and $backupMoved -and (Test-Path -LiteralPath $backupBundle)) {
        Remove-Item -LiteralPath $backupBundle -Recurse -Force
        $backupMoved = $false
    }
}

$finalFiles = @(Get-ChildItem -LiteralPath $outputBundle -Force -Recurse -File)
$totalBytes = [long]0
foreach ($file in $finalFiles) {
    $totalBytes += $file.Length
}
$finalModulePath = Join-Path $outputBundle "Contents\x86_64-win\$outputLeaf"
$finalModuleHash = (Get-FileHash -LiteralPath $finalModulePath -Algorithm SHA256).Hash

Write-Output "Packaged bundle: $outputBundle"
Write-Output "Product: $($descriptor.ProductName)"
Write-Output "Inner module SHA-256: $finalModuleHash"
Write-Output "Inner module bytes: $((Get-Item -LiteralPath $finalModulePath).Length)"
Write-Output "Bundle files: $($finalFiles.Count)"
Write-Output "Bundle bytes: $totalBytes"
