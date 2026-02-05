<#
.SYNOPSIS
    Development reinstall script for tom_dartscript_extension extension
    This script marks the installation as a "test reinstall" which triggers
    a reminder notification when VS Code reloads
#>

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "🔧 Reinstalling tom_dartscript_extension for testing..."

# Create marker file to indicate this is a test reinstall
$MarkerFile = Join-Path $env:USERPROFILE ".vscode-tom-test-reinstall"
[DateTimeOffset]::Now.ToUnixTimeSeconds() | Out-File -FilePath $MarkerFile -Encoding utf8
Write-Host "📍 Created test reinstall marker: $MarkerFile"
Write-Host ""

# Check Node.js version
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Error: Node.js is not installed"
    exit 1
}

$CurrentNodeVersion = (node --version) -replace 'v',''
$NodeMajorVersion = [int]$CurrentNodeVersion.Split('.')[0]

Write-Host "📋 Current Node.js version: v$CurrentNodeVersion"

if ($NodeMajorVersion -lt 20) {
    Write-Warning "⚠️  Node.js version $NodeMajorVersion is below the required version 20"
    Write-Host "Please install Node.js >= 20"
    exit 1
} else {
    Write-Host "✅ Node.js version meets requirements (>= 20)"
}

Write-Host ""

# Compile TypeScript
Write-Host "📦 Compiling TypeScript..."
npm run compile

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Compilation failed"
    exit 1
}

Write-Host ""
Write-Host "✅ Extension compiled successfully!"

# Check if VS Code CLI is available
$CodeCli = ""
if (Get-Command code -ErrorAction SilentlyContinue) {
    $CodeCli = "code"
} else {
    Write-Warning "⚠️  VS Code CLI not found. Extension compiled but not installed."
    Write-Host "   Press F5 to test in Extension Development Host"
    exit 0
}

# Check if vsce is installed
if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing @vscode/vsce..."
    npm install -g @vscode/vsce
}

# Uninstall old version
Write-Host ""
Write-Host "🗑️  Uninstalling old version..."
try {
    & $CodeCli --uninstall-extension tom.dartscript-vscode 2>&1 | Out-Null
} catch {
    # Ignore errors if extension was not installed
}

# Package as VSIX
Write-Host ""
Write-Host "📦 Packaging extension as VSIX..."
# Windows cmd workaround for vsce if it's a batch file
cmd /c vsce package --allow-missing-repository --skip-license --baseContentUrl https://github.com/al-the-bear/tom/blob/main/tom_dartscript_extension

if ($LASTEXITCODE -eq 0) {
    # Find the generated VSIX file
    $VsixFile = Get-ChildItem -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($VsixFile) {
        Write-Host ""
        Write-Host "✅ Package created: $($VsixFile.Name)"
        Write-Host ""
        Write-Host "🚀 Installing extension in VS Code..."
        & $CodeCli --install-extension "$($VsixFile.FullName)"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Extension installed successfully!"
            Write-Host ""
            Write-Host "🔄 Reloading VS Code window..."
            Write-Host "   Please manually reload: Ctrl+Shift+P -> 'Developer: Reload Window'"
            Write-Host ""
            Write-Host "🔔 The reminder notification will appear ~2 seconds after reload."
        } else {
            Write-Error "❌ Failed to install extension"
            exit 1
        }
    } else {
        Write-Error "❌ Could not find generated VSIX file"
        exit 1
    }
} else {
    Write-Error "❌ Failed to package extension"
    exit 1
}
