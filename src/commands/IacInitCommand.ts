import * as vscode from "vscode";
import * as helpers from "../utils/helperFunctions";
import { IacCli } from "../utils/IaC/iacCli";
import { IacFolderNotInitialized, IacGetError, IacInitError, IIacProjectHelper, NoValidIacFolder } from "../utils/IaC/iacProjectHelper";
import { IIaCProvider } from "../utils/IaC/IIaCProvider";
import { getLogger } from "../utils/logger";
import { PathObject } from "../utils/path";
import { BaseCommand, IvscodeCommandSettings } from "./BaseCommand";
import path = require("path");

export class IacInitAllProjectsCommand extends BaseCommand {
  private iacProjectHelper: IIacProjectHelper;
  private iacProvider: IIaCProvider;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfProjectHelper: IIacProjectHelper, iacProvider: IIaCProvider) {
    super(context, settings);
    this.iacProjectHelper = tfProjectHelper;
    this.iacProvider = iacProvider;
  }

  protected async init(hideErrMsgs = false, hideInfoMsgs = false, onlyThisProjects: PathObject[] = []) {
    let validFolders: PathObject[] = [];
    if (onlyThisProjects.length === 0) {
      getLogger().info(`Running ${this.iacProvider.name} init for all projects`);
      validFolders = await this.findValidIacFoldersInOpenWorkspace(hideInfoMsgs);
    } else {
      getLogger().info(`Running ${this.iacProvider.name} init for the following projects: ${onlyThisProjects.map((folder) => folder.path).join(", ")}`);
      validFolders = onlyThisProjects;
    }
    if (validFolders.length === 0) {
      helpers.showInformation(`No ${this.iacProvider.name} project found that could be initialized`, hideInfoMsgs);
      return;
    }
    const unsuccessfulFolders: PathObject[] = [];
    // show progress bar for the amount of folders
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: `Initializing ${this.iacProvider.name} projects`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });
        await Promise.all(
          validFolders.map(async (folder) => {
            try {
              await this.iacProjectHelper.initFolder(folder, false);
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
      helpers.showError(`Error encountered while initializing the following ${this.iacProvider.name} projects: ${failedFoldersRelative.join(", ")}`, hideErrMsgs);
      return;
    }
  }

  private async findValidIacFoldersInOpenWorkspace(hideInfoMsgs: boolean): Promise<PathObject[]> {
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      helpers.showWarning(`No ${this.iacProvider.name} project open. Please open a ${this.iacProvider.name} project to use this command`, hideInfoMsgs);
      return [];
    }
    const projectFolders = await this.iacProjectHelper.findAllIacFoldersInOpenWorkspace();
    if (projectFolders.length === 0) {
      helpers.showWarning(`No ${this.iacProvider.name} projects found in the current workspace`, hideInfoMsgs);
      return [];
    }

    const validFolders: PathObject[] = [];
    await Promise.all(
      projectFolders.map(async (folder) => {
        if (!(await this.iacProjectHelper.checkfolderContainsValidTfFiles(folder))) {
          getLogger().info(`Folder ${folder.path} is does not contain any modules or providers, skipping this folder`);
          return;
        }
        validFolders.push(folder);
      })
    );
    return validFolders;
  }
}

export class IacInitCurrentProjectCommand extends BaseCommand {
  private iacProjectHelper: IIacProjectHelper;
  private iacCli: IacCli;
  private iacProvider: IIaCProvider;
  constructor({
    context,
    settings,
    tfProjectHelper,
    iacCli,
    iacProvider,
  }: {
    context: vscode.ExtensionContext;
    settings: IvscodeCommandSettings;
    tfProjectHelper: IIacProjectHelper;
    iacCli: IacCli;
    iacProvider: IIaCProvider;
  }) {
    super(context, settings);
    this.iacProjectHelper = tfProjectHelper;
    this.iacCli = iacCli;
    this.iacProvider = iacProvider;
  }

  async init(hideErrMsgs = false, hideInfoMsgs = false) {
    const [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined || currentFolderRelative === undefined || currentWorkspace === undefined) {
      hideInfoMsgs ? null : vscode.window.showWarningMessage(`No ${this.iacProvider.name} project open. Please open a ${this.iacProvider.name} project to use this command`);
      return;
    }
    const currentFolder = new PathObject(path.join(currentWorkspace.uri.fsPath, currentFolderRelative));
    try {
      await this.iacProjectHelper.initFolder(currentFolder, true);
    } catch (error) {
      if (error instanceof NoValidIacFolder) {
        hideInfoMsgs ? null : vscode.window.showWarningMessage(error.message);
        return;
      }
      if (error instanceof IacInitError) {
        hideErrMsgs ? null : vscode.window.showErrorMessage(error.message);
        return;
      }
    }
  }
}

export class IacFetchModulesCurrentProjectCommand extends BaseCommand {
  private iacProjectHelper: IIacProjectHelper;
  private iacCli: IacCli;
  private iacProvider: IIaCProvider;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, tfProjectHelper: IIacProjectHelper, iacCli: IacCli, iacProvider: IIaCProvider) {
    super(context, settings);
    this.iacProjectHelper = tfProjectHelper;
    this.iacCli = iacCli;
    this.iacProvider = iacProvider;
  }

  protected async init(hideErrMsgs = false, hideInfoMsgs = false) {
    const [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined || currentFolderRelative === undefined || currentWorkspace === undefined) {
      hideInfoMsgs ? null : vscode.window.showWarningMessage(`No ${this.iacProvider.name} project open. Please open a ${this.iacProvider.name} project to use this command`);
      return;
    }
    const currentFolder = new PathObject(path.join(currentWorkspace.uri.fsPath, currentFolderRelative));
    try {
      await this.iacProjectHelper.refreshModulesInFolder(currentFolder);
    } catch (error) {
      if (error instanceof NoValidIacFolder) {
        hideInfoMsgs ? null : vscode.window.showWarningMessage(error.message);
        return;
      }
      if (error instanceof IacFolderNotInitialized) {
        hideInfoMsgs ? null : vscode.window.showWarningMessage(error.message);
        return;
      }
      if (error instanceof IacGetError) {
        hideErrMsgs ? null : vscode.window.showErrorMessage(error.message);
        return;
      }
    }
  }
}
