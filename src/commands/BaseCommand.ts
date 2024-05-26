import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import * as helper from "../utils/helperFunctions";
import { getLogger } from "../utils/logger";

export interface IvscodeCommandSettings {
  command: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  successCallback?: (...arg: any) => Promise<any>;
  checkInternetConnection?: boolean;
}

export abstract class BaseCommand {
  private readonly settings: IvscodeCommandSettings;
  readonly context: vscode.ExtensionContext;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings) {
    this.settings = settings;
    this.context = context;
    this.registerCommand();
  }

  registerCommand() {
    getLogger().trace(`Registering command ${this.settings.command}`);
    this.context.subscriptions.push(vscode.commands.registerCommand(this.settings.command, this.run.bind(this)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(...args: any[]): Promise<void> {
    getLogger().debug(`Running command ${this.settings.command}`);
    if (this.settings.checkInternetConnection && (await helper.checkInternetConnection()) === false) {
      helper.showWarning(`No internet connection, command ${this.settings.command} will not be executed`);
      return;
    }
    await this.init(...args)
      .then(() => {
        getLogger().debug(`Successfully ran command ${this.settings.command}`);
        if (this.settings.successCallback !== undefined) {
          getLogger().trace(`Running success hook for command ${this.settings.command}`);
          this.settings.successCallback(...args).catch((error) => {
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
    return this.settings.command;
  }
}

function handleError(error: Error) {
  if (error instanceof UserShownError) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showErrorMessage(error.message);
  }
  getLogger().error(`Error running command: ${error.toString()}`);
}
