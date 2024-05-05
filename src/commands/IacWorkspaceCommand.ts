import * as fs from "fs";
import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import * as helpers from "../utils/helperFunctions";
import { IIacCli } from "../utils/IaC/iacCli";
import { IacProjectHelper } from "../utils/IaC/iacProjectHelper";
import { IIaCProvider } from "../utils/IaC/IIaCProvider";
import { getLogger } from "../utils/logger";
import { PathObject } from "../utils/path";
import { BaseCommand, IvscodeCommandSettings } from "./BaseCommand";
import path = require("path");

export class ChoseAndSetIacWorkspaceCommand extends BaseCommand {
  tfcli: IIacCli;
  iacProvider: IIaCProvider;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfcli: IIacCli, iacProvider: IIaCProvider) {
    super(context, settings);
    this.tfcli = tfcli;
    this.iacProvider = iacProvider;
  }

  async init(): Promise<void> {
    const [currentWorkspace, workspaces, currentOpenFolder] = helpers.getCurrentProjectInformations();
    if (currentWorkspace === undefined || workspaces === undefined || currentOpenFolder === undefined) {
      throw new UserShownError(`No workspace open. Open a ${this.iacProvider.name} project to use this command.`);
    }
    const currentOpenFolderAbsolut = new PathObject(path.join(currentWorkspace.uri.fsPath, currentOpenFolder));
    const [iacWorkspaces, activeWorkspace] = await this.tfcli.getWorkspaces(currentOpenFolderAbsolut).catch((error) => {
      throw new UserShownError(`Error getting ${this.iacProvider.name} workspaces: ${error.toString()}`);
    });
    if (iacWorkspaces.length === 1) {
      helpers.showInformation("There is only the default workspace in this project.");
      return;
    }
    // show a quickpick to chose the workspace and add a lable to the active workspace
    const chosenWorkspace = await vscode.window.showQuickPick(
      iacWorkspaces.map((workspace) => {
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
      helpers.showInformation(`The workspace ${chosenWorkspace.label} is already active.`);
      return;
    }
    const [success, , stderr] = await this.tfcli.setWorkspace(currentOpenFolderAbsolut, chosenWorkspace.label);
    if (!success) {
      helpers.showError(`Error setting workspace to ${chosenWorkspace.label}, error: ${stderr}`);
      return;
    }
    getLogger().info(`Successfully set workspace to ${chosenWorkspace.label}`);
  }
}

export class AutoSetIacWorkspaceCommand extends BaseCommand {
  tfcli: IIacCli;
  tfProjectHelper: IacProjectHelper;
  iacProvider: IIaCProvider;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfcli: IIacCli, tfProjectHelper: IacProjectHelper, iacProvider: IIaCProvider) {
    super(context, settings);
    this.tfcli = tfcli;
    this.tfProjectHelper = tfProjectHelper;
    this.iacProvider = iacProvider;
  }

  async init(silent = false): Promise<void> {
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      helpers.showWarning(`No workspace open. Open a ${this.iacProvider.name} project to use this command.`, silent);
      return;
    }
    const iacFolders = await this.tfProjectHelper.findAllIacFoldersInOpenWorkspace();
    if (iacFolders.length === 0) {
      helpers.showWarning(`No ${this.iacProvider.name} folder found in the open workspaces.`, silent);
      return;
    }
    const processedFolders = [];
    const allreadySetFolders = [];
    await Promise.all(
      workspaces.map(async (workspace) => {
        const terraformToolboxJsonFile = new PathObject(path.join(workspace.uri.fsPath, ".terraform-toolbox.json"));
        if (!terraformToolboxJsonFile.exists()) {
          getLogger().debug(`Skipping workspace ${workspace.name} because it does not contain a .terraform-toolbox.json file.`);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let workspaceJson: any;
        try {
          workspaceJson = JSON.parse(fs.readFileSync(terraformToolboxJsonFile.path, "utf8"));
        } catch (error) {
          getLogger().error(`Error parsing .terraform-toolbox.json file in workspace ${workspace.name}, error: ${error}`);
          return;
        }
        if (workspaceJson.autoSetWorkspace.name === undefined) {
          getLogger().debug(`Skipping workspace ${workspace.name} because it does not contain a autoSetWorkspace.name property in the .terraform-toolbox.json file.`);
        }
        const foldersInWorkspace = iacFolders.filter((folder: PathObject) => {
          return folder.path.startsWith(workspace.uri.fsPath);
        });
        let filteredFolders;

        if (workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths === undefined || workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths === null) {
          filteredFolders = foldersInWorkspace;
        } else if (workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths.length === 0) {
          filteredFolders = foldersInWorkspace;
        } else {
          getLogger().debug(`Found the following excluded folders in workspace ${workspace.name}: ${workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths.join(", ")}`);
          filteredFolders = foldersInWorkspace.filter((folder: PathObject) => {
            const relativePath = folder.path.replace(workspace.uri.fsPath, "").replace(/\\/g, "/");
            return !workspaceJson.autoSetWorkspace.excludedFoldersRelativePaths.includes(relativePath);
          });
        }
        if (filteredFolders.length === 0) {
          getLogger().debug(`Skipping workspace ${workspace.name} because it does not contain a ${this.iacProvider.name} folder.`);
          return;
        }
        await Promise.all(
          filteredFolders.map(async (folder: PathObject) => {
            if (!this.tfProjectHelper.checkFolderHasBeenInitialized(folder)) {
              getLogger().debug(`Skipping folder ${folder.path} because it has not been initialized.`);
              return;
            }
            if ((await this.tfProjectHelper.getCurrentWorkspaceFromEnvFile(folder)) === workspaceJson.autoSetWorkspace.name) {
              allreadySetFolders.push(folder);
              getLogger().info(`Skipping folder ${folder.path} because the workspace ${workspaceJson.autoSetWorkspace.name} is already active.`);
              return;
            }
            const [iacWorkspaces] = await this.tfcli.getWorkspaces(folder);
            if (iacWorkspaces === undefined) {
              getLogger().warn(`Skipping folder ${folder.path} because it does not contain any workspaces.`);
              return;
            }
            if (!iacWorkspaces.includes(workspaceJson.autoSetWorkspace.name)) {
              getLogger().warn(`Skipping folder ${folder.path} because it does not contain the workspace ${workspaceJson.autoSetWorkspace.name}`);
              return;
            }
            const [success, , stderr] = await this.tfcli.setWorkspace(folder, workspaceJson.autoSetWorkspace.name);
            if (!success) {
              getLogger().error(`Error setting workspace to ${workspaceJson.autoSetWorkspace.name} for folder ${folder.path}, error: ${stderr}`);
              return;
            }
            getLogger().info(`Successfully set workspace to ${workspaceJson.autoSetWorkspace.name} for folder ${folder.path}`);
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
      helpers.showInformation(`Successfully set workspace for ${processedFolders.length} folders.`, silent);
      return;
    }
    helpers.showInformation(`Workspace is already set for ${allreadySetFolders.length} folders.`, silent);
  }
}
