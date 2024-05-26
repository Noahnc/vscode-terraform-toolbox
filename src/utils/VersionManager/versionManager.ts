import { promises as fs } from "fs";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { Release, Releases } from "../../models/github/release";
import * as helpers from "../helperFunctions";
import { getLogger } from "../logger";
import { PathObject } from "../path";
import { IversionProvider } from "./IVersionProvider";
import { IversionProviderSettings } from "./IVersionProviderSettings";
import path = require("path");
import os = require("os");

export class ReleaseError extends UserShownError {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseError";
  }
}

export interface IversionManager {
  switchVersion(chosenRelease: Release): Promise<boolean>;
  getReleases(): Promise<Releases>;
  choseRelease(releases: Releases): Promise<Release | undefined>;
  selectMultipleReleases(releases: Release[], placeHolder: string): Promise<Release[] | undefined>;
  deleteReleases(releases: Release[]): Promise<void>;
  getActiveVersion(): Promise<string | undefined>;
}

export class VersionManager implements IversionManager {
  private readonly installedVersionsFolder: PathObject;
  private readonly versionProviderSettings: IversionProviderSettings;
  public readonly baseFolder: PathObject;
  public readonly activeVersion: PathObject;
  private readonly activeVersionFolder: PathObject;
  public readonly metadataFile: PathObject;
  private readonly versionProvider: IversionProvider;

  constructor(versionProvider: IversionProvider, baseFolderName: string) {
    this.versionProvider = versionProvider;
    this.versionProviderSettings = versionProvider.getVersionProviderSettings();
    this.baseFolder = new PathObject(path.join(os.homedir(), baseFolderName));
    this.installedVersionsFolder = this.baseFolder.join(this.versionProviderSettings.softwareName);
    this.activeVersionFolder = this.baseFolder.join("active");
    this.metadataFile = this.installedVersionsFolder.join("metadata.json");
    if (os.platform() === "win32") {
      this.activeVersion = this.activeVersionFolder.join(`${this.versionProviderSettings.binaryName}.exe`);
    } else {
      this.activeVersion = this.activeVersionFolder.join(this.versionProviderSettings.binaryName);
    }
  }

  async switchVersion(chosenRelease: Release): Promise<boolean> {
    if (chosenRelease.isActive) {
      getLogger().debug(`${this.versionProviderSettings.softwareName} version ${chosenRelease.name} is already active.`);
      return false;
    }
    await this.createRequiredFolders();
    getLogger().info(`Switching to ${this.versionProviderSettings.softwareName} version ${chosenRelease.name}`);
    if (chosenRelease.isInstalled) {
      getLogger().debug(`${this.versionProviderSettings.softwareName} version ${chosenRelease.name} is installed but not active.`);
      await this.handleVersionSwitch(chosenRelease);
      return true;
    }
    const releaseBinPath = await this.versionProvider.getBinaryPathForRelease(chosenRelease);
    if (!(await releaseBinPath.exists())) {
      throw new UserShownError(`Failed to get binary for release ${chosenRelease.name}`);
    }
    await this.handleVersionSwitch(chosenRelease, releaseBinPath);
    getLogger().debug(`Successfully installed and switched to ${this.versionProviderSettings.softwareName} version ${chosenRelease.name}`);
    return true;
  }

  private async createRequiredFolders() {
    if (!(await this.activeVersionFolder.exists())) {
      await fs.mkdir(this.activeVersionFolder.path, { recursive: true });
    }
    if (!(await this.installedVersionsFolder.exists())) {
      await fs.mkdir(this.installedVersionsFolder.path, { recursive: true });
    }
  }

  async choseRelease(releases: Releases): Promise<Release | undefined> {
    const chosenRelease = await helpers.getUserDecision<Release>(`Select a ${this.versionProviderSettings.softwareName} version`, releases.all, "name", "status");
    if (chosenRelease === undefined) {
      getLogger().debug("No release chosen.");
      return undefined;
    }
    getLogger().debug(`Chosen release: ${chosenRelease.name}`);
    return chosenRelease;
  }

  async getActiveVersion(): Promise<string | undefined> {
    if (!(await this.metadataFile.exists())) {
      return undefined;
    }
    let activeVersion: string;
    try {
      const metadata = JSON.parse(await fs.readFile(this.metadataFile.path, "utf8"));
      activeVersion = metadata.activeVersion;
    } catch (error) {
      getLogger().error(`Failed to parse metadata file ${this.metadataFile.path}: ${error}`);
      return undefined;
    }
    return activeVersion;
  }

  private async createNewMetadataFile(activeVersion: string) {
    const newContent = { activeVersion: activeVersion };
    await fs.writeFile(this.metadataFile.path, JSON.stringify(newContent));
  }

  private async setActiveVersion(version: string) {
    getLogger().debug(`Setting active ${this.versionProviderSettings.softwareName} version to ${version}`);
    if (!(await this.metadataFile.exists())) {
      await this.createNewMetadataFile(version);
      return;
    }
    let currentContent;
    try {
      currentContent = JSON.parse(await fs.readFile(this.metadataFile.path, "utf8"));
    } catch (error) {
      getLogger().error(`Failed to parse metadata file ${this.metadataFile.path}: ${error}. Creating new metadata file.`);
      await this.createNewMetadataFile(version);
      return;
    }
    currentContent.activeVersion = version;
    await fs.writeFile(this.metadataFile.path, JSON.stringify(currentContent));
  }

  async getReleases(): Promise<Releases> {
    const releases = await this.versionProvider.getReleasesFormSource();
    const installedReleases = await this.getInstalledReleases(releases);
    await this.setReleaseStatus(releases, installedReleases);
    return releases;
  }

  private getBase64NameForRelease(name: string): string {
    const base64Name = Buffer.from(name).toString("base64");
    getLogger().trace(`Base64 name for release ${name} is ${base64Name}`);
    return base64Name;
  }

  private async setReleaseStatus(releases: Releases, installedReleases: Release[]): Promise<void> {
    const currentVersion = await this.getActiveVersion();
    releases.all.forEach((release) => {
      if (installedReleases.includes(release)) {
        releases.setInstalled = release;
        return;
      }
      releases.setUninstalled = release;
    });
    if (currentVersion !== undefined) {
      const activeRelease = releases.getByName(currentVersion);
      activeRelease.installed = true;
      activeRelease.active = true;
    }
  }

  private async handleVersionSwitch(newVersion: Release, newBinPath?: PathObject, retryCount = 0): Promise<void> {
    const maxLockRetries = 10;
    const currentVersion = await this.getActiveVersion();
    if (currentVersion !== undefined && (await this.activeVersion.exists())) {
      // check if the bin file is locked by the another process
      if (await this.activeVersion.isLocked()) {
        getLogger().error(`${this.versionProviderSettings.softwareName} binary is locked by the another process, try again in 5 seconds`);
        if (retryCount < maxLockRetries) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          retryCount++;
          return await this.handleVersionSwitch(newVersion, newBinPath, retryCount);
        }
      }
      const currentVersionBinDstPath = this.installedVersionsFolder.join(this.getBase64NameForRelease(currentVersion));
      await this.moveBin(this.activeVersion, currentVersionBinDstPath);
    }
    if (newBinPath === undefined) {
      // rename file from version_name to binary name
      const newVersionBinSrcPath = this.installedVersionsFolder.join(this.getBase64NameForRelease(newVersion.name));
      await this.moveBin(newVersionBinSrcPath, this.activeVersion);
    } else {
      // move file from temp folder to new version folder
      await fs.rename(newBinPath.path, this.activeVersion.path);
    }
    await this.setActiveVersion(newVersion.name);
  }

  private async moveBin(currentBinPath: PathObject, newBinPath: PathObject) {
    getLogger().debug(`Moving ${this.versionProviderSettings.softwareName} binary from ${currentBinPath.path} to ${newBinPath.path}`);
    await fs.rename(currentBinPath.path, newBinPath.path);
  }

  private async getInstalledReleases(releases: Releases): Promise<Release[]> {
    const installedVersions: Release[] = [];
    await Promise.all(
      releases.all.map(async (release) => {
        const releaseBinary = this.installedVersionsFolder.join(this.getBase64NameForRelease(release.name));
        if (await releaseBinary.exists()) {
          installedVersions.push(release);
        }
      })
    );
    getLogger().trace(`Installed releases: ${installedVersions.map((release) => release.name)}`);
    return installedVersions;
  }

  async selectMultipleReleases(releases: Release[], placeHolder: string): Promise<Release[] | undefined> {
    // show the user a list of releases, whrer multiple releases can be selected
    const releaseNames = releases.map((release) => release.name);
    const chosenReleases = await vscode.window.showQuickPick(releaseNames, {
      canPickMany: true,
      ignoreFocusOut: true,
      placeHolder: placeHolder,
    });
    if (chosenReleases === undefined) {
      getLogger().debug("User has not selected any releases");
      return undefined;
    }
    // filter releases by the selected names
    const filteredReleases = releases.filter((release) => chosenReleases.includes(release.name));
    getLogger().debug(`User has selected the following releases: ${filteredReleases.map((release) => release.name)}`);
    return filteredReleases;
  }

  async deleteReleases(releases: Release[]) {
    getLogger().info(`Deleting releases: ${releases.map((release) => release.name)}`);
    await Promise.all(
      releases.map(async (release) => {
        const releaseFile = this.installedVersionsFolder.join(this.getBase64NameForRelease(release.name));
        await releaseFile.delete();
        release.installed = false;
      })
    );
  }
}
