import * as vscode from "vscode";
import { getLogger } from "../../utils/logger";
import { IIacCli } from "../../utils/IaC/iacCli";
import { IIacProjectHelper } from "../../utils/IaC/iacProjectHelper";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./baseStatusBarItem";
import { PathObject } from "../../utils/path";
import { checkIfOpenTextEditorIsTerraform } from "../../utils/helperFunctions";

export class IacActiveWorkspaceItem extends BaseStatusBarItem {
  private readonly _tfcli: IIacCli;
  private readonly _tfProjectHelper: IIacProjectHelper;

  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, tfcli: IIacCli, tfProjectHelper: IIacProjectHelper) {
    super(context, settings);
    this._tfcli = tfcli;
    this._tfProjectHelper = tfProjectHelper;
  }

  protected async run() {
    if (!checkIfOpenTextEditorIsTerraform()) {
      this._statusBarItem.hide();
      return;
    }
    if (vscode.window.activeTextEditor?.document.uri === undefined) {
      getLogger().debug("No active text editor, hiding status bar item");
      this._statusBarItem.hide();
      return;
    }
    const openFile = new PathObject(vscode.window.activeTextEditor?.document.uri.fsPath);
    const currentWorkspace = await this._tfProjectHelper.getCurrentWorkspaceFromEnvFile(openFile.directory);
    if (currentWorkspace === undefined) {
      getLogger().debug("terraform directory not initialized, hiding status bar item");
      this._statusBarItem.hide();
      return;
    }
    if (currentWorkspace !== this._statusBarItem.text) {
      getLogger().debug("Updating status bar terraform workspace to " + currentWorkspace);
      this._statusBarItem.text = currentWorkspace;
    }
    this._statusBarItem.show();
  }
}
