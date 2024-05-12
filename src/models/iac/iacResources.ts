import { IacModule } from "./module";
import { IacProvider } from "./provider";

export class IacResources {
  private _modules: IacModule[];
  private _providers: IacProvider[];
  private _versionRequirements: string[];

  constructor(modules: IacModule[], providers: IacProvider[], versionRequirements: string[]) {
    this._modules = modules;
    this._providers = providers;
    this._versionRequirements = versionRequirements;
  }
  get modules(): IacModule[] {
    return this._modules;
  }
  get providers(): IacProvider[] {
    return this._providers;
  }
  get versionRequirements(): string[] {
    return this._versionRequirements;
  }
}
