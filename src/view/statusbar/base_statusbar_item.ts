import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { getLogger } from "../../utils/logger";

export interface IvscodeStatusBarItemSettings {
  alignment: vscode.StatusBarAlignment;
  priority: number;
  onClickCommand?: string;
  updateOnDidChangeTextEditorSelection?: boolean;
  refreshIntervalSeconds?: number;
  tooltip: string;
}

export abstract class BaseStatusBarItem {
  private readonly _settings: IvscodeStatusBarItemSettings;
  readonly _context: vscode.ExtensionContext;
  _statusBarItem: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings) {
    this._settings = settings;
    this._context = context;
    this._statusBarItem = vscode.window.createStatusBarItem(this._settings.alignment, this._settings.priority);
    this._statusBarItem.tooltip = this._settings.tooltip;
    if (this._settings.onClickCommand !== undefined) {
      this._statusBarItem.command = this._settings.onClickCommand;
    }
    this._context.subscriptions.push(this._statusBarItem);
    if (this._settings.updateOnDidChangeTextEditorSelection) {
      this._context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => {
          this.refresh();
        })
      );
    }
    if (this._settings.refreshIntervalSeconds !== undefined) {
      setInterval(() => {
        this.refresh();
      }, this._settings.refreshIntervalSeconds * 1000);
    }
  }

  async refresh(...args: any[]): Promise<void> {
    await this.run(...args).catch((error) => {
      handleError(error);
    });
  }

  protected abstract run(...args: any[]): Promise<void>;
}

function handleError(error: Error) {
  if (error instanceof UserShownError) {
    vscode.window.showErrorMessage(error.message);
  }
  getLogger().error("Error running command: " + error.toString());
}
