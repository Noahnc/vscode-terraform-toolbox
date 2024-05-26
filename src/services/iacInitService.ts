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

    for (const projectPath of allProjectPaths) {
      const semaphore = this.directoryLocks.get(projectPath);
      try {
        await semaphore?.acquire();
        const project = new PathObject(projectPath);
        if (this.pendingIacInitProjects.has(projectPath)) {
          getLogger().trace(`Processing pending iac init project ${projectPath}`);
          await this.iacInitCommand.run(false, false, [project]);
          this.pendingIacInitProjects.delete(projectPath);
          if (this.pendingIacModuleFetchProjects.has(projectPath)) {
            this.pendingIacModuleFetchProjects.delete(projectPath);
          }
          continue;
        }
        getLogger().trace(`Updating modules for project ${projectPath}`);
        await this.iacCli.getModules(project);
        this.pendingIacModuleFetchProjects.delete(projectPath);
      } catch (error) {
        getLogger().error(`Error while processing resources for project ${projectPath}: ${error}`);
      } finally {
        semaphore?.release();
      }
    }
  }
}
