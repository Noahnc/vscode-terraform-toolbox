import { IIaCProvider } from "../IaC/IIaCProvider";

export class OpenTofuProvider implements IIaCProvider {
  getName(): string {
    return "OpenTofu";
  }

  getBinaryName(): string {
    return "tofu";
  }
}
