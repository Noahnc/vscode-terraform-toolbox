import { Release } from "../../models/github/release";
import { IIaCProvider } from "../IaC/IIaCProvider";

export class TerraformProvider implements IIaCProvider {
  get Name(): string {
    return "Terraform";
  }

  get BinaryName(): string {
    return "terraform";
  }

  get GithubOrganization(): string {
    return "hashicorp";
  }

  get GithubRepository(): string {
    return "terraform";
  }

  get BaseReleaseDownloadUrl(): string {
    return "https://releases.hashicorp.com/terraform";
  }

  getReleaseDownloadUrl(release: Release, fileName: string): string {
    return this.BaseReleaseDownloadUrl + "/" + release.versionNumber + "/" + fileName;
  }
}
