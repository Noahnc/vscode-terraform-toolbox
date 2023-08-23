import * as vscode from "vscode";
import { getLogger } from "../utils/logger";

export class Settings {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVSCodeSettingKey(key: string, allowUndefined = false): any {
    const setting = vscode.workspace.getConfiguration().get(key);
    getLogger().trace("Got setting " + key + ": " + setting);
    if (setting === undefined && !allowUndefined) {
      throw new Error("Setting " + key + " is undefined");
    }
    return setting;
  }

  get spaceliftTenantID(): string | undefined {
    return this.getVSCodeSettingKey("tftoolbox.spacelift.tenantID", true);
  }
  get spacectlProfileName(): string | undefined {
    return this.getVSCodeSettingKey("tftoolbox.spacelift.profileName", true);
  }
  get autoselectVersion(): boolean {
    return this.getVSCodeSettingKey("tftoolbox.terraform.autoSelectVersion");
  }
  get logLevel(): string {
    return this.getVSCodeSettingKey("tftoolbox.logLevel");
  }
  get autoSelectWorkspace(): boolean {
    return this.getVSCodeSettingKey("tftoolbox.terraform.autoSelectWorkspace");
  }
  get autoInitAllProjects(): boolean {
    return this.getVSCodeSettingKey("tftoolbox.terraform.autoInitAllProjects");
  }
  get initArgs(): string {
    return this.getVSCodeSettingKey("tftoolbox.terraform.initArg");
  }
  get spaceliftStatusBarItemRefreshIntervalSeconds(): number {
    return this.getVSCodeSettingKey("tftoolbox.spacelift.stackPendingConfirmationStatusItemUpdateTimeSeconds");
  }
  get excludedGlobPatterns(): string[] {
    return this.getVSCodeSettingKey("tftoolbox.excludeGlobPatterns");
  }
}
