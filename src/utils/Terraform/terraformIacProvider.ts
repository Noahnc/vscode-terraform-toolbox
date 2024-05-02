import { IIaCProvider } from "../IaC/IIaCProvider";

export class TerraformProvider implements IIaCProvider {
  getName(): string {
    return "Terraform";
  }

  getBinaryName(): string {
    return "terraform";
  }
}
