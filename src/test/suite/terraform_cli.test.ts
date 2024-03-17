// import { expect } from "chai";
// import { TerraformCLI } from "../../utils/terraform/terraform_cli";

// describe("TerraformCLI", () => {
//   describe("#init", () => {
//     it("should return success when no folder is provided", async () => {
//       const cli = new TerraformCLI(async () => [true, "", ""]);
//       const [success] = await cli.init();
//       expect(success).to.be.true;
//     });

//     it("should return success when a folder is provided", async () => {
//       const cli = new TerraformCLI(async () => [true, "", ""]);
//       const [success] = await cli.init({ path: "/path/to/folder" });
//       expect(success).to.be.true;
//     });
//   });

//   describe("#getModules", () => {
//     it("should return success", async () => {
//       const cli = new TerraformCLI(async () => [true, "", ""]);
//       const [success] = await cli.getModules({ path: "/path/to/folder" });
//       expect(success).to.be.true;
//     });
//   });

//   describe("#getWorkspaces", () => {
//     it("should return a list of workspaces and the active workspace", async () => {
//       const cli = new TerraformCLI(async () => [true, "* workspace1\nworkspace2\nworkspace3\n", ""]);
//       const [workspaces, activeWorkspace] = await cli.getWorkspaces({ path: "/path/to/folder" });
//       expect(workspaces).to.deep.equal(["workspace1", "workspace2", "workspace3"]);
//       expect(activeWorkspace).to.equal("workspace1");
//     });

//     it("should throw an error if the command fails", async () => {
//       const cli = new TerraformCLI(async () => [false, "", "error message"]);
//       try {
//         await cli.getWorkspaces({ path: "/path/to/folder" });
//         expect.fail("Expected an error to be thrown");
//       } catch (error) {
//         expect(error.message).to.equal("Error getting terraform workspaces: error message");
//       }
//     });
//   });

//   describe("#setWorkspace", () => {
//     it("should return success", async () => {
//       const cli = new TerraformCLI(async () => [true, "", ""]);
//       const [success] = await cli.setWorkspace({ path: "/path/to/folder" }, "workspace1");
//       expect(success).to.be.true;
//     });
//   });
// });
