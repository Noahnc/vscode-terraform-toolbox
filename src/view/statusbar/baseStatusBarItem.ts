import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { SettingsElement } from "../../models/settings";
import * as helper from "../../utils/helperFunctions";
import { getLogger } from "../../utils/logger";

export interface IvscodeStatusBarItemSettings {
  alignment: vscode.StatusBarAlignment;
  priority: number;
  onClickCommand?: string;
  updateOnDidChangeTextEditorSelection?: boolean;
  refreshIntervalSetting?: SettingsElement<number>;
  tooltip: string;
  checkInternetConnection?: boolean;
}

export abstract class BaseStatusBarItem {
  private readonly settings: IvscodeStatusBarItemSettings;
  readonly context: vscode.ExtensionContext;
  statusBarItem: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings) {
    this.settings = settings;
    this.context = context;
    this.statusBarItem = vscode.window.createStatusBarItem(this.settings.alignment, this.settings.priority);
    this.statusBarItem.tooltip = this.settings.tooltip;
    if (this.settings.onClickCommand !== undefined) {
      this.statusBarItem.command = this.settings.onClickCommand;
    }
    this.context.subscriptions.push(this.statusBarItem);
    if (this.settings.updateOnDidChangeTextEditorSelection) {
      this.context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.refresh();
        })
      );
    }
    if (this.settings.refreshIntervalSetting !== undefined) {
      setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.refresh();
      }, this.settings.refreshIntervalSetting.value * 1000);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async refresh(...args: any[]): Promise<void> {
    if (this.settings.checkInternetConnection) {
      if ((await helper.checkInternetConnection()) === false) {
        getLogger().debug("No internet connection, hiding status bar item");
        this.statusBarItem.hide();
        return;
      }
    }
    await this.run(...args).catch((error) => {
      handleError(error);
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract run(...args: any[]): Promise<void>;
}

function handleError(error: Error) {
  if (error instanceof UserShownError) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showErrorMessage(error.message);
  }
  getLogger().error(`Error running command: ${error.toString()}`);
}
