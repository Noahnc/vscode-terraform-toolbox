import * as vscode from "vscode";
import { SpaceliftStacks } from "../../models/spacelift/stack";
import { getLogger } from "../../utils/logger";
import { IspaceliftClient } from "../../utils/Spacelift/spaceliftClient";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./baseStatusBarItem";

export class SpaceliftPenStackConfCount extends BaseStatusBarItem {
  private readonly spaceliftClient: IspaceliftClient;
  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, spaceliftClient: IspaceliftClient) {
    super(context, settings);
    this.spaceliftClient = spaceliftClient;
  }

  protected async run() {
    let stacks: SpaceliftStacks;
    if ((await this.spaceliftClient.isAuthenticated()) === false) {
      getLogger().debug("Spacelift not authenticated, hiding status bar item");
      this.statusBarItem.hide();
      return;
    }
    try {
      stacks = await this.spaceliftClient.getStacks();
    } catch (error) {
      this.statusBarItem.text = "$(error)Spacelift API error";
      this.statusBarItem.color = "red";
      this.statusBarItem.show();
      getLogger().error(`Failed to get stacks: ${error}`);
      return;
    }
    const pendingConfirmationCount = stacks.pendingConfirmation.length;
    if (pendingConfirmationCount === 0) {
      getLogger().debug("No stacks pending confirmation, hiding status bar item");
      this.statusBarItem.hide();
      return;
    }
    let statusText: string;
    if (pendingConfirmationCount === 1) {
      statusText = "$(bell)1 stack to confirm";
    } else {
      statusText = `$(bell)${pendingConfirmationCount} stacks to confirm`;
    }

    if (statusText !== this.statusBarItem.text) {
      getLogger().debug(`Updating status bar stack confirmation count to ${pendingConfirmationCount}`);
      this.statusBarItem.text = statusText;
    }
    this.statusBarItem.color = "yellow";
    this.statusBarItem.show();
  }
}
