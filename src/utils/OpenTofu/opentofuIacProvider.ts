import { Release } from "../../models/github/release";
import { IIaCProvider } from "../IaC/IIaCProvider";

export class OpenTofuProvider implements IIaCProvider {
  get name(): string {
    return "OpenTofu";
  }

  get binaryName(): string {
    return "tofu";
  }

  get githubOrganization(): string {
    return "opentofu";
  }

  get githubRepository(): string {
    return "opentofu";
  }

  get baseReleaseDownloadUrl(): string {
    return "https://github.com/opentofu/opentofu/releases/download";
  }

  getReleaseDownloadUrl(release: Release, fileName: string): string {
    return `${this.baseReleaseDownloadUrl}/${release.name}/${fileName}`;
  }
}
