import { use as chaiUse, expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { PathObject } from "../../utils/path";
import chaiAsPromised = require("chai-as-promised");

chaiUse(chaiAsPromised);

describe("Path", () => {
  const testDir = path.join(__dirname, "testDir");
  const testFile = path.join(testDir, "terraform");

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
    it("should return true if the path exists", async () => {
      const pathObj = new PathObject(testFile);
      expect(await pathObj.exists()).to.be.true;
    });

    it("should return false if the path does not exist", async () => {
      const pathObj = new PathObject(path.join(testDir, "nonexistent.txt"));
      expect(await pathObj.exists()).to.be.false;
    });
  });

  describe("#isFile", () => {
    it("should return true if the path is a file", async () => {
      const pathObj = new PathObject(testFile);
      expect(await pathObj.isFile()).to.be.true;
    });

    it("should return false if the path is a directory", async () => {
      const pathObj = new PathObject(testDir);
      expect(await pathObj.isFile()).to.be.false;
    });
  });

  describe("#isDirectory", () => {
    it("should return true if the path is a directory", async () => {
      const pathObj = new PathObject(testDir);
      expect(await pathObj.isDirectory()).to.be.true;
    });

    it("should return false if the path is a file", async () => {
      const pathObj = new PathObject(testFile);
      expect(await pathObj.isDirectory()).to.be.false;
    });
  });

  describe("#isLocked", () => {
    it("should return false if the file is not locked", async () => {
      const pathObj = new PathObject(testFile);
      expect(await pathObj.isLocked()).to.be.false;
    });
    it("should throw an error if the file does not exist", async () => {
      const pathObj = new PathObject(path.join(testDir, "nonexistent.txt"));
      await expect(pathObj.isLocked()).to.eventually.be.rejectedWith("does not exist");
    });

    it("should throw an error if the path is a directory", async () => {
      const pathObj = new PathObject(testDir);
      await expect(pathObj.isLocked()).to.eventually.be.rejectedWith("is a directory");
    });
  });

  describe("#join", () => {
    it("should return a PathObject with the joined path", () => {
      const pathObj = new PathObject(testDir);
      const joinedPath = pathObj.join("test", "test2");
      expect(joinedPath.path).to.equal(path.join(testDir, "test", "test2"));
    });
  });

  describe("#directory", () => {
    it("should return a PathObject with the directory of the path", () => {
      const pathObj = new PathObject(testFile);
      const dir = pathObj.directory;
      expect(dir.path).to.equal(path.join(testDir));
    });
  });

  describe("#delete", () => {
    it("should delete the file if it exists", async () => {
      const pathObj = new PathObject(testFile);
      await pathObj.delete();
      expect(fs.existsSync(testFile)).to.be.false;
    });

    it("should delete the directory if it exists", async () => {
      const pathObj = new PathObject(testDir);
      await pathObj.delete();
      expect(fs.existsSync(testDir)).to.be.false;
    });

    it("should do nothing if the path does not exist", async () => {
      const pathObj = new PathObject(path.join(testDir, "nonexistent.txt"));
      await pathObj.delete();
      expect(fs.existsSync(path.join(testDir, "nonexistent.txt"))).to.be.false;
    });
  });
});
