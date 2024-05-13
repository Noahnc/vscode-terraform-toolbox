import * as vscode from "vscode";
import { IacInitAllProjectsCommand } from "../commands/IacInitCommand";
import { InstalledIacProvider } from "../models/iac/installedIacProvider";
import { IacProvider } from "../models/iac/provider";
import { Settings } from "../models/settings";
import { IIacCli } from "../utils/IaC/iacCli";
import { IIacProjectHelper } from "../utils/IaC/iacProjectHelper";
import { IIaCProvider } from "../utils/IaC/IIaCProvider";
import { getLogger } from "../utils/logger";
import { PathObject } from "../utils/path";
import { AsyncSemaphore } from "../utils/semaphore";

export class IacInitService {
  private iacHelper: IIacProjectHelper;
  private iacCli: IIacCli;
  private settings: Settings;
  private iacProvider: IIaCProvider;
  private iacInitCommand: IacInitAllProjectsCommand;
  private tfFileDetectionPattern = "{**/*.tf}";
  private pendingIacInitProjects: Set<string> = new Set();
  private directoryLocks: Map<string, AsyncSemaphore> = new Map();
  private processQueueLocked: boolean = false;

  constructor(iacHelper: IIacProjectHelper, iacCli: IIacCli, iacProvider: IIaCProvider, iacInitCommand: IacInitAllProjectsCommand, settings: Settings) {
    this.iacHelper = iacHelper;
    this.iacCli = iacCli;
    this.iacProvider = iacProvider;
    this.settings = settings;
    this.iacInitCommand = iacInitCommand;
    vscode.workspace.createFileSystemWatcher(this.tfFileDetectionPattern).onDidChange(this.run.bind(this));
    vscode.workspace.createFileSystemWatcher(this.tfFileDetectionPattern).onDidCreate(this.run.bind(this));

    setInterval(this.processQueue.bind(this), 2000);
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
    let semaphore: AsyncSemaphore | undefined;
    semaphore = this.directoryLocks.get(file.directory.path);
    if (semaphore === undefined) {
      semaphore = new AsyncSemaphore(1);
      this.directoryLocks.set(file.directory.path, semaphore);
    }

    getLogger().trace(`Detected terraform file change for file ${file.path}`);
    const resources = await this.iacHelper.getDeclaredResourcesForFile(file);
    if (resources === undefined) {
      getLogger().trace(`No resources found in ${file.path}`);
      return;
    }
    if (resources.modules.length === 0 && resources.providers.length === 0) {
      getLogger().trace(`No modules or providers found in ${file.path}`);
      return;
    }
    if (enableProviderAutoInit) {
      if (resources.providers.length > 0) {
        const installedProviders = await this.iacHelper.getInstalledProvidersForFolder(file.directory);
        const installed = await this.checkAllProvidersInstalled(installedProviders, resources.providers);
        if (!installed) {
          getLogger().debug(`Adding project ${file.directory.path} to pending iac init queue since some providers are not installed`);
          this.pendingIacInitProjects.add(file.directory.path);
          return;
        }
      }
    }
    if (enableModuleAutoFetch) {
      if (resources.modules.length > 0) {
        getLogger().trace(`Refreshing modules in ${file.path}`);
        semaphore.withLock(async () => await this.iacCli.getModules(file.directory));
      }
    }
  }

  private async processQueue() {
    if (this.processQueueLocked) {
      return;
    }
    if (this.pendingIacInitProjects.size === 0) {
      return;
    }
    this.processQueueLocked = true;
    try {
      await this.processProviders();
    } catch (error) {
      getLogger().error(`Error while processing queue: ${error}`);
    } finally {
      getLogger().trace(`Finished processing queue`);
      this.processQueueLocked = false;
    }
  }
  private async checkAllProvidersInstalled(installedProviders: InstalledIacProvider[], definedProviders: IacProvider[]): Promise<boolean> {
    if (installedProviders.length === 0) {
      return false;
    }
    for (const provider of definedProviders) {
      const key = provider.getFullProviderSource(this.iacProvider.registryBaseDomain);
      const installedProvider = installedProviders.find((p) => p.key === key);
      if (installedProvider === undefined) {
        return false;
      }
      if (installedProvider.versionConstrains === undefined) {
        return false;
      }
      const constraintsLowerWithoutSpaces = installedProvider.versionConstrains.map((c) => c.replace(/\s/g, "").toLowerCase());
      const providerVersionLowerWithoutSpaces = provider.version.replace(/\s/g, "").toLowerCase();
      if (!constraintsLowerWithoutSpaces.includes(providerVersionLowerWithoutSpaces)) {
        return false;
      }
    }
    return true;
  }

  private async processProviders() {
    if (this.pendingIacInitProjects.size === 0) {
      return;
    }
    const projectPaths = new Set(this.pendingIacInitProjects.keys());
    const semaphores = Array.from(projectPaths).map((p) => this.directoryLocks.get(p));
    semaphores.forEach((s) => s?.acquire());
    const projects = Array.from(projectPaths).map((p) => new PathObject(p));
    await this.iacInitCommand.run(false, false, projects);
    for (const projectPath of projectPaths) {
      this.pendingIacInitProjects.delete(projectPath);
    }
    semaphores.forEach((s) => s?.release());
  }
}
