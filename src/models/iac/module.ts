import { IIacBaseresource } from "./base_resource";

export class Module implements IIacBaseresource {
  key: string;
  source: string;
  version?: string;

  constructor(key: string, source: string, version: string) {
    this.key = key;
    this.source = source;
    this.version = version;
  }
}
