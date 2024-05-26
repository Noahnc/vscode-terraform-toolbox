import { IIacBaseresource } from "./baseResource";

export class IacModule implements IIacBaseresource {
  key: string;
  source: string;
  version?: string;

  constructor(key: string, source: string, version: string) {
    this.key = key;
    this.source = source;
    this.version = version;
  }
}
