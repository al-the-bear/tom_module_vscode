# Reinstalling the VS Code Extension

This document describes the correct procedure for reinstalling the `tom_vscode_extension` after making code changes.

## Procedure

### Step 1: Run the Reinstall Script

Execute the reinstall script from the extension directory:

```bash
cd /Users/alexiskyaw/Desktop/Code/tom2/xternal/tom_module_vscode/tom_vscode_extension
./reinstall_for_testing.sh
```

This script:
- Compiles the TypeScript code
- Packages the extension into a VSIX file
- Uninstalls the old version
- Installs the new VSIX

### Step 2: Reload VS Code Window

After the script completes successfully, trigger a VS Code window reload:

```
workbench.action.reloadWindow
```

Use the VS Code command palette or the `run_vscode_command` tool with `commandId: "workbench.action.reloadWindow"`.

### Step 3: Wait for Confirmation

**Important:** Wait for the user or VS Code Bridge to confirm the reload is complete with `!reload finished` before continuing with any testing or further work.

## Notes

- All changes to the extension require both reinstallation AND window reload to take effect
- The reinstall script creates a marker file that triggers a reminder notification after reload
- If compilation fails, fix the TypeScript errors before attempting reinstall again

## Pattern Prompt

This procedure is also available as the `!reinstall extension` pattern prompt.
