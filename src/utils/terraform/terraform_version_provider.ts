import { Octokit } from "octokit";
import * as vscode from "vscode";
import { Release, Releases } from "../../models/github/release";
import { getLogger } from "../logger";
import { PathObject } from "../path";
import { IversionProvider } from "../version_manager";
import os = require("os");
import path = require("path");
import wget = require("wget-improved");
import { UserShownError } from "../../custom_errors";
import * as extract from "extract-zip";

export class TerraformVersionProvieder implements IversionProvider {
  protected readonly _context: vscode.ExtensionContext;
  private readonly _octokit: Octokit;

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
      await extract(zipPath.path, { dir: extractedFolder.path });
    } catch (err) {
      throw new UserShownError("Failed to unzip terraform from " + zipPath.path + " to " + extractedFolder.path + " with error: " + err);
    }
    let terraformFileName = "terraform";
    if (os.platform() === "win32") {
      terraformFileName += ".exe";
    }
    const terraformFile = extractedFolder.join(terraformFileName);

    if (!terraformFile.exists()) {
      throw new Error("Failed to find terraform binary in zip file " + zipPath.path);
    }
    return terraformFile;
  }

  private async downloadTerraformZip(zipName: string, versionString: string): Promise<PathObject> {
    const downloadZipPath = new PathObject(path.join(os.tmpdir(), zipName));
    const downloadUrl = "https://releases.hashicorp.com/terraform/" + versionString + "/" + zipName;
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
      throw new UserShownError("Failed to download terraform from " + downloadUrl + " to " + downloadZipPath.path + " with error: " + err);
    });
    getLogger().debug("Downloaded terraform to " + downloadZipPath.path);
    return downloadZipPath;
  }

  private getTerraformDownloadInfo(release: Release): [string, string] {
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
      throw new Error(`Unsupported platform: ${os.platform()}`);
    }
    const archName = archMap[os.arch()];
    if (!archName) {
      throw new Error(`Unsupported architecture: ${os.arch()}`);
    }
    // remove the v from the version name if it exists
    const versionName = release.name.startsWith("v") ? release.name.substring(1) : release.name;
    const zipName = `terraform_${versionName}_${osName}_${archName}.zip`;
    return [versionName, zipName];
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
        const [versionString, zipName] = this.getTerraformDownloadInfo(release);
        const downloadZipPath = await this.downloadTerraformZip(zipName, versionString);
        binPath = await this.unzipTerraform(downloadZipPath);
        downloadZipPath.delete();
      }
    );
    if (!binPath) {
      throw new Error("Failed to get binary path for release " + release.name);
    }
    return binPath;
  }
}
