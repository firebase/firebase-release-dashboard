const {
  convertDateToTimestamp,
  convertReleaseDatesToTimestamps,
  parseGradlePropertiesForVersion,
  calculateReleaseState,
  processLibraryNames,
  parseCommitTitleFromMessage,
} = require("../../utils/utils.js");
const RELEASE_STATES = require("../../utils/releaseStates");
const {expect} = require("chai");
const {Timestamp} = require("firebase-admin/firestore");
const sinon = require("sinon");

describe("convertDateToTimestamp", () => {
  it("should correctly convert a date string to a Firestore Timestamp", () => {
    const dateString = "2023-07-19";
    const result = convertDateToTimestamp(dateString);
    expect(result).to.be.an.instanceof(Timestamp);
  });

  it("should throw an error if date string format is invalid", () => {
    const dateString = "invalid-date-format";
    const consoleErrorStub = sinon.stub(console, "error");
    expect(() => convertDateToTimestamp(dateString)).to.throw();
    consoleErrorStub.restore();
  });
});

describe("convertReleaseDatesToTimestamps", () => {
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

    const result = convertReleaseDatesToTimestamps(mockReleases);

    result.forEach((release, index) => {
      expect(release).to.have.property("codeFreezeDate");
      expect(release.codeFreezeDate).to.be.an
          .instanceof(Timestamp);
      expect(release).to.have.property("releaseDate");
      expect(release.releaseDate).to.be.an
          .instanceof(Timestamp);
    });
  });

  it("should not convert if date properties are not present", () => {
    const mockReleases = [
      {
        name: "Release 1",
      },
    ];

    const result = convertReleaseDatesToTimestamps(mockReleases);

    expect(result[0]).to.deep.equal(mockReleases[0]);
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
  it("should work on the simple case", () => {
    const gradleProps = "version=1.2.3";
    const version = parseGradlePropertiesForVersion(gradleProps);
    expect(version).to.equal("1.2.3");
  });
  it("should ignore commented lines", () => {
    const gradleProps = `#version=1.2.3\nversion=2.3.4`;
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

  it("should throw an error when no version is found", () => {
    const gradleProps = "no version here";
    expect(() => parseGradlePropertiesForVersion(gradleProps)).to.throw();
  });
});

describe("parseCommitTitleFromMessage", () => {
  it("should return the sentence before \"(#<number>)\\n\"", () => {
    // eslint-disable-next-line max-len
    const message = `Making methods in core.Query that memoize results thread safe. (#5099)
      
      * Making methods in core.Query that memoize results thread safe.`;
    const result = parseCommitTitleFromMessage(message);
    expect(result).to
        .equal(
            "Making methods in core.Query that memoize "+
              "results thread safe.",
        );
  });

  it("should throw an error if the pattern is not found", () => {
    const message = "No pattern match in this string.";
    expect(() => parseCommitTitleFromMessage(message)).to.throw();
  });

  it("should throw an error on empty strings", () => {
    const message = "";
    expect(() => parseCommitTitleFromMessage(message)).to.throw();
  });
});
