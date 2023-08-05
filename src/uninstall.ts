import path = require("path");
import * as fs from "fs";
import * as os from "os";

const binFolderPath = path.join(os.homedir(), ".terraform-toolbox");

function removeFolder(folder: string): boolean {
  if (!fs.existsSync(binFolderPath)) {
    return true;
  }
  try {
    fs.rmdirSync(folder, { recursive: true });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

// Remove bin folder from home directory
for (let index = 0; index < 9; index++) {
  if (removeFolder(binFolderPath)) {
    break;
  }
}
