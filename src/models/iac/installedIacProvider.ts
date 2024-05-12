export class InstalledIacProvider {
  key: string;
  versionConstrains?: string[];
  version: string;

  constructor(key: string, version: string, versionConstrains?: string[]) {
    this.key = key;
    this.versionConstrains = versionConstrains;
    this.version = version;
  }
}
