/// Tom VS Code Bridge D4rt Bridge Generator
///
/// Generates D4rt BridgedClass implementations for VS Code API classes.
///
/// ## Usage
///
/// ```bash
/// # Generate all modules from exports
/// dart run tool/generate_bridge.dart --all
///
/// # Generate a specific module
/// dart run tool/generate_bridge.dart --module=vscode_api
///
/// # List available modules
/// dart run tool/generate_bridge.dart --list
/// ```
///
/// ## How It Works
///
/// The generator scans barrel export files (e.g., `lib/tom_vscode_bridge.dart`) to
/// discover which classes should be bridged. Only classes that are explicitly
/// exported are included. Hide/show clauses are respected.
library;

import 'dart:io';

import 'package:tom_d4rt_generator/tom_d4rt_generator.dart';

/// Module configuration for bridge generation.
class ModuleConfig {
  /// Display name for the module.
  final String name;

  /// Source directories (legacy mode) - used with --no-exports.
  final List<String> sourceDirs;

  /// Barrel files to scan for exports (preferred mode).
  final List<String> barrelFiles;

  /// Output path for the generated bridge file.
  final String outputPath;

  /// Import path for the barrel file in generated code.
  final String? barrelImport;

  /// File path patterns to exclude.
  final List<String> excludePatterns;

  /// Class names to exclude.
  final List<String> excludeClasses;

  const ModuleConfig({
    required this.name,
    this.sourceDirs = const [],
    this.barrelFiles = const [],
    required this.outputPath,
    this.barrelImport,
    this.excludePatterns = const [],
    this.excludeClasses = const [],
  });
}

/// Predefined module configurations.
final moduleConfigs = <String, ModuleConfig>{
  // Main tom_vscode_bridge.dart - generates all exported classes
  'all': ModuleConfig(
    name: 'all',
    barrelFiles: ['lib/tom_vscode_bridge.dart'],
    outputPath: 'lib/src/d4rt_bridges/tom_vscode_bridge_bridges.dart',
    barrelImport: 'tom_vscode_bridge.dart',
    excludePatterns: [
      '_bridge.dart',
      '_generated.dart',
      'bridge_server.dart', // Internal bridge server, not for D4rt
      'script_api.dart', // Internal API for scripts
      'standalone_bridge_runner.dart', // Test runner
    ],
    excludeClasses: [
      'VSCodeBridgeServer', // Internal server
      'StandaloneBridgeRunner', // Test utility
    ],
  ),
};

void main(List<String> args) async {
  // Parse arguments
  final listMode = args.contains('--list') || args.contains('-l');
  final allMode = args.contains('--all');
  final noExports = args.contains('--no-exports');
  final verbose = args.contains('--verbose') || args.contains('-v');

  String? moduleName;
  for (final arg in args) {
    if (arg.startsWith('--module=')) {
      moduleName = arg.substring('--module='.length);
    } else if (arg.startsWith('-m=')) {
      moduleName = arg.substring('-m='.length);
    }
  }

  // List available modules
  if (listMode) {
    print('Available modules:');
    for (final entry in moduleConfigs.entries) {
      print('  ${entry.key.padRight(20)} -> ${entry.value.outputPath}');
    }
    print('\nUsage:');
    print('  dart run tool/generate_bridge.dart --all');
    print('  dart run tool/generate_bridge.dart --module=vscode_api');
    exit(0);
  }

  // Determine which modules to generate
  final modulesToGenerate = <String>[];
  if (allMode) {
    modulesToGenerate.addAll(moduleConfigs.keys);
  } else if (moduleName != null) {
    if (!moduleConfigs.containsKey(moduleName)) {
      stderr.writeln('Error: Unknown module "$moduleName"');
      stderr.writeln('Use --list to see available modules');
      exit(1);
    }
    modulesToGenerate.add(moduleName);
  } else {
    stderr.writeln('Error: Must specify --all or --module=<name>');
    stderr.writeln('Use --list to see available modules or --help for usage');
    exit(1);
  }

  // Generate each module
  var hadErrors = false;
  for (final moduleName in modulesToGenerate) {
    final config = moduleConfigs[moduleName]!;

    print('\n${'=' * 80}');
    print('Generating bridge for: ${config.name}');
    print('${'=' * 80}\n');

    try {
      final workspacePath = Directory.current.path;
      
      // Use helpers from tom_d4rt
      final helpersPath = 'package:tom_d4rt/tom_d4rt.dart';

      final generator = BridgeGenerator(
        workspacePath: workspacePath,
        packageName: 'tom_vscode_bridge',
        sourceImport: config.barrelImport,
        helpersImport: helpersPath,
        readOnly: false,
        skipPrivate: true,
        verbose: verbose,
      );

      final outputFilePath = '$workspacePath/${config.outputPath}';

      // Convert module name to PascalCase for bridge class naming
      final bridgeClassName = config.name
          .split('_')
          .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
          .join();

      BridgeGeneratorResult result;

      // Prefer export-based generation if barrel files are configured
      if (!noExports && config.barrelFiles.isNotEmpty) {
        final barrelPaths = config.barrelFiles
            .map((f) => '$workspacePath/$f')
            .toList();

        if (verbose) {
          print('Scanning barrel files: ${barrelPaths.join(', ')}');
        }

        result = await generator.generateBridgesFromExports(
          barrelFiles: barrelPaths,
          outputPath: outputFilePath,
          moduleName: bridgeClassName,
          excludePatterns: config.excludePatterns,
          excludeClasses: config.excludeClasses,
        );
      } else {
        // Legacy approach: scan source directories
        final sourceFiles = <String>[];

        for (final dir in config.sourceDirs) {
          final dirPath = '$workspacePath/$dir';
          final directory = Directory(dirPath);
          if (directory.existsSync()) {
            final files = directory
                .listSync()
                .whereType<File>()
                .where((f) {
                  final path = f.path;
                  if (!path.endsWith('.dart')) return false;
                  for (final pattern in config.excludePatterns) {
                    if (path.contains(pattern)) return false;
                  }
                  return true;
                })
                .map((f) => f.path)
                .toList();
            sourceFiles.addAll(files);
            if (verbose) {
              print('Found ${files.length} files in $dir');
            }
          }
        }

        if (sourceFiles.isEmpty) {
          print('No source files found for module ${config.name}');
          continue;
        }

        print('Processing ${sourceFiles.length} source files...');

        result = await generator.generateBridges(
          sourceFiles: sourceFiles,
          outputPath: outputFilePath,
          moduleName: bridgeClassName,
          excludeClasses: config.excludeClasses.isNotEmpty
              ? config.excludeClasses
              : null,
        );
      }
      
      print('\n✓ Successfully generated: ${config.outputPath}');
      print('  Classes: ${result.classesGenerated}');
      if (result.warnings.isNotEmpty) {
        print('  Warnings: ${result.warnings.length}');
        if (verbose) {
          for (final warning in result.warnings) {
            print('    - $warning');
          }
        }
      }
    } catch (e, stackTrace) {
      hadErrors = true;
      stderr.writeln('\n✗ Error generating ${config.name}:');
      stderr.writeln(e);
      if (verbose) {
        stderr.writeln(stackTrace);
      }
    }
  }

  if (hadErrors) {
    exit(1);
  } else {
    print('\n${'=' * 80}');
    print('✓ All bridge generation completed successfully');
    print('${'=' * 80}\n');
  }
}
