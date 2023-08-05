import { Octokit } from "octokit";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { Release, Releases } from "../../models/github/release";
import * as helpers from "../helper_functions";
import { getLogger } from "../logger";
import { VersionManager, versionManagerSettings } from "../version_manager";
import os = require("os");
import path = require("path");
import _7z = require("7zip-min");

export class TerraformVersionManager extends VersionManager {
  protected readonly _context: vscode.ExtensionContext;
  private readonly _octokit: Octokit;
  private readonly _goBuildFolderPath: vscode.Uri;

  constructor(context: vscode.ExtensionContext, octokit: Octokit, versionManagerSettings: versionManagerSettings) {
    super(versionManagerSettings);
    this._context = context;
    this._octokit = octokit;
    this._goBuildFolderPath = vscode.Uri.joinPath(vscode.Uri.file(os.tmpdir()), "terraform-go-build");
  }
  protected async getReleasesFormSource(): Promise<Releases> {
    const githubReleases = await this._octokit.rest.repos.listReleases({
      owner: "hashicorp",
      repo: "terraform",
      per_page: 100,
    });
    getLogger().debug("Found " + githubReleases.data.length + " releases on github.");
    getLogger().trace("Releases: " + JSON.stringify(githubReleases.data));
    return new Releases(githubReleases.data);
  }

  protected async getBinaryPathForRelease(release: Release): Promise<vscode.Uri> {
    await this.ensureGoIsInstalled();
    let binPath: vscode.Uri | undefined;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: this._context.extension.packageJSON.displayName,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading terraform " + release.name });
        const downloadPath = await this.downloadSourceCodeOfRelease(release).catch((error) => {
          helpers.deleteFolderIfExists(downloadPath);
          throw error;
        });
        progress.report({ message: "Compiling terraform " + release.name });
        binPath = await this.buildTerraformFromSourceCode(downloadPath).catch((error) => {
          helpers.deleteFolderIfExists(downloadPath);
          throw error;
        });
      }
    );
    if (!binPath) {
      throw new Error("Failed to get binary path for release " + release.name);
    }
    return binPath;
  }

  async downloadSourceCodeOfRelease(release: Release) {
    const fileName = "terraform-" + release.name + ".zip";
    const tempDownloadPath = os.tmpdir();
    const zipFilePath = path.join(tempDownloadPath, fileName);

    // ToDo: Find a better solution to get the name of the unzipped folder. Currently, i check if the release starts with an v and remove it if so, because the unzipped folder has the name terraform-0.15.0 and not terraform-v0.15.0
    let unzippedFolderPath;
    if (release.name.charAt(0) === "v") {
      const rleaseNameWithoutV = release.name.substring(1);
      unzippedFolderPath = path.join(tempDownloadPath, "terraform-" + rleaseNameWithoutV);
    } else {
      unzippedFolderPath = path.join(tempDownloadPath, "terraform-" + release.name.replace("v", ""));
    }

    helpers.deleteFolderIfExists(unzippedFolderPath);
    helpers.deleteFileIfExists(zipFilePath);
    const downloadURL = "https://github.com/hashicorp/terraform/archive/refs/tags/" + release.name + ".zip";
    if (!(await helpers.downloadFile(downloadURL, zipFilePath))) {
      throw new UserShownError("Failed to download Terraform source code from " + downloadURL);
    }
    await new Promise<void>((resolve) => {
      _7z.unpack(zipFilePath, tempDownloadPath, (err: any) => {
        resolve();
      });
    });
    helpers.deleteFileIfExists(zipFilePath);
    return unzippedFolderPath;
  }

  async ensureGoIsInstalled() {
    const [success, stdout, stderr] = await helpers.runShellCommand("go help");
    if (!success) {
      throw new UserShownError("Go is not installed. In order to use this feature, Go needs to be installed and available in your path.");
    }
  }

  async buildTerraformFromSourceCode(terraformSourceCodePath: string): Promise<vscode.Uri> {
    const buildCommand = "go install -x -C " + terraformSourceCodePath;
    getLogger().debug("Building terraform from source with command: " + buildCommand + " to " + this._goBuildFolderPath.path);
    const buildEnvironmentVars = { GOBIN: this._goBuildFolderPath.path };
    const [success, stdout, stderr] = await helpers.runShellCommand(buildCommand, this._goBuildFolderPath.path);
    getLogger().trace("Build output: " + stdout);
    if (!success) {
      getLogger().error("Terraform compilation error: " + stderr);
      throw new UserShownError("Error compiling terraform from source. Check the logs for more information.");
    }
    if (os.platform() === "win32") {
      getLogger().debug("Windows OS detected, adding .exe to terraform binary name");
      return vscode.Uri.joinPath(this._goBuildFolderPath, "terraform.exe");
    }
    return vscode.Uri.joinPath(this._goBuildFolderPath, "terraform");
  }
}
