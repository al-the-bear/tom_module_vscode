// D4rt Bridge - Generated file, do not edit
// Sources: 13 files
// Generated: 2026-01-28T20:18:51.327859

import 'package:tom_d4rt/d4rt.dart';
import 'package:tom_d4rt/tom_d4rt.dart';
import 'dart:async';

import 'package:tom_vscode_bridge/tom_vscode_bridge.dart' as $pkg;

/// Bridge class for all module.
class AllBridge {
  /// Returns all bridge class definitions.
  static List<BridgedClass> bridgeClasses() {
    return [
      _createBridgeLoggingBridge(),
      _createExecutionContextBridge(),
      _createVSCodeBridgeServerBridge(),
      _createVsCodeBridgeBridge(),
      _createDartScriptBridgeRunnerBridge(),
      _createVSCodeBridge(),
      _createVSCodeUriBridge(),
      _createWorkspaceFolderBridge(),
      _createTextDocumentBridge(),
      _createPositionBridge(),
      _createRangeBridge(),
      _createSelectionBridge(),
      _createTextEditorBridge(),
      _createQuickPickItemBridge(),
      _createInputBoxOptionsBridge(),
      _createMessageOptionsBridge(),
      _createTerminalOptionsBridge(),
      _createFileSystemWatcherOptionsBridge(),
      _createVSCodeWorkspaceBridge(),
      _createVSCodeWindowBridge(),
      _createVSCodeCommandsBridge(),
      _createVSCodeCommonCommandsBridge(),
      _createExtensionBridge(),
      _createVSCodeExtensionsBridge(),
      _createVSCodeLanguageModelBridge(),
      _createLanguageModelChatBridge(),
      _createLanguageModelChatMessageBridge(),
      _createLanguageModelChatResponseBridge(),
      _createLanguageModelToolResultBridge(),
      _createLanguageModelToolInformationBridge(),
      _createVSCodeChatBridge(),
      _createChatParticipantBridge(),
      _createChatRequestBridge(),
      _createChatPromptReferenceBridge(),
      _createChatContextBridge(),
      _createChatResultBridge(),
      _createChatErrorDetailsBridge(),
      _createChatResponseStreamBridge(),
      _createVsCodeHelperBridge(),
      _createProgressBridge(),
      _createFileBatchBridge(),
    ];
  }

  /// Returns all bridged enum definitions.
  static List<BridgedEnumDefinition> bridgedEnums() {
    return [
      BridgedEnumDefinition<$pkg.DiagnosticSeverity>(
        name: 'DiagnosticSeverity',
        values: $pkg.DiagnosticSeverity.values,
      ),
    ];
  }

  /// Registers all bridges with an interpreter.
  ///
  /// [importPath] is the package import path that D4rt scripts will use
  /// to access these classes (e.g., 'package:tom_build/tom.dart').
  static void registerBridges(D4rt interpreter, String importPath) {
    // Register bridged classes
    for (final bridge in bridgeClasses()) {
      interpreter.registerBridgedClass(bridge, importPath);
    }

    // Register bridged enums
    for (final enumDef in bridgedEnums()) {
      interpreter.registerBridgedEnum(enumDef, importPath);
    }

    // Register global variables
    registerGlobalVariables(interpreter, importPath);

    // Register global functions
    for (final entry in globalFunctions().entries) {
      interpreter.registertopLevelFunction(entry.key, entry.value, importPath);
    }
  }

  /// Registers all global variables with the interpreter.
  static void registerGlobalVariables(D4rt interpreter, String importPath) {
    interpreter.registerGlobalVariable('defaultCliServerPort', $pkg.defaultCliServerPort, importPath);
    interpreter.registerGlobalVariable('vsCodeBridgeDefinition', $pkg.vsCodeBridgeDefinition, importPath);
    interpreter.registerGlobalVariable('defaultStandaloneBridgePort', $pkg.defaultStandaloneBridgePort, importPath);
    interpreter.registerGlobalGetter('vscode', () => $pkg.vscode, importPath);
    interpreter.registerGlobalGetter('window', () => $pkg.window, importPath);
    interpreter.registerGlobalGetter('workspace', () => $pkg.workspace, importPath);
    interpreter.registerGlobalGetter('commands', () => $pkg.commands, importPath);
    interpreter.registerGlobalGetter('extensions', () => $pkg.extensions, importPath);
    interpreter.registerGlobalGetter('lm', () => $pkg.lm, importPath);
    interpreter.registerGlobalGetter('chat', () => $pkg.chat, importPath);
  }

  /// Returns a map of global function names to their native implementations.
  static Map<String, NativeFunctionImpl> globalFunctions() {
    return {
      'testGlobalFunction': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'testGlobalFunction');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'testGlobalFunction');
        final count = D4.getNamedArgWithDefault<int>(named, 'count', 1);
        return $pkg.testGlobalFunction(message, count: count);
      },
    };
  }

  /// Returns the import statement needed for D4rt scripts.
  ///
  /// Use this in your D4rt initialization script to make all
  /// bridged classes available to scripts.
  static String getImportBlock() {
    return "import 'package:tom_vscode_bridge/tom_vscode_bridge.dart';";
  }

  /// Returns a list of bridged enum names.
  static List<String> get enumNames => [
    'DiagnosticSeverity',
  ];

  /// Returns D4rt script code that documents available global functions.
  ///
  /// These functions are available directly in D4rt scripts when
  /// the import block is included in the initialization script.
  static List<String> get globalFunctionNames => [
    'testGlobalFunction',
  ];

  /// Returns a list of global variable names.
  static List<String> get globalVariableNames => [
    'defaultCliServerPort',
    'vsCodeBridgeDefinition',
    'defaultStandaloneBridgePort',
    'vscode',
    'window',
    'workspace',
    'commands',
    'extensions',
    'lm',
    'chat',
  ];

}

// =============================================================================
// BridgeLogging Bridge
// =============================================================================

BridgedClass _createBridgeLoggingBridge() {
  return BridgedClass(
    nativeType: $pkg.BridgeLogging,
    name: 'BridgeLogging',
    constructors: {
    },
    staticGetters: {
      'debugTraceLogging': (visitor) => $pkg.BridgeLogging.debugTraceLogging,
      'debugLogging': (visitor) => $pkg.BridgeLogging.debugLogging,
    },
    staticMethods: {
      'setDebugLogging': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'setDebugLogging');
        final enabled = D4.getRequiredArg<bool>(positional, 0, 'enabled', 'setDebugLogging');
        return $pkg.BridgeLogging.setDebugLogging(enabled);
      },
    },
  );
}

// =============================================================================
// ExecutionContext Bridge
// =============================================================================

BridgedClass _createExecutionContextBridge() {
  return BridgedClass(
    nativeType: $pkg.ExecutionContext,
    name: 'ExecutionContext',
    constructors: {
    },
    getters: {
      'logs': (visitor, target) => D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext').logs,
      'exceptionMessage': (visitor, target) => D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext').exceptionMessage,
      'exceptionStackTrace': (visitor, target) => D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext').exceptionStackTrace,
      'hasException': (visitor, target) => D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext').hasException,
    },
    setters: {
      'exceptionMessage': (visitor, target, value) => 
        D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext').exceptionMessage = value as String?,
      'exceptionStackTrace': (visitor, target, value) => 
        D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext').exceptionStackTrace = value as String?,
    },
    methods: {
      'log': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext');
        D4.requireMinArgs(positional, 1, 'log');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'log');
        t.log(message);
        return null;
      },
      'recordException': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ExecutionContext>(target, 'ExecutionContext');
        D4.requireMinArgs(positional, 2, 'recordException');
        final error = D4.getRequiredArg<Object>(positional, 0, 'error', 'recordException');
        final stackTrace = D4.getRequiredArg<StackTrace>(positional, 1, 'stackTrace', 'recordException');
        t.recordException(error, stackTrace);
        return null;
      },
    },
  );
}

// =============================================================================
// VSCodeBridgeServer Bridge
// =============================================================================

BridgedClass _createVSCodeBridgeServerBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeBridgeServer,
    name: 'VSCodeBridgeServer',
    constructors: {
      '': (visitor, positional, named) {
        return $pkg.VSCodeBridgeServer();
      },
    },
    methods: {
      'start': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeBridgeServer>(target, 'VSCodeBridgeServer');
        t.start();
        return null;
      },
      'handleCliRequest': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeBridgeServer>(target, 'VSCodeBridgeServer');
        D4.requireMinArgs(positional, 4, 'handleCliRequest');
        final method = D4.getRequiredArg<String>(positional, 0, 'method', 'handleCliRequest');
        if (positional.length <= 1) {
          throw ArgumentError('handleCliRequest: Missing required argument "params" at position 1');
        }
        final params = D4.coerceMap<String, dynamic>(positional[1], 'params');
        final id = D4.getRequiredArg<Object?>(positional, 2, 'id', 'handleCliRequest');
        if (positional.length <= 3) {
          throw ArgumentError('handleCliRequest: Missing required argument "sendLogToSocket" at position 3');
        }
        final sendLogToSocket_raw = positional[3];
        return t.handleCliRequest(method, params, id, (String p0) { (sendLogToSocket_raw as InterpretedFunction).call(visitor as InterpreterVisitor, [p0]); });
      },
      'sendRequest': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeBridgeServer>(target, 'VSCodeBridgeServer');
        D4.requireMinArgs(positional, 2, 'sendRequest');
        final method = D4.getRequiredArg<String>(positional, 0, 'method', 'sendRequest');
        if (positional.length <= 1) {
          throw ArgumentError('sendRequest: Missing required argument "params" at position 1');
        }
        final params = D4.coerceMap<String, dynamic>(positional[1], 'params');
        final scriptName = D4.getOptionalNamedArg<String?>(named, 'scriptName');
        final timeout = D4.getNamedArgWithDefault<Duration>(named, 'timeout', const Duration(seconds: 30));
        final callId = D4.getOptionalNamedArg<String?>(named, 'callId');
        return t.sendRequest(method, params, scriptName: scriptName, timeout: timeout, callId: callId);
      },
      'sendNotification': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeBridgeServer>(target, 'VSCodeBridgeServer');
        D4.requireMinArgs(positional, 2, 'sendNotification');
        final method = D4.getRequiredArg<String>(positional, 0, 'method', 'sendNotification');
        if (positional.length <= 1) {
          throw ArgumentError('sendNotification: Missing required argument "params" at position 1');
        }
        final params = D4.coerceMap<String, dynamic>(positional[1], 'params');
        t.sendNotification(method, params);
        return null;
      },
    },
    staticGetters: {
      'params': (visitor) => $pkg.VSCodeBridgeServer.params,
    },
    staticMethods: {
      'setResult': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'setResult');
        final result = D4.getRequiredArg<Object?>(positional, 0, 'result', 'setResult');
        return $pkg.VSCodeBridgeServer.setResult(result);
      },
    },
  );
}

// =============================================================================
// VsCodeBridge Bridge
// =============================================================================

BridgedClass _createVsCodeBridgeBridge() {
  return BridgedClass(
    nativeType: $pkg.VsCodeBridge,
    name: 'VsCodeBridge',
    constructors: {
    },
    methods: {
      'setExecutionContext': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VsCodeBridge>(target, 'VsCodeBridge');
        D4.requireMinArgs(positional, 2, 'setExecutionContext');
        if (positional.length <= 0) {
          throw ArgumentError('setExecutionContext: Missing required argument "params" at position 0');
        }
        final params = D4.coerceMap<String, dynamic>(positional[0], 'params');
        if (positional.length <= 1) {
          throw ArgumentError('setExecutionContext: Missing required argument "context" at position 1');
        }
        final context = D4.coerceMap<String, dynamic>(positional[1], 'context');
        final bridgeServer = D4.getOptionalNamedArg<$pkg.VSCodeBridgeServer?>(named, 'bridgeServer');
        t.setExecutionContext(params, context, bridgeServer: bridgeServer);
        return null;
      },
      'execute': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VsCodeBridge>(target, 'VsCodeBridge');
        D4.requireMinArgs(positional, 1, 'execute');
        if (positional.length <= 0) {
          throw ArgumentError('execute: Missing required argument "handler" at position 0');
        }
        final handler_raw = positional[0];
        t.execute((Map<String, dynamic> p0, Map<String, dynamic> p1) { return (handler_raw as InterpretedFunction).call(visitor as InterpreterVisitor, [p0, p1]) as dynamic; });
        return null;
      },
    },
  );
}

// =============================================================================
// DartScriptBridgeRunner Bridge
// =============================================================================

BridgedClass _createDartScriptBridgeRunnerBridge() {
  return BridgedClass(
    nativeType: $pkg.DartScriptBridgeRunner,
    name: 'DartScriptBridgeRunner',
    constructors: {
      '': (visitor, positional, named) {
        final verbose = D4.getNamedArgWithDefault<bool>(named, 'verbose', false);
        final workspaceRoot = D4.getOptionalNamedArg<String?>(named, 'workspaceRoot');
        if (!named.containsKey('port')) {
          return $pkg.DartScriptBridgeRunner(verbose: verbose, workspaceRoot: workspaceRoot);
        }
        if (named.containsKey('port')) {
          final port = D4.getRequiredNamedArg<int>(named, 'port', 'DartScriptBridgeRunner');
          return $pkg.DartScriptBridgeRunner(verbose: verbose, workspaceRoot: workspaceRoot, port: port);
        }
      },
    },
    getters: {
      'port': (visitor, target) => D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner').port,
      'verbose': (visitor, target) => D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner').verbose,
      'workspaceRoot': (visitor, target) => D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner').workspaceRoot,
      'resolvedWorkspaceRoot': (visitor, target) => D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner').resolvedWorkspaceRoot,
      'isRunning': (visitor, target) => D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner').isRunning,
    },
    methods: {
      'start': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner');
        return t.start();
      },
      'stop': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.DartScriptBridgeRunner>(target, 'DartScriptBridgeRunner');
        return t.stop();
      },
    },
  );
}

// =============================================================================
// VSCode Bridge
// =============================================================================

BridgedClass _createVSCodeBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCode,
    name: 'VSCode',
    constructors: {
      '': (visitor, positional, named) {
        return $pkg.VSCode();
      },
      'withBridge': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCode');
        final bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, 'bridge', 'VSCode');
        return $pkg.VSCode.withBridge(bridge);
      },
    },
    getters: {
      'workspace': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').workspace,
      'window': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').window,
      'commands': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').commands,
      'extensions': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').extensions,
      'lm': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').lm,
      'chat': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').chat,
      'bridge': (visitor, target) => D4.validateTarget<$pkg.VSCode>(target, 'VSCode').bridge,
    },
    methods: {
      'getVersion': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCode>(target, 'VSCode');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10);
        return t.getVersion(timeoutSeconds: timeoutSeconds);
      },
      'getEnv': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCode>(target, 'VSCode');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10);
        return t.getEnv(timeoutSeconds: timeoutSeconds);
      },
      'openExternal': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCode>(target, 'VSCode');
        D4.requireMinArgs(positional, 1, 'openExternal');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'openExternal');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return t.openExternal(uri, timeoutSeconds: timeoutSeconds);
      },
      'copyToClipboard': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCode>(target, 'VSCode');
        D4.requireMinArgs(positional, 1, 'copyToClipboard');
        final text = D4.getRequiredArg<String>(positional, 0, 'text', 'copyToClipboard');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10);
        return t.copyToClipboard(text, timeoutSeconds: timeoutSeconds);
      },
      'readFromClipboard': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCode>(target, 'VSCode');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10);
        return t.readFromClipboard(timeoutSeconds: timeoutSeconds);
      },
    },
    staticGetters: {
      'vsCode': (visitor) => $pkg.VSCode.vsCode,
    },
    staticMethods: {
      'initializeVSCode': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'initializeVSCode');
        final bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, 'bridge', 'initializeVSCode');
        return $pkg.VSCode.initializeVSCode(bridge);
      },
    },
  );
}

// =============================================================================
// VSCodeUri Bridge
// =============================================================================

BridgedClass _createVSCodeUriBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeUri,
    name: 'VSCodeUri',
    constructors: {
      '': (visitor, positional, named) {
        final scheme = D4.getRequiredNamedArg<String>(named, 'scheme', 'VSCodeUri');
        final authority = D4.getNamedArgWithDefault<String>(named, 'authority', '');
        final path = D4.getRequiredNamedArg<String>(named, 'path', 'VSCodeUri');
        final query = D4.getNamedArgWithDefault<String>(named, 'query', '');
        final fragment = D4.getNamedArgWithDefault<String>(named, 'fragment', '');
        final fsPath = D4.getRequiredNamedArg<String>(named, 'fsPath', 'VSCodeUri');
        return $pkg.VSCodeUri(scheme: scheme, authority: authority, path: path, query: query, fragment: fragment, fsPath: fsPath);
      },
      'file': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeUri');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'VSCodeUri');
        return $pkg.VSCodeUri.file(path);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeUri');
        if (positional.length <= 0) {
          throw ArgumentError('VSCodeUri: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.VSCodeUri.fromJson(json);
      },
    },
    getters: {
      'scheme': (visitor, target) => D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri').scheme,
      'authority': (visitor, target) => D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri').authority,
      'path': (visitor, target) => D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri').path,
      'query': (visitor, target) => D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri').query,
      'fragment': (visitor, target) => D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri').fragment,
      'fsPath': (visitor, target) => D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri').fsPath,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri');
        return t.toJson();
      },
      'toString': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeUri>(target, 'VSCodeUri');
        return t.toString();
      },
    },
  );
}

// =============================================================================
// WorkspaceFolder Bridge
// =============================================================================

BridgedClass _createWorkspaceFolderBridge() {
  return BridgedClass(
    nativeType: $pkg.WorkspaceFolder,
    name: 'WorkspaceFolder',
    constructors: {
      '': (visitor, positional, named) {
        final uri = D4.getRequiredNamedArg<$pkg.VSCodeUri>(named, 'uri', 'WorkspaceFolder');
        final name = D4.getRequiredNamedArg<String>(named, 'name', 'WorkspaceFolder');
        final index = D4.getRequiredNamedArg<int>(named, 'index', 'WorkspaceFolder');
        return $pkg.WorkspaceFolder(uri: uri, name: name, index: index);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'WorkspaceFolder');
        if (positional.length <= 0) {
          throw ArgumentError('WorkspaceFolder: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.WorkspaceFolder.fromJson(json);
      },
    },
    getters: {
      'uri': (visitor, target) => D4.validateTarget<$pkg.WorkspaceFolder>(target, 'WorkspaceFolder').uri,
      'name': (visitor, target) => D4.validateTarget<$pkg.WorkspaceFolder>(target, 'WorkspaceFolder').name,
      'index': (visitor, target) => D4.validateTarget<$pkg.WorkspaceFolder>(target, 'WorkspaceFolder').index,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.WorkspaceFolder>(target, 'WorkspaceFolder');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// TextDocument Bridge
// =============================================================================

BridgedClass _createTextDocumentBridge() {
  return BridgedClass(
    nativeType: $pkg.TextDocument,
    name: 'TextDocument',
    constructors: {
      '': (visitor, positional, named) {
        final uri = D4.getRequiredNamedArg<$pkg.VSCodeUri>(named, 'uri', 'TextDocument');
        final fileName = D4.getRequiredNamedArg<String>(named, 'fileName', 'TextDocument');
        final isUntitled = D4.getRequiredNamedArg<bool>(named, 'isUntitled', 'TextDocument');
        final languageId = D4.getRequiredNamedArg<String>(named, 'languageId', 'TextDocument');
        final version = D4.getRequiredNamedArg<int>(named, 'version', 'TextDocument');
        final isDirty = D4.getRequiredNamedArg<bool>(named, 'isDirty', 'TextDocument');
        final isClosed = D4.getRequiredNamedArg<bool>(named, 'isClosed', 'TextDocument');
        final lineCount = D4.getRequiredNamedArg<int>(named, 'lineCount', 'TextDocument');
        return $pkg.TextDocument(uri: uri, fileName: fileName, isUntitled: isUntitled, languageId: languageId, version: version, isDirty: isDirty, isClosed: isClosed, lineCount: lineCount);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'TextDocument');
        if (positional.length <= 0) {
          throw ArgumentError('TextDocument: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.TextDocument.fromJson(json);
      },
    },
    getters: {
      'uri': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').uri,
      'fileName': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').fileName,
      'isUntitled': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').isUntitled,
      'languageId': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').languageId,
      'version': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').version,
      'isDirty': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').isDirty,
      'isClosed': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').isClosed,
      'lineCount': (visitor, target) => D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument').lineCount,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.TextDocument>(target, 'TextDocument');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// Position Bridge
// =============================================================================

BridgedClass _createPositionBridge() {
  return BridgedClass(
    nativeType: $pkg.Position,
    name: 'Position',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 2, 'Position');
        final line = D4.getRequiredArg<int>(positional, 0, 'line', 'Position');
        final character = D4.getRequiredArg<int>(positional, 1, 'character', 'Position');
        return $pkg.Position(line, character);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'Position');
        if (positional.length <= 0) {
          throw ArgumentError('Position: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.Position.fromJson(json);
      },
    },
    getters: {
      'line': (visitor, target) => D4.validateTarget<$pkg.Position>(target, 'Position').line,
      'character': (visitor, target) => D4.validateTarget<$pkg.Position>(target, 'Position').character,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Position>(target, 'Position');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// Range Bridge
// =============================================================================

BridgedClass _createRangeBridge() {
  return BridgedClass(
    nativeType: $pkg.Range,
    name: 'Range',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 2, 'Range');
        final start = D4.getRequiredArg<$pkg.Position>(positional, 0, 'start', 'Range');
        final end = D4.getRequiredArg<$pkg.Position>(positional, 1, 'end', 'Range');
        return $pkg.Range(start, end);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'Range');
        if (positional.length <= 0) {
          throw ArgumentError('Range: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.Range.fromJson(json);
      },
    },
    getters: {
      'start': (visitor, target) => D4.validateTarget<$pkg.Range>(target, 'Range').start,
      'end': (visitor, target) => D4.validateTarget<$pkg.Range>(target, 'Range').end,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Range>(target, 'Range');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// Selection Bridge
// =============================================================================

BridgedClass _createSelectionBridge() {
  return BridgedClass(
    nativeType: $pkg.Selection,
    name: 'Selection',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 3, 'Selection');
        final anchor = D4.getRequiredArg<$pkg.Position>(positional, 0, 'anchor', 'Selection');
        final active = D4.getRequiredArg<$pkg.Position>(positional, 1, 'active', 'Selection');
        final isReversed = D4.getRequiredArg<bool>(positional, 2, 'isReversed', 'Selection');
        return $pkg.Selection(anchor, active, isReversed);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'Selection');
        if (positional.length <= 0) {
          throw ArgumentError('Selection: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.Selection.fromJson(json);
      },
    },
    getters: {
      'start': (visitor, target) => D4.validateTarget<$pkg.Selection>(target, 'Selection').start,
      'end': (visitor, target) => D4.validateTarget<$pkg.Selection>(target, 'Selection').end,
      'anchor': (visitor, target) => D4.validateTarget<$pkg.Selection>(target, 'Selection').anchor,
      'active': (visitor, target) => D4.validateTarget<$pkg.Selection>(target, 'Selection').active,
      'isReversed': (visitor, target) => D4.validateTarget<$pkg.Selection>(target, 'Selection').isReversed,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Selection>(target, 'Selection');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// TextEditor Bridge
// =============================================================================

BridgedClass _createTextEditorBridge() {
  return BridgedClass(
    nativeType: $pkg.TextEditor,
    name: 'TextEditor',
    constructors: {
      '': (visitor, positional, named) {
        final document = D4.getRequiredNamedArg<$pkg.TextDocument>(named, 'document', 'TextEditor');
        final selection = D4.getRequiredNamedArg<$pkg.Selection>(named, 'selection', 'TextEditor');
        if (!named.containsKey('selections') || named['selections'] == null) {
          throw ArgumentError('TextEditor: Missing required named argument "selections"');
        }
        final selections = D4.coerceList<$pkg.Selection>(named['selections'], 'selections');
        final visibleRanges = D4.getOptionalNamedArg<$pkg.Range?>(named, 'visibleRanges');
        return $pkg.TextEditor(document: document, selection: selection, selections: selections, visibleRanges: visibleRanges);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'TextEditor');
        if (positional.length <= 0) {
          throw ArgumentError('TextEditor: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.TextEditor.fromJson(json);
      },
    },
    getters: {
      'document': (visitor, target) => D4.validateTarget<$pkg.TextEditor>(target, 'TextEditor').document,
      'selection': (visitor, target) => D4.validateTarget<$pkg.TextEditor>(target, 'TextEditor').selection,
      'selections': (visitor, target) => D4.validateTarget<$pkg.TextEditor>(target, 'TextEditor').selections,
      'visibleRanges': (visitor, target) => D4.validateTarget<$pkg.TextEditor>(target, 'TextEditor').visibleRanges,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.TextEditor>(target, 'TextEditor');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// QuickPickItem Bridge
// =============================================================================

BridgedClass _createQuickPickItemBridge() {
  return BridgedClass(
    nativeType: $pkg.QuickPickItem,
    name: 'QuickPickItem',
    constructors: {
      '': (visitor, positional, named) {
        final label = D4.getRequiredNamedArg<String>(named, 'label', 'QuickPickItem');
        final description = D4.getOptionalNamedArg<String?>(named, 'description');
        final detail = D4.getOptionalNamedArg<String?>(named, 'detail');
        final picked = D4.getNamedArgWithDefault<bool>(named, 'picked', false);
        return $pkg.QuickPickItem(label: label, description: description, detail: detail, picked: picked);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'QuickPickItem');
        if (positional.length <= 0) {
          throw ArgumentError('QuickPickItem: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.QuickPickItem.fromJson(json);
      },
    },
    getters: {
      'label': (visitor, target) => D4.validateTarget<$pkg.QuickPickItem>(target, 'QuickPickItem').label,
      'description': (visitor, target) => D4.validateTarget<$pkg.QuickPickItem>(target, 'QuickPickItem').description,
      'detail': (visitor, target) => D4.validateTarget<$pkg.QuickPickItem>(target, 'QuickPickItem').detail,
      'picked': (visitor, target) => D4.validateTarget<$pkg.QuickPickItem>(target, 'QuickPickItem').picked,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.QuickPickItem>(target, 'QuickPickItem');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// InputBoxOptions Bridge
// =============================================================================

BridgedClass _createInputBoxOptionsBridge() {
  return BridgedClass(
    nativeType: $pkg.InputBoxOptions,
    name: 'InputBoxOptions',
    constructors: {
      '': (visitor, positional, named) {
        final prompt = D4.getOptionalNamedArg<String?>(named, 'prompt');
        final placeHolder = D4.getOptionalNamedArg<String?>(named, 'placeHolder');
        final value = D4.getOptionalNamedArg<String?>(named, 'value');
        final password = D4.getNamedArgWithDefault<bool>(named, 'password', false);
        return $pkg.InputBoxOptions(prompt: prompt, placeHolder: placeHolder, value: value, password: password);
      },
    },
    getters: {
      'prompt': (visitor, target) => D4.validateTarget<$pkg.InputBoxOptions>(target, 'InputBoxOptions').prompt,
      'placeHolder': (visitor, target) => D4.validateTarget<$pkg.InputBoxOptions>(target, 'InputBoxOptions').placeHolder,
      'value': (visitor, target) => D4.validateTarget<$pkg.InputBoxOptions>(target, 'InputBoxOptions').value,
      'password': (visitor, target) => D4.validateTarget<$pkg.InputBoxOptions>(target, 'InputBoxOptions').password,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.InputBoxOptions>(target, 'InputBoxOptions');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// MessageOptions Bridge
// =============================================================================

BridgedClass _createMessageOptionsBridge() {
  return BridgedClass(
    nativeType: $pkg.MessageOptions,
    name: 'MessageOptions',
    constructors: {
      '': (visitor, positional, named) {
        final modal = D4.getNamedArgWithDefault<bool>(named, 'modal', false);
        final detail = D4.getOptionalNamedArg<String?>(named, 'detail');
        return $pkg.MessageOptions(modal: modal, detail: detail);
      },
    },
    getters: {
      'modal': (visitor, target) => D4.validateTarget<$pkg.MessageOptions>(target, 'MessageOptions').modal,
      'detail': (visitor, target) => D4.validateTarget<$pkg.MessageOptions>(target, 'MessageOptions').detail,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.MessageOptions>(target, 'MessageOptions');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// TerminalOptions Bridge
// =============================================================================

BridgedClass _createTerminalOptionsBridge() {
  return BridgedClass(
    nativeType: $pkg.TerminalOptions,
    name: 'TerminalOptions',
    constructors: {
      '': (visitor, positional, named) {
        final name = D4.getOptionalNamedArg<String?>(named, 'name');
        final shellPath = D4.getOptionalNamedArg<String?>(named, 'shellPath');
        final shellArgs = D4.coerceListOrNull<String>(named['shellArgs'], 'shellArgs');
        final cwd = D4.getOptionalNamedArg<String?>(named, 'cwd');
        final env = D4.coerceMapOrNull<String, String>(named['env'], 'env');
        return $pkg.TerminalOptions(name: name, shellPath: shellPath, shellArgs: shellArgs, cwd: cwd, env: env);
      },
    },
    getters: {
      'name': (visitor, target) => D4.validateTarget<$pkg.TerminalOptions>(target, 'TerminalOptions').name,
      'shellPath': (visitor, target) => D4.validateTarget<$pkg.TerminalOptions>(target, 'TerminalOptions').shellPath,
      'shellArgs': (visitor, target) => D4.validateTarget<$pkg.TerminalOptions>(target, 'TerminalOptions').shellArgs,
      'cwd': (visitor, target) => D4.validateTarget<$pkg.TerminalOptions>(target, 'TerminalOptions').cwd,
      'env': (visitor, target) => D4.validateTarget<$pkg.TerminalOptions>(target, 'TerminalOptions').env,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.TerminalOptions>(target, 'TerminalOptions');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// FileSystemWatcherOptions Bridge
// =============================================================================

BridgedClass _createFileSystemWatcherOptionsBridge() {
  return BridgedClass(
    nativeType: $pkg.FileSystemWatcherOptions,
    name: 'FileSystemWatcherOptions',
    constructors: {
      '': (visitor, positional, named) {
        final ignoreCreateEvents = D4.getNamedArgWithDefault<bool>(named, 'ignoreCreateEvents', false);
        final ignoreChangeEvents = D4.getNamedArgWithDefault<bool>(named, 'ignoreChangeEvents', false);
        final ignoreDeleteEvents = D4.getNamedArgWithDefault<bool>(named, 'ignoreDeleteEvents', false);
        return $pkg.FileSystemWatcherOptions(ignoreCreateEvents: ignoreCreateEvents, ignoreChangeEvents: ignoreChangeEvents, ignoreDeleteEvents: ignoreDeleteEvents);
      },
    },
    getters: {
      'ignoreCreateEvents': (visitor, target) => D4.validateTarget<$pkg.FileSystemWatcherOptions>(target, 'FileSystemWatcherOptions').ignoreCreateEvents,
      'ignoreChangeEvents': (visitor, target) => D4.validateTarget<$pkg.FileSystemWatcherOptions>(target, 'FileSystemWatcherOptions').ignoreChangeEvents,
      'ignoreDeleteEvents': (visitor, target) => D4.validateTarget<$pkg.FileSystemWatcherOptions>(target, 'FileSystemWatcherOptions').ignoreDeleteEvents,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.FileSystemWatcherOptions>(target, 'FileSystemWatcherOptions');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// VSCodeWorkspace Bridge
// =============================================================================

BridgedClass _createVSCodeWorkspaceBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeWorkspace,
    name: 'VSCodeWorkspace',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeWorkspace');
        final _bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, '_bridge', 'VSCodeWorkspace');
        return $pkg.VSCodeWorkspace(_bridge);
      },
    },
    methods: {
      'getWorkspaceFolders': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return t.getWorkspaceFolders(timeoutSeconds: timeoutSeconds);
      },
      'getWorkspaceFolder': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'getWorkspaceFolder');
        final uri = D4.getRequiredArg<$pkg.VSCodeUri>(positional, 0, 'uri', 'getWorkspaceFolder');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return t.getWorkspaceFolder(uri, timeoutSeconds: timeoutSeconds);
      },
      'openTextDocument': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'openTextDocument');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'openTextDocument');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.openTextDocument(path, timeoutSeconds: timeoutSeconds);
      },
      'saveTextDocument': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'saveTextDocument');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'saveTextDocument');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.saveTextDocument(path, timeoutSeconds: timeoutSeconds);
      },
      'findFiles': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'findFiles');
        final include = D4.getRequiredArg<String>(positional, 0, 'include', 'findFiles');
        final exclude = D4.getOptionalNamedArg<String?>(named, 'exclude');
        final maxResults = D4.getOptionalNamedArg<int?>(named, 'maxResults');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.findFiles(include, exclude: exclude, maxResults: maxResults, timeoutSeconds: timeoutSeconds);
      },
      'findFilePaths': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        final include = D4.getRequiredNamedArg<String>(named, 'include', 'findFilePaths');
        final exclude = D4.getOptionalNamedArg<String?>(named, 'exclude');
        final maxResults = D4.getOptionalNamedArg<int?>(named, 'maxResults');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.findFilePaths(include: include, exclude: exclude, maxResults: maxResults, timeoutSeconds: timeoutSeconds);
      },
      'getConfiguration': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'getConfiguration');
        final section = D4.getRequiredArg<String>(positional, 0, 'section', 'getConfiguration');
        final scope = D4.getOptionalNamedArg<String?>(named, 'scope');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getConfiguration(section, scope: scope, timeoutSeconds: timeoutSeconds);
      },
      'updateConfiguration': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 3, 'updateConfiguration');
        final section = D4.getRequiredArg<String>(positional, 0, 'section', 'updateConfiguration');
        final key = D4.getRequiredArg<String>(positional, 1, 'key', 'updateConfiguration');
        final value = D4.getRequiredArg<dynamic>(positional, 2, 'value', 'updateConfiguration');
        final global = D4.getNamedArgWithDefault<bool>(named, 'global', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.updateConfiguration(section, key, value, global: global, timeoutSeconds: timeoutSeconds);
      },
      'getRootPath': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        return t.getRootPath();
      },
      'getWorkspaceName': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        return t.getWorkspaceName();
      },
      'readFile': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'readFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'readFile');
        return t.readFile(path);
      },
      'writeFile': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 2, 'writeFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'writeFile');
        final content = D4.getRequiredArg<String>(positional, 1, 'content', 'writeFile');
        return t.writeFile(path, content);
      },
      'deleteFile': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'deleteFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'deleteFile');
        return t.deleteFile(path);
      },
      'fileExists': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWorkspace>(target, 'VSCodeWorkspace');
        D4.requireMinArgs(positional, 1, 'fileExists');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'fileExists');
        return t.fileExists(path);
      },
    },
  );
}

// =============================================================================
// VSCodeWindow Bridge
// =============================================================================

BridgedClass _createVSCodeWindowBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeWindow,
    name: 'VSCodeWindow',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeWindow');
        final _bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, '_bridge', 'VSCodeWindow');
        return $pkg.VSCodeWindow(_bridge);
      },
    },
    methods: {
      'showInformationMessage': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showInformationMessage');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'showInformationMessage');
        final items = D4.coerceListOrNull<String>(named['items'], 'items');
        final options = D4.getOptionalNamedArg<$pkg.MessageOptions?>(named, 'options');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 5 * 60);
        return t.showInformationMessage(message, items: items, options: options, timeoutSeconds: timeoutSeconds);
      },
      'showWarningMessage': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showWarningMessage');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'showWarningMessage');
        final items = D4.coerceListOrNull<String>(named['items'], 'items');
        final options = D4.getOptionalNamedArg<$pkg.MessageOptions?>(named, 'options');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 5 * 60);
        return t.showWarningMessage(message, items: items, options: options, timeoutSeconds: timeoutSeconds);
      },
      'showErrorMessage': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showErrorMessage');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'showErrorMessage');
        final items = D4.coerceListOrNull<String>(named['items'], 'items');
        final options = D4.getOptionalNamedArg<$pkg.MessageOptions?>(named, 'options');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 5 * 60);
        return t.showErrorMessage(message, items: items, options: options, timeoutSeconds: timeoutSeconds);
      },
      'showQuickPick': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showQuickPick');
        if (positional.length <= 0) {
          throw ArgumentError('showQuickPick: Missing required argument "items" at position 0');
        }
        final items = D4.coerceList<String>(positional[0], 'items');
        final placeHolder = D4.getOptionalNamedArg<String?>(named, 'placeHolder');
        final canPickMany = D4.getNamedArgWithDefault<bool>(named, 'canPickMany', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30 * 60);
        final fallbackValueOnTimeout = D4.getOptionalNamedArg<String?>(named, 'fallbackValueOnTimeout');
        final failOnTimeout = D4.getNamedArgWithDefault<bool>(named, 'failOnTimeout', false);
        return t.showQuickPick(items, placeHolder: placeHolder, canPickMany: canPickMany, timeoutSeconds: timeoutSeconds, fallbackValueOnTimeout: fallbackValueOnTimeout, failOnTimeout: failOnTimeout);
      },
      'showInputBox': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        final prompt = D4.getOptionalNamedArg<String?>(named, 'prompt');
        final placeHolder = D4.getOptionalNamedArg<String?>(named, 'placeHolder');
        final value = D4.getOptionalNamedArg<String?>(named, 'value');
        final password = D4.getNamedArgWithDefault<bool>(named, 'password', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30 * 60);
        final fallbackValueOnTimeout = D4.getOptionalNamedArg<String?>(named, 'fallbackValueOnTimeout');
        final failOnTimeout = D4.getNamedArgWithDefault<bool>(named, 'failOnTimeout', false);
        return t.showInputBox(prompt: prompt, placeHolder: placeHolder, value: value, password: password, timeoutSeconds: timeoutSeconds, fallbackValueOnTimeout: fallbackValueOnTimeout, failOnTimeout: failOnTimeout);
      },
      'getActiveTextEditor': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        return t.getActiveTextEditor();
      },
      'showTextDocument': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showTextDocument');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'showTextDocument');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10 * 60);
        return t.showTextDocument(path, timeoutSeconds: timeoutSeconds);
      },
      'createOutputChannel': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'createOutputChannel');
        final name = D4.getRequiredArg<String>(positional, 0, 'name', 'createOutputChannel');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return t.createOutputChannel(name, timeoutSeconds: timeoutSeconds);
      },
      'appendToOutputChannel': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 2, 'appendToOutputChannel');
        final channelName = D4.getRequiredArg<String>(positional, 0, 'channelName', 'appendToOutputChannel');
        final text = D4.getRequiredArg<String>(positional, 1, 'text', 'appendToOutputChannel');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return t.appendToOutputChannel(channelName, text, timeoutSeconds: timeoutSeconds);
      },
      'showOutputChannel': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showOutputChannel');
        final channelName = D4.getRequiredArg<String>(positional, 0, 'channelName', 'showOutputChannel');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return t.showOutputChannel(channelName, timeoutSeconds: timeoutSeconds);
      },
      'createTerminal': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        final name = D4.getOptionalNamedArg<String?>(named, 'name');
        final shellPath = D4.getOptionalNamedArg<String?>(named, 'shellPath');
        final shellArgs = D4.coerceListOrNull<String>(named['shellArgs'], 'shellArgs');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.createTerminal(name: name, shellPath: shellPath, shellArgs: shellArgs, timeoutSeconds: timeoutSeconds);
      },
      'sendTextToTerminal': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 2, 'sendTextToTerminal');
        final terminalName = D4.getRequiredArg<String>(positional, 0, 'terminalName', 'sendTextToTerminal');
        final text = D4.getRequiredArg<String>(positional, 1, 'text', 'sendTextToTerminal');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.sendTextToTerminal(terminalName, text, timeoutSeconds: timeoutSeconds);
      },
      'showTerminal': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'showTerminal');
        final terminalName = D4.getRequiredArg<String>(positional, 0, 'terminalName', 'showTerminal');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.showTerminal(terminalName, timeoutSeconds: timeoutSeconds);
      },
      'setStatusBarMessage': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        D4.requireMinArgs(positional, 1, 'setStatusBarMessage');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'setStatusBarMessage');
        final timeout = D4.getOptionalNamedArg<int?>(named, 'timeout');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.setStatusBarMessage(message, timeout: timeout, timeoutSeconds: timeoutSeconds);
      },
      'showSaveDialog': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        final defaultUri = D4.getOptionalNamedArg<String?>(named, 'defaultUri');
        final filters = D4.coerceMapOrNull<String, List<String>>(named['filters'], 'filters');
        final title = D4.getOptionalNamedArg<String?>(named, 'title');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30 * 60);
        return t.showSaveDialog(defaultUri: defaultUri, filters: filters, title: title, timeoutSeconds: timeoutSeconds);
      },
      'showOpenDialog': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeWindow>(target, 'VSCodeWindow');
        final canSelectFiles = D4.getNamedArgWithDefault<bool>(named, 'canSelectFiles', true);
        final canSelectFolders = D4.getNamedArgWithDefault<bool>(named, 'canSelectFolders', false);
        final canSelectMany = D4.getNamedArgWithDefault<bool>(named, 'canSelectMany', false);
        final defaultUri = D4.getOptionalNamedArg<String?>(named, 'defaultUri');
        final filters = D4.coerceMapOrNull<String, List<String>>(named['filters'], 'filters');
        final title = D4.getOptionalNamedArg<String?>(named, 'title');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30 * 60);
        return t.showOpenDialog(canSelectFiles: canSelectFiles, canSelectFolders: canSelectFolders, canSelectMany: canSelectMany, defaultUri: defaultUri, filters: filters, title: title, timeoutSeconds: timeoutSeconds);
      },
    },
  );
}

// =============================================================================
// VSCodeCommands Bridge
// =============================================================================

BridgedClass _createVSCodeCommandsBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeCommands,
    name: 'VSCodeCommands',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeCommands');
        final _bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, '_bridge', 'VSCodeCommands');
        return $pkg.VSCodeCommands(_bridge);
      },
    },
    methods: {
      'executeCommand': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeCommands>(target, 'VSCodeCommands');
        D4.requireMinArgs(positional, 1, 'executeCommand');
        final command = D4.getRequiredArg<String>(positional, 0, 'command', 'executeCommand');
        final args = D4.coerceListOrNull<dynamic>(named['args'], 'args');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.executeCommand(command, args: args, timeoutSeconds: timeoutSeconds);
      },
      'getCommands': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeCommands>(target, 'VSCodeCommands');
        final filterInternal = D4.getNamedArgWithDefault<bool>(named, 'filterInternal', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getCommands(filterInternal: filterInternal, timeoutSeconds: timeoutSeconds);
      },
      'registerCommand': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeCommands>(target, 'VSCodeCommands');
        D4.requireMinArgs(positional, 2, 'registerCommand');
        final command = D4.getRequiredArg<String>(positional, 0, 'command', 'registerCommand');
        final handlerScript = D4.getRequiredArg<String>(positional, 1, 'handlerScript', 'registerCommand');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.registerCommand(command, handlerScript, timeoutSeconds: timeoutSeconds);
      },
    },
  );
}

// =============================================================================
// VSCodeCommonCommands Bridge
// =============================================================================

BridgedClass _createVSCodeCommonCommandsBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeCommonCommands,
    name: 'VSCodeCommonCommands',
    constructors: {
    },
    staticGetters: {
      'openFile': (visitor) => $pkg.VSCodeCommonCommands.openFile,
      'openFolder': (visitor) => $pkg.VSCodeCommonCommands.openFolder,
      'newUntitledFile': (visitor) => $pkg.VSCodeCommonCommands.newUntitledFile,
      'saveFile': (visitor) => $pkg.VSCodeCommonCommands.saveFile,
      'saveAllFiles': (visitor) => $pkg.VSCodeCommonCommands.saveAllFiles,
      'closeActiveEditor': (visitor) => $pkg.VSCodeCommonCommands.closeActiveEditor,
      'showCommands': (visitor) => $pkg.VSCodeCommonCommands.showCommands,
      'quickOpen': (visitor) => $pkg.VSCodeCommonCommands.quickOpen,
      'goToFile': (visitor) => $pkg.VSCodeCommonCommands.goToFile,
      'goToSymbol': (visitor) => $pkg.VSCodeCommonCommands.goToSymbol,
      'goToLine': (visitor) => $pkg.VSCodeCommonCommands.goToLine,
      'findInFiles': (visitor) => $pkg.VSCodeCommonCommands.findInFiles,
      'replaceInFiles': (visitor) => $pkg.VSCodeCommonCommands.replaceInFiles,
      'toggleTerminal': (visitor) => $pkg.VSCodeCommonCommands.toggleTerminal,
      'newTerminal': (visitor) => $pkg.VSCodeCommonCommands.newTerminal,
      'toggleSidebar': (visitor) => $pkg.VSCodeCommonCommands.toggleSidebar,
      'togglePanel': (visitor) => $pkg.VSCodeCommonCommands.togglePanel,
      'formatDocument': (visitor) => $pkg.VSCodeCommonCommands.formatDocument,
      'organizeImports': (visitor) => $pkg.VSCodeCommonCommands.organizeImports,
      'renameSymbol': (visitor) => $pkg.VSCodeCommonCommands.renameSymbol,
      'goToDefinition': (visitor) => $pkg.VSCodeCommonCommands.goToDefinition,
      'goToReferences': (visitor) => $pkg.VSCodeCommonCommands.goToReferences,
      'showHover': (visitor) => $pkg.VSCodeCommonCommands.showHover,
      'commentLine': (visitor) => $pkg.VSCodeCommonCommands.commentLine,
      'copyLineDown': (visitor) => $pkg.VSCodeCommonCommands.copyLineDown,
      'moveLineDown': (visitor) => $pkg.VSCodeCommonCommands.moveLineDown,
      'deleteLine': (visitor) => $pkg.VSCodeCommonCommands.deleteLine,
      'reloadWindow': (visitor) => $pkg.VSCodeCommonCommands.reloadWindow,
      'showExtensions': (visitor) => $pkg.VSCodeCommonCommands.showExtensions,
      'installExtension': (visitor) => $pkg.VSCodeCommonCommands.installExtension,
    },
  );
}

// =============================================================================
// Extension Bridge
// =============================================================================

BridgedClass _createExtensionBridge() {
  return BridgedClass(
    nativeType: $pkg.Extension,
    name: 'Extension',
    constructors: {
      '': (visitor, positional, named) {
        final id = D4.getRequiredNamedArg<String>(named, 'id', 'Extension');
        final extensionUri = D4.getRequiredNamedArg<String>(named, 'extensionUri', 'Extension');
        final extensionPath = D4.getRequiredNamedArg<String>(named, 'extensionPath', 'Extension');
        final isActive = D4.getRequiredNamedArg<bool>(named, 'isActive', 'Extension');
        if (!named.containsKey('packageJSON') || named['packageJSON'] == null) {
          throw ArgumentError('Extension: Missing required named argument "packageJSON"');
        }
        final packageJSON = D4.coerceMap<String, dynamic>(named['packageJSON'], 'packageJSON');
        final extensionKind = D4.getOptionalNamedArg<String?>(named, 'extensionKind');
        return $pkg.Extension(id: id, extensionUri: extensionUri, extensionPath: extensionPath, isActive: isActive, packageJSON: packageJSON, extensionKind: extensionKind);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'Extension');
        if (positional.length <= 0) {
          throw ArgumentError('Extension: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.Extension.fromJson(json);
      },
    },
    getters: {
      'id': (visitor, target) => D4.validateTarget<$pkg.Extension>(target, 'Extension').id,
      'extensionUri': (visitor, target) => D4.validateTarget<$pkg.Extension>(target, 'Extension').extensionUri,
      'extensionPath': (visitor, target) => D4.validateTarget<$pkg.Extension>(target, 'Extension').extensionPath,
      'isActive': (visitor, target) => D4.validateTarget<$pkg.Extension>(target, 'Extension').isActive,
      'packageJSON': (visitor, target) => D4.validateTarget<$pkg.Extension>(target, 'Extension').packageJSON,
      'extensionKind': (visitor, target) => D4.validateTarget<$pkg.Extension>(target, 'Extension').extensionKind,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Extension>(target, 'Extension');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// VSCodeExtensions Bridge
// =============================================================================

BridgedClass _createVSCodeExtensionsBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeExtensions,
    name: 'VSCodeExtensions',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeExtensions');
        final _bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, '_bridge', 'VSCodeExtensions');
        return $pkg.VSCodeExtensions(_bridge);
      },
    },
    methods: {
      'getAll': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getAll(timeoutSeconds: timeoutSeconds);
      },
      'getExtension': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'getExtension');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'getExtension');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getExtension(extensionId, timeoutSeconds: timeoutSeconds);
      },
      'isInstalled': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'isInstalled');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'isInstalled');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.isInstalled(extensionId, timeoutSeconds: timeoutSeconds);
      },
      'getExtensionExports': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'getExtensionExports');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'getExtensionExports');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.getExtensionExports(extensionId, timeoutSeconds: timeoutSeconds);
      },
      'activateExtension': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'activateExtension');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'activateExtension');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return t.activateExtension(extensionId, timeoutSeconds: timeoutSeconds);
      },
      'getExtensionVersion': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'getExtensionVersion');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'getExtensionVersion');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getExtensionVersion(extensionId, timeoutSeconds: timeoutSeconds);
      },
      'getExtensionDisplayName': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'getExtensionDisplayName');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'getExtensionDisplayName');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getExtensionDisplayName(extensionId, timeoutSeconds: timeoutSeconds);
      },
      'getExtensionDescription': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeExtensions>(target, 'VSCodeExtensions');
        D4.requireMinArgs(positional, 1, 'getExtensionDescription');
        final extensionId = D4.getRequiredArg<String>(positional, 0, 'extensionId', 'getExtensionDescription');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getExtensionDescription(extensionId, timeoutSeconds: timeoutSeconds);
      },
    },
  );
}

// =============================================================================
// VSCodeLanguageModel Bridge
// =============================================================================

BridgedClass _createVSCodeLanguageModelBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeLanguageModel,
    name: 'VSCodeLanguageModel',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeLanguageModel');
        final _bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, '_bridge', 'VSCodeLanguageModel');
        return $pkg.VSCodeLanguageModel(_bridge);
      },
    },
    methods: {
      'selectChatModels': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeLanguageModel>(target, 'VSCodeLanguageModel');
        final vendor = D4.getOptionalNamedArg<String?>(named, 'vendor');
        final family = D4.getOptionalNamedArg<String?>(named, 'family');
        final id = D4.getOptionalNamedArg<String?>(named, 'id');
        final version = D4.getOptionalNamedArg<String?>(named, 'version');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.selectChatModels(vendor: vendor, family: family, id: id, version: version, timeoutSeconds: timeoutSeconds);
      },
      'invokeTool': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeLanguageModel>(target, 'VSCodeLanguageModel');
        D4.requireMinArgs(positional, 2, 'invokeTool');
        final name = D4.getRequiredArg<String>(positional, 0, 'name', 'invokeTool');
        if (positional.length <= 1) {
          throw ArgumentError('invokeTool: Missing required argument "options" at position 1');
        }
        final options = D4.coerceMap<String, dynamic>(positional[1], 'options');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return t.invokeTool(name, options, timeoutSeconds: timeoutSeconds);
      },
      'registerTool': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeLanguageModel>(target, 'VSCodeLanguageModel');
        D4.requireMinArgs(positional, 2, 'registerTool');
        final name = D4.getRequiredArg<String>(positional, 0, 'name', 'registerTool');
        if (positional.length <= 1) {
          throw ArgumentError('registerTool: Missing required argument "tool" at position 1');
        }
        final tool = D4.coerceMap<String, dynamic>(positional[1], 'tool');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.registerTool(name, tool, timeoutSeconds: timeoutSeconds);
      },
      'getTools': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeLanguageModel>(target, 'VSCodeLanguageModel');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return t.getTools(timeoutSeconds: timeoutSeconds);
      },
    },
  );
}

// =============================================================================
// LanguageModelChat Bridge
// =============================================================================

BridgedClass _createLanguageModelChatBridge() {
  return BridgedClass(
    nativeType: $pkg.LanguageModelChat,
    name: 'LanguageModelChat',
    constructors: {
      '': (visitor, positional, named) {
        final id = D4.getRequiredNamedArg<String>(named, 'id', 'LanguageModelChat');
        final vendor = D4.getRequiredNamedArg<String>(named, 'vendor', 'LanguageModelChat');
        final family = D4.getRequiredNamedArg<String>(named, 'family', 'LanguageModelChat');
        final version = D4.getRequiredNamedArg<String>(named, 'version', 'LanguageModelChat');
        final name = D4.getRequiredNamedArg<String>(named, 'name', 'LanguageModelChat');
        final maxInputTokens = D4.getRequiredNamedArg<int>(named, 'maxInputTokens', 'LanguageModelChat');
        return $pkg.LanguageModelChat(id: id, vendor: vendor, family: family, version: version, name: name, maxInputTokens: maxInputTokens);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelChat');
        if (positional.length <= 0) {
          throw ArgumentError('LanguageModelChat: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.LanguageModelChat.fromJson(json);
      },
    },
    getters: {
      'id': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat').id,
      'vendor': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat').vendor,
      'family': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat').family,
      'version': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat').version,
      'name': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat').name,
      'maxInputTokens': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat').maxInputTokens,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat');
        return t.toJson();
      },
      'sendRequest': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat');
        D4.requireMinArgs(positional, 2, 'sendRequest');
        final bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, 'bridge', 'sendRequest');
        if (positional.length <= 1) {
          throw ArgumentError('sendRequest: Missing required argument "messages" at position 1');
        }
        final messages = D4.coerceList<$pkg.LanguageModelChatMessage>(positional[1], 'messages');
        final modelOptions = D4.coerceMapOrNull<String, dynamic>(named['modelOptions'], 'modelOptions');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return t.sendRequest(bridge, messages, modelOptions: modelOptions, timeoutSeconds: timeoutSeconds);
      },
      'countTokens': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelChat>(target, 'LanguageModelChat');
        D4.requireMinArgs(positional, 2, 'countTokens');
        final bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, 'bridge', 'countTokens');
        final text = D4.getRequiredArg<String>(positional, 1, 'text', 'countTokens');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return t.countTokens(bridge, text, timeoutSeconds: timeoutSeconds);
      },
    },
  );
}

// =============================================================================
// LanguageModelChatMessage Bridge
// =============================================================================

BridgedClass _createLanguageModelChatMessageBridge() {
  return BridgedClass(
    nativeType: $pkg.LanguageModelChatMessage,
    name: 'LanguageModelChatMessage',
    constructors: {
      '': (visitor, positional, named) {
        final role = D4.getRequiredNamedArg<String>(named, 'role', 'LanguageModelChatMessage');
        final content = D4.getRequiredNamedArg<String>(named, 'content', 'LanguageModelChatMessage');
        final name = D4.getOptionalNamedArg<String?>(named, 'name');
        return $pkg.LanguageModelChatMessage(role: role, content: content, name: name);
      },
      'user': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelChatMessage');
        final content = D4.getRequiredArg<String>(positional, 0, 'content', 'LanguageModelChatMessage');
        final name = D4.getOptionalNamedArg<String?>(named, 'name');
        return $pkg.LanguageModelChatMessage.user(content, name: name);
      },
      'assistant': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelChatMessage');
        final content = D4.getRequiredArg<String>(positional, 0, 'content', 'LanguageModelChatMessage');
        final name = D4.getOptionalNamedArg<String?>(named, 'name');
        return $pkg.LanguageModelChatMessage.assistant(content, name: name);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelChatMessage');
        if (positional.length <= 0) {
          throw ArgumentError('LanguageModelChatMessage: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.LanguageModelChatMessage.fromJson(json);
      },
    },
    getters: {
      'role': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChatMessage>(target, 'LanguageModelChatMessage').role,
      'content': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChatMessage>(target, 'LanguageModelChatMessage').content,
      'name': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChatMessage>(target, 'LanguageModelChatMessage').name,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelChatMessage>(target, 'LanguageModelChatMessage');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// LanguageModelChatResponse Bridge
// =============================================================================

BridgedClass _createLanguageModelChatResponseBridge() {
  return BridgedClass(
    nativeType: $pkg.LanguageModelChatResponse,
    name: 'LanguageModelChatResponse',
    constructors: {
      '': (visitor, positional, named) {
        final text = D4.getRequiredNamedArg<String>(named, 'text', 'LanguageModelChatResponse');
        if (!named.containsKey('streamParts') || named['streamParts'] == null) {
          throw ArgumentError('LanguageModelChatResponse: Missing required named argument "streamParts"');
        }
        final streamParts = D4.coerceList<String>(named['streamParts'], 'streamParts');
        return $pkg.LanguageModelChatResponse(text: text, streamParts: streamParts);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelChatResponse');
        if (positional.length <= 0) {
          throw ArgumentError('LanguageModelChatResponse: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.LanguageModelChatResponse.fromJson(json);
      },
    },
    getters: {
      'text': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChatResponse>(target, 'LanguageModelChatResponse').text,
      'streamParts': (visitor, target) => D4.validateTarget<$pkg.LanguageModelChatResponse>(target, 'LanguageModelChatResponse').streamParts,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelChatResponse>(target, 'LanguageModelChatResponse');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// LanguageModelToolResult Bridge
// =============================================================================

BridgedClass _createLanguageModelToolResultBridge() {
  return BridgedClass(
    nativeType: $pkg.LanguageModelToolResult,
    name: 'LanguageModelToolResult',
    constructors: {
      '': (visitor, positional, named) {
        if (!named.containsKey('content') || named['content'] == null) {
          throw ArgumentError('LanguageModelToolResult: Missing required named argument "content"');
        }
        final content = D4.coerceList<dynamic>(named['content'], 'content');
        return $pkg.LanguageModelToolResult(content: content);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelToolResult');
        if (positional.length <= 0) {
          throw ArgumentError('LanguageModelToolResult: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.LanguageModelToolResult.fromJson(json);
      },
    },
    getters: {
      'content': (visitor, target) => D4.validateTarget<$pkg.LanguageModelToolResult>(target, 'LanguageModelToolResult').content,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelToolResult>(target, 'LanguageModelToolResult');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// LanguageModelToolInformation Bridge
// =============================================================================

BridgedClass _createLanguageModelToolInformationBridge() {
  return BridgedClass(
    nativeType: $pkg.LanguageModelToolInformation,
    name: 'LanguageModelToolInformation',
    constructors: {
      '': (visitor, positional, named) {
        final name = D4.getRequiredNamedArg<String>(named, 'name', 'LanguageModelToolInformation');
        final description = D4.getRequiredNamedArg<String>(named, 'description', 'LanguageModelToolInformation');
        if (!named.containsKey('inputSchema') || named['inputSchema'] == null) {
          throw ArgumentError('LanguageModelToolInformation: Missing required named argument "inputSchema"');
        }
        final inputSchema = D4.coerceMap<String, dynamic>(named['inputSchema'], 'inputSchema');
        return $pkg.LanguageModelToolInformation(name: name, description: description, inputSchema: inputSchema);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'LanguageModelToolInformation');
        if (positional.length <= 0) {
          throw ArgumentError('LanguageModelToolInformation: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.LanguageModelToolInformation.fromJson(json);
      },
    },
    getters: {
      'name': (visitor, target) => D4.validateTarget<$pkg.LanguageModelToolInformation>(target, 'LanguageModelToolInformation').name,
      'description': (visitor, target) => D4.validateTarget<$pkg.LanguageModelToolInformation>(target, 'LanguageModelToolInformation').description,
      'inputSchema': (visitor, target) => D4.validateTarget<$pkg.LanguageModelToolInformation>(target, 'LanguageModelToolInformation').inputSchema,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.LanguageModelToolInformation>(target, 'LanguageModelToolInformation');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// VSCodeChat Bridge
// =============================================================================

BridgedClass _createVSCodeChatBridge() {
  return BridgedClass(
    nativeType: $pkg.VSCodeChat,
    name: 'VSCodeChat',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'VSCodeChat');
        final _bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, '_bridge', 'VSCodeChat');
        return $pkg.VSCodeChat(_bridge);
      },
    },
    methods: {
      'createChatParticipant': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.VSCodeChat>(target, 'VSCodeChat');
        D4.requireMinArgs(positional, 1, 'createChatParticipant');
        final id = D4.getRequiredArg<String>(positional, 0, 'id', 'createChatParticipant');
        if (!named.containsKey('handler') || named['handler'] == null) {
          throw ArgumentError('createChatParticipant: Missing required named argument "handler"');
        }
        final handler_raw = named['handler'];
        final description = D4.getOptionalNamedArg<String?>(named, 'description');
        final fullName = D4.getOptionalNamedArg<String?>(named, 'fullName');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return t.createChatParticipant(id, handler: ($pkg.ChatRequest p0, $pkg.ChatContext p1, $pkg.ChatResponseStream p2) { return (handler_raw as InterpretedFunction).call(visitor as InterpreterVisitor, [p0, p1, p2]) as Future<$pkg.ChatResult>; }, description: description, fullName: fullName, timeoutSeconds: timeoutSeconds);
      },
    },
    staticMethods: {
      'handleChatRequest': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'handleChatRequest');
        if (positional.length <= 0) {
          throw ArgumentError('handleChatRequest: Missing required argument "params" at position 0');
        }
        final params = D4.coerceMap<String, dynamic>(positional[0], 'params');
        return $pkg.VSCodeChat.handleChatRequest(params);
      },
    },
  );
}

// =============================================================================
// ChatParticipant Bridge
// =============================================================================

BridgedClass _createChatParticipantBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatParticipant,
    name: 'ChatParticipant',
    constructors: {
      '': (visitor, positional, named) {
        final id = D4.getRequiredNamedArg<String>(named, 'id', 'ChatParticipant');
        final description = D4.getOptionalNamedArg<String?>(named, 'description');
        final fullName = D4.getOptionalNamedArg<String?>(named, 'fullName');
        return $pkg.ChatParticipant(id: id, description: description, fullName: fullName);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'ChatParticipant');
        if (positional.length <= 0) {
          throw ArgumentError('ChatParticipant: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.ChatParticipant.fromJson(json);
      },
    },
    getters: {
      'id': (visitor, target) => D4.validateTarget<$pkg.ChatParticipant>(target, 'ChatParticipant').id,
      'description': (visitor, target) => D4.validateTarget<$pkg.ChatParticipant>(target, 'ChatParticipant').description,
      'fullName': (visitor, target) => D4.validateTarget<$pkg.ChatParticipant>(target, 'ChatParticipant').fullName,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatParticipant>(target, 'ChatParticipant');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// ChatRequest Bridge
// =============================================================================

BridgedClass _createChatRequestBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatRequest,
    name: 'ChatRequest',
    constructors: {
      '': (visitor, positional, named) {
        final prompt = D4.getRequiredNamedArg<String>(named, 'prompt', 'ChatRequest');
        final command = D4.getRequiredNamedArg<String>(named, 'command', 'ChatRequest');
        if (!named.containsKey('references') || named['references'] == null) {
          throw ArgumentError('ChatRequest: Missing required named argument "references"');
        }
        final references = D4.coerceList<$pkg.ChatPromptReference>(named['references'], 'references');
        return $pkg.ChatRequest(prompt: prompt, command: command, references: references);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'ChatRequest');
        if (positional.length <= 0) {
          throw ArgumentError('ChatRequest: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.ChatRequest.fromJson(json);
      },
    },
    getters: {
      'prompt': (visitor, target) => D4.validateTarget<$pkg.ChatRequest>(target, 'ChatRequest').prompt,
      'command': (visitor, target) => D4.validateTarget<$pkg.ChatRequest>(target, 'ChatRequest').command,
      'references': (visitor, target) => D4.validateTarget<$pkg.ChatRequest>(target, 'ChatRequest').references,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatRequest>(target, 'ChatRequest');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// ChatPromptReference Bridge
// =============================================================================

BridgedClass _createChatPromptReferenceBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatPromptReference,
    name: 'ChatPromptReference',
    constructors: {
      '': (visitor, positional, named) {
        final id = D4.getRequiredNamedArg<String>(named, 'id', 'ChatPromptReference');
        final value = D4.getRequiredNamedArg<dynamic>(named, 'value', 'ChatPromptReference');
        final modelDescription = D4.getOptionalNamedArg<String?>(named, 'modelDescription');
        return $pkg.ChatPromptReference(id: id, value: value, modelDescription: modelDescription);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'ChatPromptReference');
        if (positional.length <= 0) {
          throw ArgumentError('ChatPromptReference: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.ChatPromptReference.fromJson(json);
      },
    },
    getters: {
      'id': (visitor, target) => D4.validateTarget<$pkg.ChatPromptReference>(target, 'ChatPromptReference').id,
      'value': (visitor, target) => D4.validateTarget<$pkg.ChatPromptReference>(target, 'ChatPromptReference').value,
      'modelDescription': (visitor, target) => D4.validateTarget<$pkg.ChatPromptReference>(target, 'ChatPromptReference').modelDescription,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatPromptReference>(target, 'ChatPromptReference');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// ChatContext Bridge
// =============================================================================

BridgedClass _createChatContextBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatContext,
    name: 'ChatContext',
    constructors: {
      '': (visitor, positional, named) {
        if (!named.containsKey('history') || named['history'] == null) {
          throw ArgumentError('ChatContext: Missing required named argument "history"');
        }
        final history = D4.coerceList<dynamic>(named['history'], 'history');
        return $pkg.ChatContext(history: history);
      },
      'fromJson': (visitor, positional, named) {
        D4.requireMinArgs(positional, 1, 'ChatContext');
        if (positional.length <= 0) {
          throw ArgumentError('ChatContext: Missing required argument "json" at position 0');
        }
        final json = D4.coerceMap<String, dynamic>(positional[0], 'json');
        return $pkg.ChatContext.fromJson(json);
      },
    },
    getters: {
      'history': (visitor, target) => D4.validateTarget<$pkg.ChatContext>(target, 'ChatContext').history,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatContext>(target, 'ChatContext');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// ChatResult Bridge
// =============================================================================

BridgedClass _createChatResultBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatResult,
    name: 'ChatResult',
    constructors: {
      '': (visitor, positional, named) {
        final metadata = D4.coerceMapOrNull<String, dynamic>(named['metadata'], 'metadata');
        final errorDetails = D4.getOptionalNamedArg<$pkg.ChatErrorDetails?>(named, 'errorDetails');
        return $pkg.ChatResult(metadata: metadata, errorDetails: errorDetails);
      },
    },
    getters: {
      'metadata': (visitor, target) => D4.validateTarget<$pkg.ChatResult>(target, 'ChatResult').metadata,
      'errorDetails': (visitor, target) => D4.validateTarget<$pkg.ChatResult>(target, 'ChatResult').errorDetails,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResult>(target, 'ChatResult');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// ChatErrorDetails Bridge
// =============================================================================

BridgedClass _createChatErrorDetailsBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatErrorDetails,
    name: 'ChatErrorDetails',
    constructors: {
      '': (visitor, positional, named) {
        final message = D4.getRequiredNamedArg<String>(named, 'message', 'ChatErrorDetails');
        final responseIsFiltered = D4.getOptionalNamedArg<bool?>(named, 'responseIsFiltered');
        return $pkg.ChatErrorDetails(message: message, responseIsFiltered: responseIsFiltered);
      },
    },
    getters: {
      'message': (visitor, target) => D4.validateTarget<$pkg.ChatErrorDetails>(target, 'ChatErrorDetails').message,
      'responseIsFiltered': (visitor, target) => D4.validateTarget<$pkg.ChatErrorDetails>(target, 'ChatErrorDetails').responseIsFiltered,
    },
    methods: {
      'toJson': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatErrorDetails>(target, 'ChatErrorDetails');
        return t.toJson();
      },
    },
  );
}

// =============================================================================
// ChatResponseStream Bridge
// =============================================================================

BridgedClass _createChatResponseStreamBridge() {
  return BridgedClass(
    nativeType: $pkg.ChatResponseStream,
    name: 'ChatResponseStream',
    constructors: {
      '': (visitor, positional, named) {
        D4.requireMinArgs(positional, 2, 'ChatResponseStream');
        final _bridge = D4.getRequiredArg<dynamic>(positional, 0, '_bridge', 'ChatResponseStream');
        final _streamId = D4.getRequiredArg<String>(positional, 1, '_streamId', 'ChatResponseStream');
        return $pkg.ChatResponseStream(_bridge, _streamId);
      },
    },
    methods: {
      'markdown': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'markdown');
        final text = D4.getRequiredArg<String>(positional, 0, 'text', 'markdown');
        return t.markdown(text);
      },
      'anchor': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'anchor');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'anchor');
        final title = D4.getOptionalNamedArg<String?>(named, 'title');
        return t.anchor(uri, title: title);
      },
      'button': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'button');
        final command = D4.getRequiredArg<String>(positional, 0, 'command', 'button');
        final title = D4.getOptionalNamedArg<String?>(named, 'title');
        final arguments = D4.coerceListOrNull<dynamic>(named['arguments'], 'arguments');
        return t.button(command, title: title, arguments: arguments);
      },
      'filetree': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'filetree');
        if (positional.length <= 0) {
          throw ArgumentError('filetree: Missing required argument "files" at position 0');
        }
        final files = D4.coerceList<String>(positional[0], 'files');
        final baseUri = D4.getOptionalNamedArg<String?>(named, 'baseUri');
        return t.filetree(files, baseUri: baseUri);
      },
      'progress': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'progress');
        final value = D4.getRequiredArg<String>(positional, 0, 'value', 'progress');
        return t.progress(value);
      },
      'reference': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'reference');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'reference');
        final title = D4.getOptionalNamedArg<String?>(named, 'title');
        return t.reference(uri, title: title);
      },
      'error': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.ChatResponseStream>(target, 'ChatResponseStream');
        D4.requireMinArgs(positional, 1, 'error');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'error');
        return t.error(message);
      },
    },
  );
}

// =============================================================================
// VsCodeHelper Bridge
// =============================================================================

BridgedClass _createVsCodeHelperBridge() {
  return BridgedClass(
    nativeType: $pkg.VsCodeHelper,
    name: 'VsCodeHelper',
    constructors: {
    },
    staticMethods: {
      'getVSCode': (visitor, positional, named, typeArgs) {
        return $pkg.VsCodeHelper.getVSCode();
      },
      'setVSCode': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'setVSCode');
        final vscode = D4.getRequiredArg<$pkg.VSCode>(positional, 0, 'vscode', 'setVSCode');
        return $pkg.VsCodeHelper.setVSCode(vscode);
      },
      'initialize': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'initialize');
        final bridge = D4.getRequiredArg<$pkg.VSCodeBridgeServer>(positional, 0, 'bridge', 'initialize');
        return $pkg.VsCodeHelper.initialize(bridge);
      },
      'getWindowId': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return $pkg.VsCodeHelper.getWindowId(timeoutSeconds: timeoutSeconds);
      },
      'generateTimestampId': (visitor, positional, named, typeArgs) {
        return $pkg.VsCodeHelper.generateTimestampId();
      },
      'showInfo': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'showInfo');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'showInfo');
        final choices = D4.coerceListOrNull<String>(named['choices'], 'choices');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.showInfo(message, choices: choices, timeoutSeconds: timeoutSeconds);
      },
      'showWarning': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'showWarning');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'showWarning');
        final choices = D4.coerceListOrNull<String>(named['choices'], 'choices');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.showWarning(message, choices: choices, timeoutSeconds: timeoutSeconds);
      },
      'showError': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'showError');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'showError');
        final choices = D4.coerceListOrNull<String>(named['choices'], 'choices');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.showError(message, choices: choices, timeoutSeconds: timeoutSeconds);
      },
      'quickPick': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'quickPick');
        if (positional.length <= 0) {
          throw ArgumentError('quickPick: Missing required argument "items" at position 0');
        }
        final items = D4.coerceList<String>(positional[0], 'items');
        final placeholder = D4.getOptionalNamedArg<String?>(named, 'placeholder');
        final canPickMany = D4.getNamedArgWithDefault<bool>(named, 'canPickMany', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 1800);
        final fallbackValueOnTimeout = D4.getOptionalNamedArg<String?>(named, 'fallbackValueOnTimeout');
        final failOnTimeout = D4.getNamedArgWithDefault<bool>(named, 'failOnTimeout', false);
        return $pkg.VsCodeHelper.quickPick(items, placeholder: placeholder, canPickMany: canPickMany, timeoutSeconds: timeoutSeconds, fallbackValueOnTimeout: fallbackValueOnTimeout, failOnTimeout: failOnTimeout);
      },
      'inputBox': (visitor, positional, named, typeArgs) {
        final prompt = D4.getOptionalNamedArg<String?>(named, 'prompt');
        final placeholder = D4.getOptionalNamedArg<String?>(named, 'placeholder');
        final defaultValue = D4.getOptionalNamedArg<String?>(named, 'defaultValue');
        final password = D4.getNamedArgWithDefault<bool>(named, 'password', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 1800);
        final fallbackValueOnTimeout = D4.getOptionalNamedArg<String?>(named, 'fallbackValueOnTimeout');
        final failOnTimeout = D4.getNamedArgWithDefault<bool>(named, 'failOnTimeout', false);
        return $pkg.VsCodeHelper.inputBox(prompt: prompt, placeholder: placeholder, defaultValue: defaultValue, password: password, timeoutSeconds: timeoutSeconds, fallbackValueOnTimeout: fallbackValueOnTimeout, failOnTimeout: failOnTimeout);
      },
      'getWorkspaceRoot': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return $pkg.VsCodeHelper.getWorkspaceRoot(timeoutSeconds: timeoutSeconds);
      },
      'getWorkspaceFolders': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return $pkg.VsCodeHelper.getWorkspaceFolders(timeoutSeconds: timeoutSeconds);
      },
      'getActiveTextEditor': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return $pkg.VsCodeHelper.getActiveTextEditor(timeoutSeconds: timeoutSeconds);
      },
      'findFiles': (visitor, positional, named, typeArgs) {
        final include = D4.getRequiredNamedArg<String>(named, 'include', 'findFiles');
        final exclude = D4.getOptionalNamedArg<String?>(named, 'exclude');
        final maxResults = D4.getOptionalNamedArg<int?>(named, 'maxResults');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.findFiles(include: include, exclude: exclude, maxResults: maxResults, timeoutSeconds: timeoutSeconds);
      },
      'readFile': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'readFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'readFile');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.readFile(path, timeoutSeconds: timeoutSeconds);
      },
      'writeFile': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'writeFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'writeFile');
        final content = D4.getRequiredArg<String>(positional, 1, 'content', 'writeFile');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.writeFile(path, content, timeoutSeconds: timeoutSeconds);
      },
      'createFile': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'createFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'createFile');
        final content = D4.getNamedArgWithDefault<String>(named, 'content', '');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.createFile(path, content: content, timeoutSeconds: timeoutSeconds);
      },
      'deleteFile': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'deleteFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'deleteFile');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.deleteFile(path, timeoutSeconds: timeoutSeconds);
      },
      'fileExists': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'fileExists');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'fileExists');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 30);
        return $pkg.VsCodeHelper.fileExists(path, timeoutSeconds: timeoutSeconds);
      },
      'executeCommand': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'executeCommand');
        final command = D4.getRequiredArg<String>(positional, 0, 'command', 'executeCommand');
        final args = D4.coerceListOrNull<dynamic>(named['args'], 'args');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.executeCommand(command, args: args, timeoutSeconds: timeoutSeconds);
      },
      'setStatus': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'setStatus');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'setStatus');
        final timeout = D4.getOptionalNamedArg<int?>(named, 'timeout');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.setStatus(message, timeout: timeout, timeoutSeconds: timeoutSeconds);
      },
      'createOutput': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'createOutput');
        final name = D4.getRequiredArg<String>(positional, 0, 'name', 'createOutput');
        final initialContent = D4.getOptionalNamedArg<String?>(named, 'initialContent');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.createOutput(name, initialContent: initialContent, timeoutSeconds: timeoutSeconds);
      },
      'appendOutput': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'appendOutput');
        final channel = D4.getRequiredArg<String>(positional, 0, 'channel', 'appendOutput');
        final text = D4.getRequiredArg<String>(positional, 1, 'text', 'appendOutput');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.appendOutput(channel, text, timeoutSeconds: timeoutSeconds);
      },
      'copyToClipboard': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'copyToClipboard');
        final text = D4.getRequiredArg<String>(positional, 0, 'text', 'copyToClipboard');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10);
        return $pkg.VsCodeHelper.copyToClipboard(text, timeoutSeconds: timeoutSeconds);
      },
      'readClipboard': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 10);
        return $pkg.VsCodeHelper.readClipboard(timeoutSeconds: timeoutSeconds);
      },
      'openFile': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'openFile');
        final path = D4.getRequiredArg<String>(positional, 0, 'path', 'openFile');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 600);
        return $pkg.VsCodeHelper.openFile(path, timeoutSeconds: timeoutSeconds);
      },
      'getConfig': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'getConfig');
        final section = D4.getRequiredArg<String>(positional, 0, 'section', 'getConfig');
        final key = D4.getOptionalNamedArg<String?>(named, 'key');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.getConfig(section, key: key, timeoutSeconds: timeoutSeconds);
      },
      'setConfig': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 3, 'setConfig');
        final section = D4.getRequiredArg<String>(positional, 0, 'section', 'setConfig');
        final key = D4.getRequiredArg<String>(positional, 1, 'key', 'setConfig');
        final value = D4.getRequiredArg<dynamic>(positional, 2, 'value', 'setConfig');
        final global = D4.getNamedArgWithDefault<bool>(named, 'global', true);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.setConfig(section, key, value, global: global, timeoutSeconds: timeoutSeconds);
      },
      'runPubGet': (visitor, positional, named, typeArgs) {
        final workingDirectory = D4.getOptionalNamedArg<String?>(named, 'workingDirectory');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.runPubGet(workingDirectory: workingDirectory, timeoutSeconds: timeoutSeconds);
      },
      'runPubUpgrade': (visitor, positional, named, typeArgs) {
        final workingDirectory = D4.getOptionalNamedArg<String?>(named, 'workingDirectory');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.runPubUpgrade(workingDirectory: workingDirectory, timeoutSeconds: timeoutSeconds);
      },
      'addDependency': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'addDependency');
        final name = D4.getRequiredArg<String>(positional, 0, 'name', 'addDependency');
        final version = D4.getOptionalNamedArg<String?>(named, 'version');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.addDependency(name, version: version, timeoutSeconds: timeoutSeconds);
      },
      'getDiagnostics': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'getDiagnostics');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'getDiagnostics');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.getDiagnostics(uri, timeoutSeconds: timeoutSeconds);
      },
      'formatDocument': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'formatDocument');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'formatDocument');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.formatDocument(uri, timeoutSeconds: timeoutSeconds);
      },
      'organizeImports': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'organizeImports');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'organizeImports');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.organizeImports(uri, timeoutSeconds: timeoutSeconds);
      },
      'hotReload': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.hotReload(timeoutSeconds: timeoutSeconds);
      },
      'hotRestart': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 240);
        return $pkg.VsCodeHelper.hotRestart(timeoutSeconds: timeoutSeconds);
      },
      'getFlutterDevices': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.getFlutterDevices(timeoutSeconds: timeoutSeconds);
      },
      'runFlutterApp': (visitor, positional, named, typeArgs) {
        final deviceId = D4.getOptionalNamedArg<String?>(named, 'deviceId');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 420);
        return $pkg.VsCodeHelper.runFlutterApp(deviceId: deviceId, timeoutSeconds: timeoutSeconds);
      },
      'askCopilot': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'askCopilot');
        final prompt = D4.getRequiredArg<String>(positional, 0, 'prompt', 'askCopilot');
        final context = D4.getOptionalNamedArg<String?>(named, 'context');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.askCopilot(prompt, context: context, timeoutSeconds: timeoutSeconds);
      },
      'askCopilotChat': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'askCopilotChat');
        final prompt = D4.getRequiredArg<String>(positional, 0, 'prompt', 'askCopilotChat');
        final requestId = D4.getRequiredNamedArg<String>(named, 'requestId', 'askCopilotChat');
        final pollIntervalSeconds = D4.getNamedArgWithDefault<int>(named, 'pollIntervalSeconds', 10);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 7200);
        final customResponseInstructions = D4.getNamedArgWithDefault<bool>(named, 'customResponseInstructions', false);
        return $pkg.VsCodeHelper.askCopilotChat(prompt, requestId: requestId, pollIntervalSeconds: pollIntervalSeconds, timeoutSeconds: timeoutSeconds, customResponseInstructions: customResponseInstructions);
      },
      'askModel': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'askModel');
        final modelId = D4.getRequiredArg<String>(positional, 0, 'modelId', 'askModel');
        final prompt = D4.getRequiredArg<String>(positional, 1, 'prompt', 'askModel');
        final context = D4.getOptionalNamedArg<String?>(named, 'context');
        final vendor = D4.getNamedArgWithDefault<String>(named, 'vendor', 'copilot');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.askModel(modelId, prompt, context: context, vendor: vendor, timeoutSeconds: timeoutSeconds);
      },
      'getCopilotSuggestion': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'getCopilotSuggestion');
        final code = D4.getRequiredArg<String>(positional, 0, 'code', 'getCopilotSuggestion');
        final instruction = D4.getRequiredArg<String>(positional, 1, 'instruction', 'getCopilotSuggestion');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.getCopilotSuggestion(code, instruction, timeoutSeconds: timeoutSeconds);
      },
      'explainCode': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'explainCode');
        final code = D4.getRequiredArg<String>(positional, 0, 'code', 'explainCode');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.explainCode(code, timeoutSeconds: timeoutSeconds);
      },
      'reviewCode': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'reviewCode');
        final code = D4.getRequiredArg<String>(positional, 0, 'code', 'reviewCode');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.reviewCode(code, timeoutSeconds: timeoutSeconds);
      },
      'generateTests': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'generateTests');
        final code = D4.getRequiredArg<String>(positional, 0, 'code', 'generateTests');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.generateTests(code, timeoutSeconds: timeoutSeconds);
      },
      'fixCode': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'fixCode');
        final code = D4.getRequiredArg<String>(positional, 0, 'code', 'fixCode');
        final error = D4.getRequiredArg<String>(positional, 1, 'error', 'fixCode');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.fixCode(code, error, timeoutSeconds: timeoutSeconds);
      },
      'selectCopilotModel': (visitor, positional, named, typeArgs) {
        final family = D4.getOptionalNamedArg<String?>(named, 'family');
        final vendor = D4.getOptionalNamedArg<String?>(named, 'vendor');
        final id = D4.getOptionalNamedArg<String?>(named, 'id');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.selectCopilotModel(family: family, vendor: vendor, id: id, timeoutSeconds: timeoutSeconds);
      },
      'getCopilotModels': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.getCopilotModels(timeoutSeconds: timeoutSeconds);
      },
      'replaceText': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 6, 'replaceText');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'replaceText');
        final startLine = D4.getRequiredArg<int>(positional, 1, 'startLine', 'replaceText');
        final startChar = D4.getRequiredArg<int>(positional, 2, 'startChar', 'replaceText');
        final endLine = D4.getRequiredArg<int>(positional, 3, 'endLine', 'replaceText');
        final endChar = D4.getRequiredArg<int>(positional, 4, 'endChar', 'replaceText');
        final text = D4.getRequiredArg<String>(positional, 5, 'text', 'replaceText');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.replaceText(uri, startLine, startChar, endLine, endChar, text, timeoutSeconds: timeoutSeconds);
      },
      'insertSnippet': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 4, 'insertSnippet');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'insertSnippet');
        final line = D4.getRequiredArg<int>(positional, 1, 'line', 'insertSnippet');
        final character = D4.getRequiredArg<int>(positional, 2, 'character', 'insertSnippet');
        final snippet = D4.getRequiredArg<String>(positional, 3, 'snippet', 'insertSnippet');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.insertSnippet(uri, line, character, snippet, timeoutSeconds: timeoutSeconds);
      },
      'applyWorkspaceEdit': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'applyWorkspaceEdit');
        if (positional.length <= 0) {
          throw ArgumentError('applyWorkspaceEdit: Missing required argument "edits" at position 0');
        }
        final edits = D4.coerceList<Map<String, dynamic>>(positional[0], 'edits');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.applyWorkspaceEdit(edits, timeoutSeconds: timeoutSeconds);
      },
      'getSelection': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.getSelection(timeoutSeconds: timeoutSeconds);
      },
      'setSelection': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 4, 'setSelection');
        final startLine = D4.getRequiredArg<int>(positional, 0, 'startLine', 'setSelection');
        final startChar = D4.getRequiredArg<int>(positional, 1, 'startChar', 'setSelection');
        final endLine = D4.getRequiredArg<int>(positional, 2, 'endLine', 'setSelection');
        final endChar = D4.getRequiredArg<int>(positional, 3, 'endChar', 'setSelection');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.setSelection(startLine, startChar, endLine, endChar, timeoutSeconds: timeoutSeconds);
      },
      'getCursorPosition': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 60);
        return $pkg.VsCodeHelper.getCursorPosition(timeoutSeconds: timeoutSeconds);
      },
      'getProjectFiles': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'getProjectFiles');
        final pattern = D4.getRequiredArg<String>(positional, 0, 'pattern', 'getProjectFiles');
        final excludeTests = D4.getNamedArgWithDefault<bool>(named, 'excludeTests', true);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.getProjectFiles(pattern, excludeTests: excludeTests, timeoutSeconds: timeoutSeconds);
      },
      'getGitRoot': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.getGitRoot(timeoutSeconds: timeoutSeconds);
      },
      'getProjectType': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 120);
        return $pkg.VsCodeHelper.getProjectType(timeoutSeconds: timeoutSeconds);
      },
      'searchInWorkspace': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'searchInWorkspace');
        final query = D4.getRequiredArg<String>(positional, 0, 'query', 'searchInWorkspace');
        final includePattern = D4.getOptionalNamedArg<String?>(named, 'includePattern');
        final excludePattern = D4.getOptionalNamedArg<String?>(named, 'excludePattern');
        final isRegex = D4.getNamedArgWithDefault<bool>(named, 'isRegex', false);
        final maxResults = D4.getOptionalNamedArg<int?>(named, 'maxResults');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.searchInWorkspace(query, includePattern: includePattern, excludePattern: excludePattern, isRegex: isRegex, maxResults: maxResults, timeoutSeconds: timeoutSeconds);
      },
      'replaceInWorkspace': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'replaceInWorkspace');
        final query = D4.getRequiredArg<String>(positional, 0, 'query', 'replaceInWorkspace');
        final replacement = D4.getRequiredArg<String>(positional, 1, 'replacement', 'replaceInWorkspace');
        final includePattern = D4.getOptionalNamedArg<String?>(named, 'includePattern');
        final excludePattern = D4.getOptionalNamedArg<String?>(named, 'excludePattern');
        final isRegex = D4.getNamedArgWithDefault<bool>(named, 'isRegex', false);
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.replaceInWorkspace(query, replacement, includePattern: includePattern, excludePattern: excludePattern, isRegex: isRegex, timeoutSeconds: timeoutSeconds);
      },
      'runTests': (visitor, positional, named, typeArgs) {
        final uri = D4.getOptionalNamedArg<String?>(named, 'uri');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 420);
        return $pkg.VsCodeHelper.runTests(uri: uri, timeoutSeconds: timeoutSeconds);
      },
      'runTestsWithCoverage': (visitor, positional, named, typeArgs) {
        final uri = D4.getOptionalNamedArg<String?>(named, 'uri');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 600);
        return $pkg.VsCodeHelper.runTestsWithCoverage(uri: uri, timeoutSeconds: timeoutSeconds);
      },
      'getTestResults': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 240);
        return $pkg.VsCodeHelper.getTestResults(timeoutSeconds: timeoutSeconds);
      },
      'startDebugging': (visitor, positional, named, typeArgs) {
        final config = D4.coerceMapOrNull<String, dynamic>(named['config'], 'config');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 300);
        return $pkg.VsCodeHelper.startDebugging(config: config, timeoutSeconds: timeoutSeconds);
      },
      'stopDebugging': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.stopDebugging(timeoutSeconds: timeoutSeconds);
      },
      'setBreakpoint': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'setBreakpoint');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'setBreakpoint');
        final line = D4.getRequiredArg<int>(positional, 1, 'line', 'setBreakpoint');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.setBreakpoint(uri, line, timeoutSeconds: timeoutSeconds);
      },
      'removeBreakpoint': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 2, 'removeBreakpoint');
        final uri = D4.getRequiredArg<String>(positional, 0, 'uri', 'removeBreakpoint');
        final line = D4.getRequiredArg<int>(positional, 1, 'line', 'removeBreakpoint');
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.removeBreakpoint(uri, line, timeoutSeconds: timeoutSeconds);
      },
      'getBreakpoints': (visitor, positional, named, typeArgs) {
        final timeoutSeconds = D4.getNamedArgWithDefault<int>(named, 'timeoutSeconds', 180);
        return $pkg.VsCodeHelper.getBreakpoints(timeoutSeconds: timeoutSeconds);
      },
    },
  );
}

// =============================================================================
// Progress Bridge
// =============================================================================

BridgedClass _createProgressBridge() {
  return BridgedClass(
    nativeType: $pkg.Progress,
    name: 'Progress',
    constructors: {
    },
    getters: {
      'channelName': (visitor, target) => D4.validateTarget<$pkg.Progress>(target, 'Progress').channelName,
    },
    methods: {
      'report': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Progress>(target, 'Progress');
        D4.requireMinArgs(positional, 1, 'report');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'report');
        return t.report(message);
      },
      'complete': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Progress>(target, 'Progress');
        return t.complete();
      },
      'error': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.Progress>(target, 'Progress');
        D4.requireMinArgs(positional, 1, 'error');
        final message = D4.getRequiredArg<String>(positional, 0, 'message', 'error');
        return t.error(message);
      },
    },
    staticMethods: {
      'create': (visitor, positional, named, typeArgs) {
        D4.requireMinArgs(positional, 1, 'create');
        final name = D4.getRequiredArg<String>(positional, 0, 'name', 'create');
        return $pkg.Progress.create(name);
      },
    },
  );
}

// =============================================================================
// FileBatch Bridge
// =============================================================================

BridgedClass _createFileBatchBridge() {
  return BridgedClass(
    nativeType: $pkg.FileBatch,
    name: 'FileBatch',
    constructors: {
    },
    getters: {
      'files': (visitor, target) => D4.validateTarget<$pkg.FileBatch>(target, 'FileBatch').files,
      'count': (visitor, target) => D4.validateTarget<$pkg.FileBatch>(target, 'FileBatch').count,
    },
    methods: {
      'process': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.FileBatch>(target, 'FileBatch');
        D4.requireMinArgs(positional, 1, 'process');
        if (positional.length <= 0) {
          throw ArgumentError('process: Missing required argument "processor" at position 0');
        }
        final processor_raw = positional[0];
        return t.process((String p0, String p1) { return (processor_raw as InterpretedFunction).call(visitor as InterpreterVisitor, [p0, p1]) as Future<dynamic>; });
      },
      'filter': (visitor, target, positional, named, typeArgs) {
        final t = D4.validateTarget<$pkg.FileBatch>(target, 'FileBatch');
        D4.requireMinArgs(positional, 1, 'filter');
        if (positional.length <= 0) {
          throw ArgumentError('filter: Missing required argument "predicate" at position 0');
        }
        final predicate_raw = positional[0];
        return t.filter((String p0) { return (predicate_raw as InterpretedFunction).call(visitor as InterpreterVisitor, [p0]) as bool; });
      },
    },
    staticMethods: {
      'fromPattern': (visitor, positional, named, typeArgs) {
        final include = D4.getRequiredNamedArg<String>(named, 'include', 'fromPattern');
        final exclude = D4.getOptionalNamedArg<String?>(named, 'exclude');
        final maxResults = D4.getOptionalNamedArg<int?>(named, 'maxResults');
        return $pkg.FileBatch.fromPattern(include: include, exclude: exclude, maxResults: maxResults);
      },
    },
  );
}

