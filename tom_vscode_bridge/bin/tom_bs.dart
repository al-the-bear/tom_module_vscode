import 'package:tom_vscode_bridge/bridge_server.dart';
import 'package:tom_vscode_bridge/src/version.g.dart';

/// Main entry point for VS Code bridge server
///
/// This server communicates with the VS Code extension via stdin/stdout
/// using JSON-RPC protocol.
void main(List<String> arguments) {
  if (arguments.contains('version') ||
      arguments.contains('-version') ||
      arguments.contains('--version')) {
    print(TomVersionInfo.versionLong);
    return;
  }

  final server = VSCodeBridgeServer();
  server.start();

  // Keep the process running
  // The server listens on stdin and responds on stdout
}
