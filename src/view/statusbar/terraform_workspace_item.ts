import * as vscode from "vscode";
import { getLogger } from "../../utils/logger";
import { IterraformCLI } from "../../utils/terraform/terraform_cli";
import { IterraformProjectHelper } from "../../utils/terraform/terraform_project_helper";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./base_statusbar_item";

export class TfActiveWorkspaceItem extends BaseStatusBarItem {
  private readonly _tfcli: IterraformCLI;
  private readonly _tfProjectHelper: IterraformProjectHelper;

  constructor(context: vscode.ExtensionContext, settings: IvscodeStatusBarItemSettings, tfcli: IterraformCLI, tfProjectHelper: IterraformProjectHelper) {
    super(context, settings);
    this._tfcli = tfcli;
    this._tfProjectHelper = tfProjectHelper;
  }

  protected async run() {
    if (!checkIfTerraformFileOpen()) {
      this._statusBarItem.hide();
      return;
    }
    if (vscode.window.activeTextEditor?.document.uri === undefined) {
      getLogger().debug("No active text editor, hiding status bar item");
      this._statusBarItem.hide();
      return;
    }
    const openFolderPath = vscode.Uri.joinPath(vscode.window.activeTextEditor?.document.uri, "..");
    const currentWorkspace = await this._tfProjectHelper.getCurrentWorkspaceFromEnvFile(openFolderPath);
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

function checkIfTerraformFileOpen(): boolean {
  const activeDocument = vscode.window.activeTextEditor?.document.uri;
  if (activeDocument === undefined) {
    return false;
  }
  if (!activeDocument.path.endsWith(".tf") && !activeDocument.path.endsWith(".tfvars")) {
    return false;
  }
  return true;
}
