/**
 * Desktop Context Types
 * 
 * Type definitions for the desktop context awareness feature
 */

/**
 * Focused window information
 */
export interface FocusedWindow {
  windowId: string;
  title: string;
  application: string;
  windowClass: string;
}

/**
 * Desktop context information
 */
export interface DesktopContext {
  focusedWindow: FocusedWindow | null;
  currentDirectory: string | null;
  screenContent: string | null;
  lastUpdate: Date | null;
  captureEnabled: boolean;
  ocrEnabled: boolean;
  directorySyncEnabled: boolean;
}

/**
 * Context settings
 */
export interface ContextSettings {
  captureInterval: number;        // 5000-60000 ms
  captureEnabled: boolean;
  ocrEnabled: boolean;
  directorySyncEnabled: boolean;
}

/**
 * Context update message from WebSocket
 */
export interface ContextUpdateMessage {
  type: 'context_update';
  context: DesktopContext;
  timestamp: string;
}
