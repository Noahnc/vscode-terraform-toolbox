import { Octokit } from "octokit";
import * as vscode from "vscode";
import { UserShownError } from "../../custom_errors";
import { Release, Releases } from "../../models/github/release";
import * as helpers from "../helper_functions";
import { getLogger } from "../logger";
import { VersionManager, versionManagerSettings } from "../version_manager";
import os = require("os");
import * as fs from "fs";
import path = require("path");
import _7z = require("7zip-min");
import { PathObject } from "../path";

export class TerraformVersionManager extends VersionManager {
  protected readonly _context: vscode.ExtensionContext;
  private readonly _octokit: Octokit;
  private readonly _goBuildFolderPath: PathObject;

  constructor(context: vscode.ExtensionContext, octokit: Octokit, versionManagerSettings: versionManagerSettings) {
    super(versionManagerSettings);
    this._context = context;
    this._octokit = octokit;
    this._goBuildFolderPath = new PathObject(path.join(os.tmpdir(), "terraform-go-build"));
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

  protected async getBinaryPathForRelease(release: Release): Promise<PathObject> {
    await this.ensureGoIsInstalled();
    let binPath: PathObject | undefined;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: this._context.extension.packageJSON.displayName,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Downloading terraform " + release.name });
        const releaseFolder = await this.downloadSourceCodeOfRelease(release).catch((error) => {
          releaseFolder.delete();
          throw error;
        });
        progress.report({ message: "Compiling terraform " + release.name });
        binPath = await this.buildTerraformFromSourceCode(releaseFolder).catch((error) => {
          releaseFolder.delete();
          throw error;
        });
      }
    );
    if (!binPath) {
      throw new Error("Failed to get binary path for release " + release.name);
    }
    return binPath;
  }

  async downloadSourceCodeOfRelease(release: Release): Promise<PathObject> {
    const fileName = "terraform-" + release.name + ".zip";
    const tempDownload = new PathObject(os.tmpdir());
    const zipFile = tempDownload.join(fileName);

    // ToDo: Find a better solution to get the name of the unzipped folder. Currently, i check if the release starts with an v and remove it if so, because the unzipped folder has the name terraform-0.15.0 and not terraform-v0.15.0
    let unzippedFolder;
    if (release.name.charAt(0) === "v") {
      const rleaseNameWithoutV = release.name.substring(1);
      unzippedFolder = tempDownload.join("terraform-" + rleaseNameWithoutV);
    } else {
      unzippedFolder = tempDownload.join("terraform-" + release.name.replace("v", ""));
    }

    unzippedFolder.delete();
    zipFile.delete();
    const downloadURL = "https://github.com/hashicorp/terraform/archive/refs/tags/" + release.name + ".zip";
    if (!(await helpers.downloadFile(downloadURL, zipFile.path))) {
      throw new UserShownError("Failed to download Terraform source code from " + downloadURL);
    }
    await new Promise<void>((resolve) => {
      _7z.unpack(zipFile.path, tempDownload.path, (err: any) => {
        resolve();
      });
    });
    if (!unzippedFolder.exists()) {
      throw new UserShownError("Failed to unzip Terraform source code from " + zipFile);
    }
    zipFile.delete();
    return unzippedFolder;
  }

  async ensureGoIsInstalled() {
    const [success, stdout, stderr] = await helpers.runShellCommand("go help");
    if (!success) {
      throw new UserShownError("Go is not installed. In order to use this feature, Go needs to be installed and available in your path.");
    }
  }

  async buildTerraformFromSourceCode(terraformSourceCodePath: PathObject): Promise<PathObject> {
    const buildCommand = "go install -x -C " + terraformSourceCodePath.path;
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
      return this._goBuildFolderPath.join("terraform.exe");
    }
    return this._goBuildFolderPath.join("terraform");
  }
}
