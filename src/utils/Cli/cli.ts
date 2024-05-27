import { exec } from "child_process";
import { getLogger } from "../logger";
import { IEnvironmentPathsProvider } from "./IEnvironmentPathsProvider";

export interface ICli {
  runShellCommand(command: string): Promise<[boolean, string, string]>;
  checkIfBinaryIsInPath(binaryName: string): Promise<boolean>;
}

export class Cli implements ICli {
  private readonly pathProvider: IEnvironmentPathsProvider;

  constructor(pathProvider: IEnvironmentPathsProvider) {
    this.pathProvider = pathProvider;
  }

  async runShellCommand(command: string): Promise<[boolean, string, string]> {
    getLogger().debug(`Running shell command: ${command}`);
    return await new Promise<[boolean, string, string]>((resolve) => {
      const pathVar = this.pathProvider.getPathValue();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
      exec(command, { silent: true, env: { PATH: pathVar } } as any, (error: any, stdout: any, stderr: any) => {
        getLogger().trace(`Stdout: ${stdout}`);
        getLogger().trace(`Stderr: ${stderr}`);
        if (error) {
          getLogger().debug(`Shell command: ${command} exited with non zero exit code: ${error}`);
          resolve([false, stdout, stderr]);
          return;
        }
        getLogger().debug(`Shell command: ${command} exited with zero exit code`);
        resolve([true, stdout, stderr]);
      });
    });
  }
  async checkIfBinaryIsInPath(binaryName: string): Promise<boolean> {
    let command: string;
    if (process.platform === "win32") {
      command = `where ${binaryName}`;
    } else {
      command = `which ${binaryName}`;
    }
    const [success, stdout] = await this.runShellCommand(command);
    if (!success) {
      getLogger().info(`Binary ${binaryName} not found in path. `);
      return false;
    }
    getLogger().debug(`Binary ${binaryName} found at ${stdout}`);
    return true;
  }
}
