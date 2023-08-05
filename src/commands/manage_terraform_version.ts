import * as fs from "fs";
import * as hcl from "hcl2-parser";
import * as vscode from "vscode";
import * as helpers from "../utils/helper_functions";
import { getLogger } from "../utils/logger";
import { TerraformProjectHelper } from "../utils/terraform/terraform_project_helper";
import { IversionManager } from "../utils/version_manager";
import { BaseCommand, IvscodeCommandSettings } from "./base_command";

export class ChoseAndSetTerraformVersionCommand extends BaseCommand {
  private readonly _versionManager: IversionManager;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager) {
    super(context, settings);
    this._versionManager = versionManager;
  }

  protected async init() {
    const Releases = await this._versionManager.getReleases();
    const chosenRelease = await this._versionManager.choseRelease(Releases);
    if (chosenRelease === undefined) {
      getLogger().info("No terraform version chosen. Skipping setting terraform version.");
      return;
    }
    if (!(await this._versionManager.switchVersion(chosenRelease))) {
      vscode.window.showInformationMessage("Terraform version " + chosenRelease.name + " is already active.");
      getLogger().debug("Terraform version " + chosenRelease.name + " is already active.");
      return;
    }
  }
}

export class SetTerraformVersionBasedOnProjectRequirementsCommand extends BaseCommand {
  private readonly _versionManager: IversionManager;
  private _tfProjectHelper: TerraformProjectHelper;
  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, tfProjectHelper: TerraformProjectHelper) {
    super(context, settings);
    this._versionManager = versionManager;
    this._tfProjectHelper = tfProjectHelper;
  }

  protected async init(silent = false) {
    getLogger().info("Try to set terraform version based on project requirements.");
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      getLogger().debug("No workspace folder open. Skipping setting terraform version based on project requirements.");
      if (!silent) {
        vscode.window.showInformationMessage("No workspace folder open.");
      }
      return;
    }

    let terraformVersionRequirements = this.readTfVersionReqFromSpaceliftProjectAllWorkspaces(workspaces);
    if (terraformVersionRequirements.length === 0) {
      getLogger().debug("Unable to evaluate required terraform version from spacelift stacks, trying to read terraform version requirement from terraform block");
      terraformVersionRequirements = await this._tfProjectHelper.getRequiredTerraformVersionsForOpenWorkspaces();
    }
    if (terraformVersionRequirements.length === 0) {
      getLogger().debug("No terraform version requirements found in any of your open terraform files, skipping...");
      if (!silent) {
        vscode.window.showInformationMessage("No terraform version requirement found in project stacks.");
      }
      return;
    }
    const releases = await this._versionManager.getReleases();
    const targetRelease = releases.getNewestReleaseMatchingVersionConstraints(terraformVersionRequirements);
    if (!(await this._versionManager.switchVersion(targetRelease))) {
      if (!silent) {
        vscode.window.showInformationMessage("Terraform version " + targetRelease.name + " is already active.");
      }
      return;
    }
  }

  // This is a feature specific to our workflow at CMI. We have a file ./Spacelift-Resources/main.tf in our projects, which contains the terraform version requirement for all Stacks in the project.
  private readTfVersionReqFromSpaceliftProjectInWorkspace(spaceliftStackTfFile: vscode.Uri): string | undefined {
    if (!fs.existsSync(spaceliftStackTfFile.path)) {
      getLogger().debug("No spacelift stacks file found at " + spaceliftStackTfFile);
      return undefined;
    }
    const spaceliftStacks = hcl.parseToObject(fs.readFileSync(spaceliftStackTfFile.path, "utf8"));
    getLogger().trace("Spacelift resources file content: " + JSON.stringify(spaceliftStacks));
    try {
      const terraformVersion = spaceliftStacks[0].module["cmi-spacelift-stacks"][0].terraform_version;
      getLogger().debug("Found terraform version requirement in spacelift stacks: " + terraformVersion);
      return terraformVersion;
    } catch (error) {
      getLogger().debug("Unable to read terraform version requirement from spacelift stacks: " + error);
      return undefined;
    }
  }

  private readTfVersionReqFromSpaceliftProjectAllWorkspaces(workspaces: vscode.WorkspaceFolder[]): string[] {
    const terraformVersionRequirements: string[] = [];
    workspaces.forEach((workspace) => {
      const spaceliftStackTffile = vscode.Uri.joinPath(workspace.uri, "Spacelift-Resources", "main.tf");
      const requiredTerraformVersion = this.readTfVersionReqFromSpaceliftProjectInWorkspace(spaceliftStackTffile);
      if (requiredTerraformVersion !== undefined) {
        terraformVersionRequirements.push(requiredTerraformVersion);
      }
    });
    return [...new Set(terraformVersionRequirements)];
  }
}

export class ChoseAndDeleteTerraformVersionsCommand extends BaseCommand {
  private readonly _versionManager: IversionManager;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager) {
    super(context, settings);
    this._versionManager = versionManager;
  }

  async init() {
    const Releases = await this._versionManager.getReleases();
    if (Releases.installedNotActive.length === 0) {
      vscode.window.showInformationMessage("No terraform version installed besides the active one.");
      return;
    }
    const chosenReleases = await this._versionManager.selectMultipleReleases(Releases.installedNotActive, "Select terraform versions to delete");
    if (chosenReleases === undefined) {
      getLogger().info("No terraform versions chosen. Skipping deleting terraform versions.");
      return;
    }
    this._versionManager.deleteReleases(chosenReleases);
  }
}
