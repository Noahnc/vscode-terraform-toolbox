import * as semver from "semver";
import { UserShownError } from "../../custom_errors";
import { getLogger } from "../../utils/logger";

export class Release {
  private _name: string;
  private _prerelease: boolean;
  private _installed: boolean;
  private _isActive: boolean;

  constructor(name: string, prerelease: boolean, isInstalled: boolean, isActive: boolean) {
    this._name = name;
    this._prerelease = prerelease;
    this._installed = isInstalled;
    this._isActive = isActive;
  }

  get status(): string {
    if (this._isActive) {
      return "active";
    }
    if (this._installed) {
      return "installed";
    }
    return "not installed";
  }

  set active(isActive: boolean) {
    if (isActive && this._installed === false) {
      throw new Error("Cannot set release active if it is not installed");
    }
    getLogger().trace("Setting release " + this._name + " property isActive to " + isActive.toString());
    this._isActive = isActive;
  }

  set installed(isInstalled: boolean) {
    getLogger().trace("Setting release " + this._name + " property isInstalled to " + isInstalled.toString());
    this._installed = isInstalled;
  }

  get name(): string {
    return this._name;
  }
  get prerelease(): boolean {
    return this._prerelease;
  }
  get isInstalled(): boolean {
    return this._installed;
  }
  get isActive(): boolean {
    return this._isActive;
  }
}

export class Releases {
  private readonly releases: Release[] = [];
  private readonly releasesMap: Map<string, Release> = new Map();
  private activeReleaseIndex: number | undefined;

  constructor(releases: any[]) {
    if (releases.length === 0) {
      throw new Error("No releases found");
    }
    releases.forEach((release) => {
      if (!Object.prototype.hasOwnProperty.call(release, "name") || !Object.prototype.hasOwnProperty.call(release, "prerelease")) {
        throw new Error("Invalid release object");
      }
      let isInstalled = false;
      if (Object.prototype.hasOwnProperty.call(release, "isInstalled")) {
        isInstalled = release.isInstalled;
      }
      const newRelease = new Release(release.name, release.prerelease, isInstalled, false);
      this.releases.push(newRelease);
      this.releasesMap.set(release.name, newRelease);
    });
  }

  get latest(): Release {
    return this.getReleases(false, false, false)[0];
  }

  get all(): Release[] {
    return this.sortByVersionDescending(this.releases);
  }

  get installed(): Release[] {
    return this.sortByVersionDescending(this.releases.filter((release) => release.isInstalled));
  }

  get installedNotActive(): Release[] {
    return this.sortByVersionDescending(this.releases.filter((release) => release.isInstalled && !release.isActive));
  }

  get active(): Release | undefined {
    if (this.activeReleaseIndex === undefined) {
      throw new Error("No active release set");
    }
    return this.releases[this.activeReleaseIndex];
  }

  set setActive(release: Release) {
    const foundRelease = this.releasesMap.get(release.name);
    if (foundRelease === undefined) {
      throw new Error("Release not found");
    }
    if (this.activeReleaseIndex !== undefined) {
      this.releases[this.activeReleaseIndex].active = false;
    }
    this.activeReleaseIndex = this.releases.indexOf(foundRelease);
    this.releases[this.activeReleaseIndex].active = true;
  }

  set setInstalled(release: Release) {
    const foundRelease = this.releasesMap.get(release.name);
    if (foundRelease === undefined) {
      throw new Error("Release not found");
    }
    foundRelease.installed = true;
  }

  set setUninstalled(release: Release) {
    const foundRelease = this.releasesMap.get(release.name);
    if (foundRelease === undefined) {
      throw new Error("Release not found");
    }
    foundRelease.installed = false;
  }

  getByMatchingVersionConstraint(versionConstraint: string): Release[] {
    return this.sortByVersionDescending(this.releases.filter((release) => semver.satisfies(release.name, versionConstraint)));
  }

  getByName(name: string): Release {
    const foundRelease = this.releasesMap.get(name);
    if (foundRelease === undefined) {
      throw new Error("Release not found");
    }
    return foundRelease;
  }

  getNewestReleaseMatchingVersionConstraints(versionConstraints: string[]): Release {
    function matchVersion(versionConstraint: string, releasesToFilter: Release[]): Release[] {
      return releasesToFilter.filter((release) => semver.satisfies(release.name, versionConstraint));
    }

    let matchingReleases = this.releases;
    for (const constraint of versionConstraints) {
      matchingReleases = matchVersion(constraint, matchingReleases);
      if (matchingReleases.length === 0) {
        break;
      }
    }
    // const matchingReleases = releases.filter((release) => semver.satisfies(release.name, versionConstraint));
    if (matchingReleases.length === 0) {
      throw new UserShownError("No terraform version matching the following constraints found: " + versionConstraints.join(", "));
    }
    return matchingReleases[0];
  }

  private sortByVersionDescending(releases: Release[]): Release[] {
    return releases.sort((a, b) => semver.compare(b.name, a.name));
  }

  getReleases(beta = false, rc = false, alpha = false): Release[] {
    const filteredReleases: Array<any> = [];
    // add all releases with prerelease = false
    this.releases.forEach((release) => {
      if (release.prerelease === false) {
        filteredReleases.push(release);
      }
    });
    if (beta) {
      // add all releases with beta in the name
      this.releases.forEach((release) => {
        if (release.name.includes("beta")) {
          filteredReleases.push(release);
        }
      });
    }
    if (rc) {
      // add all releases with rc in the name
      this.releases.forEach((release) => {
        if (release.name.includes("rc")) {
          filteredReleases.push(release);
        }
      });
    }
    if (alpha) {
      // add all releases with alpha in the name
      this.releases.forEach((release) => {
        if (release.name.includes("alpha")) {
          filteredReleases.push(release);
        }
      });
    }
    getLogger().trace("Filtered releases: " + filteredReleases.map((release) => release.name));
    return this.sortByVersionDescending(filteredReleases);
  }
}
