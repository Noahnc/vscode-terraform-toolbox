import * as vscode from "vscode";
import { getLogger } from "../../utils/logger";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./baseStatusBarItem";
import { ISpaceliftAuthenticationHandler } from "../../utils/Spacelift/spaceliftAuthenticationHandler";

export class SpaceliftApiAuthenticationStatus extends BaseStatusBarItem {
  private readonly _authHandler: ISpaceliftAuthenticationHandler;
  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, authHandler: ISpaceliftAuthenticationHandler) {
    super(context, settings);
    this._authHandler = authHandler;
  }

  protected async run() {
    if ((await this._authHandler.get_token()) !== null) {
      getLogger().debug("Valid spacelift token, hiding status bar item");
      this._statusBarItem.hide();
      return;
    }
    getLogger().debug("No valid spacelift token, showing status bar item to show login required");
    this._statusBarItem.text = "$(error) authenticate spacectl";
    this._statusBarItem.color = "orange";
    this._statusBarItem.show();
    return;
  }
}
