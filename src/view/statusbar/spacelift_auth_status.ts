import * as vscode from "vscode";
import { getLogger } from "../../utils/logger";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./base_statusbar_item";
import { IspaceliftAuthenticationHandler } from "../../utils/spacelift/spacelift_authentication_handler";

export class SpaceliftApiAuthenticationStatus extends BaseStatusBarItem {
  private readonly _authHandler: IspaceliftAuthenticationHandler;
  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, authHandler: IspaceliftAuthenticationHandler) {
    super(context, settings);
    this._authHandler = authHandler;
  }

  protected async run() {
    if ((await this._authHandler.check_token_valid()) == false) {
      getLogger().debug("No valid spacelift token, showing status bar item to show login required");
      this._statusBarItem.text = "$(error) authenticate spacectl";
      this._statusBarItem.color = "orange";
      this._statusBarItem.show();
      return;
    }
    getLogger().debug("Valid spacelift token, hiding status bar item");
    this._statusBarItem.hide();
    return;
  }
}
