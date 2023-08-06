import * as vscode from "vscode";
import { getLogger } from "../../utils/logger";
import { IversionManager } from "../../utils/version_manager";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./base_statusbar_item";
import { checkIfOpenTextEditorIsTerraform } from "../../utils/helper_functions";

export class TfActiveVersionItem extends BaseStatusBarItem {
  private _versionManager: IversionManager;
  constructor(context: vscode.ExtensionContext, versionManager: IversionManager, settings: IvscodeStatusBarItemSettings) {
    super(context, settings);
    this._versionManager = versionManager;
  }

  protected async run() {
    if (!checkIfOpenTextEditorIsTerraform()) {
      this._statusBarItem.hide();
      return;
    }
    const activeVersion = this._versionManager.getActiveVersion();
    if (activeVersion === undefined) {
      getLogger().debug("No terraform version installed, hiding status bar item");
      this._statusBarItem.hide();
      return;
    }
    if (activeVersion !== this._statusBarItem.text) {
      getLogger().debug("Updating status bar terraform version to " + activeVersion);
      this._statusBarItem.text = activeVersion;
    }
    this._statusBarItem.show();
  }
}
