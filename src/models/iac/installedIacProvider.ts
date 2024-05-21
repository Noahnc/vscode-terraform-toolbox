import * as semver from "semver";

export class InstalledIacProvider {
  key: string;
  versionConstrains?: string[];
  version: string;

  constructor(key: string, version: string, versionConstrains?: string[]) {
    this.key = key;
    this.versionConstrains = versionConstrains;
    this.version = version;
  }

  checkInstalledVersionSatifiesConstraint(constraint: string): boolean {
    return semver.satisfies(this.version, constraint);
  }
}
