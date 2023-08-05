import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Path } from "../../utils/path";

describe("Path", () => {
  const testDir = path.join(__dirname, "testDir");
  const testFile = path.join(testDir, "testFile.txt");

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    if (!fs.existsSync(testFile)) {
      fs.writeFileSync(testFile, "test content");
    }
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
  });

  describe("#exists", () => {
    it("should return true if the path exists", () => {
      const pathObj = new Path(testFile);
      expect(pathObj.exists()).to.be.true;
    });

    it("should return false if the path does not exist", () => {
      const pathObj = new Path(path.join(testDir, "nonexistent.txt"));
      expect(pathObj.exists()).to.be.false;
    });
  });

  describe("#isFile", () => {
    it("should return true if the path is a file", () => {
      const pathObj = new Path(testFile);
      expect(pathObj.isFile()).to.be.true;
    });

    it("should return false if the path is a directory", () => {
      const pathObj = new Path(testDir);
      expect(pathObj.isFile()).to.be.false;
    });
  });

  describe("#isDirectory", () => {
    it("should return true if the path is a directory", () => {
      const pathObj = new Path(testDir);
      expect(pathObj.isDirectory()).to.be.true;
    });

    it("should return false if the path is a file", () => {
      const pathObj = new Path(testFile);
      expect(pathObj.isDirectory()).to.be.false;
    });
  });

  describe("#isLocked", () => {
    it("should return false if the file is not locked", () => {
      const pathObj = new Path(testFile);
      expect(pathObj.isLocked()).to.be.false;
    });
    it("should throw an error if the file does not exist", () => {
      const pathObj = new Path(path.join(testDir, "nonexistent.txt"));
      expect(() => pathObj.isLocked()).to.throw(Error, /does not exist/);
    });

    it("should throw an error if the path is a directory", () => {
      const pathObj = new Path(testDir);
      expect(() => pathObj.isLocked()).to.throw(Error, /is a directory/);
    });
  });

  describe("#delete", () => {
    it("should delete the file if it exists", () => {
      const pathObj = new Path(testFile);
      pathObj.delete();
      expect(fs.existsSync(testFile)).to.be.false;
    });

    it("should delete the directory if it exists", () => {
      const pathObj = new Path(testDir);
      pathObj.delete();
      expect(fs.existsSync(testDir)).to.be.false;
    });

    it("should do nothing if the path does not exist", () => {
      const pathObj = new Path(path.join(testDir, "nonexistent.txt"));
      pathObj.delete();
      expect(fs.existsSync(path.join(testDir, "nonexistent.txt"))).to.be.false;
    });
  });
});
