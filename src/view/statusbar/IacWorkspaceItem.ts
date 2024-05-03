import * as vscode from "vscode";
import { checkIfOpenTextEditorIsTerraform } from "../../utils/helperFunctions";
import { IIacCli } from "../../utils/IaC/iacCli";
import { IIacProjectHelper } from "../../utils/IaC/iacProjectHelper";
import { getLogger } from "../../utils/logger";
import { PathObject } from "../../utils/path";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./baseStatusBarItem";

export class IacActiveWorkspaceItem extends BaseStatusBarItem {
  private readonly iacCli: IIacCli;
  private readonly iacProjectHelper: IIacProjectHelper;

  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, tfcli: IIacCli, tfProjectHelper: IIacProjectHelper) {
    super(context, settings);
    this.iacCli = tfcli;
    this.iacProjectHelper = tfProjectHelper;
  }

  protected async run() {
    if (!checkIfOpenTextEditorIsTerraform()) {
      this.statusBarItem.hide();
      return;
    }
    if (vscode.window.activeTextEditor?.document.uri === undefined) {
      getLogger().debug("No active text editor, hiding status bar item");
      this.statusBarItem.hide();
      return;
    }
    const openFile = new PathObject(vscode.window.activeTextEditor?.document.uri.fsPath);
    const currentWorkspace = await this.iacProjectHelper.getCurrentWorkspaceFromEnvFile(openFile.directory);
    if (currentWorkspace === undefined) {
      getLogger().debug("terraform directory not initialized, hiding status bar item");
      this.statusBarItem.hide();
      return;
    }
    if (currentWorkspace !== this.statusBarItem.text) {
      getLogger().debug(`Updating status bar terraform workspace to ${currentWorkspace}`);
      this.statusBarItem.text = currentWorkspace;
    }
    this.statusBarItem.show();
  }
}
