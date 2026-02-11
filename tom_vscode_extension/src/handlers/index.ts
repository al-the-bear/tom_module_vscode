/**
 * Command Handlers Index
 *
 * This module exports all command handlers for the VS Code extension.
 * Each handler is responsible for a specific dartscript.* command.
 */

// Shared utilities
export {
    bridgeLog,
    handleError,
    getWorkspaceRoot,
    getWorkspaceStructure,
    ensureBridgeRunning,
    getCopilotModel,
    sendCopilotRequest,
    validateDartFile,
    getFilePath,
    showAnalysisResult,
    getBridgeClient,
    setBridgeClient
} from './handler_shared';

// Command handlers
export { sendToChatHandler } from './sendToChat-handler';
export { SendToChatAdvancedManager } from './sendToChatAdvanced-handler';
export { executeInTomAiBuildHandler } from './executeInTomAiBuild-handler';
export { executeAsScriptHandler } from './executeAsScript-handler';
export { restartBridgeHandler, initializeBridgeClient, switchBridgeProfileHandler } from './restartBridge-handler';
export { runTestsHandler } from './runTests-handler';
export { reloadWindowHandler } from './reloadWindow-handler';
export {
    startCliServerHandler,
    startCliServerCustomPortHandler,
    stopCliServerHandler
} from './cliServer-handler';
export { startProcessMonitorHandler } from './processMonitor-handler';
export { toggleBridgeDebugLoggingHandler } from './debugLogging-handler';
export { printConfigurationHandler } from './printConfiguration-handler';
export { showHelpHandler } from './showHelp-handler';
export { showApiInfoHandler } from './showApiInfo-handler';
export { startTomAiChatHandler, sendToTomAiChatHandler, interruptTomAiChatHandler } from './tomAiChat-handler';
export {
    expandPromptHandler,
    createProfileHandler,
    switchModelHandler,
    PromptExpanderManager,
    setPromptExpanderManager,
    getPromptExpanderManager,
} from './expandPrompt-handler';
export {
    startBotConversationHandler,
    stopBotConversationHandler,
    haltBotConversationHandler,
    continueBotConversationHandler,
    addToBotConversationHandler,
    BotConversationManager,
    setBotConversationManager,
    getBotConversationManager,
} from './botConversation-handler';
export { registerChordMenuCommands } from './chordMenu-handler';
export { registerCommandlineCommands } from './commandline-handler';
export { registerCombinedCommands } from './combinedCommand-handler';
export { telegramTestHandler, telegramToggleHandler, telegramConfigureHandler, disposeTelegramStandalone } from './telegram-commands';
