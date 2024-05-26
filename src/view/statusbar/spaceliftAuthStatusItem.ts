import * as vscode from "vscode";
import { getLogger } from "../../utils/logger";
import { ISpaceliftAuthenticationHandler } from "../../utils/Spacelift/spaceliftAuthenticationHandler";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./baseStatusBarItem";

export class SpaceliftApiAuthenticationStatus extends BaseStatusBarItem {
  private readonly authHandler: ISpaceliftAuthenticationHandler;
  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, authHandler: ISpaceliftAuthenticationHandler) {
    super(context, settings);
    this.authHandler = authHandler;
  }

  protected async run() {
    if ((await this.authHandler.getToken()) !== null) {
      getLogger().debug("Valid spacelift token, hiding status bar item");
      this.statusBarItem.hide();
      return;
    }
    getLogger().debug("No valid spacelift token, showing status bar item to show login required");
    this.statusBarItem.text = "$(error) authenticate spacectl";
    this.statusBarItem.color = "orange";
    this.statusBarItem.show();
  }
}
