import { shell, BrowserWindow } from "electron";
import log from "electron-log";
import { createLoggedHandler } from "./safe_handle";

const logger = log.scope("shell_handlers");
const handle = createLoggedHandler(logger);

export function registerShellHandlers() {
  handle("open-external-url", async (_event, url: string) => {
    if (!url) {
      throw new Error("No URL provided.");
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Attempted to open invalid or non-http URL: " + url);
    }

    // Check if this is an OAuth URL (contains oauth or device code patterns)
    const isOAuthUrl = url.includes('oauth') || url.includes('device') || url.includes('qwen.ai');

    if (isOAuthUrl) {
      // Create a popup window for OAuth flows
      const oauthWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
        titleBarStyle: 'default',
        resizable: true,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        modal: false,
      });

      oauthWindow.once('ready-to-show', () => {
        oauthWindow.show();
        oauthWindow.focus();
      });

      oauthWindow.loadURL(url);

      // Handle window close
      oauthWindow.on('closed', () => {
        logger.debug("OAuth popup window closed");
      });

      logger.debug("Opened OAuth URL in popup window:", url);
    } else {
      // Use default browser for other URLs
      await shell.openExternal(url);
      logger.debug("Opened external URL in default browser:", url);
    }
  });

  handle("show-item-in-folder", async (_event, fullPath: string) => {
    // Validate that a path was provided
    if (!fullPath) {
      throw new Error("No file path provided.");
    }

    shell.showItemInFolder(fullPath);
    logger.debug("Showed item in folder:", fullPath);
  });
}
