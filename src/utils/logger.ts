/**
 * This file manages the logger's state.
 */
import { LogLevel, getExtensionLogger } from "@vscode-logging/logger";
import { IChildLogger, IVSCodeExtLogger } from "@vscode-logging/types";
import { NOOP_LOGGER } from "@vscode-logging/wrapper";
import { readFile as readFileCallback } from "fs";
import { resolve } from "path";
import { promisify } from "util";
import { ExtensionContext, window } from "vscode";
import { Settings } from "../models/settings";

const readFile = promisify(readFileCallback);

// On file load we initialize our logger to `NOOP_LOGGER`
// this is done because the "real" logger cannot be initialized during file load.
// only once the `activate` function has been called in extension.ts
// as the `ExtensionContext` argument to `activate` contains the required `logPath`
let loggerImpel: IVSCodeExtLogger = NOOP_LOGGER;

export function getLogger(): IChildLogger {
  return loggerImpel;
}

function setLogger(newLogger: IVSCodeExtLogger): void {
  loggerImpel = newLogger;
}

export async function initLogger(context: ExtensionContext, settings: Settings): Promise<void> {
  const meta = JSON.parse(await readFile(resolve(context.extensionPath, "package.json"), "utf8"));
  const extLogger = getExtensionLogger({
    extName: meta.displayName,
    level: settings.logLevel.value as LogLevel,
    logPath: context.logUri.fsPath,
    logOutputChannel: window.createOutputChannel(meta.displayName),
    sourceLocationTracking: false,
    logConsole: false,
  });

  setLogger(extLogger);
}
