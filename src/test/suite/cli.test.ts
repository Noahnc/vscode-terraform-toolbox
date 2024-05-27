import { expect } from "chai";
import { mockExtensionContext } from "../../mocks/ExtensionContextMock";
import { Cli } from "../../utils/Cli/cli";
import { PathEnvironmentHelper } from "../../utils/PathEnvironmentHelper";

describe("CLI", () => {
  const envPathHelper = new PathEnvironmentHelper(mockExtensionContext);
  const cli = new Cli(envPathHelper);

  it("should find ping in path", async () => {
    const installed = await cli.checkIfBinaryIsInPath("ping");
    expect(installed).to.be.true;
  });

  it("should not find nonexisting in path", async () => {
    const installed = await cli.checkIfBinaryIsInPath("nonexisting");
    expect(installed).to.be.false;
  });

  it("should run a shell command", async () => {
    const [success, stdout, stderr] = await cli.runShellCommand("whoami");
    expect(success).to.be.true;
    expect(stdout).to.not.be.empty;
    expect(stderr).to.be.empty;
  });
  it("should run a shell command with error", async () => {
    const [success, stdout, stderr] = await cli.runShellCommand("nonexisting command -d");
    expect(success).to.be.false;
    expect(stderr).to.not.be.empty;
    expect(stdout).to.be.empty;
  });
});
