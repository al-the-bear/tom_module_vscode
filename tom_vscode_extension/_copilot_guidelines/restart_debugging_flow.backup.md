## Reinstall and Reload Process

1. Run `./reinstall_for_testing.sh` in the `tom_vscode_extension` folder to compile, package, and install the extension
2. Reload the VS Code window sending the workbench.action.reloadWindow command to VS Code
3. After reload, the extension start script sends a special prompt "!!!Reload finished" to the Copilot Chat to indicate successful reload

## "Reload" Prompt

When you receive a prompt containing just !!!Reload finished in the Copilot Chat, this indicates:

- The extension has just been reinstalled and the window reloaded
- Both the VS Code extension and Dart bridge are now running with the latest code
- You should **continue testing** or **resume the previous task** that was in progress before the reload
- Typically you will continue with sending the runTests command to VS Code to trigger testing and then doublecheck the results, so you can continue fixing any remaining issues or proceed with the next task

This workflow allows seamless continuation of development/testing after code changes are applied.

## Test and Fix Process

See `tom_vscode_bridge/_copilot_guidelines/extension_reload_workflow.md` for the complete test and fix workflow including:
- Step-by-step iterative development process
- Quick reference table for commands and locations