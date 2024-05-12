import path = require("path");
import * as fs from "fs";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { IacResources } from "../../models/iac/iacResources";
import { InstalledIacProvider } from "../../models/iac/installedIacProvider";
import { IacModule } from "../../models/iac/module";
import { IacProvider } from "../../models/iac/provider";
import { Settings } from "../../models/settings";
import { getLogger } from "../logger";
import { PathObject } from "../path";
import { IIacCli } from "./iacCli";

export interface Ihcl2Parser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseToObject: (hcl: string) => any;
}

export class IacInitError extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "IacInitError";
  }
}

export class NoValidIacFolder extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "NoValidIacFolder";
  }
}

export class IacFolderNotInitialized extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "IacFolderNotInitialized";
  }
}

export class IacGetError extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "IacGetError";
  }
}

export interface IIacProjectHelper {
  initFolder: (folder: PathObject, withProgress: boolean) => Promise<void>;
  refreshModulesInFolder: (folder: PathObject) => Promise<void>;
  findAllIacFoldersInOpenWorkspace: () => Promise<PathObject[]>;
  checkFolderHasBeenInitialized: (folder: PathObject) => boolean;
  checkfolderContainsValidTfFiles: (folder: PathObject) => Promise<boolean>;
  getInstalledProvidersForFolder: (folder: PathObject) => Promise<InstalledIacProvider[]>;
  getInstalledModulesForFolder: (folder: PathObject) => Promise<IacModule[]>;
  getDeclaredResourcesForFolder: (folder: PathObject) => Promise<IacResources | undefined>;
  getDeclaredResourcesForFile: (file: PathObject) => Promise<IacResources | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvidersFromParsedHcl: (hclObject: any) => IacProvider[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModulesFromParsedHcl: (hclObject: any) => IacModule[];
  getCurrentWorkspaceFromEnvFile(folderPath: PathObject): Promise<string | undefined>;
}

export class IacProjectHelper implements IIacProjectHelper {
  private readonly hclParser: Ihcl2Parser;
  private readonly iacCli: IIacCli;
  private readonly tfrcFolder = ".terraform";
  private readonly tflockFileName = ".terraform.lock.hcl";
  private readonly settings: Settings;

  constructor(hclParser: Ihcl2Parser, iacCli: IIacCli, settings: Settings) {
    this.hclParser = hclParser;
    this.iacCli = iacCli;
    this.settings = settings;
  }

  async findAllIacFoldersInOpenWorkspace(): Promise<PathObject[]> {
    const excludeGlobPatternString = `{${this.settings.excludedGlobPatterns.value.join(",")}}`;
    getLogger().trace(`Searching for project folders with exclude pattern: ${excludeGlobPatternString}`);
    const tfFiles = await vscode.workspace.findFiles("**/*.tf", excludeGlobPatternString, 2000);
    // get all unique folders of the collected files
    const tfFolders: PathObject[] = [];
    tfFiles.forEach((file) => {
      const folder = new PathObject(path.dirname(file.fsPath));

      // check if tfFolders includes a element with the same path
      if (tfFolders.some((element) => element.path === folder.path) === false) {
        tfFolders.push(folder);
      }
    });
    return tfFolders;
  }

  checkFolderHasBeenInitialized(folder: PathObject): boolean {
    const tfFolder = folder.join(this.tfrcFolder);
    if (!tfFolder.exists()) {
      getLogger().debug(`Folder ${folder.path} contains no .terraform folder and is therefore not initialized`);
      return false;
    }
    return true;
  }

  async checkfolderContainsValidTfFiles(folder: PathObject): Promise<boolean> {
    const resources = await this.getDeclaredResourcesForFolder(folder);
    if (resources === undefined) {
      return false;
    }
    if (resources.modules.length === 0 && resources.providers.length === 0) {
      getLogger().debug(`Folder ${folder.path} contains no modules or providers`);
      return false;
    }
    return true;
  }

  async getCurrentWorkspaceFromEnvFile(folder: PathObject): Promise<string | undefined> {
    if (this.checkFolderHasBeenInitialized(folder) === false) {
      return undefined;
    }
    const envFilePath = folder.join(this.tfrcFolder, "environment");
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

  async getInstalledModulesForFolder(folder: PathObject): Promise<IacModule[]> {
    const installedModules: IacModule[] = [];
    const terraformFolder = folder.join(this.tfrcFolder);
    const terraformModulesFile = terraformFolder.join("modules", "modules.json");
    if (!terraformFolder.exists()) {
      getLogger().debug(`Folder ${folder.path} contains no .terraform folder`);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modulesJson: any;
    try {
      modulesJson = JSON.parse(fs.readFileSync(terraformModulesFile.path, "utf8")).Modules;
    } catch (error) {
      getLogger().debug(`Error reading modules file: ${terraformModulesFile.path}`);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modulesJson.forEach((module: any) => {
      installedModules.push(new IacModule(module.Key, module.Source, module.Version));
    });
    return installedModules;
  }

  async getInstalledProvidersForFolder(folder: PathObject): Promise<InstalledIacProvider[]> {
    const installedProviders: InstalledIacProvider[] = [];
    const tfLockFile = folder.join(this.tflockFileName);
    if (!tfLockFile.exists()) {
      getLogger().debug(`Folder ${folder.path} has no terraform lock file and is therefore not initialized`);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let installedProvidersHcl: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      installedProvidersHcl = this.hclParser.parseToObject(fs.readFileSync(tfLockFile.path, "utf8"));
    } catch (error) {
      getLogger().debug(`Error reading providers file: ${tfLockFile.path}`);
      return [];
    }
    const providers = installedProvidersHcl[0].provider;
    for (const key in providers) {
      const version = providers[key][0].version;
      let versionConstrainString: string = "";
      if (providers[key][0].constraints !== undefined) {
        versionConstrainString = providers[key][0].constraints;
      }
      const constraints = versionConstrainString.split(",");
      installedProviders.push(new InstalledIacProvider(key, version, constraints));
    }
    return installedProviders;
  }

  async getRequiredTerraformVersionsForOpenWorkspaces(): Promise<string[]> {
    const foundVersions: string[] = [];
    const folders = await this.findAllIacFoldersInOpenWorkspace();
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
    getLogger().debug(`Found required terraform versions: ${uniqueVersions}`);
    return uniqueVersions;
  }

  async getDeclaredResourcesForFolder(folder: PathObject): Promise<IacResources | undefined> {
    let foundModules: IacModule[] = [];
    let foundProviders: IacProvider[] = [];
    let requiredVersions: string[] = [];
    // find all files in the folder that end with .tf with a depth of 1
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder.path, "*.tf"));
    await Promise.all(
      files.map(async (file) => {
        const fileResources = await this.getDeclaredResourcesForFile(new PathObject(file.fsPath));
        requiredVersions = requiredVersions.concat(fileResources?.versionRequirements ?? []);
        foundModules = foundModules.concat(fileResources?.modules ?? []);
        foundProviders = foundProviders.concat(fileResources?.providers ?? []);
      })
    );
    return new IacResources(foundModules, foundProviders, [...new Set(requiredVersions)]);
  }

  async getDeclaredResourcesForFile(file: PathObject): Promise<IacResources | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hclObject: any;
    try {
      hclObject = this.hclParser.parseToObject(fs.readFileSync(file.path, "utf8"));
      if (hclObject === undefined) {
        getLogger().debug(`Error parsing file: ${file.path}`);
        return undefined;
      }
      if (hclObject[0] === undefined || hclObject[0] === null) {
        getLogger().debug(`File ${file.path} does not contain any hcl objects`);
        return undefined;
      }
    } catch (error) {
      return undefined;
    }
    const foundModules = this.getModulesFromParsedHcl(hclObject);
    const foundProviders = this.getProvidersFromParsedHcl(hclObject);
    const requiredVersions = this.getRequiredVersionFromParsedHcl(hclObject);
    return new IacResources(foundModules, foundProviders, requiredVersions);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvidersFromParsedHcl(hclObject: any): IacProvider[] {
    const foundProviders: IacProvider[] = [];
    if (!Object.hasOwn(hclObject[0], "terraform")) {
      getLogger().trace("File does not contain a terraform block");
      return [];
    }
    if (!Object.hasOwn(hclObject[0]["terraform"][0], "required_providers")) {
      getLogger().trace("File does not contain any required providers");
      return [];
    }
    const providers = hclObject[0].terraform[0].required_providers[0];
    for (const key in providers) {
      const provider = providers[key];
      foundProviders.push(new IacProvider(key, provider.source, provider.version));
    }
    return foundProviders;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModulesFromParsedHcl(hclObject: any): IacModule[] {
    const foundModules: IacModule[] = [];
    if (!Object.hasOwn(hclObject[0], "module")) {
      getLogger().trace("File does not contain any modules");
      return [];
    }
    const modules = hclObject[0].module;
    for (const key in modules) {
      const module = modules[key][0];
      foundModules.push(new IacModule(key, module.source, module.version));
    }
    return foundModules;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRequiredVersionFromParsedHcl(hclObject: any): string[] {
    if (!Object.hasOwn(hclObject[0], "terraform")) {
      getLogger().trace("File does not contain a terraform block");
      return [];
    }
    if (!Object.hasOwn(hclObject[0]["terraform"][0], "required_version")) {
      getLogger().trace("File does not contain a required_version");
      return [];
    }
    return hclObject[0].terraform[0].required_version;
  }

  async refreshModulesInFolder(folder: PathObject): Promise<void> {
    if ((await this.checkfolderContainsValidTfFiles(folder)) === false) {
      throw new NoValidIacFolder(`Folder ${folder.path} does not contain any modules or providers and can therefore not be initialized`);
    }
    if (this.checkFolderHasBeenInitialized(folder) === false) {
      throw new IacFolderNotInitialized(`Folder ${folder.path} is not initialized`);
    }
    getLogger().debug(`Refreshing modules in folder ${folder.path}`);
    const [success, , stderr] = await this.iacCli.getModules(folder);
    if (success === false) {
      throw new IacGetError(`Error running refreshing modules for project ${folder.path}: ${stderr}`);
    }
    getLogger().debug(`Successfully refreshed modules in folder ${folder.path}`);
  }

  async initFolder(folder: PathObject, withProgress = false): Promise<void> {
    if (!(await this.checkfolderContainsValidTfFiles(folder))) {
      throw new NoValidIacFolder(`Folder ${folder.path} does not contain any modules or providers and can therefore not be initialized`);
    }
    getLogger().debug(`Initializing project ${folder.path}`);
    if (withProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: "Initializing current folder",
          cancellable: false,
        },
        async () => {
          const [success, , stderr] = await this.iacCli.init(folder, this.settings.initArgs.value);
          if (success === false) {
            throw new IacInitError(`Error running initializing project:${folder.path} error: ${stderr}`);
          }
        }
      );
      return;
    }
    const [success, , stderr] = await this.iacCli.init(folder, this.settings.initArgs.value);
    if (success === false) {
      throw new IacInitError(`Error initializing project:${folder.path} error: ${stderr}`);
    }
    getLogger().info(`Successfully initialized project ${folder.path}`);
  }
}
