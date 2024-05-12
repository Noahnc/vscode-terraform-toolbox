import { Release } from "../../models/github/release";

export interface IIaCProvider {
  get name(): string;
  get binaryName(): string;
  get registryBaseDomain(): string;
  get githubOrganization(): string;
  get githubRepository(): string;
  get baseReleaseDownloadUrl(): string;
  getReleaseDownloadUrl(release: Release, fileName: string): string;
}
