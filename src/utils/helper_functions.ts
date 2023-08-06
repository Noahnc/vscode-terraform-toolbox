/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getLogger } from "./logger";

export async function runShellCommand(command: string, envVariables?: any): Promise<[boolean, string, string]> {
  getLogger().debug("Running shell command: " + command);
  return await new Promise<[boolean, string, string]>((resolve) => {
    exec(command, { silent: true, env: { ...process.env, GOBIN: envVariables } } as any, (error: any, stdout: any, stderr: any) => {
      getLogger().trace("Stdout: " + stdout);
      getLogger().trace("Stderr: " + stderr);
      if (error) {
        getLogger().debug("Shell command: " + command + " exited with non zero exit code: " + error);
        resolve([false, stdout, stderr]);
        return;
      }
      getLogger().debug("Shell command: " + command + " exited with zero exit code");
      resolve([true, stdout, stderr]);
      return;
    });
  });
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
    getLogger().debug("User has not chosen a value from: " + values.map((value) => value[labelAttribute]));
    return undefined;
  }
  getLogger().debug("User has chosen: " + choice[labelAttribute]);
  return choice;
}

export async function downloadFile(url: string, filePath: string): Promise<boolean> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const fileData = Buffer.from(response.data, "binary");
    fs.writeFileSync(filePath, fileData);
    if (!fs.existsSync(filePath)) {
      getLogger().debug("Error saving file to: " + filePath);
      return false;
    }
    getLogger().debug("File: " + filePath + " has been downloaded");
    return true;
  } catch (err) {
    getLogger().debug("Error downloading file: " + filePath + " from url: " + url + " error: " + err);
    return false;
  }
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
