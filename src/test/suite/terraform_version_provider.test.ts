import { expect } from "chai";
import { TerraformVersionProvieder } from "../../utils/terraform/terraform_version_provider";
import { mockExtensionContext } from "../../mocks/extension_context";
import { Octokit } from "octokit";
import { Releases } from "../../models/github/release";
import fetch from "node-fetch";
import { ReleaseError } from "../../utils/version_manager";

describe("Terraform version provider", () => {
  // Non authenticated github api requests on the mac os runner have rate limit issues. As a workaround we use a github auth token from the action env.
  const githubAuthToken = process.env.GITHUB_TOKEN;
  let octokit = new Octokit({ request: { fetch } });
  if (githubAuthToken) {
    console.log("Using github auth token");
    octokit = new Octokit({ request: { fetch }, auth: githubAuthToken });
  }

  const versionProvider = new TerraformVersionProvieder(mockExtensionContext, octokit);

  const releasesData = [
    { name: "v1.5.0", prerelease: false, isInstalled: true },
    { name: "v1000.0.0", prerelease: false, isInstalled: true },
  ];

  let releases: Releases;

  beforeEach(() => {
    releases = new Releases(releasesData);
  });

  describe("Get versions from github", () => {
    it("should return a list of versions", async () => {
      const versions = await versionProvider.getReleasesFormSource();
      expect(versions).to.be.of.instanceOf(Releases);
      expect(versions.all).to.be.of.length.greaterThan(0);
    });
  });

  describe("Get terraform binary", () => {
    it("should return the latest version", async () => {
      const versions = await versionProvider.getReleasesFormSource();
      const binary = await versionProvider.getBinaryPathForRelease(versions.latest);
      expect(binary.exists()).to.be.true;
      after(() => binary.delete());
    });

    it("should return the version 1.5.0", async () => {
      const binary = await versionProvider.getBinaryPathForRelease(releases.getByName("v1.5.0"));
      expect(binary.exists()).to.be.true;
      after(() => binary.delete());
    });

    it("should fail to get the non existing version", async () => {
      const release = releases.getByName("v1000.0.0");
      const binary = await versionProvider
        .getBinaryPathForRelease(release)
        .then()
        .catch((error) => {
          expect(error).to.be.instanceOf(ReleaseError);
        });
      expect(binary).to.be.undefined;
    });
  });
});
