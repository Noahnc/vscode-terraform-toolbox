import * as vscode from "vscode";
import * as helpers from "../utils/helper_functions";
import { getLogger } from "../utils/logger";
import { TerraformCLI } from "../utils/terraform/terraform_cli";
import { IterraformProjectHelper, noValidTerraformFolder, terraformFolderNotInitialized, terraformGetError, terraformInitError } from "../utils/terraform/terraform_project_helper";
import { BaseCommand, IvscodeCommandSettings } from "./base_command";
import { PathObject } from "../utils/path";
import path = require("path");

export class TerraformInitAllProjectsCommand extends BaseCommand {
  tfProjectHelper: IterraformProjectHelper;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfProjectHelper: IterraformProjectHelper) {
    super(context, settings);
    this.tfProjectHelper = tfProjectHelper;
  }

  protected async init(hideErrMsgs = false, hideInfoMsgs = false) {
    getLogger().info("Running terraform init for all projects");
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      helpers.showWarning("No terraform project open. Please open a terraform project to use this command", hideInfoMsgs);
      return;
    }
    const terraformProjectFolders = await this.tfProjectHelper.findAllTerraformFoldersInOpenWorkspaces();
    if (terraformProjectFolders.length === 0) {
      helpers.showWarning("No terraform projects found in the current workspace", hideInfoMsgs);
      return;
    }

    const validFolders: PathObject[] = [];
    await Promise.all(
      terraformProjectFolders.map(async (folder) => {
        if (!(await this.tfProjectHelper.checkFolderContainsValidTerraformFiles(folder))) {
          getLogger().info("Folder " + folder.path + " is does not contain any modules or providers, skipping this folder");
          return;
        }
        validFolders.push(folder);
      })
    );
    if (validFolders.length === 0) {
      helpers.showInformation("No Terraform project found that could be initialized", hideInfoMsgs);
      return;
    }
    const unsuccessfulFolders: PathObject[] = [];
    // show progress bar for the amount of folders
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Initializing terraform projects",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });
        await Promise.all(
          validFolders.map(async (folder) => {
            try {
              await this.tfProjectHelper.initTerraformFolder(folder, false);
              progress.report({ increment: 100 / validFolders.length });
            } catch (error: unknown) {
              if (error instanceof Error) {
                getLogger().error(error.message);
              }
              unsuccessfulFolders.push(folder);
              progress.report({ increment: 100 / validFolders.length });
            }
          })
        );
      }
    );
    if (unsuccessfulFolders.length > 0) {
      const failedFoldersRelative = unsuccessfulFolders.map((folder) => {
        return vscode.workspace.asRelativePath(folder.path);
      });
      helpers.showError("Error encountered while initializing the following terraform projects: " + failedFoldersRelative.join(", "), hideErrMsgs);
      return;
    }
  }
}

export class TerraformInitCurrentProjectCommand extends BaseCommand {
  tfProjectHelper: IterraformProjectHelper;
  tfcli: TerraformCLI;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfProjectHelper: IterraformProjectHelper, tfcli: TerraformCLI) {
    super(context, settings);
    this.tfProjectHelper = tfProjectHelper;
    this.tfcli = tfcli;
  }

  async init(hideErrMsgs = false, hideInfoMsgs = false) {
    const [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined || currentFolderRelative === undefined || currentWorkspace === undefined) {
      hideInfoMsgs ? null : vscode.window.showWarningMessage("No terraform project open. Please open a terraform project to use this command");
      return;
    }
    const currentFolder = new PathObject(path.join(currentWorkspace.uri.fsPath, currentFolderRelative));
    try {
      await this.tfProjectHelper.initTerraformFolder(currentFolder, true);
    } catch (error) {
      if (error instanceof noValidTerraformFolder) {
        hideInfoMsgs ? null : vscode.window.showWarningMessage(error.message);
        return;
      }
      if (error instanceof terraformInitError) {
        hideErrMsgs ? null : vscode.window.showErrorMessage(error.message);
        return;
      }
    }
  }
}

export class TerraformFetchModulesCurrentProjectCommand extends BaseCommand {
  tfProjectHelper: IterraformProjectHelper;
  tfcli: TerraformCLI;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfProjectHelper: IterraformProjectHelper, tfcli: TerraformCLI) {
    super(context, settings);
    this.tfProjectHelper = tfProjectHelper;
    this.tfcli = tfcli;
  }

  protected async init(hideErrMsgs = false, hideInfoMsgs = false) {
    const [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined || currentFolderRelative === undefined || currentWorkspace === undefined) {
      hideInfoMsgs ? null : vscode.window.showWarningMessage("No terraform project open. Please open a terraform project to use this command");
      return;
    }
    const currentFolder = new PathObject(path.join(currentWorkspace.uri.fsPath, currentFolderRelative));
    try {
      await this.tfProjectHelper.refreshModulesInFolder(currentFolder);
    } catch (error) {
      if (error instanceof noValidTerraformFolder) {
        hideInfoMsgs ? null : vscode.window.showWarningMessage(error.message);
        return;
      }
      if (error instanceof terraformFolderNotInitialized) {
        hideInfoMsgs ? null : vscode.window.showWarningMessage(error.message);
        return;
      }
      if (error instanceof terraformGetError) {
        hideErrMsgs ? null : vscode.window.showErrorMessage(error.message);
        return;
      }
    }
  }
}
