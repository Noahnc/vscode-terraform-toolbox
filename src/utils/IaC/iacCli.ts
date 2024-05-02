import { ICli } from "../cli";
import { getLogger } from "../logger";
import { PathObject } from "../path";

export interface IIacCli {
  init(folderPath?: PathObject, args?: string): Promise<[boolean, string, string]>;
  getModules(folderPath: PathObject): Promise<[boolean, string, string]>;
  getWorkspaces(folderPath: PathObject): Promise<[string[], string]>;
  setWorkspace(folderPath: PathObject, workspace: string): Promise<[boolean, string, string]>;
}

export class IacCli implements IIacCli {
  private _cli: ICli;
  private _cliBinary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(cli: ICli, cliBinary: string) {
    this._cli = cli;
    this._cliBinary = cliBinary;
  }

  async init(folder?: PathObject, args?: string): Promise<[boolean, string, string]> {
    let terraformInitCommand = "";
    if (folder !== undefined) {
      terraformInitCommand += this.getChdirString(folder);
    }
    terraformInitCommand += " init -input=false -no-color";
    if (args !== undefined) {
      terraformInitCommand += " " + args;
    }
    return await this.runTerraformCommand(terraformInitCommand);
  }

  async getModules(folder: PathObject): Promise<[boolean, string, string]> {
    return await this.runTerraformCommand(this.getChdirString(folder) + " get -no-color");
  }

  async getWorkspaces(folder: PathObject): Promise<[string[], string]> {
    const [success, stdout, stderr] = await this.runTerraformCommand(this.getChdirString(folder) + " workspace list");
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

  private getChdirString(folderPath: PathObject): string {
    // return "-chdir=" + "'" + folderPath.path + "'";
    return "-chdir=" + '"' + folderPath.path + '"';
  }

  async setWorkspace(folder: PathObject, workspace: string): Promise<[boolean, string, string]> {
    return await this.runTerraformCommand(this.getChdirString(folder) + " workspace select " + workspace);
  }

  async runTerraformCommand(command: string): Promise<[boolean, string, string]> {
    return await this._cli.runShellCommand(this._cliBinary + " " + command);
  }
}
