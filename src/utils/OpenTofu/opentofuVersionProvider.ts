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

export class OpenTofuVersionProvider implements IversionProvider {
  protected readonly _context: vscode.ExtensionContext;
  private readonly _octokit: Octokit;
  private readonly _openTofuBaseUrl = "https://github.com/opentofu/opentofu/releases/download/";

  constructor(context: vscode.ExtensionContext, octokit: Octokit) {
    this._context = context;
    this._octokit = octokit;
  }

  getVersionProviderSettings(): versionProviderSettings {
    return {
      softwareName: "OpenTofu",
      binaryName: "tofu",
    };
  }

  async getReleasesFormSource(): Promise<Releases> {
    const githubReleases = await this._octokit.rest.repos.listReleases({
      owner: "opentofu",
      repo: "opentofu",
      per_page: 100,
    });
    getLogger().debug("Found " + githubReleases.data.length + " releases on github.");
    getLogger().trace("Releases: " + JSON.stringify(githubReleases.data));
    return new Releases(githubReleases.data);
  }

  private async unzipOpenTofu(zipPath: PathObject): Promise<PathObject> {
    const extractedFolder = new PathObject(path.join(os.tmpdir(), "opentofu-extracted"));
    extractedFolder.delete();
    getLogger().debug("Unzipping OpenTofu from " + zipPath.path + " to " + extractedFolder.path);
    try {
      await decompress(zipPath.path, extractedFolder.path);
    } catch (err) {
      throw new ReleaseError("Failed to unzip OpenTofu from " + zipPath.path + " to " + extractedFolder.path + " with error: " + err);
    }
    let openTofuFileName = "tofu";
    if (os.platform() === "win32") {
      openTofuFileName += ".exe";
    }
    const openTofuFile = extractedFolder.join(openTofuFileName);

    if (!openTofuFile.exists()) {
      throw new ReleaseError("Failed to find OpenTofu binary in zip file " + zipPath.path);
    }
    return openTofuFile;
  }

  private async downloadOpenTofuZip(zipName: string, versionString: string): Promise<PathObject> {
    const downloadZipPath = new PathObject(path.join(os.tmpdir(), zipName));
    const downloadUrl = this._openTofuBaseUrl + versionString + "/" + zipName;
    getLogger().debug("Downloading OpenTofu from " + downloadUrl);
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
      throw new ReleaseError("Failed to download OpenTofu from " + downloadUrl + " to " + downloadZipPath.path + " with error: " + err);
    });
    getLogger().debug("Downloaded OpenTofu to " + downloadZipPath.path);
    return downloadZipPath;
  }

  private getOpenTofuAssetName(release: Release): string {
    getLogger().debug("Composing opentofu asset name for release " + release.name + " with platform " + os.platform() + " and architecture " + os.arch());
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
    const zipName = `tofu_${release.versionNumber}_${osName}_${archName}.zip`;
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
        progress.report({ message: "Downloading OpenTofu " + release.name });
        const zipName = this.getOpenTofuAssetName(release);
        const downloadZipPath = await this.downloadOpenTofuZip(zipName, release.name);
        binPath = await this.unzipOpenTofu(downloadZipPath);
        downloadZipPath.delete();
      }
    );
    if (!binPath) {
      throw new ReleaseError("Failed to get binary path for release " + release.name);
    }
    return binPath;
  }
}
