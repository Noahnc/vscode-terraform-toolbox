import * as fs from "fs";
import * as os from "os";
import { Release, Releases } from "../models/github/release";
import { getLogger } from "../utils/logger";
import { PathObject } from "../utils/path";
import { IversionProvider } from "../utils/VersionManager/IVersionProvider";
import { IversionProviderSettings } from "../utils/VersionManager/IVersionProviderSettings";

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

  getVersionProviderSettings(): IversionProviderSettings {
    return {
      softwareName: "test",
      binaryName: "testbinary",
    };
  }

  async getBinaryPathForRelease(release: Release): Promise<PathObject> {
    getLogger().debug(`Getting binary path for release ${release.name}`);
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
