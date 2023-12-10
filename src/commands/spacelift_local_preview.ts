import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import { Stack } from "../models/spacelift/stack";
import * as helpers from "../utils/helper_functions";
import { getLogger } from "../utils/logger";
import { Ispacectl } from "../utils/spacelift/spacectl";
import { IspaceliftClient } from "../utils/spacelift/spacelift_client";
import { BaseCommand, IvscodeCommandSettings } from "./base_command";

export class RunSpacectlLocalPreviewCurrentStackCommand extends BaseCommand {
  spacelift: IspaceliftClient;
  spacectl: Ispacectl;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, spacelift: IspaceliftClient, spacectl: Ispacectl) {
    super(context, settings);
    this.spacelift = spacelift;
    this.spacectl = spacectl;
  }

  protected async init() {
    if ((await this.spacelift.isAuthenticated()) === false) {
      throw new UserShownError("Spacectl not authenticated, please login first.");
    }
    const stacks = await this.spacelift.getStacks();

    const [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined || currentFolderRelative === undefined || currentWorkspace === undefined) {
      throw new UserShownError("No Spacelift terraform project open. Please open a Spacelift terraform project to use this command");
    }
    const chosenWorkspaceStack = await choseTerraformWorkspace(stacks.getStacksMatchingProject(currentWorkspace.name, currentFolderRelative));
    if (chosenWorkspaceStack === undefined) {
      getLogger().info("No workspace chosen, aborting");
      return;
    }
    getLogger().info("Running local preview for stack: " + chosenWorkspaceStack.name);
    this.spacectl.executeLocalPreview(chosenWorkspaceStack, currentWorkspace.uri.fsPath);
  }
}

export class RunSpacectlLocalPreviewCommand extends BaseCommand {
  spacelift: IspaceliftClient;
  spacectl: Ispacectl;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, spacelift: IspaceliftClient, spacectl: Ispacectl) {
    super(context, settings);
    this.spacelift = spacelift;
    this.spacectl = spacectl;
  }

  protected async init() {
    if ((await this.spacelift.isAuthenticated()) === false) {
      throw new UserShownError("Spacectl not authenticated, please login first.");
    }
    const stacks = await this.spacelift.getStacks();
    // eslint-disable-next-line prefer-const
    let [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      throw new UserShownError("No open workspace found.");
    }
    if (currentWorkspace === undefined || currentFolderRelative === undefined) {
      currentWorkspace = await helpers.getUserDecision("Select a workspace", workspaces, "name");
      if (currentWorkspace === undefined) {
        getLogger().debug("No workspace chosen, aborting");
        return;
      }
    }
    const chosenStacks = await this.choseStacks(stacks.getStacksMatchingProject(currentWorkspace.name));
    if (chosenStacks === undefined || chosenStacks.length === 0) {
      getLogger().info("No workspace chosen, aborting");
      return;
    }
    const chosenWorkspaceStack = await choseTerraformWorkspace(chosenStacks);
    if (chosenWorkspaceStack === undefined) {
      getLogger().info("No workspace chosen, aborting");
      return;
    }
    getLogger().info("Running local preview for stack: " + chosenWorkspaceStack.name);
    this.spacectl.executeLocalPreview(chosenWorkspaceStack, currentWorkspace.uri.fsPath);
  }

  async choseStacks(stacks: Stack[]): Promise<Stack[] | undefined> {
    if (stacks.length === 0) {
      throw new UserShownError("No stack found for this project.");
    }
    // Create a list of unique stacks and sort out duplicate stacks for different environments (eg. dev and prod)
    const uniqueStacks: Stack[] = [];
    for (const stack of stacks) {
      if (!uniqueStacks.some((uniqueStack) => uniqueStack.projectRoot === stack.projectRoot && uniqueStack.repository === stack.repository)) {
        uniqueStacks.push(stack);
      }
    }
    getLogger().trace("Identified unique stacks: " + JSON.stringify(uniqueStacks));
    const chosenStack = await helpers.getUserDecision<Stack>("Select a spacelift stack", uniqueStacks, "projectRoot");
    if (chosenStack === undefined) {
      getLogger().debug("User has not chosen a project");
      return undefined;
    }
    return stacks.filter((stack) => {
      return stack.projectRoot === chosenStack.projectRoot && stack.repository === chosenStack.repository;
    });
  }
}

async function choseTerraformWorkspace(stacks: Stack[]): Promise<Stack | undefined> {
  if (stacks.length === 0) {
    throw new UserShownError("No stack found for this project.");
  }
  if (stacks.length === 1) {
    getLogger().debug("Only one stack found, using " + stacks[0].name);
    return stacks[0];
  }
  const stackNames = stacks.map((stack) => stack.vendorConfig.workspace);
  getLogger().debug("Asking user to chose one of the following terraform workspaces: " + JSON.stringify(stackNames));
  const chosenTerraformWorkspaceName = await vscode.window.showQuickPick(stackNames, {
    placeHolder: "Please select a terraform workspace",
  });
  const chosenStack = stacks.find((stack) => stack.vendorConfig.workspace === chosenTerraformWorkspaceName);
  if (chosenStack === undefined) {
    getLogger().debug("User has not chosen a terraform workspace");
    return undefined;
  }
  return chosenStack;
}
