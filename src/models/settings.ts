import * as vscode from "vscode";
import { getLogger } from "../utils/logger";

export class Settings {
  private static instance: Settings;
  private static settingsUpdateFunctions = new Map<string, (event: vscode.ConfigurationChangeEvent) => void>();

  private spaceliftTenantIdSetting: SettingsElement<string | undefined>;
  private spacectlProfileNameSetting: SettingsElement<string | undefined>;
  private autoselectVersionSetting: SettingsElement<boolean>;
  private logLevelSetting: SettingsElement<string>;
  private autoSelectWorkspaceSetting: SettingsElement<boolean>;
  private autoInitAllProjectsSetting: SettingsElement<boolean>;
  private initArgsSetting: SettingsElement<string>;
  private spaceliftStatusBarItemRefreshIntervalSecondsSetting: SettingsElement<number>;
  private excludedGlobPatternsSetting: SettingsElement<string[]>;
  private showSpacectlLoginNotificationOnStartSetting: SettingsElement<boolean>;
  private showSpaceliftInitErrorOnStartSetting: SettingsElement<boolean>;
  private iacProviderSetting: SettingsElement<IacProvider>;
  private showIacSelectionSetting: SettingsElement<boolean>;
  private showNoIacVersionInstalledMsgSetting: SettingsElement<boolean>;
  private enableIacAutoInitSetting: SettingsElement<boolean>;
  private enableIacModuleAutoFetchSetting: SettingsElement<boolean>;
  private resourceProcessingQueDelayMsSetting: SettingsElement<number>;

  constructor() {
    if (Settings.instance !== undefined) {
      throw new Error("Settings is a singleton class and can only be instantiated once.");
    }

    Settings.instance = this;

    this.spaceliftTenantIdSetting = new SettingsElement<string | undefined>("tftoolbox.spacelift.tenantID", true);
    this.spacectlProfileNameSetting = new SettingsElement<string | undefined>("tftoolbox.spacelift.profileName", true);
    this.autoselectVersionSetting = new SettingsElement<boolean>("tftoolbox.iac.autoSelectVersion");
    this.logLevelSetting = new SettingsElement<string>("tftoolbox.logLevel", true);
    this.autoSelectWorkspaceSetting = new SettingsElement<boolean>("tftoolbox.iac.autoSelectWorkspace");
    this.autoInitAllProjectsSetting = new SettingsElement<boolean>("tftoolbox.iac.autoInitAllProjects");
    this.initArgsSetting = new SettingsElement<string>("tftoolbox.iac.initArg");
    this.spaceliftStatusBarItemRefreshIntervalSecondsSetting = new SettingsElement<number>("tftoolbox.spacelift.stackPendingConfirmationStatusItemUpdateTimeSeconds");
    this.excludedGlobPatternsSetting = new SettingsElement<string[]>("tftoolbox.excludeGlobPatterns");
    this.showSpacectlLoginNotificationOnStartSetting = new SettingsElement<boolean>("tftoolbox.spacelift.showLoginNotificationOnStartup");
    this.showSpaceliftInitErrorOnStartSetting = new SettingsElement<boolean>("tftoolbox.spacelift.showSpaceliftInitErrorOnStart");
    this.iacProviderSetting = new SettingsElement<IacProvider>("tftoolbox.iac.provider", true);
    this.showIacSelectionSetting = new SettingsElement<boolean>("tftoolbox.iac.showIacSelectionWelcomeMsg");
    this.showNoIacVersionInstalledMsgSetting = new SettingsElement<boolean>("tftoolbox.iac.showNoVersionInstalledMsg");
    this.enableIacAutoInitSetting = new SettingsElement<boolean>("tftoolbox.iac.enableAutoProviderInitialization");
    this.enableIacModuleAutoFetchSetting = new SettingsElement<boolean>("tftoolbox.iac.enableAutoModuleFetch");
    this.resourceProcessingQueDelayMsSetting = new SettingsElement<number>("tftoolbox.iac.resourceProcessingQueDelayMs");
  }

  get spaceliftTenantID(): SettingsElement<string | undefined> {
    return this.spaceliftTenantIdSetting;
  }
  get spacectlProfileName(): SettingsElement<string | undefined> {
    return this.spacectlProfileNameSetting;
  }
  get autoselectVersion(): SettingsElement<boolean> {
    return this.autoselectVersionSetting;
  }
  get logLevel(): SettingsElement<string> {
    return this.logLevelSetting;
  }
  get autoSelectWorkspace(): SettingsElement<boolean> {
    return this.autoSelectWorkspaceSetting;
  }
  get autoInitAllProjects(): SettingsElement<boolean> {
    return this.autoInitAllProjectsSetting;
  }
  get initArgs(): SettingsElement<string> {
    return this.initArgsSetting;
  }
  get spaceliftStatusBarItemRefreshIntervalSeconds(): SettingsElement<number> {
    return this.spaceliftStatusBarItemRefreshIntervalSecondsSetting;
  }
  get excludedGlobPatterns(): SettingsElement<string[]> {
    return this.excludedGlobPatternsSetting;
  }
  get showSpacectlNotAuthenticatedWarningOnStartup(): SettingsElement<boolean> {
    return this.showSpacectlLoginNotificationOnStartSetting;
  }
  get showSpaceliftInitErrorOnStart(): SettingsElement<boolean> {
    return this.showSpaceliftInitErrorOnStartSetting;
  }
  get iacProvider(): SettingsElement<IacProvider> {
    const setting = this.iacProviderSetting;
    const enumValues = Object.values(IacProvider);
    if (!enumValues.includes(setting.value)) {
      throw new Error(`Unknown IacProvider: ${setting.value}`);
    }
    return setting;
  }
  get showIacSelection(): SettingsElement<boolean> {
    return this.showIacSelectionSetting;
  }
  get showNoIacVersionInstalledMsg(): SettingsElement<boolean> {
    return this.showNoIacVersionInstalledMsgSetting;
  }
  get enableIacAutoInit(): SettingsElement<boolean> {
    return this.enableIacAutoInitSetting;
  }
  get enableIacModuleAutoFetch(): SettingsElement<boolean> {
    return this.enableIacModuleAutoFetchSetting;
  }
  get resourceProcessingQueDelayMs(): SettingsElement<number> {
    return this.resourceProcessingQueDelayMsSetting;
  }

  private handleSettingChange(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration("tftoolbox")) {
      return;
    }
    Settings.settingsUpdateFunctions.forEach((element) => {
      element(event);
    });
  }

  enableSettingUpdateRestartNotification(): void {
    vscode.workspace.onDidChangeConfiguration(this.handleSettingChange.bind(this));
  }

  static addSettingToUpdateHook(setting: SettingsElement<unknown>): void {
    Settings.settingsUpdateFunctions.set(setting.settingsKey, setting.handleSettingChange.bind(setting));
  }
}

export class SettingsElement<T> {
  private key: string;
  private changeRequiresRestart: boolean;
  private allowUndefined;

  constructor(settingsKey: string, changeRequiresRestart = false, allowUndefined = false) {
    this.key = settingsKey;
    this.changeRequiresRestart = changeRequiresRestart;
    this.allowUndefined = allowUndefined;
    Settings.addSettingToUpdateHook(this);
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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showInformationMessage(`The setting ${this.key} changed and requires a restart of the extension.`, "Restart", "Skip").then((value) => {
        if (value === "Restart") {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get value(): T {
    const setting = vscode.workspace.getConfiguration().get<T>(this.key) as T;

    getLogger().trace(`Got setting ${this.key}: ${setting}`);
    if (setting === undefined && !this.allowUndefined) {
      throw new Error(`Setting ${this.key} is undefined`);
    }

    return setting;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setValueAsync(value: any) {
    await vscode.workspace.getConfiguration().update(this.key, value, vscode.ConfigurationTarget.Global);
  }
}

export enum IacProvider {
  terraform = "Terraform",
  opentofu = "OpenTofu",
}
