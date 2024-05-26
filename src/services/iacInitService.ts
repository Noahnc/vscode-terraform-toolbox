import * as vscode from "vscode";
import { IacInitAllProjectsCommand } from "../commands/IacInitCommand";
import { IacLockFileProvider } from "../models/iac/iacLockFileProvider";
import { IacProvider } from "../models/iac/provider";
import { Settings } from "../models/settings";
import { IIacCli } from "../utils/IaC/iacCli";
import { IIacParser } from "../utils/IaC/iacParser";
import { IIacProjectHelper } from "../utils/IaC/iacProjectHelper";
import { IIaCProvider } from "../utils/IaC/IIaCProvider";
import { getLogger } from "../utils/logger";
import { PathObject } from "../utils/path";
import { AsyncSemaphore } from "../utils/semaphore";

export class IacInitService {
  private iacHelper: IIacProjectHelper;
  private iacCli: IIacCli;
  private iacParser: IIacParser;
  private settings: Settings;
  private iacProvider: IIaCProvider;
  private iacInitCommand: IacInitAllProjectsCommand;
  private tfFileDetectionPattern = "{**/*.tf}";
  private queueExecutionDelayMs = 600;
  private currentSequenceNumber = 0;
  private pendingIacInitProjects: Set<string> = new Set();
  private pendingIacModuleFetchProjects: Set<string> = new Set();
  private directoryLocks: Map<string, AsyncSemaphore> = new Map();

  constructor(iacHelper: IIacProjectHelper, iacCli: IIacCli, iacParser: IIacParser, iacProvider: IIaCProvider, iacInitCommand: IacInitAllProjectsCommand, settings: Settings) {
    this.iacHelper = iacHelper;
    this.iacParser = iacParser;
    this.iacCli = iacCli;
    this.iacProvider = iacProvider;
    this.settings = settings;
    this.iacInitCommand = iacInitCommand;
    vscode.workspace.createFileSystemWatcher(this.tfFileDetectionPattern).onDidChange(this.run.bind(this));
    vscode.workspace.createFileSystemWatcher(this.tfFileDetectionPattern).onDidCreate(this.run.bind(this));
  }

  private async run(uri: vscode.Uri) {
    // ToDo: Find a way to ignore .terraform with glob in the file watcher
    if (uri.path.includes(".terraform")) {
      return;
    }

    const enableModuleAutoFetch = this.settings.enableIacModuleAutoFetch.value;
    const enableProviderAutoInit = this.settings.enableIacAutoInit.value;

    if (!enableModuleAutoFetch && !enableProviderAutoInit) {
      return;
    }

    const file = new PathObject(uri.fsPath);
    const directory = file.directory;
    let semaphore: AsyncSemaphore | undefined;
    semaphore = this.directoryLocks.get(file.directory.path);
    if (semaphore === undefined) {
      semaphore = new AsyncSemaphore(1);
      this.directoryLocks.set(file.directory.path, semaphore);
    }

    getLogger().trace(`Detected terraform file change for file ${file.path}`);
    const resources = await this.iacParser.getDeclaredResourcesForFile(file);
    if (resources === undefined) {
      getLogger().trace(`No resources found in ${file.path}`);
      return;
    }

    if (resources.modules.length === 0 && resources.providers.length === 0) {
      getLogger().trace(`No modules or providers found in ${file.path}`);
      return;
    }

    this.currentSequenceNumber++;
    const sequenceNumber = this.currentSequenceNumber.valueOf();

    if (enableProviderAutoInit && resources.providers.length > 0) {
      const installedProviders = await this.iacHelper.getProvidersInLockFile(directory);
      const installed = await this.checkAllProvidersInstalled(installedProviders, resources.providers, directory);
      if (!installed) {
        getLogger().debug(`Adding project ${directory.path} to pending iac init queue since some providers are not installed`);
        await semaphore.withLock(async () => this.pendingIacInitProjects.add(directory.path));
        setTimeout(() => this.processResources(sequenceNumber), this.queueExecutionDelayMs);
        return;
      }
    }
    if (enableModuleAutoFetch && resources.modules.length > 0) {
      getLogger().debug(`Adding project ${directory.path} to pending module fetch queue`);
      await semaphore.withLock(async () => this.pendingIacModuleFetchProjects.add(directory.path));
      setTimeout(() => this.processResources(sequenceNumber), this.queueExecutionDelayMs);
    }
  }

  private async checkAllProvidersInstalled(installedProviders: IacLockFileProvider[], definedProviders: IacProvider[], folder: PathObject): Promise<boolean> {
    if (installedProviders.length === 0) {
      return false;
    }
    for (const definedProvider of definedProviders) {
      const key = definedProvider.getFullProviderSource(this.iacProvider.registryBaseDomain);
      const installedProvider = installedProviders.find((p) => p.key === key);
      if (installedProvider === undefined) {
        return false;
      }
      if (installedProvider.version === undefined) {
        return false;
      }
      if (!installedProvider.checkInstalledVersionSatifiesConstraint(definedProvider.version)) {
        return false;
      }
      if (!(await this.iacHelper.checkProviderFromLockFileIsInstalled(installedProvider, folder))) {
        return false;
      }
    }
    return true;
  }

  private async processResources(sequenceNumber: number) {
    // If the current sequence number does not match the sequence number of the current run, we skip it because a new run has been triggered
    if (sequenceNumber !== this.currentSequenceNumber) {
      getLogger().trace(`Skipping processing of resources since sequence number ${sequenceNumber} does not match current sequence number ${this.currentSequenceNumber}`);
      return;
    }
    if (this.pendingIacInitProjects.size === 0 && this.pendingIacModuleFetchProjects.size === 0) {
      return;
    }

    const moduleProjectPaths = new Set(this.pendingIacModuleFetchProjects.keys());
    const initProjectPaths = new Set(this.pendingIacInitProjects.keys());
    const allProjectPaths = new Set([...moduleProjectPaths, ...initProjectPaths]);

    getLogger().info(`Start processing ${moduleProjectPaths.size} projects for module updates and ${initProjectPaths.size} projects for provider init with sequence number ${sequenceNumber}`);

    await Promise.all(
      [...allProjectPaths].map(async (projectPath) => {
        const semaphore = this.directoryLocks.get(projectPath);

        await semaphore?.acquire();

        if (this.pendingIacInitProjects.has(projectPath)) {
          this.pendingIacInitProjects.delete(projectPath);
        }

        if (this.pendingIacModuleFetchProjects.has(projectPath)) {
          this.pendingIacModuleFetchProjects.delete(projectPath);
        }

        if (initProjectPaths.size === 0) {
          return;
        }

        if (initProjectPaths.has(projectPath) && moduleProjectPaths.has(projectPath)) {
          getLogger().trace(`Removing project ${projectPath} from pending module fetch que since it is also in the init queue`);
          moduleProjectPaths.delete(projectPath);
        }
      })
    );

    if (initProjectPaths.size > 0) {
      try {
        getLogger().trace(`Initializing the following projects: ${[...initProjectPaths].join(", ")}`);
        await this.iacInitCommand.run(
          false,
          false,
          [...initProjectPaths].map((p) => new PathObject(p))
        );
      } catch (error) {
        getLogger().error(`Error while initializing projects: ${error}`);
      }
    }

    await Promise.all(
      [...moduleProjectPaths].map(async (projectPath) => {
        const project = new PathObject(projectPath);
        try {
          getLogger().trace(`Updating modules for project ${projectPath}`);
          await this.iacCli.getModules(project);
        } catch (error) {
          getLogger().error(`Error while updating modules for project ${projectPath}: ${error}`);
        }
      })
    );

    await Promise.all(
      [...allProjectPaths].map(async (projectPath) => {
        const semaphore = this.directoryLocks.get(projectPath);
        semaphore?.release();
      })
    );

    getLogger().info(`Finished processing for sequence number ${sequenceNumber}`);
  }
}
