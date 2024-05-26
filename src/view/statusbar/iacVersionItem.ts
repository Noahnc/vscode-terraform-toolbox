import * as vscode from "vscode";
import { checkIfOpenTextEditorIsTerraform } from "../../utils/helperFunctions";
import { getLogger } from "../../utils/logger";
import { IversionManager } from "../../utils/VersionManager/versionManager";
import { BaseStatusBarItem, IvscodeStatusBarItemSettings } from "./baseStatusBarItem";

export class IacActiveVersionItem extends BaseStatusBarItem {
  private versionManager: IversionManager;
  constructor(context: vscode.ExtensionContext, versionManager: IversionManager, settings: IvscodeStatusBarItemSettings) {
    super(context, settings);
    this.versionManager = versionManager;
  }

  protected async run() {
    if (!checkIfOpenTextEditorIsTerraform()) {
      this.statusBarItem.hide();
      return;
    }
    const activeVersion = await this.versionManager.getActiveVersion();
    if (activeVersion === undefined) {
      getLogger().debug("No terraform version installed, hiding status bar item");
      this.statusBarItem.hide();
      return;
    }
    if (activeVersion !== this.statusBarItem.text) {
      getLogger().debug(`Updating status bar terraform version to ${activeVersion}`);
      this.statusBarItem.text = activeVersion;
    }
    this.statusBarItem.show();
  }
}
