import * as vscode from "vscode";
import { UserShownError } from "../custom_errors";
import { Stack } from "../models/spacelift/stack";
import * as helpers from "../utils/helperFunctions";
import { getLogger } from "../utils/logger";

import { ISpacectl } from "../utils/Spacelift/spacectl";
import { IspaceliftClient } from "../utils/Spacelift/spaceliftClient";
import { BaseCommand, IvscodeCommandSettings } from "./BaseCommand";

export class RunSpacectlLocalPreviewCurrentStackCommand extends BaseCommand {
  spacelift: IspaceliftClient;
  spacectl: ISpacectl;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, spacelift: IspaceliftClient, spacectl: ISpacectl) {
    super(context, settings);
    this.spacelift = spacelift;
    this.spacectl = spacectl;
  }

  protected async init() {
    const stacks = await this.spacelift.getStacks();

    const [currentWorkspace, workspaces, currentFolderRelative] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined || currentFolderRelative === undefined || currentWorkspace === undefined) {
      throw new UserShownError("No Spacelift project open. Please open a Spacelift project to use this command");
    }
    const chosenWorkspaceStack = await choseWorkspace(stacks.getStacksMatchingProject(currentWorkspace.name, currentFolderRelative));
    if (chosenWorkspaceStack === undefined) {
      getLogger().info("No workspace chosen, aborting");
      return;
    }
    getLogger().info(`Running local preview for stack: ${chosenWorkspaceStack.name}`);
    this.spacectl.executeLocalPreview(chosenWorkspaceStack, currentWorkspace.uri.fsPath);
  }
}

export class RunSpacectlLocalPreviewCommand extends BaseCommand {
  spacelift: IspaceliftClient;
  spacectl: ISpacectl;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, spacelift: IspaceliftClient, spacectl: ISpacectl) {
    super(context, settings);
    this.spacelift = spacelift;
    this.spacectl = spacectl;
  }

  protected async init() {
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
    const chosenWorkspaceStack = await choseWorkspace(chosenStacks);
    if (chosenWorkspaceStack === undefined) {
      getLogger().info("No workspace chosen, aborting");
      return;
    }
    getLogger().info(`Running local preview for stack: ${chosenWorkspaceStack.name}`);
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
    getLogger().trace(`Identified unique stacks: ${JSON.stringify(uniqueStacks)}`);
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

async function choseWorkspace(stacks: Stack[]): Promise<Stack | undefined> {
  if (stacks.length === 0) {
    throw new UserShownError("No stack found for this project.");
  }
  if (stacks.length === 1) {
    getLogger().debug(`Only one stack found, using ${stacks[0].name}`);
    return stacks[0];
  }
  const stackNames = stacks.map((stack) => stack.vendorConfig.workspace);
  getLogger().debug(`Asking user to chose one of the following workspaces: ${JSON.stringify(stackNames)}`);
  const chosenWorkspaceName = await vscode.window.showQuickPick(stackNames, {
    placeHolder: "Please select a workspace",
  });
  const chosenStack = stacks.find((stack) => stack.vendorConfig.workspace === chosenWorkspaceName);
  if (chosenStack === undefined) {
    getLogger().debug("User has not chosen a workspace");
    return undefined;
  }
  return chosenStack;
}
