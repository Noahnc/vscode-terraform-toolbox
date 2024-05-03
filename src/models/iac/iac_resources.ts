import { Module } from "./module";
import { Provider } from "./provider";

export class iacResources {
  private _modules: Module[];
  private _providers: Provider[];
  private _versionRequirements: string[];

  constructor(modules: Module[], providers: Provider[], versionRequirements: string[]) {
    this._modules = modules;
    this._providers = providers;
    this._versionRequirements = versionRequirements;
  }
  get modules(): Module[] {
    return this._modules;
  }
  get providers(): Provider[] {
    return this._providers;
  }
  get versionRequirements(): string[] {
    return this._versionRequirements;
  }
}
