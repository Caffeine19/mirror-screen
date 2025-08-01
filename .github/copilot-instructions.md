# Copilot Instructions: Mirror Screen Raycast Extension

## Architecture Overview

This is a Raycast extension that controls macOS Screen Mirroring through a **hybrid TypeScript + Lua architecture**:

- **UI Layer**: React components using Raycast API (`src/mirror-screen.tsx`)
- **Bridge Layer**: TypeScript utilities that generate and execute Lua scripts (`src/utils/`)
- **Automation Layer**: Lua scripts that interact with macOS accessibility APIs via Hammerspoon

## Key Integration Pattern: TypeScript → AppleScript → Hammerspoon → Lua

The core automation flow follows this chain:

1. TypeScript functions in `src/utils/screenMirror.ts` generate Lua scripts as strings
2. `callHammerspoon()` wraps Lua in AppleScript and executes via `runAppleScript()`
3. Hammerspoon executes the Lua code to interact with macOS Control Center
4. Results are JSON-encoded in Lua and parsed back to TypeScript interfaces

Example from `screenMirror.ts`:

```typescript
export async function toggleDisplayMirroring(displayTitle: string): Promise<ToggleDisplayResult> {
  const luaCode = generateToggleDisplayLua(displayTitle); // Generate Lua as string
  const response = await callHammerspoon(luaCode); // Execute via AppleScript bridge
  return JSON.parse(response); // Parse Lua JSON response
}
```

## Critical Dependencies

- **Hammerspoon**: Must be installed and running on the user's Mac for any functionality to work
- **Accessibility Permissions**: Required for Lua scripts to interact with Control Center UI elements
- **Control Center**: Extension specifically targets macOS Control Center's Screen Mirroring interface

## State Management Patterns

- Use `useCachedState<ScreenDisplay[]>` for persisting discovered displays between sessions
- Display state includes `"(Currently Mirroring)"` suffix in titles to indicate active status
- UI logic strips this suffix for clean display while preserving it for toggle operations

## Lua Script Patterns

When modifying Lua generation functions:

- Always include recursive depth limits (`depth > 10`) to prevent infinite loops
- Use `hs.timer.usleep()` for timing between UI interactions (500ms for dialogs, 300ms for actions)
- Include comprehensive logging with emoji prefixes for debugging: `logger.i("🔍 Starting search...")`
- End scripts with `hs.eventtap.keyStroke({}, "escape")` to close Control Center dialogs
- Structure as embedded template literals with `${variable}` interpolation

## UI Convention: Icon + Color Coding

Display status is indicated through icon and color combinations:

```typescript
icon={{
  source: isCurrentlyMirroring ? Icon.Circle : Icon.Monitor,
  tintColor: isCurrentlyMirroring ? "#00FF00" : undefined,
}}
```

- 🟢 Green circle: Currently mirroring
- 🖥️ Monitor icon: Available displays

## Development Workflow

- `npm run dev`: Start Raycast development mode
- `npm run build`: Build extension for production
- Debug Lua execution via console logs in `callHammerspoon()` - both AppleScript and returned values are logged

## Error Handling Pattern

All async operations follow this pattern:

```typescript
try {
  setIsLoading(true);
  const result = await utilityFunction();
  // Handle success/failure with appropriate toast messages
} catch (error) {
  console.error("Context-specific error message:", error);
  showToast({ style: Toast.Style.Failure, title: "User-friendly title" });
} finally {
  setIsLoading(false);
}
```
