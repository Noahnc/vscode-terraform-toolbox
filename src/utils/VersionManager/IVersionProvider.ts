import { Release, Releases } from "../../models/github/release";
import { PathObject } from "../path";
import { versionProviderSettings } from "./IVersionProviderSettings";

export interface IversionProvider {
  getReleasesFormSource(): Promise<Releases>;
  getBinaryPathForRelease(release: Release): Promise<PathObject>;
  getVersionProviderSettings(): versionProviderSettings;
}
