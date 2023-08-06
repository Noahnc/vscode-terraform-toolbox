import * as fs from "fs";
import * as path from "path";
import { getLogger } from "./logger";
import { platform } from "os";

export class PathObject {
  private readonly _path: string;
  private readonly _pathMeta: path.ParsedPath;
  constructor(FSPath: string) {
    this._pathMeta = path.parse(FSPath);
    this._path = FSPath;
  }

  get path(): string {
    return this._path;
  }

  public exists(): boolean {
    const result = fs.existsSync(this._path);
    getLogger().trace("Path: " + this._path + " exists: " + result);
    return result;
  }

  public isFile(): boolean {
    const result = fs.statSync(this._path).isFile();
    getLogger().trace("Path: " + this._path + " is file: " + result);
    return result;
  }

  public isDirectory(): boolean {
    const result = fs.statSync(this._path).isDirectory();
    getLogger().trace("Path: " + this._path + " is directory: " + result);
    return result;
  }

  get directory(): PathObject {
    return new PathObject(this._pathMeta.dir);
  }

  public isLocked(): boolean {
    if (!this.exists()) {
      throw new Error("File: " + this._path + " does not exist");
    }
    if (this.isDirectory()) {
      throw new Error("Path: " + this._path + " is a directory and cannot be locked");
    }
    let locked = false;
    try {
      fs.closeSync(fs.openSync(this._path, "r+"));
    } catch (err) {
      locked = true;
      getLogger().trace("File: " + this._path + " is locked");
    }
    getLogger().trace("File: " + this._path + " is not locked");
    return locked;
  }

  delete(): void {
    if (!this.exists()) {
      getLogger().trace(this._path + " does not exist, nothing to delete");
      return;
    }
    if (this.isDirectory()) {
      fs.rmdirSync(this._path, { recursive: true });
    } else {
      fs.unlinkSync(this._path);
    }
    getLogger().trace(this._path + " has been deleted");
  }

  join(...paths: string[]): PathObject {
    const joinedPath = path.join(this._path, ...paths);
    getLogger().trace("Joined path: " + joinedPath);
    return new PathObject(joinedPath);
  }
}
