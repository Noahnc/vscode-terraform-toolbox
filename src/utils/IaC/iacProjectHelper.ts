import path = require("path");
import * as fs from "fs";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { Module } from "../../models/iac/module";
import { Provider } from "../../models/iac/provider";
import { iacResources } from "../../models/iac/iac_resources";
import { getLogger } from "../logger";
import { Settings } from "../../models/settings";
import { PathObject } from "../path";
import { IIacCli } from "./iacCli";

export interface Ihcl2Parser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseToObject: (hcl: string) => any;
}

export class terraformInitError extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "terraformInitError";
  }
}

export class noValidTerraformFolder extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "noValidTerraformFolder";
  }
}

export class terraformFolderNotInitialized extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "terraformFolderNotInitialized";
  }
}

export class terraformGetError extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "terraformGetError";
  }
}

export interface IIacProjectHelper {
  initTerraformFolder: (folder: PathObject, withProgress: boolean) => Promise<void>;
  refreshModulesInFolder: (folder: PathObject) => Promise<void>;
  findAllTerraformFoldersInOpenWorkspaces: () => Promise<PathObject[]>;
  checkFolderHasBeenInitialized: (folder: PathObject) => boolean;
  checkFolderContainsValidTerraformFiles: (folder: PathObject) => Promise<boolean>;
  getInstalledModulesForFolder: (folder: PathObject) => Promise<Module[]>;
  getDeclaredResourcesForFolder: (folder: PathObject) => Promise<iacResources | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvidersFromParsedHcl: (hclObject: any) => Provider[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModulesFromParsedHcl: (hclObject: any) => Module[];
  getCurrentWorkspaceFromEnvFile(folderPath: PathObject): Promise<string | undefined>;
}

export class IacProjectHelper implements IIacProjectHelper {
  private readonly hclParser: Ihcl2Parser;
  private readonly tfcli: IIacCli;
  private readonly terraformFolder = ".terraform";
  private readonly settings: Settings;

  constructor(hclParser: Ihcl2Parser, terraformCLI: IIacCli, settings: Settings) {
    this.hclParser = hclParser;
    this.tfcli = terraformCLI;
    this.settings = settings;
  }

  async findAllTerraformFoldersInOpenWorkspaces(): Promise<PathObject[]> {
    const excludeGlobPatternString = "{" + this.settings.excludedGlobPatterns.join(",") + "}";
    getLogger().trace("Searching for terraform folders with exclude pattern: " + excludeGlobPatternString);
    const terraformFiles = await vscode.workspace.findFiles("**/*.tf", excludeGlobPatternString, 2000);
    // get all unique folders of the collected files
    const terraformFolders: PathObject[] = [];
    terraformFiles.forEach((file) => {
      const folder = new PathObject(path.dirname(file.fsPath));

      // check if terraformFolders includes a element with the same path
      if (terraformFolders.some((element) => element.path === folder.path) === false) {
        terraformFolders.push(folder);
      }
    });
    return terraformFolders;
  }

  checkFolderHasBeenInitialized(folder: PathObject): boolean {
    const terraformFolder = folder.join(this.terraformFolder);
    if (!terraformFolder.exists()) {
      getLogger().debug("Folder " + folder.path + " contains no .terraform folder and is therefore not initialized");
      return false;
    }
    return true;
  }

  async checkFolderContainsValidTerraformFiles(folder: PathObject): Promise<boolean> {
    const resources = await this.getDeclaredResourcesForFolder(folder);
    if (resources === undefined) {
      return false;
    }
    if (resources.modules.length === 0 && resources.providers.length === 0) {
      getLogger().debug("Folder " + folder.path + " contains no modules or providers, skipping terraform init");
      return false;
    }
    return true;
  }

  async getCurrentWorkspaceFromEnvFile(folder: PathObject): Promise<string | undefined> {
    if (this.checkFolderHasBeenInitialized(folder) === false) {
      return undefined;
    }
    const envFilePath = folder.join(this.terraformFolder, "environment");
    if (!envFilePath.exists()) {
      return "default";
    }
    const envFileContent = fs.readFileSync(envFilePath.path, "utf8");
    const envFileLines = envFileContent.split("\n");
    if (envFileLines.length === 0) {
      return "default";
    }
    return envFileLines[0];
  }

  async getInstalledModulesForFolder(folder: PathObject): Promise<Module[]> {
    const installedModules: Module[] = [];
    const terraformFolder = folder.join(this.terraformFolder);
    const terraformModulesFile = terraformFolder.join("modules", "modules.json");
    if (!terraformFolder.exists()) {
      getLogger().debug("Folder " + folder.path + " contains no .terraform folder");
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modulesJson: any;
    try {
      modulesJson = JSON.parse(fs.readFileSync(terraformModulesFile.path, "utf8")).Modules;
    } catch (error) {
      getLogger().debug("Error reading modules file: " + terraformModulesFile.path);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modulesJson.forEach((module: any) => {
      installedModules.push(new Module(module.Key, module.Source, module.Version));
    });
    return installedModules;
  }

  async getRequiredTerraformVersionsForOpenWorkspaces(): Promise<string[]> {
    const foundVersions: string[] = [];
    const folders = await this.findAllTerraformFoldersInOpenWorkspaces();
    await Promise.all(
      folders.map(async (folder) => {
        const resources = await this.getDeclaredResourcesForFolder(folder);
        if (resources === undefined || resources.versionRequirements.length === 0) {
          return;
        }
        foundVersions.push(...resources.versionRequirements);
      })
    );
    const uniqueVersions = [...new Set(foundVersions)];
    getLogger().debug("Found required terraform versions: " + uniqueVersions);
    return uniqueVersions;
  }

  async getDeclaredResourcesForFolder(folder: PathObject): Promise<iacResources | undefined> {
    let foundModules: Module[] = [];
    let foundProviders: Provider[] = [];
    let requiredVersions: string[] = [];
    // find all files in the folder that end with .tf with a depth of 1
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder.path, "*.tf"));
    files.forEach((file) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hclObject: any;
      try {
        hclObject = this.hclParser.parseToObject(fs.readFileSync(file.fsPath, "utf8"));
        if (hclObject === undefined) {
          getLogger().debug("Error parsing file: " + file.fsPath);
          return;
        }
        if (hclObject[0] === undefined || hclObject[0] === null) {
          getLogger().debug("File " + file.fsPath + " does not contain any hcl objects");
          return;
        }
      } catch (error) {
        return;
      }
      requiredVersions = requiredVersions.concat(this.getRequiredTerraformVersionFromParsedHcl(hclObject));
      foundModules = foundModules.concat(this.getModulesFromParsedHcl(hclObject));
      foundProviders = foundProviders.concat(this.getProvidersFromParsedHcl(hclObject));
    });
    return new iacResources(foundModules, foundProviders, [...new Set(requiredVersions)]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvidersFromParsedHcl(hclObject: any): Provider[] {
    const foundProviders: Provider[] = [];
    if (!Object.prototype.hasOwnProperty.call(hclObject[0], "terraform")) {
      getLogger().trace("File does not contain a terraform block");
      return [];
    }
    if (!Object.prototype.hasOwnProperty.call(hclObject[0]["terraform"][0], "required_providers")) {
      getLogger().trace("File does not contain any required providers");
      return [];
    }
    const providers = hclObject[0].terraform[0].required_providers[0];
    for (const key in providers) {
      const provider = providers[key];
      foundProviders.push(new Provider(key, provider.source, provider.version));
    }
    return foundProviders;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModulesFromParsedHcl(hclObject: any): Module[] {
    const foundModules: Module[] = [];
    if (!Object.prototype.hasOwnProperty.call(hclObject[0], "module")) {
      getLogger().trace("File does not contain any modules");
      return [];
    }
    const modules = hclObject[0].module;
    for (const key in modules) {
      const module = modules[key][0];
      foundModules.push(new Module(key, module.source, module.version));
    }
    return foundModules;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRequiredTerraformVersionFromParsedHcl(hclObject: any): string[] {
    if (!Object.prototype.hasOwnProperty.call(hclObject[0], "terraform")) {
      getLogger().trace("File does not contain a terraform block");
      return [];
    }
    if (!Object.prototype.hasOwnProperty.call(hclObject[0]["terraform"][0], "required_version")) {
      getLogger().trace("File does not contain a required_version");
      return [];
    }
    return hclObject[0].terraform[0].required_version;
  }

  async refreshModulesInFolder(folder: PathObject): Promise<void> {
    if ((await this.checkFolderContainsValidTerraformFiles(folder)) === false) {
      throw new noValidTerraformFolder("Folder " + folder + " does not contain any modules or providers and can therefore not be initialized");
    }
    if (this.checkFolderHasBeenInitialized(folder) === false) {
      throw new terraformFolderNotInitialized("Folder " + folder.path + " is not initialized");
    }
    getLogger().debug("Refreshing modules in folder " + folder.path);
    const [success, , stderr] = await this.tfcli.getModules(folder);
    if (success === false) {
      throw new terraformGetError("Error running terraform get for project " + folder.path + ": " + stderr);
    }
    getLogger().debug("Successfully refreshed modules in folder " + folder.path);
    return;
  }

  async initTerraformFolder(folder: PathObject, withProgress = false): Promise<void> {
    if (!(await this.checkFolderContainsValidTerraformFiles(folder))) {
      throw new noValidTerraformFolder("Folder " + folder.path + " does not contain any modules or providers and can therefore not be initialized");
    }
    getLogger().debug("Initializing terraform project " + folder.path);
    if (withProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: "Initializing current folder",
          cancellable: false,
        },
        async () => {
          const [success, , stderr] = await this.tfcli.init(folder, this.settings.initArgs);
          if (success === false) {
            throw new terraformInitError("Error running terraform init for Folder:" + folder.path + " error: " + stderr);
          }
        }
      );
      return;
    }
    const [success, , stderr] = await this.tfcli.init(folder, this.settings.initArgs);
    if (success === false) {
      throw new terraformInitError("Error running terraform init for Folder:" + folder.path + " error: " + stderr);
    }
    getLogger().info("Successfully initialized terraform project " + folder.path);
    return;
  }
}
