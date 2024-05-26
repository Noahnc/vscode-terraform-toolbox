export class IacProvider {
  key: string;
  source: string;
  version: string;

  constructor(key: string, source: string, version: string) {
    this.key = key;
    this.source = source;
    this.version = version;
  }

  getFullProviderSource(defaultRegistryDomain: string): string {
    // check if the source matches  <string1>/<string2>/<string3>
    if (this.source.split("/").length === 3) {
      return this.source;
    }
    return `${defaultRegistryDomain}/${this.source}`;
  }
}
