import { Release, Releases } from "../models/github/release";
import { PathObject } from "../utils/path";
import { IversionProvider } from "../utils/version_manager";
import * as fs from "fs";
import * as os from "os";

export class MockVersionProvider implements IversionProvider {
  async getReleasesFormSource(): Promise<Releases> {
    const releasesData = [
      { name: "v1.1.0", prerelease: false },
      { name: "v1.0.0", prerelease: false },
      { name: "v1.2.0-beta.1", prerelease: true },
      { name: "v1.2.0-rc.1", prerelease: true },
      { name: "v1.2.0", prerelease: false },
    ];
    return new Releases(releasesData);
  }

  async getBinaryPathForRelease(release: Release): Promise<PathObject> {
    const tempFolder = new PathObject(os.tmpdir());
    let binaryName = "mockbinary";
    if (os.platform() === "win32") {
      binaryName += ".exe";
    }
    const testBinary = tempFolder.join(binaryName);
    fs.writeFileSync(testBinary.path, "test");
    return testBinary;
  }
}
