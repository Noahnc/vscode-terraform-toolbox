import { Octokit } from "octokit";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { Release, Releases } from "../../models/github/release";
import { getLogger } from "../logger";
import { PathObject } from "../path";
import { IversionProvider, ReleaseError } from "../version_manager";
import os = require("os");
import path = require("path");
import wget = require("wget-improved");
import decompress = require("decompress");
export class TerraformVersionProvieder implements IversionProvider {
  protected readonly _context: vscode.ExtensionContext;
  private readonly _octokit: Octokit;
  private readonly _terraformReleaseURL = "https://releases.hashicorp.com/terraform/";

  constructor(context: vscode.ExtensionContext, octokit: Octokit) {
    this._context = context;
    this._octokit = octokit;
  }

  async getReleasesFormSource(): Promise<Releases> {
    const githubReleases = await this._octokit.rest.repos.listReleases({
      owner: "hashicorp",
      repo: "terraform",
      per_page: 100,
    });
    getLogger().debug("Found " + githubReleases.data.length + " releases on github.");
    getLogger().trace("Releases: " + JSON.stringify(githubReleases.data));
    return new Releases(githubReleases.data);
  }

  private async unzipTerraform(zipPath: PathObject): Promise<PathObject> {
    const extractedFolder = new PathObject(path.join(os.tmpdir(), "terraform-extracted"));
    extractedFolder.delete();
    getLogger().debug("Unzipping terraform from " + zipPath.path + " to " + extractedFolder.path);
    try {
      await decompress(zipPath.path, extractedFolder.path);
    } catch (err) {
      throw new ReleaseError("Failed to unzip terraform from " + zipPath.path + " to " + extractedFolder.path + " with error: " + err);
    }
    let terraformFileName = "terraform";
    if (os.platform() === "win32") {
      terraformFileName += ".exe";
    }
    const terraformFile = extractedFolder.join(terraformFileName);

    if (!terraformFile.exists()) {
      throw new ReleaseError("Failed to find terraform binary in zip file " + zipPath.path);
    }
    return terraformFile;
  }

  private async downloadTerraformZip(zipName: string, versionString: string): Promise<PathObject> {
    const downloadZipPath = new PathObject(path.join(os.tmpdir(), zipName));
    const downloadUrl = this._terraformReleaseURL + versionString + "/" + zipName;
    getLogger().debug("Downloading terraform from " + downloadUrl);
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
      throw new ReleaseError("Failed to download terraform from " + downloadUrl + " to " + downloadZipPath.path + " with error: " + err);
    });
    getLogger().debug("Downloaded terraform to " + downloadZipPath.path);
    return downloadZipPath;
  }

  private getTerraformDownloadInfo(release: Release): string {
    getLogger().debug("Composing zip name for release " + release.name + " with platform " + os.platform() + " and architecture " + os.arch());
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
    const zipName = `terraform_${release.versionNumber}_${osName}_${archName}.zip`;
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
        progress.report({ message: "Downloading terraform " + release.name });
        const zipName = this.getTerraformDownloadInfo(release);
        const downloadZipPath = await this.downloadTerraformZip(zipName, release.versionNumber);
        binPath = await this.unzipTerraform(downloadZipPath);
        downloadZipPath.delete();
      }
    );
    if (!binPath) {
      throw new ReleaseError("Failed to get binary path for release " + release.name);
    }
    return binPath;
  }
}
