import * as fs from "fs";
import * as vscode from "vscode";
import { IacResources } from "../../models/iac/iacResources";
import { IacModule } from "../../models/iac/module";
import { IacProvider } from "../../models/iac/provider";
import { getLogger } from "../logger";
import { PathObject } from "../path";

export interface Ihcl2Parser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseToObject: (hcl: string) => any;
}

export interface IIacParser {
  getDeclaredResourcesForFolder: (folder: PathObject) => Promise<IacResources | undefined>;
  getDeclaredResourcesForFile: (file: PathObject) => Promise<IacResources | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvidersFromParsedHcl: (hclObject: any) => IacProvider[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getModulesFromParsedHcl: (hclObject: any) => IacModule[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRawHclFromFile: (file: PathObject) => Promise<any>;
}

export class IacParser implements IIacParser {
  private readonly hclParser: Ihcl2Parser;

  constructor(hclParser: Ihcl2Parser) {
    this.hclParser = hclParser;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRawHclFromFile(file: PathObject): Promise<any> {
    return this.hclParser.parseToObject(fs.readFileSync(file.path, "utf8"));
  }
}
