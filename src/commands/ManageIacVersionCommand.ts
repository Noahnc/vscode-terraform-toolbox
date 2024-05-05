import * as fs from "fs";
import * as hcl from "hcl2-parser";
import * as vscode from "vscode";
import * as helpers from "../utils/helperFunctions";
import { IacProjectHelper } from "../utils/IaC/iacProjectHelper";
import { IIaCProvider } from "../utils/IaC/IIaCProvider";
import { getLogger } from "../utils/logger";
import { PathObject } from "../utils/path";
import { IversionManager } from "../utils/VersionManager/versionManager";
import { BaseCommand, IvscodeCommandSettings } from "./BaseCommand";
import path = require("path");

export class ChoseAndSetIacVersionCommand extends BaseCommand {
  private readonly versionManager: IversionManager;
  private readonly iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, iacProvider: IIaCProvider) {
    super(context, settings);
    this.versionManager = versionManager;
    this.iacProvider = iacProvider;
  }

  protected async init() {
    const releases = await this.versionManager.getReleases();
    const chosenRelease = await this.versionManager.choseRelease(releases);
    if (chosenRelease === undefined) {
      getLogger().info(`No ${this.iacProvider.name} version chosen, skipping...`);
      return;
    }
    if (!(await this.versionManager.switchVersion(chosenRelease))) {
      vscode.window.showInformationMessage(`${this.iacProvider.name} version ${chosenRelease.name} is already active.`);
      getLogger().debug(`${this.iacProvider.name} version ${chosenRelease.name} is already active.`);
      return;
    }
  }
}

export class SetIacVersionBasedOnProjectRequirementsCommand extends BaseCommand {
  private readonly versionManager: IversionManager;
  private tfProjectHelper: IacProjectHelper;
  private readonly iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, tfProjectHelper: IacProjectHelper, iacProvider: IIaCProvider) {
    super(context, settings);
    this.versionManager = versionManager;
    this.tfProjectHelper = tfProjectHelper;
    this.iacProvider = iacProvider;
  }

  protected async init(silent = false) {
    getLogger().info(`Try to set ${this.iacProvider.name} version based on project requirements.`);
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      getLogger().debug(`No workspace folder open. Skipping setting ${this.iacProvider.name} version based on project requirements.`);
      if (!silent) {
        vscode.window.showInformationMessage("No workspace folder open.");
      }
      return;
    }

    let iacVersionRequirements = this.readTfVersionReqFromSpaceliftProjectAllWorkspaces(workspaces);
    if (iacVersionRequirements.length === 0) {
      getLogger().debug(`Unable to evaluate required ${this.iacProvider.name} version from spacelift stacks, trying to read version requirement from terraform block`);
      iacVersionRequirements = await this.tfProjectHelper.getRequiredTerraformVersionsForOpenWorkspaces();
    }
    if (iacVersionRequirements.length === 0) {
      getLogger().debug(`No ${this.iacProvider.name} version requirements found in any of your workspace files, skipping...`);
      if (!silent) {
        vscode.window.showInformationMessage(`No ${this.iacProvider.name} version requirement found in project stacks.`);
      }
      return;
    }
    const releases = await this.versionManager.getReleases();
    const targetRelease = releases.getNewestReleaseMatchingVersionConstraints(iacVersionRequirements);
    if (!(await this.versionManager.switchVersion(targetRelease))) {
      if (!silent) {
        vscode.window.showInformationMessage(`${this.iacProvider.name} version ${targetRelease.name} is already active.`);
      }
      return;
    }
  }

  // This is a feature specific to our workflow at CMI. We have a file ./Spacelift-Resources/main.tf in our projects, which contains the terraform version requirement for all Stacks in the project.
  private readTfVersionReqFromSpaceliftProjectInWorkspace(spaceliftStackTfFile: PathObject): string | undefined {
    if (!spaceliftStackTfFile.exists()) {
      getLogger().debug(`No spacelift stacks file found at ${spaceliftStackTfFile.path}`);
      return undefined;
    }
    const spaceliftStacks = hcl.parseToObject(fs.readFileSync(spaceliftStackTfFile.path, "utf8"));
    getLogger().trace(`Spacelift resources file content: ${JSON.stringify(spaceliftStacks)}`);
    try {
      const terraformVersion = spaceliftStacks[0].module["cmi-spacelift-stacks"][0].terraform_version;
      getLogger().debug(`Found ${this.iacProvider.name} version requirement in spacelift stacks: ${terraformVersion}`);
      return terraformVersion;
    } catch (error) {
      getLogger().debug(`Unable to read ${this.iacProvider.name} version requirement from spacelift stacks: ${error}`);
      return undefined;
    }
  }

  private readTfVersionReqFromSpaceliftProjectAllWorkspaces(workspaces: vscode.WorkspaceFolder[]): string[] {
    const versionRequirements: string[] = [];
    workspaces.forEach((workspace) => {
      const spaceliftStackTffile = new PathObject(path.join(workspace.uri.fsPath, "Spacelift-Resources", "main.tf"));
      const requiredTerraformVersion = this.readTfVersionReqFromSpaceliftProjectInWorkspace(spaceliftStackTffile);
      if (requiredTerraformVersion !== undefined) {
        versionRequirements.push(requiredTerraformVersion);
      }
    });
    return [...new Set(versionRequirements)];
  }
}

export class ChoseAndDeleteIacVersionsCommand extends BaseCommand {
  private readonly versionManager: IversionManager;
  private readonly iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, iacProvider: IIaCProvider) {
    super(context, settings);
    this.versionManager = versionManager;
    this.iacProvider = iacProvider;
  }

  async init() {
    const releases = await this.versionManager.getReleases();
    if (releases.installedNotActive.length === 0) {
      vscode.window.showInformationMessage(`No ${this.iacProvider.name} version installed besides the active one.`);
      return;
    }
    const chosenReleases = await this.versionManager.selectMultipleReleases(releases.installedNotActive, `Select ${this.iacProvider.name} versions to delete`);
    if (chosenReleases === undefined) {
      getLogger().info(`No ${this.iacProvider.name} versions chosen. Skipping...`);
      return;
    }
    this.versionManager.deleteReleases(chosenReleases);
  }
}
