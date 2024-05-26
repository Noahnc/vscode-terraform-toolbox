import * as semver from "semver";

export class IacLockFileProvider {
  key: string;
  versionConstrains?: string[];
  version: string;

  constructor(key: string, version: string, versionConstrains?: string[]) {
    this.key = key;
    this.versionConstrains = versionConstrains;
    this.version = version;
  }

  get registryDomain(): string {
    return this.key.split("/")[0];
  }

  get vendor(): string {
    return this.key.split("/")[1];
  }

  get name(): string {
    return this.key.split("/")[2];
  }

  checkInstalledVersionSatifiesConstraint(constraint: string): boolean {
    return semver.satisfies(this.version, constraint);
  }
}
