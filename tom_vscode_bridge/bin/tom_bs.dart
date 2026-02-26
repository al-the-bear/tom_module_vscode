/// Tom Bridge Server - Basic VS Code Bridge
///
/// Entry point for the basic VS Code bridge server with DCli and VS Code
/// API bridges. For the extended version with full Tom Framework bridges,
/// use `core_bs` from `tom_core_bridge` instead.
///
/// This binary is launched by the VS Code extension and communicates via
/// stdin/stdout using a JSON-RPC-like protocol.
library;

import 'package:tom_vscode_bridge/bridge_server.dart';

void main() {
  VSCodeBridgeServer().start();
}
