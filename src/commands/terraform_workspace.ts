import * as fs from "fs";
import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import * as helpers from "../utils/helper_functions";
import { getLogger } from "../utils/logger";
import { IterraformCLI } from "../utils/terraform/terraform_cli";
import { TerraformProjectHelper } from "../utils/terraform/terraform_project_helper";
import { BaseCommand, IvscodeCommandSettings } from "./base_command";
import { PathObject } from "../utils/path";
import path = require("path");

export class ChoseAndSetTerraformWorkspaceCommand extends BaseCommand {
  tfcli: IterraformCLI;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfcli: IterraformCLI) {
    super(context, settings);
    this.tfcli = tfcli;
  }

  async init(): Promise<void> {
    const [currentWorkspace, workspaces, currentOpenFolder] = helpers.getCurrentProjectInformations();
    if (currentWorkspace === undefined || workspaces === undefined || currentOpenFolder === undefined) {
      throw new UserShownError("No workspace open. Open a terraform project to use this command.");
    }
    const currentOpenFolderAbsolut = new PathObject(path.join(currentWorkspace.uri.fsPath, currentOpenFolder));
    const [terraformWorkspaces, activeWorkspace] = await this.tfcli.getWorkspaces(currentOpenFolderAbsolut).catch((error) => {
      throw new UserShownError("Error getting terraform workspaces: " + error.toString());
    });
    if (terraformWorkspaces.length === 1) {
      helpers.showInformation("There is only the default workspace in this project.");
      return;
    }
    // show a quickpick to chose the workspace and add a lable to the active workspace
    const chosenWorkspace = await vscode.window.showQuickPick(
      terraformWorkspaces.map((workspace) => {
        if (workspace === activeWorkspace) {
          return {
            label: workspace,
            description: "(active)",
          };
        }
        return {
          label: workspace,
        };
      }),
      {
        placeHolder: "Choose a workspace",
      }
    );

    if (chosenWorkspace === undefined) {
      return;
    }
    if (chosenWorkspace.label === activeWorkspace) {
      helpers.showInformation("The workspace " + chosenWorkspace.label + " is already active.");
      return;
    }
    const [success, , stderr] = await this.tfcli.setWorkspace(currentOpenFolderAbsolut, chosenWorkspace.label);
    if (!success) {
      helpers.showError("Error setting workspace to " + chosenWorkspace.label + ", error: " + stderr);
      return;
    }
    getLogger().info("Successfully set workspace to " + chosenWorkspace.label);
  }
}

export class AutoSetTerraformWorkspaceCommand extends BaseCommand {
  tfcli: IterraformCLI;
  tfProjectHelper: TerraformProjectHelper;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfcli: IterraformCLI, tfProjectHelper: TerraformProjectHelper) {
    super(context, settings);
    this.tfcli = tfcli;
    this.tfProjectHelper = tfProjectHelper;
  }

  async init(silent = false): Promise<void> {
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      helpers.showWarning("No workspace open. Open a terraform project to use this command.", silent);
      return;
    }
    const terraformFolders = await this.tfProjectHelper.findAllTerraformFoldersInOpenWorkspaces();
    if (terraformFolders.length === 0) {
      helpers.showWarning("No terraform folder found in the open workspaces.", silent);
      return;
    }
    const processedFolders = [];
    const allreadySetFolders = [];
    await Promise.all(
      workspaces.map(async (workspace) => {
        const terraformToolboxJsonFile = new PathObject(path.join(workspace.uri.fsPath, ".terraform-toolbox.json"));
        if (!terraformToolboxJsonFile.exists()) {
          getLogger().debug("Skipping workspace " + workspace.name + " because it does not contain a .terraform-toolbox.json file.");
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let workspaceJson: any;
        try {
          workspaceJson = JSON.parse(fs.readFileSync(terraformToolboxJsonFile.path, "utf8"));
        } catch (error) {
          getLogger().error("Error parsing .terraform-toolbox.json file in workspace " + workspace.name + ", error: " + error);
          return;
        }
        if (workspaceJson.autoSetWorkspace.name === undefined) {
          getLogger().debug("Skipping workspace " + workspace.name + " because it does not contain a autoSetWorkspace.name property in the .terraform-toolbox.json file.");
        }
        const foldersInWorkspace = terraformFolders.filter((folder: PathObject) => {
          return folder.path.startsWith(workspace.uri.fsPath);
        });
        let filteredFolders;

        if (workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths === undefined || workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths === null) {
          filteredFolders = foldersInWorkspace;
        } else if (workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths.length === 0) {
          filteredFolders = foldersInWorkspace;
        } else {
          getLogger().debug("Found the following excluded folders in workspace " + workspace.name + ": " + workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths.join(", "));
          filteredFolders = foldersInWorkspace.filter((folder: PathObject) => {
            const relativePath = folder.path.replace(workspace.uri.fsPath, "").replace(/\\/g, "/");
            return !workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths.includes(relativePath);
          });
        }
        if (filteredFolders.length === 0) {
          getLogger().debug("Skipping workspace " + workspace.name + " because it does not contain a terraform folder.");
          return;
        }
        await Promise.all(
          filteredFolders.map(async (folder: PathObject) => {
            if (!this.tfProjectHelper.checkFolderHasBeenInitialized(folder)) {
              getLogger().debug("Skipping folder " + folder.path + " because it has not been initialized.");
              return;
            }
            if ((await this.tfProjectHelper.getCurrentWorkspaceFromEnvFile(folder)) === workspaceJson.autoSetWorkspace.name) {
              allreadySetFolders.push(folder);
              getLogger().info("Skipping folder " + folder.path + " because the workspace " + workspaceJson.autoSetWorkspace.name + " is already active.");
              return;
            }
            const [terraformWorkspaces] = await this.tfcli.getWorkspaces(folder);
            if (terraformWorkspaces === undefined) {
              getLogger().warn("Skipping folder " + folder.path + " because it does not contain any workspaces.");
              return;
            }
            if (!terraformWorkspaces.includes(workspaceJson.autoSetWorkspace.name)) {
              getLogger().warn("Skipping folder " + folder.path + " because it does not contain the workspace " + workspaceJson.autoSetWorkspace.name);
              return;
            }
            const [success, , stderr] = await this.tfcli.setWorkspace(folder, workspaceJson.autoSetWorkspace.name);
            if (!success) {
              getLogger().error("Error setting workspace to " + workspaceJson.autoSetWorkspace.name + " for folder " + folder.path + ", error: " + stderr);
              return;
            }
            getLogger().info("Successfully set workspace to " + workspaceJson.autoSetWorkspace.name + " for folder " + folder.path);
            processedFolders.push(folder);
          })
        );
      })
    );

    if (processedFolders.length === 0 && allreadySetFolders.length === 0) {
      helpers.showWarning("No folder found where the workspace could be set.", silent);
      return;
    }
    if (processedFolders.length > 0) {
      helpers.showInformation("Successfully set workspace for " + processedFolders.length + " folders.", silent);
      return;
    }
    helpers.showInformation("Workspace is already set for " + allreadySetFolders.length + " folders.", silent);
  }
}
