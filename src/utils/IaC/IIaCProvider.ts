import { Release } from "../../models/github/release";

export interface IIaCProvider {
  get Name(): string;
  get BinaryName(): string;
  get GithubOrganization(): string;
  get GithubRepository(): string;
  get BaseReleaseDownloadUrl(): string;
  getReleaseDownloadUrl(release: Release, fileName: string): string;
}
