import * as fs from "fs";
import * as hcl from "hcl2-parser";
import * as vscode from "vscode";
import * as helpers from "../utils/helperFunctions";
import { BaseCommand, IvscodeCommandSettings } from "./BaseCommand";
import { PathObject } from "../utils/path";
import path = require("path");
import { IversionManager } from "../utils/VersionManager/versionManager";
import { getLogger } from "../utils/logger";
import { IacProjectHelper } from "../utils/IaC/iacProjectHelper";
import { IIaCProvider } from "../utils/IaC/IIaCProvider";

export class ChoseAndSetIacVersionCommand extends BaseCommand {
  private readonly _versionManager: IversionManager;
  private readonly _iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, iacProvider: IIaCProvider) {
    super(context, settings);
    this._versionManager = versionManager;
    this._iacProvider = iacProvider;
  }

  protected async init() {
    const Releases = await this._versionManager.getReleases();
    const chosenRelease = await this._versionManager.choseRelease(Releases);
    if (chosenRelease === undefined) {
      getLogger().info("No " + this._iacProvider.getName() + " version chosen, skipping...");
      return;
    }
    if (!(await this._versionManager.switchVersion(chosenRelease))) {
      vscode.window.showInformationMessage(this._iacProvider.getName() + " version " + chosenRelease.name + " is already active.");
      getLogger().debug(this._iacProvider.getName() + " version " + chosenRelease.name + " is already active.");
      return;
    }
  }
}

export class SetIacVersionBasedOnProjectRequirementsCommand extends BaseCommand {
  private readonly _versionManager: IversionManager;
  private _tfProjectHelper: IacProjectHelper;
  private readonly _iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, tfProjectHelper: IacProjectHelper, iacProvider: IIaCProvider) {
    super(context, settings);
    this._versionManager = versionManager;
    this._tfProjectHelper = tfProjectHelper;
    this._iacProvider = iacProvider;
  }

  protected async init(silent = false) {
    getLogger().info("Try to set " + this._iacProvider.getName() + " version based on project requirements.");
    const [, workspaces] = helpers.getCurrentProjectInformations();
    if (workspaces === undefined) {
      getLogger().debug("No workspace folder open. Skipping setting " + this._iacProvider.getName() + " version based on project requirements.");
      if (!silent) {
        vscode.window.showInformationMessage("No workspace folder open.");
      }
      return;
    }

    let iacVersionRequirements = this.readTfVersionReqFromSpaceliftProjectAllWorkspaces(workspaces);
    if (iacVersionRequirements.length === 0) {
      getLogger().debug("Unable to evaluate required " + this._iacProvider.getName() + " version from spacelift stacks, trying to read version requirement from terraform block");
      iacVersionRequirements = await this._tfProjectHelper.getRequiredTerraformVersionsForOpenWorkspaces();
    }
    if (iacVersionRequirements.length === 0) {
      getLogger().debug("No " + this._iacProvider.getName() + " version requirements found in any of your workspace files, skipping...");
      if (!silent) {
        vscode.window.showInformationMessage("No " + this._iacProvider.getName() + " version requirement found in project stacks.");
      }
      return;
    }
    const releases = await this._versionManager.getReleases();
    const targetRelease = releases.getNewestReleaseMatchingVersionConstraints(iacVersionRequirements);
    if (!(await this._versionManager.switchVersion(targetRelease))) {
      if (!silent) {
        vscode.window.showInformationMessage(this._iacProvider.getName() + " version " + targetRelease.name + " is already active.");
      }
      return;
    }
  }

  // This is a feature specific to our workflow at CMI. We have a file ./Spacelift-Resources/main.tf in our projects, which contains the terraform version requirement for all Stacks in the project.
  private readTfVersionReqFromSpaceliftProjectInWorkspace(spaceliftStackTfFile: PathObject): string | undefined {
    if (!spaceliftStackTfFile.exists()) {
      getLogger().debug("No spacelift stacks file found at " + spaceliftStackTfFile.path);
      return undefined;
    }
    const spaceliftStacks = hcl.parseToObject(fs.readFileSync(spaceliftStackTfFile.path, "utf8"));
    getLogger().trace("Spacelift resources file content: " + JSON.stringify(spaceliftStacks));
    try {
      const terraformVersion = spaceliftStacks[0].module["cmi-spacelift-stacks"][0].terraform_version;
      getLogger().debug("Found " + this._iacProvider.getName() + " version requirement in spacelift stacks: " + terraformVersion);
      return terraformVersion;
    } catch (error) {
      getLogger().debug("Unable to read " + this._iacProvider.getName() + " version requirement from spacelift stacks: " + error);
      return undefined;
    }
  }

  private readTfVersionReqFromSpaceliftProjectAllWorkspaces(workspaces: vscode.WorkspaceFolder[]): string[] {
    const terraformVersionRequirements: string[] = [];
    workspaces.forEach((workspace) => {
      const spaceliftStackTffile = new PathObject(path.join(workspace.uri.fsPath, "Spacelift-Resources", "main.tf"));
      const requiredTerraformVersion = this.readTfVersionReqFromSpaceliftProjectInWorkspace(spaceliftStackTffile);
      if (requiredTerraformVersion !== undefined) {
        terraformVersionRequirements.push(requiredTerraformVersion);
      }
    });
    return [...new Set(terraformVersionRequirements)];
  }
}

export class ChoseAndDeleteIacVersionsCommand extends BaseCommand {
  private readonly _versionManager: IversionManager;
  private readonly _iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, settings: IvscodeCommandSettings, versionManager: IversionManager, iacProvider: IIaCProvider) {
    super(context, settings);
    this._versionManager = versionManager;
    this._iacProvider = iacProvider;
  }

  async init() {
    const Releases = await this._versionManager.getReleases();
    if (Releases.installedNotActive.length === 0) {
      vscode.window.showInformationMessage("No " + this._iacProvider.getName() + " version installed besides the active one.");
      return;
    }
    const chosenReleases = await this._versionManager.selectMultipleReleases(Releases.installedNotActive, "Select " + this._iacProvider.getName() + " versions to delete");
    if (chosenReleases === undefined) {
      getLogger().info("No " + this._iacProvider.getName() + " versions chosen. Skipping...");
      return;
    }
    this._versionManager.deleteReleases(chosenReleases);
  }
}
