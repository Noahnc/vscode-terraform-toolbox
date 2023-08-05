import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import { getLogger } from "../utils/logger";

export interface IvscodeCommandSettings {
  command: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  successCallback?: (...arg: any) => Promise<any>;
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

  async run(...args: any[]): Promise<void> {
    getLogger().debug("Running command " + this._settings.command);
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
