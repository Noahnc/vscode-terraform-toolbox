import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import { getLogger } from "../utils/logger";
import * as helper from "../utils/helperFunctions";

export interface IvscodeCommandSettings {
  command: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  successCallback?: (...arg: any) => Promise<any>;
  checkInternetConnection?: boolean;
}

export abstract class BaseCommand {
  private readonly _settings: IvscodeCommandSettings;
  readonly _context: vscode.ExtensionContext;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings) {
    this._settings = settings;
    this._context = context;
    this.registerCommand();
  }

  registerCommand() {
    getLogger().trace("Registering command " + this._settings.command);
    this._context.subscriptions.push(vscode.commands.registerCommand(this._settings.command, this.run.bind(this)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(...args: any[]): Promise<void> {
    getLogger().debug("Running command " + this._settings.command);
    if (this._settings.checkInternetConnection && (await helper.checkInternetConnection()) === false) {
      helper.showWarning("No internet connection, command " + this._settings.command + " will not be executed");
      return;
    }
    await this.init(...args)
      .then(() => {
        getLogger().debug("Successfully ran command " + this._settings.command);
        if (this._settings.successCallback !== undefined) {
          getLogger().trace("Running success hook for command " + this._settings.command);
          this._settings.successCallback(...args).catch((error) => {
            handleError(error);
          });
        }
      })
      .catch((error) => {
        handleError(error);
      });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract init(...args: any[]): Promise<void>;

  getCommandName(): string {
    return this._settings.command;
  }
}

function handleError(error: Error) {
  if (error instanceof UserShownError) {
    vscode.window.showErrorMessage(error.message);
  }
  getLogger().error("Error running command: " + error.toString());
}
