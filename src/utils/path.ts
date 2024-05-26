/* eslint-disable no-underscore-dangle */
import * as fs from "fs";
import { promises as fsAsync } from "fs";
import * as path from "path";
import { getLogger } from "./logger";

export class PathObject {
  private readonly _path: string;
  private readonly _pathMeta: path.ParsedPath;
  constructor(fsPath: string) {
    this._pathMeta = path.parse(fsPath);
    this._path = fsPath;
  }

  get path(): string {
    return this._path;
  }

  public async exists(): Promise<boolean> {
    const result = await fs.existsSync(this._path);
    getLogger().trace(`Path: ${this._path} exists: ${result}`);
    return result;
  }

  public async isFile(): Promise<boolean> {
    const stat = await fsAsync.stat(this._path);
    const result = stat.isFile();
    getLogger().trace(`Path: ${this._path} is file: ${result}`);
    return result;
  }

  public async isDirectory(): Promise<boolean> {
    const stat = await fsAsync.stat(this._path);
    const result = stat.isDirectory();
    getLogger().trace(`Path: ${this._path} is directory: ${result}`);
    return result;
  }

  get directory(): PathObject {
    return new PathObject(this._pathMeta.dir);
  }

  public async isLocked(): Promise<boolean> {
    if (!(await this.exists())) {
      throw new Error(`File: ${this._path} does not exist`);
    }
    if (await this.isDirectory()) {
      throw new Error(`Path: ${this._path} is a directory and cannot be locked`);
    }
    let locked = false;
    try {
      fs.closeSync(fs.openSync(this._path, "r+"));
    } catch (err) {
      locked = true;
      getLogger().trace(`File: ${this._path} is locked`);
    }
    getLogger().trace(`File: ${this._path} is not locked`);
    return locked;
  }

  async delete(): Promise<void> {
    if (!(await this.exists())) {
      getLogger().trace(`${this._path} does not exist, nothing to delete`);
      return;
    }
    if (await this.isDirectory()) {
      await fsAsync.rmdir(this._path, { recursive: true });
    } else {
      await fsAsync.unlink(this._path);
    }
    getLogger().trace(`${this._path} has been deleted`);
  }

  join(...paths: string[]): PathObject {
    const joinedPath = path.join(this._path, ...paths);
    getLogger().trace(`Joined path: ${joinedPath}`);
    return new PathObject(joinedPath);
  }
}
