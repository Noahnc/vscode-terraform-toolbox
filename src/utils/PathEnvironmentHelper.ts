import * as os from "os";
import * as vscode from "vscode";
import { IEnvironmentPathsProvider } from "./Cli/IEnvironmentPathsProvider";
import { getLogger } from "./logger";

export class PathEnvironmentHelper implements IEnvironmentPathsProvider {
  private readonly platform: NodeJS.Platform;
  private readonly context: vscode.ExtensionContext;
  private readonly addedPaths: string[] = [];
  private static instance: PathEnvironmentHelper;

  constructor(context: vscode.ExtensionContext) {
    if (PathEnvironmentHelper.instance !== undefined) {
      throw new Error(`${PathEnvironmentHelper.name} is a singleton class and can only be instantiated once.`);
    }
    this.platform = os.platform();
    this.context = context;
    PathEnvironmentHelper.instance = this;
  }
  getPathValue(): string {
    return [...this.getPathsFromEnvVar(), ...this.addedPaths].join(this.getPathSplitter());
  }

  private getPathsFromEnvVar(): string[] {
    const path = process.env.PATH || "";
    return path.split(this.getPathSplitter());
  }

  private savePathsToContext(paths: string[]): void {
    this.context.environmentVariableCollection?.replace("PATH", paths.join(this.getPathSplitter()));
  }

  private getPathSplitter(): string {
    return this.platform === "win32" ? ";" : ":";
  }

  private checkIfContainsPath(path: string, paths: string[]): boolean {
    return paths.includes(path);
  }

  public async addPath(directory: string): Promise<void> {
    const pathsFromEnv = this.getPathsFromEnvVar();
    const allPaths = [...pathsFromEnv, ...this.addedPaths];
    if (this.checkIfContainsPath(directory, allPaths)) {
      getLogger().info(`${directory} is already in the PATH.`);
      return;
    }
    getLogger().info(`Adding ${directory} to the PATH in variableContext.`);
    allPaths.push(directory);
    this.addedPaths.push(directory);
    this.savePathsToContext(allPaths);
  }
}
