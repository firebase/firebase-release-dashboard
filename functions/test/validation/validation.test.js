const chai = require("chai");
const expect = chai.expect;
const {
  validateNewReleases,
  validateNewReleaseStructure,
  isValidDate,
  isValidReleaseName,
} = require("../../validation/validation.js");
const ERRORS = require("../../utils/errors.js");
const {Timestamp} = require("firebase-admin/firestore");

describe("isValidReleaseName", () => {
  it("should return true for a valid release name", () => {
    const validReleaseName = "M123";
    expect(isValidReleaseName(validReleaseName)).to.be.true;
  });

  it("should return false for a release name without the M prefix", () => {
    const invalidReleaseName = "123";
    expect(isValidReleaseName(invalidReleaseName)).to.be.false;
  });

  it("should return false for a release name with non-numeric characters"+
    " after the M", () => {
    const invalidReleaseName = "M12A";
    expect(isValidReleaseName(invalidReleaseName)).to.be.false;
  });

  it("should return false for an empty string", () => {
    const invalidReleaseName = "";
    expect(isValidReleaseName(invalidReleaseName)).to.be.false;
  });
});

describe("validateNewReleases", () => {
  it("should return no errors for valid releases when there are no previous"+
    " releases", async () => {
    const newReleases = [
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
      {
        releaseName: "M104",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-07-30",
        releaseDate: "2123-08-07",
      },
      {
        releaseName: "M105",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-08-30",
        releaseDate: "2123-09-07",
      },
    ];
    const existingReleases = [];
    const errors = await validateNewReleases(newReleases, existingReleases);
    expect(errors).to.be.an("array").that.is.empty;
  });

  it("should return no errors for valid releases when there are previous"+
    " releases", async () => {
    const newReleases = [
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
      {
        releaseName: "M104",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-07-30",
        releaseDate: "2123-08-07",
      },
      {
        releaseName: "M105",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-08-30",
        releaseDate: "2123-09-07",
      },
    ];
    const existingReleases = [
      {
        releaseName: "M102",
        releaseOperator: "operator1",
        codeFreezeDate: "2022-06-30",
        releaseDate: "2022-07-07",
      },
    ];
    const errors = await validateNewReleases(newReleases, existingReleases);
    expect(errors).to.be.an("array").that.is.empty;
  });

  it("should return an error for invalid release name", async () => {
    const newReleases = [
      {
        releaseName: "101",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.INVALID_RELEASE_NAME,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for invalid release name", async () => {
    const newReleases = [
      {
        releaseName: "m101",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.INVALID_RELEASE_NAME,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for invalid release name", async () => {
    const newReleases = [
      {
        releaseName: "M101.release",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.INVALID_RELEASE_NAME,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for invalid date", async () => {
    const newReleases = [
      {
        releaseName: "M101.release",
        releaseOperator: "operator1",
        codeFreezeDate: "not a date",
        releaseDate: "not a date",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.INVALID_DATE,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for not having a code freeze date before the " +
    "release date", async () => {
    const newReleases = [
      {
        releaseName: "M101",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-07-30",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.CODEFREEZE_AFTER_RELEASE,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for not having a code freeze date before the " +
    "release date", async () => {
    const newReleases = [
      {
        releaseName: "M101",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-07-07",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.CODEFREEZE_AFTER_RELEASE,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for duplicate release names", async () => {
    const newReleases = [
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];
    const errors = validateNewReleases(newReleases);
    const expectedErrors = {
      message: ERRORS.DUPLICATE_RELEASE_NAMES,
    };
    expect(errors).to.deep.include(expectedErrors);
  });
});

describe("isValidDate", () => {
  it("should return true for valid dates", () => {
    expect(isValidDate("2023-07-13")).to.be.true;
    expect(isValidDate("July 13, 2023")).to.be.true;
  });

  it("should return false for invalid dates", () => {
    expect(isValidDate("not a date")).to.be.false;
    expect(isValidDate("2023-13-07")).to.be.false; // Month > 12 is invalid
    expect(isValidDate("")).to.be.false;
  });

  it("should return false for non-string inputs", () => {
    expect(isValidDate(null)).to.be.false;
    expect(isValidDate(undefined)).to.be.false;
    expect(isValidDate(123456789)).to.be.false;
    expect(isValidDate({})).to.be.false;
  });
});

describe("validateNewReleaseStructure", () => {
  it("should throw an error if newReleases is not an array", () => {
    const newReleases = "not an array";
    expect(() => validateNewReleaseStructure(newReleases))
        .to.throw("New releases should be an array");
  });

  it("should throw an error if a release is not an object", () => {
    const newReleases = ["not an object"];
    expect(() => validateNewReleaseStructure(newReleases)).
        to.throw("Each release should be an object");
  });

  it("should throw an error if a release is missing properties", () => {
    const newReleases = [{
      releaseName: "M100",
      releaseOperator: "operator1",
      codeFreezeDate: Timestamp.now(),
      // missing release date
    }];
    expect(() => validateNewReleaseStructure(newReleases)).
        to.throw("Each release should have a Firestore Timestamp"+
          " property 'releaseDate'");
  });

  it("should throw an error if a release property is of incorrect type", () => {
    const newReleases = [{
      releaseName: "M100",
      releaseOperator: "operator1",
      codeFreezeDate: Timestamp.now(),
      releaseDate: "not a timestamp",
    }];
    expect(() => validateNewReleaseStructure(newReleases)).
        to.throw("Each release should have a Firestore Timestamp"+
          " property 'releaseDate'");
  });

  it("should not throw an error if all releases are correct", () => {
    const newReleases = [{
      releaseName: "M100",
      releaseOperator: "operator1",
      codeFreezeDate: Timestamp.now(),
      releaseDate: Timestamp.now(),
    }];
    expect(() => validateNewReleaseStructure(newReleases)).to.not.throw();
  });
});
