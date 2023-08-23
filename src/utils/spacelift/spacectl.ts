import * as vscode from "vscode";
import * as constants from "../../constants";
import { UserShownError } from "../../custom_errors";
import { SpaceliftJwt } from "../../models/spacelift/jwt";
import { Stack } from "../../models/spacelift/stack";
import { getLogger } from "../logger";
import { ICli } from "../cli";

export interface Ispacectl {
  executeLocalPreview(stack: Stack, projectPath: string): Promise<void>;
  setUserprofile(profileName: string): Promise<void>;
  ensureSpacectlIsInstalled(): Promise<void>;
  getExportedToken(): Promise<SpaceliftJwt>;
}

export class Spacectl implements Ispacectl {
  private _cli: ICli;

  constructor(cli: ICli) {
    this._cli = cli;
  }

  async executeLocalPreview(stack: Stack, projectPath: string) {
    const terminalName = "Spacelift local preview";
    getLogger().debug("Executing local preview for stack " + stack.id);
    let terminal = vscode.window.terminals.find((t) => t.name === terminalName);
    if (terminal !== undefined) {
      getLogger().debug("Found existing terminal, disposing it");
      terminal.dispose();
    }
    terminal = vscode.window.createTerminal({ name: terminalName, cwd: projectPath });
    terminal.show();
    terminal.sendText("spacectl stack local-preview -id " + stack.id);
  }

  async setUserprofile(profileName: string) {
    getLogger().debug("Setting spacectl profile to " + profileName);
    const [success, stdout] = await this.runSpacectlCommand("profile select " + profileName);
    getLogger().trace("spacectl profile select stdout: " + stdout);
    if (success === false && stdout !== "") {
      getLogger().error(stdout);
      throw new UserShownError("Failed to select spacectl profile " + profileName + ". Make sure you have a profile with this name.");
    }
  }

  async ensureSpacectlIsInstalled() {
    if (await this._cli.checkIfBinaryIsInPath(constants.SPACECTL_COMMAND_NAME)) {
      getLogger().debug("spacectl is installed and in path");
      return;
    }
    throw new UserShownError("spacectl not found in your shells path.");
  }

  async getExportedToken(): Promise<SpaceliftJwt> {
    const [success, token] = await this.runSpacectlCommand("profile export-token");
    if (success === false || token === "") {
      throw new UserShownError("Failed to get token from spacectl. Please make sure you have a configured profile in spacectl.");
    }
    const jwt = new SpaceliftJwt(token);
    getLogger().debug("Successfully got spacelift access token from spacectl.");
    return jwt;
  }

  private async runSpacectlCommand(subcommand: string): Promise<[boolean, string, string]> {
    return await this._cli.runShellCommand(constants.SPACECTL_COMMAND_NAME + " " + subcommand);
  }
}
