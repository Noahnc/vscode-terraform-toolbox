import { Release } from "../../models/github/release";
import { IIaCProvider } from "../IaC/IIaCProvider";

export class TerraformProvider implements IIaCProvider {
  get registryBaseDomain(): string {
    return "registry.terraform.io";
  }
  get name(): string {
    return "Terraform";
  }

  get binaryName(): string {
    return "terraform";
  }

  get githubOrganization(): string {
    return "hashicorp";
  }

  get githubRepository(): string {
    return "terraform";
  }

  get baseReleaseDownloadUrl(): string {
    return "https://releases.hashicorp.com/terraform";
  }

  getReleaseDownloadUrl(release: Release, fileName: string): string {
    return `${this.baseReleaseDownloadUrl}/${release.versionNumber}/${fileName}`;
  }
}
