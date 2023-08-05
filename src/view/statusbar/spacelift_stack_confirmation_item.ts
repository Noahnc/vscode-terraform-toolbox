import * as vscode from "vscode";
import { SpaceliftStacks } from "../../models/spacelift/stack";
import { getLogger } from "../../utils/logger";
import { IspaceliftClient } from "../../utils/spacelift/spacelift_client";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./base_statusbar_item";

export class SpaceliftPenStackConfCount extends BaseStatusBarItem {
  private readonly _spaceliftClient: IspaceliftClient;
  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, spaceliftClient: IspaceliftClient) {
    super(context, settings);
    this._spaceliftClient = spaceliftClient;
  }

  protected async run() {
    let stacks: SpaceliftStacks;
    try {
      stacks = await this._spaceliftClient.getStacks();
    } catch (error) {
      this._statusBarItem.text = "$(error)Spacelift API error";
      this._statusBarItem.color = "red";
      this._statusBarItem.show();
      getLogger().error("Failed to get stacks: " + error);
      return;
    }
    const pendingConfirmationCount = stacks.pendingConfirmation.length;
    if (pendingConfirmationCount === 0) {
      getLogger().debug("No stacks pending confirmation, hiding status bar item");
      this._statusBarItem.hide();
      return;
    }
    let statusText: string;
    if (pendingConfirmationCount === 1) {
      statusText = "$(bell)1 stack to confirm";
    } else {
      statusText = "$(bell)" + pendingConfirmationCount + " stacks to confirm";
    }

    if (statusText !== this._statusBarItem.text) {
      getLogger().debug("Updating status bar stack confirmation count to " + pendingConfirmationCount);
      this._statusBarItem.text = statusText;
    }
    this._statusBarItem.color = "yellow";
    this._statusBarItem.show();
  }
}
