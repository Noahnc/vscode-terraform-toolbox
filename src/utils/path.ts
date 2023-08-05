import * as fs from "fs";
import * as path from "path";
import { getLogger } from "./logger";

export class Path {
  private readonly _path: string;
  constructor(FSPath: string) {
    this._path = path.resolve(FSPath);
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
      getLogger().debug("File: " + this._path + " is locked");
    }
    getLogger().debug("File: " + this._path + " is not locked");
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
    getLogger().debug(this._path + " has been deleted");
  }
}
