# Tom DartScript Extension - Copilot Guidelines

## Extension Reinstallation

When testing changes to the extension or the bridge, use the dedicated reinstallation script:

```bash
cd /Users/alexiskyaw/Desktop/Code/tom2/tom_vscode_extension
./reinstall_for_testing.sh
```

**Do NOT use** `install_tom_vscode_extension.sh` from the workspace root - use `reinstall_for_testing.sh` instead.

After reinstallation, the user must manually reload VS Code:
- `Cmd+Shift+P` → `Developer: Reload Window`

Wait for `!reload finished` prompt before continuing testing.

## Development Workflow

1. Make changes to extension code in `src/`
2. Run `./reinstall_for_testing.sh`
3. Reload VS Code window
4. Test the changes
5. Repeat as needed
