import * as vscode from "vscode";
import { getLogger } from "../utils/logger";

export class Settings {
  private settingsDict: { [key: string]: SettingsElement } = {};

  constructor() {
    this.settingsDict["spaceliftTenantID"] = new SettingsElement("tftoolbox.spacelift.tenantID", true, true);
    this.settingsDict["spacectlProfileName"] = new SettingsElement("tftoolbox.spacelift.profileName", true, true);
    this.settingsDict["autoselectVersion"] = new SettingsElement("tftoolbox.iac.autoSelectVersion");
    this.settingsDict["logLevel"] = new SettingsElement("tftoolbox.logLevel");
    this.settingsDict["autoSelectWorkspace"] = new SettingsElement("tftoolbox.iac.autoSelectWorkspace");
    this.settingsDict["autoInitAllProjects"] = new SettingsElement("tftoolbox.iac.autoInitAllProjects");
    this.settingsDict["initArgs"] = new SettingsElement("tftoolbox.iac.initArg");
    this.settingsDict["spaceliftStatusBarItemRefreshIntervalSeconds"] = new SettingsElement("tftoolbox.spacelift.stackPendingConfirmationStatusItemUpdateTimeSeconds");
    this.settingsDict["excludedGlobPatterns"] = new SettingsElement("tftoolbox.excludeGlobPatterns");
    this.settingsDict["showSpacectlNotAuthenticatedWarningOnStartup"] = new SettingsElement("tftoolbox.spacelift.showLoginNotificationOnStartup");
    this.settingsDict["iacProvider"] = new SettingsElement("tftoolbox.iac.provider", true);

    vscode.workspace.onDidChangeConfiguration(this.handleSettingChange.bind(this));
  }

  get spaceliftTenantID(): string | undefined {
    return this.settingsDict["spaceliftTenantID"].value;
  }
  get spacectlProfileName(): string | undefined {
    return this.settingsDict["spacectlProfileName"].value;
  }
  get autoselectVersion(): boolean {
    return this.settingsDict["autoselectVersion"].value;
  }
  get logLevel(): string {
    return this.settingsDict["logLevel"].value;
  }
  get autoSelectWorkspace(): boolean {
    return this.settingsDict["autoSelectWorkspace"].value;
  }
  get autoInitAllProjects(): boolean {
    return this.settingsDict["autoInitAllProjects"].value;
  }
  get initArgs(): string {
    return this.settingsDict["initArgs"].value;
  }
  get spaceliftStatusBarItemRefreshIntervalSeconds(): number {
    return this.settingsDict["spaceliftStatusBarItemRefreshIntervalSeconds"].value;
  }
  get excludedGlobPatterns(): string[] {
    return this.settingsDict["excludedGlobPatterns"].value;
  }
  get showSpacectlNotAuthenticatedWarningOnStartup(): boolean {
    return this.settingsDict["showSpacectlNotAuthenticatedWarningOnStartup"].value;
  }
  get iacProvider(): IacProvider {
    const provider = this.settingsDict["iacProvider"].value;
    if (!(provider in IacProvider)) {
      throw new Error(`Unknown IacProvider: ${provider}`);
    }
    return provider;
  }

  handleSettingChange(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration("tftoolbox")) {
      return;
    }
    Object.values(this.settingsDict).forEach((element) => {
      element.handleSettingChange(event);
    });
  }
}

class SettingsElement {
  private key: string;
  private changeRequiresRestart: boolean;
  private allowUndefined;

  constructor(settingsKey: string, changeRequiresRestart = false, allowUndefined = false) {
    this.key = settingsKey;
    this.changeRequiresRestart = changeRequiresRestart;
    this.allowUndefined = allowUndefined;
  }

  get settingsKey(): string {
    return this.key;
  }

  handleSettingChange(event: vscode.ConfigurationChangeEvent): void {
    if (!this.changeRequiresRestart) {
      return;
    }
    if (event.affectsConfiguration(this.key)) {
      getLogger().info(`Setting ${this.key} changed and requires restart of the extension.`);
      // show a information with two buttons to restart the extension or skip
      vscode.window.showInformationMessage(`The setting ${this.key} changed and requires a restart of the extension.`, "Restart", "Skip").then((value) => {
        if (value === "Restart") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get value(): any {
    const setting = vscode.workspace.getConfiguration().get(this.key);

    getLogger().trace(`Got setting ${this.key}: ${setting}`);
    if (setting === undefined && !this.allowUndefined) {
      throw new Error(`Setting ${this.key} is undefined`);
    }

    return setting;
  }
}

export enum IacProvider {
  terraform = "terraform",
  opentofu = "opentofu",
}
