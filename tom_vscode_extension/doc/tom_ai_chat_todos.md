# Tom AI Chat Implementation Plan

Step-by-step plan for implementing the Tom AI chat workflow in the VS Code extension.

## Progress

- [x] Phase 1 - Commands, Keybindings, and Configuration
- [x] Phase 2 - Chat File Handling
- [x] Phase 3 - Model/Participant Integration
- [x] Phase 4 - Response & Summary File Management
- [x] Phase 5 - Output Channels
- [x] Phase 6 - Documentation & Tests
- [ ] Phase 7 - QA and Packaging

## Phase 1 - Commands, Keybindings, and Configuration

1. **Add configuration settings**
   - `dartscript.tomAiChat.modelId` (default: gpt-4o)
   - `dartscript.tomAiChat.responsesTokenLimit`
   - `dartscript.tomAiChat.responseSummaryTokenLimit`

2. **Register commands**
   - `dartscript.startTomAIChat`
   - `dartscript.sendToTomAIChat`

3. **Add keybindings (scoped to `*.chat.md`)**
   - `Cmd+T`, `Cmd+N` → `dartscript.startTomAIChat`
   - `Cmd+T`, `Cmd+S` → `dartscript.sendToTomAIChat`

4. **Add command titles & menu entries**
   - Command palette entries
   - Editor context menu for `*.chat.md`

## Phase 2 - Chat File Handling

5. **Implement chat file parsing**
   - Read metadata header
   - Detect `CHAT <chat-id>` header
   - Extract prompt block between header and first separator (`---` or `___`)

6. **Implement chat file initialization** (`startTomAIChat`)
   - Create `<chat-id>.chat.md` if missing
   - Insert metadata block (editable plain text)
   - Add `CHAT <chat-id>` header
   - Overwrite `<chat-id>.responses.md` and `<chat-id>.response-summary.md`

7. **Implement post-processing updates** (`sendToTomAIChat`)
   - Insert separator of 30 underscores
   - Insert two blank lines above processed block
   - Move cursor to blank input area

## Phase 3 - Model/Participant Integration

8. **Create chat participant**
   - Register participant on demand
   - Use participant context to obtain `toolInvocationToken`

9. **Send prompt via LM API**
   - Build prompt template with response summary reference
   - Stream intermediate output to **Tom AI Chat Log**
   - Stream final output to **Tom AI Chat Responses**

10. **Tool execution**
    - Detect tool calls from model response
    - Invoke tools with `toolInvocationToken`
    - Refresh participant and retry on failure

## Phase 4 - Response & Summary File Management

11. **Write `<chat-id>.responses.md`**
    - Prepend newest response at top
    - Create file if missing

12. **Generate `<chat-id>.response-summary.md`**
    - Skip if responses file missing
    - Apply summary token limit

13. **Token trimming**
    - Use `model.countTokens()` for estimates
    - Trim oldest entries until under configured limits

## Phase 5 - Output Channels

14. **Create output channels**
    - `Tom AI Chat Log` for tool/intermediate output
    - `Tom AI Chat Responses` for final markdown response

## Phase 6 - Documentation & Tests

15. **Update docs**
    - Add command usage to README and user guide
    - Keep design doc in sync

16. **Add tests**
    - Parser tests for prompt extraction
    - File overwrite behavior
    - Token trimming logic

## Phase 7 - QA and Packaging

17. **Run `dart analyze`** on affected packages
18. **Reinstall extension** using `reinstall_for_testing.sh`
19. **Verify keybindings and commands**
20. **Manual end-to-end test** with a sample `<chat-id>.chat.md`
