#!/bin/bash

# Development reinstall script for tom_vscode_extension extension
# This script marks the installation as a "test reinstall" which triggers
# a reminder notification when VS Code reloads

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Reinstalling tom_vscode_extension for testing..."

# Create marker file to indicate this is a test reinstall
MARKER_FILE="$HOME/.vscode-tom-test-reinstall"
echo "$(date +%s)" > "$MARKER_FILE"
echo "📍 Created test reinstall marker: $MARKER_FILE"
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

CURRENT_NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR_VERSION=$(echo "$CURRENT_NODE_VERSION" | cut -d. -f1)

echo "📋 Current Node.js version: v$CURRENT_NODE_VERSION"

# Check if Node.js version is >= 20
if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
    echo "⚠️  Node.js version $NODE_MAJOR_VERSION is below the required version 20"
    
    # Check if nvm is installed
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "✅ Node Version Manager (nvm) is installed"
        
        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Check if Node 20 is already installed
        if nvm list | grep -q "v20"; then
            echo "📦 Node.js 20 is already installed, switching to it..."
            nvm use 20
        else
            echo "📦 Installing Node.js 20 (LTS)..."
            nvm install 20
            nvm use 20
        fi
        
        # Get new version
        CURRENT_NODE_VERSION=$(node --version | sed 's/v//')
        echo "✅ Now using Node.js v$CURRENT_NODE_VERSION"
    else
        echo "❌ Error: Node Version Manager (nvm) is not installed"
        echo "Please install Node.js >= 20 or install nvm first"
        exit 1
    fi
else
    echo "✅ Node.js version meets requirements (>= 20)"
fi

echo ""

# Compile TypeScript
echo "📦 Compiling TypeScript..."
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed"
    exit 1
fi

echo ""
echo "✅ Extension compiled successfully!"

# Check if VS Code CLI is available
CODE_CLI=""
if command -v code &> /dev/null; then
    CODE_CLI="code"
else
    echo "⚠️  VS Code CLI not found. Extension compiled but not installed."
    echo "   Press F5 to test in Extension Development Host"
    exit 0
fi

# Check if vsce is installed
if ! command -v vsce &> /dev/null; then
    echo "📦 Installing @vscode/vsce..."
    npm install -g @vscode/vsce
fi

# Uninstall old version
echo ""
echo "🗑️  Uninstalling old version..."
"$CODE_CLI" --uninstall-extension tom.dartscript-vscode 2>/dev/null || true

# Package as VSIX
echo ""
echo "📦 Packaging extension as VSIX..."
vsce package --allow-missing-repository --skip-license --baseContentUrl https://github.com/al-the-bear/tom/blob/main/tom_vscode_extension

if [ $? -eq 0 ]; then
    # Find the generated VSIX file
    VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -n 1)
    
    if [ -n "$VSIX_FILE" ]; then
        echo ""
        echo "✅ Package created: $VSIX_FILE"
        echo ""
        echo "🚀 Installing extension in VS Code..."
        "$CODE_CLI" --install-extension "$VSIX_FILE"
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Extension installed successfully!"
            echo ""
            echo "🔄 Reloading VS Code window..."
            echo "   Please manually reload: Cmd+Shift+P → 'Developer: Reload Window'"
            echo ""
            echo "🔔 The reminder notification will appear ~2 seconds after reload."
        else
            echo "❌ Failed to install extension"
            exit 1
        fi
    else
        echo "❌ Could not find generated VSIX file"
        exit 1
    fi
else
    echo "❌ Failed to package extension"
    exit 1
fi
