import { MockVersionProvider } from "../../mocks/version_provider";
import { Releases } from "../../models/github/release";
import { VersionManager } from "../../utils/version_manager";
import { expect } from "chai";

describe("Version Provider", () => {
  const versionManager = new VersionManager({ baseFolderName: "version_manager_test", softwareName: "version_manager_test", binaryName: "testbinary" }, new MockVersionProvider());

  afterEach(async () => {
    versionManager._baseFolder.delete();
  });

  it("should throw an error that no version is active", async () => {
    const releases = await versionManager.getReleases();
    expect(releases).to.be.instanceOf(Releases);
    expect(() => releases.active).to.throw(Error);
  });

  it("should have no version installed", async () => {
    const releases = await versionManager.getReleases();
    expect(releases).to.be.instanceOf(Releases);
    expect(releases.installed).to.be.empty;
  });

  it("should have a metadata file", async () => {
    const releases = await versionManager.getReleases();
    expect(releases).to.be.instanceOf(Releases);
    await versionManager.switchVersion(releases.latest);
    expect(versionManager._metadataFile.exists()).to.be.true;
  });

  it("should have one version installed and one active", async () => {
    const releases = await versionManager.getReleases();
    expect(releases).to.be.instanceOf(Releases);
    const installedVersion = releases.all[0];
    const activeVersion = releases.all[1];
    await versionManager.switchVersion(installedVersion);
    await versionManager.switchVersion(activeVersion);
    const newversions = await versionManager.getReleases();
    expect(newversions.getByName(activeVersion.name).isActive).to.be.true;
    expect(newversions.getByName(installedVersion.name).isInstalled).to.be.true;
    expect(newversions.getByName(activeVersion.name).isInstalled).to.be.true;
    expect(newversions.getByName(installedVersion.name).isActive).to.be.false;
  });
});
