/* eslint-disable @typescript-eslint/no-explicit-any */
import * as dns from "dns";
import * as path from "path";
import * as vscode from "vscode";
import { getLogger } from "./logger";

export function checkIfOpenTextEditorIsTerraform(): boolean {
  const activeDocument = vscode.window.activeTextEditor?.document;

  if (activeDocument === undefined) {
    return false;
  }
  if (activeDocument.languageId !== "terraform" && activeDocument.languageId !== "terraformjson") {
    return false;
  }
  return true;
}

export function getCurrentProjectInformations(): [vscode.WorkspaceFolder | undefined, vscode.WorkspaceFolder[] | undefined, string | undefined] {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders === undefined) {
    return [undefined, undefined, undefined];
  }
  if (vscode.window.activeTextEditor === undefined && workspaceFolders.length === 1) {
    return [workspaceFolders[0], workspaceFolders as vscode.WorkspaceFolder[], undefined];
  }
  if (vscode.window.activeTextEditor === undefined) {
    return [undefined, workspaceFolders as vscode.WorkspaceFolder[], undefined];
  }
  const currentWorkspace = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
  if (currentWorkspace === undefined) {
    return [undefined, workspaceFolders as vscode.WorkspaceFolder[], undefined];
  }
  const currentlyOpenFilePathAbsolut = vscode.window.activeTextEditor?.document.uri.fsPath;
  const currentlyOpenFolderPathRelative = path.dirname(path.relative(currentWorkspace.uri.fsPath, currentlyOpenFilePathAbsolut)).replace(/\\/g, "/");

  return [currentWorkspace, workspaceFolders as vscode.WorkspaceFolder[], currentlyOpenFolderPathRelative];
}

export async function getUserDecision<T>(placeHolderMsg: string, values: T[], labelAttribute: keyof T, descriptionAttribute?: keyof T): Promise<T | undefined> {
  const selection = await vscode.window.showQuickPick(
    values.map((value: T) => {
      return {
        label: value[labelAttribute] as string,
        description: descriptionAttribute ? (value[descriptionAttribute] as string) : "",
      };
    }),
    {
      placeHolder: placeHolderMsg,
    }
  );
  // find all the values that match the user input
  const choice = values.find((value) => value[labelAttribute] === selection?.label);
  if (choice === undefined || choice === null) {
    getLogger().debug(`User has not chosen a value from: ${values.map((value) => value[labelAttribute])}`);
    return undefined;
  }
  getLogger().debug(`User has chosen: ${choice[labelAttribute]}`);
  return choice;
}

type MessageTypes = "information" | "warning" | "error";
export async function showNotificationWithDecisions(message: string, settingKey: string, decision: string, type: MessageTypes): Promise<boolean> {
  if (vscode.workspace.getConfiguration().get(settingKey) === false) {
    getLogger().trace(`User has disabled notification: ${settingKey}`);
    return false;
  }
  let messageFunction;
  if (type === "information") {
    messageFunction = vscode.window.showInformationMessage;
  } else if (type === "warning") {
    messageFunction = vscode.window.showWarningMessage;
  } else if (type === "error") {
    messageFunction = vscode.window.showErrorMessage;
  } else {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const selection = await messageFunction(message, decision, "Don't show again");
  if (selection === decision) {
    return true;
  } else if (selection === "Don't show again") {
    vscode.workspace.getConfiguration().update(settingKey, false, vscode.ConfigurationTarget.Global);
    return false;
  }
  return false;
}

export function showInformation(message: string, silent = false) {
  getLogger().info(message);
  silent == false ? vscode.window.showInformationMessage(message) : null;
}

export function showWarning(message: string, silent = false) {
  getLogger().warn(message);
  silent == false ? vscode.window.showWarningMessage(message) : null;
}

export function showError(message: string, silent = false) {
  getLogger().error(message);
  silent == false ? vscode.window.showErrorMessage(message) : null;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function checkInternetConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    dns.lookup("google.com", function (err: any) {
      if (err && err.code == "ENOTFOUND") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}
