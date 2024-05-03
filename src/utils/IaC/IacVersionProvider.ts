import { Octokit } from "octokit";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { Release, Releases } from "../../models/github/release";
import { getLogger } from "../logger";
import { PathObject } from "../path";
import os = require("os");
import path = require("path");
import wget = require("wget-improved");
import decompress = require("decompress");
import { IversionProvider } from "../VersionManager/IVersionProvider";
import { versionProviderSettings } from "../VersionManager/IVersionProviderSettings";
import { ReleaseError } from "../VersionManager/versionManager";
import { IIaCProvider } from "./IIaCProvider";

export class IacVersionProvider implements IversionProvider {
  protected readonly _context: vscode.ExtensionContext;
  private readonly _octokit: Octokit;
  private readonly _iacProvider: IIaCProvider;

  constructor(context: vscode.ExtensionContext, octokit: Octokit, IIaCProvider: IIaCProvider) {
    this._context = context;
    this._octokit = octokit;
    this._iacProvider = IIaCProvider;
  }

  getVersionProviderSettings(): versionProviderSettings {
    return {
      softwareName: this._iacProvider.Name,
      binaryName: this._iacProvider.BinaryName,
    };
  }

  async getReleasesFormSource(): Promise<Releases> {
    const githubReleases = await this._octokit.rest.repos.listReleases({
      owner: this._iacProvider.GithubOrganization,
      repo: this._iacProvider.GithubRepository,
      per_page: 100,
    });
    getLogger().debug("Found " + githubReleases.data.length + " releases for " + this._iacProvider.Name + " on github.");
    getLogger().trace("Releases: " + JSON.stringify(githubReleases.data));
    return new Releases(githubReleases.data);
  }

  private async unzip(zipPath: PathObject): Promise<PathObject> {
    const folderName = this._iacProvider.Name.toLowerCase() + "-extracted";
    const extractedFolder = new PathObject(path.join(os.tmpdir(), folderName));
    extractedFolder.delete();
    getLogger().debug("Unzipping " + this._iacProvider.Name + " from " + zipPath.path + " to " + extractedFolder.path);
    try {
      await decompress(zipPath.path, extractedFolder.path);
    } catch (err) {
      throw new ReleaseError("Failed to unzip " + this._iacProvider.Name + " from " + zipPath.path + " to " + extractedFolder.path + " with error: " + err);
    }
    let binaryName = this._iacProvider.BinaryName;
    if (os.platform() === "win32") {
      binaryName += ".exe";
    }
    const binaryFile = extractedFolder.join(binaryName);

    if (!binaryFile.exists()) {
      throw new ReleaseError("Failed to find " + this._iacProvider.Name + " binary in zip file " + zipPath.path);
    }
    return binaryFile;
  }

  private async downloadRelease(zipName: string, release: Release): Promise<PathObject> {
    const downloadZipPath = new PathObject(path.join(os.tmpdir(), zipName));
    const downloadUrl = this._iacProvider.getReleaseDownloadUrl(release, zipName);
    getLogger().debug("Downloading " + this._iacProvider.Name + " from " + downloadUrl);
    downloadZipPath.delete();
    await new Promise<void>((resolve, reject) => {
      const request = wget.download(downloadUrl, downloadZipPath.path);
      request.on("error", (err) => {
        reject(err);
      });
      request.on("end", () => {
        resolve();
      });
    }).catch((err) => {
      throw new ReleaseError("Failed to download " + this._iacProvider.Name + " from " + downloadUrl + " to " + downloadZipPath.path + " with error: " + err);
    });
    getLogger().debug("Downloaded " + this._iacProvider.Name + " to " + downloadZipPath.path);
    return downloadZipPath;
  }

  private getAssetName(release: Release): string {
    getLogger().debug("Composing " + this._iacProvider.Name + " asset name for release " + release.name + " with platform " + os.platform() + " and architecture " + os.arch());
    const osMap: Record<string, string> = {
      win32: "windows",
      darwin: "darwin",
      linux: "linux",
    };
    const archMap: Record<string, string> = {
      386: "386",
      x64: "amd64",
      arm: "arm",
      arm64: "arm64",
    };
    const osName = osMap[os.platform()];
    if (!osName) {
      throw new UserShownError(`Unsupported platform: ${os.platform()}`);
    }
    const archName = archMap[os.arch()];
    if (!archName) {
      throw new UserShownError(`Unsupported architecture: ${os.arch()}`);
    }
    const zipName = `${this._iacProvider.BinaryName}_${release.versionNumber}_${osName}_${archName}.zip`;
    return zipName;
  }

  async getBinaryPathForRelease(release: Release): Promise<PathObject> {
    let binPath: PathObject | undefined;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: this._context.extension.packageJSON.displayName,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading " + this._iacProvider.Name + " " + release.name });
        const zipName = this.getAssetName(release);
        const downloadZipPath = await this.downloadRelease(zipName, release);
        binPath = await this.unzip(downloadZipPath);
        downloadZipPath.delete();
      }
    );
    if (!binPath) {
      throw new ReleaseError("Failed to get binary path for release " + release.name);
    }
    return binPath;
  }
}
