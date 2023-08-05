import { expect } from "chai";
import { Releases, Release } from "../../models/github/release";

describe("Releases", () => {
  const releasesData = [
    { name: "v1.1.0", prerelease: false, isInstalled: true },
    { name: "v1.0.0", prerelease: false, isInstalled: true },
    { name: "v1.2.0-beta.1", prerelease: true, isInstalled: false },
    { name: "v1.2.0-rc.1", prerelease: true, isInstalled: false },
    { name: "v1.2.0", prerelease: false, isInstalled: false },
  ];

  let releases: Releases;

  beforeEach(() => {
    releases = new Releases(releasesData);
  });

  describe("latest", () => {
    it("should return the latest non-prerelease release", () => {
      const latestRelease = releases.latest;
      expect(latestRelease).to.be.an.instanceOf(Release);
      expect(latestRelease?.name).to.equal("v1.2.0");
    });
  });

  describe("all", () => {
    it("should return all releases", () => {
      const allReleases = releases.all;
      expect(allReleases).to.be.an("array").with.lengthOf(releasesData.length);
      expect(allReleases[0]).to.be.an.instanceOf(Release);
      expect(allReleases[0].name).to.equal("v1.2.0");
    });
  });

  describe("installed", () => {
    it("should return all installed releases", () => {
      const installedReleases = releases.installed;
      expect(installedReleases).to.be.an("array").with.lengthOf(2);
      expect(installedReleases[0]).to.be.an.instanceOf(Release);
      expect(installedReleases[0].name).to.equal("v1.1.0");
    });
  });

  describe("installedNotActive", () => {
    it("should return all installed releases that are not active", () => {
      const installedNotActiveReleases = releases.installedNotActive;
      expect(installedNotActiveReleases).to.be.an("array").with.lengthOf(2);
      expect(installedNotActiveReleases[0]).to.be.an.instanceOf(Release);
      expect(installedNotActiveReleases[0].name).to.equal("v1.1.0");
    });
  });

  describe("active", () => {
    it("should throw an error if no active release is set", () => {
      expect(() => releases.active).to.throw("No active release set");
    });

    it("should return the active release", () => {
      const releaseToActivate = releases.getByName("v1.0.0");
      releases.setActive = releaseToActivate;
      const activeRelease = releases.active;
      expect(activeRelease).to.be.an.instanceOf(Release);
      expect(activeRelease?.name).to.equal("v1.0.0");
    });
  });

  describe("setActive", () => {
    it("should throw an error if the release is not found", () => {
      const releaseToActivate = new Release("v1.3.0", false, false, false);
      expect(() => (releases.setActive = releaseToActivate)).to.throw("Release not found");
    });

    it("should set the release as active", () => {
      const releaseToActivate = releases.getByName("v1.0.0");
      releases.setActive = releaseToActivate;
      expect(releases.active?.name).to.equal("v1.0.0");
    });

    it("should deactivate the previously active release", () => {
      const releaseToActivate = releases.getByName("v1.1.0");
      releases.setActive = releaseToActivate;
      const previouslyActiveRelease = releases.getByName("v1.0.0");
      expect(previouslyActiveRelease.isActive).to.be.false;
    });
  });

  describe("setInstalled", () => {
    it("should throw an error if the release is not found", () => {
      const releaseToInstall = new Release("v1.3.0", false, false, false);
      expect(() => (releases.setInstalled = releaseToInstall)).to.throw("Release not found");
    });

    it("should set the release as installed", () => {
      const releaseToInstall = releases.getByName("v1.1.0");
      releases.setInstalled = releaseToInstall;
      expect(releaseToInstall.isInstalled).to.be.true;
    });
  });

  describe("setUninstalled", () => {
    it("should throw an error if the release is not found", () => {
      const releaseToUninstall = new Release("v1.3.0", false, false, false);
      expect(() => (releases.setUninstalled = releaseToUninstall)).to.throw("Release not found");
    });

    it("should set the release as uninstalled", () => {
      const releaseToUninstall = releases.getByName("v1.0.0");
      releases.setUninstalled = releaseToUninstall;
      expect(releaseToUninstall.isInstalled).to.be.false;
    });
  });

  describe("getByMatchingVersionConstraint", () => {
    it("should return all releases that match the version constraint", () => {
      const matchingReleases = releases.getByMatchingVersionConstraint(">=1.1.0");
      expect(matchingReleases).to.be.an("array").with.lengthOf(2);
      expect(matchingReleases[0]).to.be.an.instanceOf(Release);
      expect(matchingReleases[0].name).to.equal("v1.2.0");
      expect(matchingReleases[1]).to.be.equal(releases.getByName("v1.1.0"));
    });
  });

  describe("getByName", () => {
    it("should throw an error if the release is not found", () => {
      expect(() => releases.getByName("v1.3.0")).to.throw("Release not found");
    });

    it("should return the release with the given name", () => {
      const release = releases.getByName("v1.0.0");
      expect(release).to.be.an.instanceOf(Release);
      expect(release?.name).to.equal("v1.0.0");
    });
  });

  describe("getNewestReleaseMatchingVersionConstraints", () => {
    it("should throw an error if no matching release is found", () => {
      expect(() => releases.getNewestReleaseMatchingVersionConstraints(["^2.0.0"])).to.throw("No terraform version matching the following constraints found: ^2.0.0");
    });

    it("should return the newest release that matches all version constraints", () => {
      const newestRelease = releases.getNewestReleaseMatchingVersionConstraints(["^1.2.0"]);
      expect(newestRelease).to.be.an.instanceOf(Release);
      expect(newestRelease.name).to.equal("v1.2.0");
    });
  });

  describe("getReleases", () => {
    it("should return all non-prerelease releases if no options are provided", () => {
      const filteredReleases = releases.getReleases();
      expect(filteredReleases).to.be.an("array").with.lengthOf(3);
      expect(filteredReleases[0]).to.be.an.instanceOf(Release);
      expect(filteredReleases[0].name).to.equal("v1.2.0");
    });

    it("should return all releases that match the beta option", () => {
      const filteredReleases = releases.getReleases(true);
      expect(filteredReleases).to.be.an("array").with.lengthOf(4);
      expect(filteredReleases[0]).to.be.an.instanceOf(Release);
      expect(filteredReleases[0].name).to.equal("v1.2.0");
    });

    it("should return all releases that match the rc option", () => {
      const filteredReleases = releases.getReleases(false, true);
      expect(filteredReleases).to.be.an("array").with.lengthOf(4);
      expect(filteredReleases[0]).to.be.an.instanceOf(Release);
      expect(filteredReleases[0].name).to.equal("v1.2.0");
    });

    it("should return all releases that match the alpha option", () => {
      const filteredReleases = releases.getReleases(false, false, true);
      expect(filteredReleases).to.be.an("array").with.lengthOf(3);
      expect(filteredReleases[0]).to.be.an.instanceOf(Release);
      expect(filteredReleases[0].name).to.equal("v1.2.0");
    });

    it("should return all releases that match any of the options", () => {
      const filteredReleases = releases.getReleases(true, true, false);
      expect(filteredReleases).to.be.an("array").with.lengthOf(5);
      expect(filteredReleases[0]).to.be.an.instanceOf(Release);
      expect(filteredReleases[0].name).to.equal("v1.2.0");
      expect(filteredReleases[1]).to.be.an.instanceOf(Release);
      expect(filteredReleases[1].name).to.equal("v1.2.0-rc.1");
    });
  });
});
