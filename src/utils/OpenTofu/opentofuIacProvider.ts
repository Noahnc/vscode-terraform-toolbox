import { Release } from "../../models/github/release";
import { IIaCProvider } from "../IaC/IIaCProvider";

export class OpenTofuProvider implements IIaCProvider {
  get Name(): string {
    return "OpenTofu";
  }

  get BinaryName(): string {
    return "tofu";
  }

  get GithubOrganization(): string {
    return "opentofu";
  }

  get GithubRepository(): string {
    return "opentofu";
  }

  get BaseReleaseDownloadUrl(): string {
    return "https://github.com/opentofu/opentofu/releases/download";
  }

  getReleaseDownloadUrl(release: Release, fileName: string): string {
    return this.BaseReleaseDownloadUrl + "/" + release.name + "/" + fileName;
  }
}
