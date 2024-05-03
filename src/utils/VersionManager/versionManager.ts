import * as fs from "fs";
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
  deleteReleases(releases: Release[]): void;
  getActiveVersion(): string | undefined;
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
    this.createRequiredFolders();
    getLogger().info(`Switching to ${this.versionProviderSettings.softwareName} version ${chosenRelease.name}`);
    if (chosenRelease.isInstalled) {
      getLogger().debug(`${this.versionProviderSettings.softwareName} version ${chosenRelease.name} is installed but not active.`);
      await this.handleVersionSwitch(chosenRelease);
      return true;
    }
    const releaseBinPath = await this.versionProvider.getBinaryPathForRelease(chosenRelease);
    if (!fs.existsSync(releaseBinPath.path)) {
      throw new UserShownError(`Failed to get binary for release ${chosenRelease.name}`);
    }
    await this.handleVersionSwitch(chosenRelease, releaseBinPath);
    getLogger().debug(`Successfully installed and switched to ${this.versionProviderSettings.softwareName} version ${chosenRelease.name}`);
    return true;
  }

  private createRequiredFolders() {
    if (!fs.existsSync(this.activeVersionFolder.path)) {
      fs.mkdirSync(this.activeVersionFolder.path, { recursive: true });
    }
    if (!fs.existsSync(this.installedVersionsFolder.path)) {
      fs.mkdirSync(this.installedVersionsFolder.path, { recursive: true });
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

  getActiveVersion(): string | undefined {
    if (!fs.existsSync(this.metadataFile.path)) {
      return undefined;
    }
    let activeVersion: string;
    try {
      const metadata = JSON.parse(fs.readFileSync(this.metadataFile.path, "utf8"));
      activeVersion = metadata.activeVersion;
    } catch (error) {
      getLogger().error(`Failed to parse metadata file ${this.metadataFile.path}: ${error}`);
      return undefined;
    }
    return activeVersion;
  }

  private createNewMetadataFile(activeVersion: string) {
    const newContent = { activeVersion: activeVersion };
    fs.writeFileSync(this.metadataFile.path, JSON.stringify(newContent));
  }

  private setActiveVersion(version: string) {
    getLogger().debug(`Setting active ${this.versionProviderSettings.softwareName} version to ${version}`);
    if (!fs.existsSync(this.metadataFile.path)) {
      this.createNewMetadataFile(version);
      return;
    }
    let currentContent;
    try {
      currentContent = JSON.parse(fs.readFileSync(this.metadataFile.path, "utf8"));
    } catch (error) {
      getLogger().error(`Failed to parse metadata file ${this.metadataFile.path}: ${error}. Creating new metadata file.`);
      this.createNewMetadataFile(version);
      return;
    }
    currentContent.activeVersion = version;
    fs.writeFileSync(this.metadataFile.path, JSON.stringify(currentContent));
    return;
  }

  async getReleases(): Promise<Releases> {
    const releases = await this.versionProvider.getReleasesFormSource();
    const installedReleases = this.getInstalledReleases(releases);
    this.setReleaseStatus(releases, installedReleases);
    return releases;
  }

  private getBase64NameForRelease(name: string): string {
    const base64Name = Buffer.from(name).toString("base64");
    getLogger().trace(`Base64 name for release ${name} is ${base64Name}`);
    return base64Name;
  }

  private setReleaseStatus(releases: Releases, installedReleases: Release[]): void {
    const currentVersion = this.getActiveVersion();
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
    const currentVersion = this.getActiveVersion();
    if (currentVersion !== undefined && fs.existsSync(this.activeVersion.path)) {
      // check if the bin file is locked by the another process
      if (this.activeVersion.isLocked()) {
        getLogger().error(`${this.versionProviderSettings.softwareName} binary is locked by the another process, try again in 5 seconds`);
        if (retryCount < maxLockRetries) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          retryCount++;
          return await this.handleVersionSwitch(newVersion, newBinPath, retryCount);
        }
      }
      const currentVersionBinDstPath = this.installedVersionsFolder.join(this.getBase64NameForRelease(currentVersion));
      this.moveBin(this.activeVersion, currentVersionBinDstPath);
    }
    if (newBinPath === undefined) {
      // rename file from version_name to binary name
      const newVersionBinSrcPath = this.installedVersionsFolder.join(this.getBase64NameForRelease(newVersion.name));
      this.moveBin(newVersionBinSrcPath, this.activeVersion);
    } else {
      // move file from temp folder to new version folder
      fs.renameSync(newBinPath.path, this.activeVersion.path);
    }
    this.setActiveVersion(newVersion.name);
  }

  private moveBin(currentBinPath: PathObject, newBinPath: PathObject) {
    getLogger().debug(`Moving ${this.versionProviderSettings.softwareName} binary from ${currentBinPath.path} to ${newBinPath.path}`);
    fs.renameSync(currentBinPath.path, newBinPath.path);
  }

  private getInstalledReleases(releases: Releases): Release[] {
    const installedVersions: Release[] = [];
    releases.all.forEach((release) => {
      if (fs.existsSync(path.join(this.installedVersionsFolder.path, this.getBase64NameForRelease(release.name)))) {
        installedVersions.push(release);
      }
    });
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

  deleteReleases(releases: Release[]) {
    getLogger().info(`Deleting releases: ${releases.map((release) => release.name)}`);
    releases.forEach((release) => {
      const releaseFile = this.installedVersionsFolder.join(this.getBase64NameForRelease(release.name));
      releaseFile.delete();
      release.installed = false;
    });
  }
}
