const chai = require("chai");
const sinon = require("sinon");
const expect = chai.expect;
const {Timestamp} = require("firebase-admin/firestore");

const {validateNewReleases} = require("../index");
const {validateNewReleaseStructure} = require("../index");
const {convertDatesToTimestamps} = require("../index");
const {isFutureDate} = require("../index");
const {isValidReleaseName} = require("../index");
const {getReleaseNumbers} = require("../index");
const {calculateReleaseState} = require("../index");
const {parseGradlePropertiesForVersion} = require("../index");
const {processLibraryNames} = require("../index");

const ERRORS = require("../utils/errors");
const RELEASE_STATES = require("../releaseStates");


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

  it("should return an error for releases scheduled in the past", async () => {
    const newReleases = [
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2022-08-30",
        releaseDate: "2022-09-07",
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

  it("should return an error for overlapping releases", async () => {
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
        codeFreezeDate: "2123-07-01",
        releaseDate: "2123-07-08",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.RELEASE_OVERLAP,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for overlapping releases", async () => {
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
        codeFreezeDate: "2123-08-01",
        releaseDate: "2123-08-08",
      },
      {
        releaseName: "M105",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-07-01",
        releaseDate: "2123-07-08",
      },
    ];
    const existingReleases = [];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.RELEASE_OVERLAP,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for non monotonic release number", async () => {
    const newReleases = [
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [
      {
        releaseName: "M101",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.NON_MONOTONIC_RELEASE_NUMBER,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
  });

  it("should return an error for non monotonic release number", async () => {
    const newReleases = [
      {
        releaseName: "M101",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];
    const existingReleases = [
      {
        releaseName: "M103",
        releaseOperator: "operator1",
        codeFreezeDate: "2123-06-30",
        releaseDate: "2123-07-07",
      },
    ];

    const errors = await validateNewReleases(newReleases, existingReleases);
    const expectedErrors = {
      message: ERRORS.NON_MONOTONIC_RELEASE_NUMBER,
      offendingRelease: newReleases[0],
    };

    expect(errors).to.deep.include(expectedErrors);
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

    try {
      expect(errors).to.deep.include(expectedErrors);
    } catch (error) {
      console.log(errors);
      console.log(expectedErrors);
      throw error;
    }
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

describe("convertDatesToTimestamps", () => {
  it("should correctly convert date strings to Firestore Timestamps", () => {
    const mockReleases = [
      {
        name: "Release 1",
        codeFreezeDate: "2023-07-19",
        releaseDate: "2023-08-19",
      },
      {
        name: "Release 2",
        codeFreezeDate: "2023-09-19",
        releaseDate: "2023-10-19",
      },
    ];

    const result = convertDatesToTimestamps(mockReleases);

    result.forEach((release, index) => {
      expect(release).to.have.property("codeFreezeDate");
      expect(release.codeFreezeDate).to.be.an.instanceof(Timestamp);
      expect(release).to.have.property("releaseDate");
      expect(release.releaseDate).to.be.an.instanceof(Timestamp);
    });
  });

  it("should throw an error if date string format is invalid", () => {
    const mockReleases = [
      {
        name: "Release 1",
        codeFreezeDate: "invalid-date-format",
        releaseDate: "2023-08-19",
      },
    ];
    // Suppress error output, since we don't want to see the exception in tests
    const consoleErrorStub = sinon.stub(console, "error");

    expect(() => convertDatesToTimestamps(mockReleases)).to.throw();
    consoleErrorStub.restore();
  });

  it("should not convert if date properties are not present", () => {
    const mockReleases = [
      {
        name: "Release 1",
      },
    ];

    const result = convertDatesToTimestamps(mockReleases);

    expect(result[0]).to.deep.equal(mockReleases[0]);
  });
});

describe("isFutureDate", () => {
  it("should return true for a future date", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isFutureDate(tomorrow.toISOString())).to.be.true;
  });

  it("should return false for a date in the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isFutureDate(yesterday.toISOString())).to.be.false;
  });

  it("should return false for today's date", () => {
    const today = new Date();
    expect(isFutureDate(today.toISOString())).to.be.false;
  });
});

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

describe("getReleaseNumbers", () => {
  it("should return release numbers for valid data", () => {
    const validData = [
      {releaseName: "M123"},
      {releaseName: "M456"},
      {releaseName: "M789"},
    ];
    const expectedNumbers = [123, 456, 789];
    expect(getReleaseNumbers(validData)).to.deep.equal(expectedNumbers);
  });

  it("should throw TypeError for non-array input", () => {
    expect(() => getReleaseNumbers("not an array")).to.throw(TypeError);
  });

  it("should throw Error for document without releaseName", () => {
    const invalidData = [
      {notReleaseName: "M123"},
    ];
    expect(() => getReleaseNumbers(invalidData)).to.throw(Error);
  });

  it("should throw Error for releaseName that is not a string", () => {
    const invalidData = [
      {releaseName: 123},
    ];
    expect(() => getReleaseNumbers(invalidData)).to.throw(Error);
  });

  it("should throw Error for releaseName that does not start with M "+
  "followed by digits", () => {
    const invalidData = [
      {releaseName: "notValid123"},
    ];
    expect(() => getReleaseNumbers(invalidData)).to.throw(Error);
  });
});

describe("calculateReleaseState", () => {
  it("should return SCHEDULED if code freeze is more than 2 days away", () => {
    const now = new Date();
    const codeFreeze = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const release = new Date(codeFreeze.getTime() + 5 * 24 * 60 * 60 * 1000);
    expect(calculateReleaseState(codeFreeze, release, false))
        .to.equal(RELEASE_STATES.SCHEDULED);
  });

  it("should return UPCOMING if code freeze is less than 2 days away", () => {
    const now = new Date();
    const codeFreeze = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const release = new Date(codeFreeze.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect(calculateReleaseState(codeFreeze, release, false))
        .to.equal(RELEASE_STATES.UPCOMING);
  });

  it("should throw error if unable to calculate state", () => {
    const now = new Date();
    expect(() => calculateReleaseState(now, now, false))
        .to.throw("Unable to calculate release state");
  });

  it("should return CODE_FREEZE if code freeze has passed and release " +
    "date is in future", () => {
    const now = new Date();
    const codeFreeze = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const release = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    expect(calculateReleaseState(codeFreeze, release, false))
        .to.equal(RELEASE_STATES.CODE_FREEZE);
  });

  it("should return RELEASE_DAY if release date is today", () => {
    const now = new Date();
    const codeFreeze = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const release = new Date(now.setHours(0, 0, 0, 0));
    expect(calculateReleaseState(codeFreeze, release, false))
        .to.equal(RELEASE_STATES.RELEASE_DAY);
  });

  it("should return RELEASED if release date has passed and isComplete " +
    "is true", () => {
    const now = new Date();
    const codeFreeze = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const release = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(calculateReleaseState(codeFreeze, release, true))
        .to.equal(RELEASE_STATES.RELEASED);
  });

  it("should return DELAYED if release date has passed and isComplete " +
    "is false", () => {
    const now = new Date();
    const codeFreeze = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const release = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(calculateReleaseState(codeFreeze, release, false))
        .to.equal(RELEASE_STATES.DELAYED);
  });
});

describe("processLibraryNames", () => {
  it("should remove leading colon from library names", () => {
    const releaseConfig = {
      libraries: [":library1", ":library2/ktx", ":library3"],
    };

    processLibraryNames(releaseConfig);

    expect(releaseConfig.libraries).to.deep.equal(
        ["library1", "library2/ktx", "library3"],
    );
  });

  it("should replace :ktx with /ktx in library names", () => {
    const releaseConfig = {
      libraries: ["library1:ktx", "library2:ktx", "library3:ktx"],
    };

    processLibraryNames(releaseConfig);

    expect(releaseConfig.libraries).to.deep.equal(
        ["library1/ktx", "library2/ktx", "library3/ktx"],
    );
  });

  it("should correctly process a combination of leading colons and :ktx"+
  " in library names", () => {
    const releaseConfig = {
      libraries: [":library1:ktx", ":library2:ktx", ":library3:ktx"],
    };

    processLibraryNames(releaseConfig);

    expect(releaseConfig.libraries).to.deep.equal(
        ["library1/ktx", "library2/ktx", "library3/ktx"],
    );
  });
});

describe("parseGradlePropertiesForVersion", () => {
  it("should ignore commented lines", () => {
    const gradleProps = "#version=1.2.3\nversion=2.3.4";
    const version = parseGradlePropertiesForVersion(gradleProps);
    expect(version).to.equal("2.3.4");
  });

  it("should handle leading and trailing whitespace", () => {
    const gradleProps = " \t version = 3.4.5 \t ";
    const version = parseGradlePropertiesForVersion(gradleProps);
    expect(version).to.equal("3.4.5");
  });

  it("should handle case-insensitivity", () => {
    const gradleProps = "VERSION=4.5.6";
    const version = parseGradlePropertiesForVersion(gradleProps);
    expect(version).to.equal("4.5.6");
  });

  it("should ignore lines without equals sign", () => {
    const gradleProps = "version\nversion=5.6.7";
    const version = parseGradlePropertiesForVersion(gradleProps);
    expect(version).to.equal("5.6.7");
  });

  it("should handle version numbers with equals sign", () => {
    const gradleProps = "version=7=8=9";
    const version = parseGradlePropertiesForVersion(gradleProps);
    expect(version).to.equal("7=8=9");
  });

  it("should throw an error when no version is found", () => {
    const gradleProps = "no version here";
    expect(() => parseGradlePropertiesForVersion(gradleProps)).to.throw();
  });
});
