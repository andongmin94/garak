[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration,

    [Parameter(Mandatory = $true)]
    [string]$ArtifactRootPath,

    [Parameter(Mandatory = $true)]
    [string]$TemplateBundlePath,

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
    [string]$ReportPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

function Resolve-OutBundle {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $absolutePath = ConvertTo-RepositoryAbsolutePath -Path $Path
    Assert-PathUnderOut -Path $absolutePath -Description $Description
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Container)) {
        throw "$Description does not exist as a directory: $absolutePath"
    }
    Assert-NoReparsePointInOutPath -Path $absolutePath -Description $Description

    $reparsePoints = @(
        Get-ChildItem -LiteralPath $absolutePath -Force -Recurse |
            Where-Object {
                ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
            }
    )
    if ($reparsePoints.Count -ne 0) {
        throw "$Description contains a reparse point: $($reparsePoints[0].FullName)"
    }

    $resolvedPath = [IO.Path]::GetFullPath(
        (Get-Item -LiteralPath $absolutePath -Force).FullName
    )
    if ([IO.Path]::GetExtension($resolvedPath) -ine '.vst3') {
        throw "$Description must have the .vst3 extension: $resolvedPath"
    }
    return $resolvedPath
}

function Read-UInt16LittleEndian {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Bytes,

        [Parameter(Mandatory = $true)]
        [long]$Offset,

        [Parameter(Mandatory = $true)]
        [string]$Context
    )

    if ($Offset -lt 0 -or $Offset + 2 -gt $Bytes.LongLength) {
        throw "PE field '$Context' is outside the file."
    }
    return [BitConverter]::ToUInt16($Bytes, [int]$Offset)
}

function Read-UInt32LittleEndian {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Bytes,

        [Parameter(Mandatory = $true)]
        [long]$Offset,

        [Parameter(Mandatory = $true)]
        [string]$Context
    )

    if ($Offset -lt 0 -or $Offset + 4 -gt $Bytes.LongLength) {
        throw "PE field '$Context' is outside the file."
    }
    return [BitConverter]::ToUInt32($Bytes, [int]$Offset)
}

function Convert-RvaToFileOffset {
    param(
        [Parameter(Mandatory = $true)]
        [uint32]$Rva,

        [Parameter(Mandatory = $true)]
        [object[]]$Sections,

        [Parameter(Mandatory = $true)]
        [uint32]$SizeOfHeaders,

        [Parameter(Mandatory = $true)]
        [long]$FileLength
    )

    if ([uint64]$Rva -lt [uint64]$SizeOfHeaders -and [uint64]$Rva -lt [uint64]$FileLength) {
        return [long]$Rva
    }

    foreach ($section in $Sections) {
        $sectionSpan = [Math]::Max([uint64]$section.VirtualSize, [uint64]$section.RawSize)
        $sectionStart = [uint64]$section.VirtualAddress
        $sectionEnd = $sectionStart + $sectionSpan
        if ([uint64]$Rva -ge $sectionStart -and [uint64]$Rva -lt $sectionEnd) {
            $delta = [uint64]$Rva - $sectionStart
            if ($delta -ge [uint64]$section.RawSize) {
                throw "PE RVA 0x$($Rva.ToString('X8')) maps to a virtual-only section tail."
            }
            $offset = [uint64]$section.RawOffset + $delta
            if ($offset -ge [uint64]$FileLength) {
                throw "PE RVA 0x$($Rva.ToString('X8')) maps outside the file."
            }
            return [long]$offset
        }
    }

    throw "PE RVA 0x$($Rva.ToString('X8')) does not map to a section."
}

function Read-NullTerminatedAscii {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Bytes,

        [Parameter(Mandatory = $true)]
        [long]$Offset,

        [Parameter(Mandatory = $true)]
        [string]$Context
    )

    $result = [Text.StringBuilder]::new()
    $limit = [Math]::Min($Bytes.LongLength, $Offset + 4096)
    for ($index = $Offset; $index -lt $limit; ++$index) {
        $value = $Bytes[[int]$index]
        if ($value -eq 0) {
            return $result.ToString()
        }
        if ($value -lt 0x20 -or $value -gt 0x7E) {
            throw "$Context contains a non-printable import character."
        }
        $null = $result.Append([char]$value)
    }

    throw "$Context is not NUL-terminated within 4096 bytes."
}

function Get-PeEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $fileInfo = Get-Item -LiteralPath $Path
    if ($fileInfo.Length -gt 536870912) {
        throw "PE inspection refuses files larger than 512 MiB: $Path"
    }
    if (-not [BitConverter]::IsLittleEndian) {
        throw 'PE inspection requires a little-endian runtime.'
    }

    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 64 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
        throw "Inner module lacks a valid DOS header: $Path"
    }

    $peOffset = [long](Read-UInt32LittleEndian -Bytes $bytes -Offset 0x3C `
            -Context 'DOS e_lfanew')
    if ($peOffset + 24 -gt $bytes.LongLength -or
        $bytes[[int]$peOffset] -ne 0x50 -or
        $bytes[[int]($peOffset + 1)] -ne 0x45 -or
        $bytes[[int]($peOffset + 2)] -ne 0 -or
        $bytes[[int]($peOffset + 3)] -ne 0) {
        throw "Inner module lacks a valid PE signature: $Path"
    }

    $coffOffset = $peOffset + 4
    $machine = Read-UInt16LittleEndian -Bytes $bytes -Offset $coffOffset `
        -Context 'COFF machine'
    $sectionCount = Read-UInt16LittleEndian -Bytes $bytes -Offset ($coffOffset + 2) `
        -Context 'COFF section count'
    $optionalHeaderSize = Read-UInt16LittleEndian -Bytes $bytes -Offset ($coffOffset + 16) `
        -Context 'COFF optional header size'
    $characteristics = Read-UInt16LittleEndian -Bytes $bytes -Offset ($coffOffset + 18) `
        -Context 'COFF characteristics'
    if ($sectionCount -lt 1 -or $sectionCount -gt 96) {
        throw "PE section count is outside the supported bound: $sectionCount"
    }

    $optionalOffset = $coffOffset + 20
    if ($optionalHeaderSize -lt 128 -or
        $optionalOffset + $optionalHeaderSize -gt $bytes.LongLength) {
        throw 'PE optional header is truncated or too small for PE32+ data directories.'
    }
    $optionalMagic = Read-UInt16LittleEndian -Bytes $bytes -Offset $optionalOffset `
        -Context 'optional header magic'
    if ($optionalMagic -ne 0x20B) {
        throw "Inner module is not PE32+: $Path"
    }

    $sizeOfHeaders = Read-UInt32LittleEndian -Bytes $bytes -Offset ($optionalOffset + 60) `
        -Context 'size of headers'
    $directoryCount = Read-UInt32LittleEndian -Bytes $bytes -Offset ($optionalOffset + 108) `
        -Context 'data directory count'
    $importRva = [uint32]0
    $importSize = [uint32]0
    $delayImportRva = [uint32]0
    $delayImportSize = [uint32]0
    if ($directoryCount -ge 2) {
        $importRva = Read-UInt32LittleEndian -Bytes $bytes -Offset ($optionalOffset + 120) `
            -Context 'import directory RVA'
        $importSize = Read-UInt32LittleEndian -Bytes $bytes -Offset ($optionalOffset + 124) `
            -Context 'import directory size'
    }
    if ($directoryCount -ge 14 -and $optionalHeaderSize -ge 224) {
        $delayImportRva = Read-UInt32LittleEndian -Bytes $bytes -Offset ($optionalOffset + 216) `
            -Context 'delay-import directory RVA'
        $delayImportSize = Read-UInt32LittleEndian -Bytes $bytes -Offset ($optionalOffset + 220) `
            -Context 'delay-import directory size'
    }

    $sectionTableOffset = $optionalOffset + $optionalHeaderSize
    if ($sectionTableOffset + ([long]$sectionCount * 40) -gt $bytes.LongLength) {
        throw 'PE section table is truncated.'
    }
    $sections = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $sectionCount; ++$index) {
        $sectionOffset = $sectionTableOffset + ([long]$index * 40)
        $sections.Add([pscustomobject]@{
                VirtualSize = Read-UInt32LittleEndian -Bytes $bytes `
                    -Offset ($sectionOffset + 8) -Context 'section virtual size'
                VirtualAddress = Read-UInt32LittleEndian -Bytes $bytes `
                    -Offset ($sectionOffset + 12) -Context 'section virtual address'
                RawSize = Read-UInt32LittleEndian -Bytes $bytes `
                    -Offset ($sectionOffset + 16) -Context 'section raw size'
                RawOffset = Read-UInt32LittleEndian -Bytes $bytes `
                    -Offset ($sectionOffset + 20) -Context 'section raw offset'
            })
    }

    $importNames = [System.Collections.Generic.List[string]]::new()
    $seenImports = [System.Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    if ($importRva -ne 0) {
        if ($importSize -lt 20) {
            throw 'PE import directory is too small for a terminating descriptor.'
        }
        $importOffset = Convert-RvaToFileOffset -Rva $importRva `
            -Sections $sections.ToArray() -SizeOfHeaders $sizeOfHeaders `
            -FileLength $bytes.LongLength
        $importEndRva = [uint64]$importRva + [uint64]$importSize - 1
        if ($importEndRva -gt [uint64][uint32]::MaxValue) {
            throw 'PE import directory RVA range overflows UINT32.'
        }
        $importEndOffset = Convert-RvaToFileOffset -Rva ([uint32]$importEndRva) `
            -Sections $sections.ToArray() -SizeOfHeaders $sizeOfHeaders `
            -FileLength $bytes.LongLength
        if ($importOffset + [long]$importSize -gt $bytes.LongLength) {
            throw 'PE import directory extends beyond the file.'
        }
        if ($importEndOffset -ne $importOffset + [long]$importSize - 1) {
            throw 'PE import directory is not contiguous in raw file data.'
        }
        $descriptorLimit = [Math]::Min(
            4096,
            [Math]::Floor([double]$importSize / 20.0)
        )

        $foundTerminator = $false
        for ($index = 0; $index -lt $descriptorLimit; ++$index) {
            $descriptorOffset = $importOffset + ([long]$index * 20)
            $originalFirstThunk = Read-UInt32LittleEndian -Bytes $bytes `
                -Offset $descriptorOffset -Context 'import original thunk'
            $timeDateStamp = Read-UInt32LittleEndian -Bytes $bytes `
                -Offset ($descriptorOffset + 4) -Context 'import timestamp'
            $forwarderChain = Read-UInt32LittleEndian -Bytes $bytes `
                -Offset ($descriptorOffset + 8) -Context 'import forwarder chain'
            $nameRva = Read-UInt32LittleEndian -Bytes $bytes `
                -Offset ($descriptorOffset + 12) -Context 'import name RVA'
            $firstThunk = Read-UInt32LittleEndian -Bytes $bytes `
                -Offset ($descriptorOffset + 16) -Context 'import first thunk'
            if ($originalFirstThunk -eq 0 -and $timeDateStamp -eq 0 -and
                $forwarderChain -eq 0 -and $nameRva -eq 0 -and $firstThunk -eq 0) {
                $foundTerminator = $true
                break
            }
            if ($nameRva -eq 0) {
                throw 'PE import descriptor has an empty DLL name RVA.'
            }

            $nameOffset = Convert-RvaToFileOffset -Rva $nameRva `
                -Sections $sections.ToArray() -SizeOfHeaders $sizeOfHeaders `
                -FileLength $bytes.LongLength
            $importName = Read-NullTerminatedAscii -Bytes $bytes -Offset $nameOffset `
                -Context 'PE import name'
            if ($importName.Length -eq 0) {
                throw 'PE import descriptor contains an empty DLL name.'
            }
            if ($seenImports.Add($importName)) {
                $importNames.Add($importName)
            }
        }
        if (-not $foundTerminator) {
            throw 'PE import descriptor list exceeded its bounded directory size.'
        }
    }

    $delayImportNames = [System.Collections.Generic.List[string]]::new()
    $seenDelayImports = [System.Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    if ($delayImportRva -ne 0) {
        if ($delayImportSize -lt 32) {
            throw 'PE delay-import directory is too small for a terminating descriptor.'
        }
        $delayImportOffset = Convert-RvaToFileOffset -Rva $delayImportRva `
            -Sections $sections.ToArray() -SizeOfHeaders $sizeOfHeaders `
            -FileLength $bytes.LongLength
        $delayImportEndRva = [uint64]$delayImportRva + [uint64]$delayImportSize - 1
        if ($delayImportEndRva -gt [uint64][uint32]::MaxValue) {
            throw 'PE delay-import directory RVA range overflows UINT32.'
        }
        $delayImportEndOffset = Convert-RvaToFileOffset -Rva ([uint32]$delayImportEndRva) `
            -Sections $sections.ToArray() -SizeOfHeaders $sizeOfHeaders `
            -FileLength $bytes.LongLength
        if ($delayImportOffset + [long]$delayImportSize -gt $bytes.LongLength) {
            throw 'PE delay-import directory extends beyond the file.'
        }
        if ($delayImportEndOffset -ne $delayImportOffset + [long]$delayImportSize - 1) {
            throw 'PE delay-import directory is not contiguous in raw file data.'
        }
        $delayDescriptorLimit = [Math]::Min(
            4096,
            [Math]::Floor([double]$delayImportSize / 32.0)
        )

        $foundDelayTerminator = $false
        for ($index = 0; $index -lt $delayDescriptorLimit; ++$index) {
            $descriptorOffset = $delayImportOffset + ([long]$index * 32)
            $fields = [uint32[]]::new(8)
            $allZero = $true
            for ($fieldIndex = 0; $fieldIndex -lt $fields.Count; ++$fieldIndex) {
                $fields[$fieldIndex] = Read-UInt32LittleEndian -Bytes $bytes `
                    -Offset ($descriptorOffset + ([long]$fieldIndex * 4)) `
                    -Context 'delay-import descriptor'
                if ($fields[$fieldIndex] -ne 0) {
                    $allZero = $false
                }
            }
            if ($allZero) {
                $foundDelayTerminator = $true
                break
            }
            if (($fields[0] -band 1) -eq 0) {
                throw 'PE delay-import descriptor does not use RVA-based fields.'
            }
            if ($fields[1] -eq 0) {
                throw 'PE delay-import descriptor has an empty DLL name RVA.'
            }

            $nameOffset = Convert-RvaToFileOffset -Rva $fields[1] `
                -Sections $sections.ToArray() -SizeOfHeaders $sizeOfHeaders `
                -FileLength $bytes.LongLength
            $delayImportName = Read-NullTerminatedAscii -Bytes $bytes -Offset $nameOffset `
                -Context 'PE delay-import name'
            if ($delayImportName.Length -eq 0) {
                throw 'PE delay-import descriptor contains an empty DLL name.'
            }
            if ($seenDelayImports.Add($delayImportName)) {
                $delayImportNames.Add($delayImportName)
            }
        }
        if (-not $foundDelayTerminator) {
            throw 'PE delay-import descriptor list exceeded its bounded directory size.'
        }
    }

    $imports = $importNames.ToArray()
    [Array]::Sort($imports, [StringComparer]::OrdinalIgnoreCase)
    $delayImports = $delayImportNames.ToArray()
    [Array]::Sort($delayImports, [StringComparer]::OrdinalIgnoreCase)
    $allImports = [System.Collections.Generic.HashSet[string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    foreach ($importName in @($imports) + @($delayImports)) {
        $null = $allImports.Add($importName)
    }
    $forbiddenImports = [string[]]@(
        $allImports | Where-Object {
            $_ -match '(?i)(garak|node|electron|chromium|chrome|javascript|vstgui|juce)' -or
            $_ -match '(?i)(^|[^a-z0-9])v8([^a-z0-9]|$)'
        }
    )
    [Array]::Sort($forbiddenImports, [StringComparer]::OrdinalIgnoreCase)

    return [ordered]@{
        machine = '0x' + $machine.ToString('X4')
        architecture = if ($machine -eq 0x8664) { 'x64' } else { 'unsupported' }
        format = 'PE32+'
        isDll = ($characteristics -band 0x2000) -ne 0
        dependencyEvidenceScope = 'PE import and delay-import directories only'
        staticImports = @($imports)
        delayImports = @($delayImports)
        forbiddenImports = @($forbiddenImports)
    }
}

function Get-BundleEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundlePath,

        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$ExpectedResourcePaths
    )

    $bundleLeaf = [IO.Path]::GetFileName($BundlePath)
    $innerRelativePath = "Contents\x86_64-win\$bundleLeaf"
    $expectedPaths = [System.Collections.Generic.List[string]]::new()
    $expectedPaths.Add($innerRelativePath)
    foreach ($resourcePath in $ExpectedResourcePaths) {
        $expectedPaths.Add($resourcePath)
    }

    $relativeDirectories = [System.Collections.Generic.List[string]]::new()
    foreach ($directory in @(
            Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -Directory
        )) {
        $relativePath = $directory.FullName.Substring($BundlePath.Length).TrimStart('\', '/')
        $relativeDirectories.Add($relativePath.Replace('/', '\'))
    }
    $actualDirectories = $relativeDirectories.ToArray()
    $expectedDirectories = [string[]]@(
        'Contents',
        'Contents\Resources',
        'Contents\x86_64-win'
    )
    [Array]::Sort($actualDirectories, [StringComparer]::Ordinal)
    [Array]::Sort($expectedDirectories, [StringComparer]::Ordinal)
    if ($actualDirectories.Count -ne $expectedDirectories.Count) {
        throw "$Label bundle directory count mismatch. Expected $($expectedDirectories.Count), found $($actualDirectories.Count)."
    }
    for ($index = 0; $index -lt $expectedDirectories.Count; ++$index) {
        if ($actualDirectories[$index] -cne $expectedDirectories[$index]) {
            throw "$Label bundle directory inventory mismatch. Expected '$($expectedDirectories[$index])', found '$($actualDirectories[$index])'."
        }
    }

    $relativePaths = [System.Collections.Generic.List[string]]::new()
    foreach ($file in @(Get-ChildItem -LiteralPath $BundlePath -Force -Recurse -File)) {
        $relativePath = $file.FullName.Substring($BundlePath.Length).TrimStart('\', '/')
        $relativePaths.Add($relativePath.Replace('/', '\'))
    }
    $actual = $relativePaths.ToArray()
    $expected = $expectedPaths.ToArray()
    [Array]::Sort($actual, [StringComparer]::Ordinal)
    [Array]::Sort($expected, [StringComparer]::Ordinal)
    if ($actual.Count -ne $expected.Count) {
        throw "$Label bundle file count mismatch. Expected $($expected.Count), found $($actual.Count)."
    }
    for ($index = 0; $index -lt $expected.Count; ++$index) {
        if ($actual[$index] -cne $expected[$index]) {
            throw "$Label bundle inventory mismatch. Expected '$($expected[$index])', found '$($actual[$index])'."
        }
    }

    $fileEvidence = [System.Collections.Generic.List[object]]::new()
    $totalBytes = [long]0
    foreach ($relativePath in $actual) {
        $fullPath = Join-Path $BundlePath $relativePath
        $fileInfo = Get-Item -LiteralPath $fullPath
        $totalBytes += $fileInfo.Length
        $fileEvidence.Add([ordered]@{
                path = $relativePath.Replace('\', '/')
                bytes = [long]$fileInfo.Length
                sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
            })
    }

    $innerModule = Join-Path $BundlePath $innerRelativePath
    $innerInfo = Get-Item -LiteralPath $innerModule
    return [ordered]@{
        label = $Label
        bundlePath = $BundlePath
        fileCount = $actual.Count
        bundleBytes = $totalBytes
        innerModule = [ordered]@{
            path = $innerModule
            bytes = [long]$innerInfo.Length
            sha256 = (Get-FileHash -LiteralPath $innerModule -Algorithm SHA256).Hash
            pe = Get-PeEvidence -Path $innerModule
        }
        directories = @($actualDirectories | ForEach-Object { $_.Replace('\', '/') })
        files = $fileEvidence.ToArray()
    }
}

function Test-FilesByteEqual {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FirstPath,

        [Parameter(Mandatory = $true)]
        [string]$SecondPath
    )

    $firstInfo = Get-Item -LiteralPath $FirstPath
    $secondInfo = Get-Item -LiteralPath $SecondPath
    if ($firstInfo.Length -ne $secondInfo.Length) {
        return $false
    }

    $firstStream = [IO.File]::OpenRead($FirstPath)
    $secondStream = [IO.File]::OpenRead($SecondPath)
    try {
        $firstBuffer = New-Object byte[] 65536
        $secondBuffer = New-Object byte[] 65536
        while ($true) {
            $firstRead = $firstStream.Read($firstBuffer, 0, $firstBuffer.Length)
            $secondRead = $secondStream.Read($secondBuffer, 0, $secondBuffer.Length)
            if ($firstRead -ne $secondRead) {
                return $false
            }
            if ($firstRead -eq 0) {
                return $true
            }
            for ($index = 0; $index -lt $firstRead; ++$index) {
                if ($firstBuffer[$index] -ne $secondBuffer[$index]) {
                    return $false
                }
            }
        }
    }
    finally {
        $firstStream.Dispose()
        $secondStream.Dispose()
    }
}

$artifactRoot = ConvertTo-RepositoryAbsolutePath -Path $ArtifactRootPath
Assert-PathUnderOut -Path $artifactRoot -Description 'Runtime strategy artifact root'
if (-not (Test-Path -LiteralPath $artifactRoot -PathType Container)) {
    throw "Runtime strategy artifact root does not exist as a directory: $artifactRoot"
}
Assert-NoReparsePointInOutPath -Path $artifactRoot `
    -Description 'Runtime strategy artifact root'
$artifactRoot = [IO.Path]::GetFullPath(
    (Get-Item -LiteralPath $artifactRoot -Force).FullName
)

$templateBundle = Resolve-OutBundle -Path $TemplateBundlePath `
    -Description 'Runtime template bundle'
$gainSpikeBundle = Resolve-OutBundle -Path $GainSpikeBundlePath `
    -Description 'Garak Gain Spike bundle'
$dataAlphaBundle = Resolve-OutBundle -Path $DataAlphaBundlePath `
    -Description 'Garak Data Alpha bundle'
$dataBetaBundle = Resolve-OutBundle -Path $DataBetaBundlePath `
    -Description 'Garak Data Beta bundle'
$thinAlphaBundle = Resolve-OutBundle -Path $ThinAlphaBundlePath `
    -Description 'Garak Thin Alpha bundle'
$thinBetaBundle = Resolve-OutBundle -Path $ThinBetaBundlePath `
    -Description 'Garak Thin Beta bundle'

$fixedBundleNames = [ordered]@{
    $templateBundle = 'Garak Data Runtime Template.vst3'
    $gainSpikeBundle = 'Garak Gain Spike.vst3'
    $dataAlphaBundle = 'Garak Data Alpha.vst3'
    $dataBetaBundle = 'Garak Data Beta.vst3'
    $thinAlphaBundle = 'Garak Thin Alpha.vst3'
    $thinBetaBundle = 'Garak Thin Beta.vst3'
}
foreach ($entry in $fixedBundleNames.GetEnumerator()) {
    if ([IO.Path]::GetFileName($entry.Key) -cne $entry.Value) {
        throw "Expected bundle leaf '$($entry.Value)': $($entry.Key)"
    }
}

$bundlePaths = @(
    $templateBundle,
    $gainSpikeBundle,
    $dataAlphaBundle,
    $dataBetaBundle,
    $thinAlphaBundle,
    $thinBetaBundle
)
$seenPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($bundlePath in $bundlePaths) {
    if (-not (Test-PathContainedBy -CandidatePath $bundlePath -BoundaryPath $artifactRoot)) {
        throw "Bundle must be inside the explicit artifact root: $bundlePath"
    }
    if (-not $seenPaths.Add($bundlePath)) {
        throw "Bundle paths must be distinct: $bundlePath"
    }
}

$reportFile = ConvertTo-RepositoryAbsolutePath -Path $ReportPath
Assert-PathUnderOut -Path $reportFile -Description 'Artifact report'
Assert-NoReparsePointInOutPath -Path $reportFile -Description 'Artifact report'
if ([IO.Path]::GetExtension($reportFile) -ine '.json') {
    throw "Artifact report must use the .json extension: $reportFile"
}
foreach ($bundlePath in $bundlePaths) {
    if (Test-PathContainedBy -CandidatePath $reportFile -BoundaryPath $bundlePath `
            -AllowBoundary) {
        throw "Artifact report must not be written inside a bundle: $bundlePath"
    }
}

$templateEvidence = Get-BundleEvidence -BundlePath $templateBundle `
    -Label 'Runtime Template' -ExpectedResourcePaths @()
$gainSpikeEvidence = Get-BundleEvidence -BundlePath $gainSpikeBundle `
    -Label 'Garak Gain Spike' -ExpectedResourcePaths @()
$dataAlphaEvidence = Get-BundleEvidence -BundlePath $dataAlphaBundle `
    -Label 'Garak Data Alpha' -ExpectedResourcePaths @(
        'Contents\Resources\garak-product-spike-v1.txt',
        'Contents\Resources\moduleinfo.json'
    )
$dataBetaEvidence = Get-BundleEvidence -BundlePath $dataBetaBundle `
    -Label 'Garak Data Beta' -ExpectedResourcePaths @(
        'Contents\Resources\garak-product-spike-v1.txt',
        'Contents\Resources\moduleinfo.json'
    )
$thinAlphaEvidence = Get-BundleEvidence -BundlePath $thinAlphaBundle `
    -Label 'Garak Thin Alpha' -ExpectedResourcePaths @(
        'Contents\Resources\moduleinfo.json'
    )
$thinBetaEvidence = Get-BundleEvidence -BundlePath $thinBetaBundle `
    -Label 'Garak Thin Beta' -ExpectedResourcePaths @(
        'Contents\Resources\moduleinfo.json'
    )

$templateHash = $templateEvidence.innerModule.sha256
$dataAlphaHash = $dataAlphaEvidence.innerModule.sha256
$dataBetaHash = $dataBetaEvidence.innerModule.sha256
$thinAlphaHash = $thinAlphaEvidence.innerModule.sha256
$thinBetaHash = $thinBetaEvidence.innerModule.sha256
$dataHashesIdentical = $templateHash -ceq $dataAlphaHash -and
    $templateHash -ceq $dataBetaHash
$dataModulesByteIdentical = $dataHashesIdentical -and
    (Test-FilesByteEqual -FirstPath $templateEvidence.innerModule.path `
        -SecondPath $dataAlphaEvidence.innerModule.path) -and
    (Test-FilesByteEqual -FirstPath $templateEvidence.innerModule.path `
        -SecondPath $dataBetaEvidence.innerModule.path)
$thinModulesDistinct = $thinAlphaHash -cne $thinBetaHash

$evidence = [ordered]@{
    schema = 'garak.runtime-strategy-artifacts.v1'
    configuration = $Configuration
    artifactRoot = $artifactRoot
    bundles = [ordered]@{
        runtimeTemplate = $templateEvidence
        gainSpike = $gainSpikeEvidence
        dataAlpha = $dataAlphaEvidence
        dataBeta = $dataBetaEvidence
        thinAlpha = $thinAlphaEvidence
        thinBeta = $thinBetaEvidence
    }
    comparisons = [ordered]@{
        templateDataAlphaDataBetaModuleHashesIdentical = $dataHashesIdentical
        templateDataAlphaDataBetaModulesByteIdentical = $dataModulesByteIdentical
        thinAlphaThinBetaModulesDistinct = $thinModulesDistinct
    }
}

$reportParent = [IO.Path]::GetDirectoryName($reportFile)
Assert-NoReparsePointInOutPath -Path $reportParent -Description 'Artifact report parent'
$null = New-Item -ItemType Directory -Force -Path $reportParent
$temporaryReport = Join-Path $reportParent (
    '.' + [IO.Path]::GetFileName($reportFile) + '.tmp.' + [Guid]::NewGuid().ToString('N')
)
$backupReport = Join-Path $reportParent (
    '.' + [IO.Path]::GetFileName($reportFile) + '.backup.' + [Guid]::NewGuid().ToString('N')
)
try {
    $json = $evidence | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($temporaryReport, $json + "`n", $utf8NoBom)
    if (Test-Path -LiteralPath $reportFile) {
        if (-not (Test-Path -LiteralPath $reportFile -PathType Leaf)) {
            throw "Artifact report exists but is not a file: $reportFile"
        }
        [IO.File]::Replace($temporaryReport, $reportFile, $backupReport, $true)
        [IO.File]::Delete($backupReport)
    }
    else {
        [IO.File]::Move($temporaryReport, $reportFile)
    }
}
finally {
    if (Test-Path -LiteralPath $temporaryReport) {
        Remove-Item -LiteralPath $temporaryReport -Force
    }
    if (Test-Path -LiteralPath $backupReport) {
        Remove-Item -LiteralPath $backupReport -Force
    }
}

$issues = [System.Collections.Generic.List[string]]::new()
if (-not $dataModulesByteIdentical) {
    $issues.Add('Template, Data Alpha, and Data Beta inner modules are not byte-identical.')
}
if (-not $thinModulesDistinct) {
    $issues.Add('Thin Alpha and Thin Beta inner module SHA-256 values are unexpectedly identical.')
}
foreach ($bundleEvidence in @(
        $templateEvidence,
        $gainSpikeEvidence,
        $dataAlphaEvidence,
        $dataBetaEvidence,
        $thinAlphaEvidence,
        $thinBetaEvidence
    )) {
    if ($bundleEvidence.innerModule.pe.architecture -cne 'x64') {
        $issues.Add("$($bundleEvidence.label) inner module is not PE x64.")
    }
    if (-not $bundleEvidence.innerModule.pe.isDll) {
        $issues.Add("$($bundleEvidence.label) inner module lacks the PE DLL characteristic.")
    }
    if ($bundleEvidence.innerModule.pe.forbiddenImports.Count -ne 0) {
        $issues.Add(
            "$($bundleEvidence.label) has forbidden imports: " +
            ($bundleEvidence.innerModule.pe.forbiddenImports -join ', ')
        )
    }
}

Write-Output "Artifact report: $reportFile"
Write-Output "Configuration: $Configuration"
Write-Output "Template/Data module bytes identical: $dataModulesByteIdentical"
Write-Output "Thin module bytes distinct: $thinModulesDistinct"
if ($issues.Count -ne 0) {
    throw ($issues -join [Environment]::NewLine)
}
