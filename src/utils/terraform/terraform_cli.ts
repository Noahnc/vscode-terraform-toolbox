import * as vscode from "vscode";
import { getLogger } from "../logger";

export interface IterraformCLI {
  init(folderPath?: vscode.Uri): Promise<[boolean, string, string]>;
  getModules(folderPath: vscode.Uri): Promise<[boolean, string, string]>;
  getWorkspaces(folderPath: vscode.Uri): Promise<[string[], string]>;
  setWorkspace(folderPath: vscode.Uri, workspace: string): Promise<[boolean, string, string]>;
}

export class TerraformCLI implements IterraformCLI {
  private _cliFunction: (arg0: string) => Promise<[boolean, string, string]>;

  constructor(cliFunction: any) {
    this._cliFunction = cliFunction;
  }

  async init(folderPath?: vscode.Uri): Promise<[boolean, string, string]> {
    let terraformInitCommand = "";
    if (folderPath !== undefined) {
      terraformInitCommand += "-chdir=" + folderPath.fsPath;
    }
    terraformInitCommand += " init -upgrade -input=false -no-color";
    return await this.runTerraformCommand(terraformInitCommand);
  }

  async getModules(folderPath: vscode.Uri): Promise<[boolean, string, string]> {
    return await this.runTerraformCommand("-chdir=" + folderPath.fsPath + " get -no-color");
  }

  async getWorkspaces(folderPath: vscode.Uri): Promise<[string[], string]> {
    const [success, stdout, stderr] = await this.runTerraformCommand("-chdir=" + folderPath.fsPath + " workspace list");
    if (!success) {
      throw new Error("Error getting terraform workspaces: " + stderr);
    }
    const workspaceList = stdout.split("\n");
    // remove any empty lines
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i] === "") {
        workspaceList.splice(i, 1);
        i--;
      }
    }
    let activeWorkspaceIndex: number | undefined;
    // remove the "*" from the current workspace
    for (let i = 0; i < workspaceList.length; i++) {
      if (workspaceList[i].startsWith("*")) {
        workspaceList[i] = workspaceList[i].substring(1);
        activeWorkspaceIndex = i;
        break;
      }
    }
    // remove any spaces at the beginning or end of the workspace name
    for (let i = 0; i < workspaceList.length; i++) {
      workspaceList[i] = workspaceList[i].trim();
    }
    if (activeWorkspaceIndex === undefined) {
      throw new Error("Error evaluating active terraform workspace");
    }
    getLogger().debug("Found workspaces: " + workspaceList);
    return [workspaceList, workspaceList[activeWorkspaceIndex]];
  }

  async setWorkspace(folderPath: vscode.Uri, workspace: string): Promise<[boolean, string, string]> {
    return await this.runTerraformCommand("-chdir=" + folderPath.fsPath + " workspace select " + workspace);
  }

  async runTerraformCommand(command: string): Promise<[boolean, string, string]> {
    return await this._cliFunction("terraform " + command);
  }
}
