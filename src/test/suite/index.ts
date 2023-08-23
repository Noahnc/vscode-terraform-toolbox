import * as path from "path";
import * as Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
    timeout: 30000,
  });

  const testsRoot = path.resolve(__dirname, "..");
  const testFiles = await glob("**/**.test.js", { cwd: testsRoot });

  return new Promise((c, e) => {
    testFiles.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));
    try {
      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      console.error(err);
      e(err);
    }
  });
}
