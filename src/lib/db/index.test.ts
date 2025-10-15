import Database from "better-sqlite3";

import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    appendFileSync: vi.fn(),
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        readFileSync: vi.fn(),
        appendFileSync: vi.fn(),
    },
}));

vi.mock("path", () => {
    const MOCK_DB_DIR_INTERNAL = "/mock/project/.db";
    const MOCK_DB_PATH_INTERNAL = "/mock/project/.db/discogsdash.db";
    const MOCK_GITIGNORE_PATH_INTERNAL = "/mock/project/.gitignore";

    return {
        resolve: vi.fn((...args: string[]) => {
            const lastArg = args[args.length - 1];
            if (lastArg === ".gitignore") return MOCK_GITIGNORE_PATH_INTERNAL;
            if (lastArg === ".db") return MOCK_DB_DIR_INTERNAL;

            console.warn(`Unexpected path.resolve call in test: ${args}`);
            return `/mock/project/resolved_fallback_${lastArg}`;
        }),
        join: vi.fn((...args: string[]) => {
            if (args.length === 2 && args[0] === MOCK_DB_DIR_INTERNAL && args[1] === "discogsdash.db")
                return MOCK_DB_PATH_INTERNAL;
            console.warn(`Unexpected path.join call in test: ${args}`);
            return `${args.join("_")}`;
        }),
        default: {
            resolve: vi.fn((...args: string[]) => {
                const lastArg = args[args.length - 1];
                if (lastArg === ".gitignore") return MOCK_GITIGNORE_PATH_INTERNAL;
                if (lastArg === ".db") return MOCK_DB_DIR_INTERNAL;
                console.warn(`Unexpected path.resolve (default) call in test: ${args}`);
                return `/mock/project/resolved_fallback_${lastArg}`;
            }),
            join: vi.fn((...args: string[]) => {
                if (args.length === 2 && args[0] === MOCK_DB_DIR_INTERNAL && args[1] === "discogsdash.db")
                    return MOCK_DB_PATH_INTERNAL;
                console.warn(`Unexpected path.join (default) call in test: ${args}`);
                return `${args.join("_")}`;
            }),
        },
    };
});

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbPrepare = vi.fn(() => ({
    run: mockDbRun,
    get: mockDbGet,
}));
const mockDbExec = vi.fn();
const mockDbPragma = vi.fn();
const mockDatabaseInstance = {
    pragma: mockDbPragma,
    exec: mockDbExec,
    prepare: mockDbPrepare,
};
vi.mock("better-sqlite3", () => ({
    default: vi.fn(() => mockDatabaseInstance),
}));

const MOCK_CWD = "/mock/project";
vi.spyOn(process, "cwd").mockReturnValue(MOCK_CWD);

import { __resetDbInstanceForTest, getDb, getSetting, setSetting } from "./index";

describe("Database Utilities (src/lib/db/index.ts)", () => {
    const MOCK_DB_DIR_EXPECTED = "/mock/project/.db";
    const MOCK_DB_PATH_EXPECTED = "/mock/project/.db/discogsdash.db";
    const MOCK_GITIGNORE_PATH_EXPECTED = "/mock/project/.gitignore";

    let logSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    const mockedFsExistsSync = vi.mocked(fs.existsSync);
    const mockedFsMkdirSync = vi.mocked(fs.mkdirSync);
    const mockedFsReadFileSync = vi.mocked(fs.readFileSync);
    const mockedFsAppendFileSync = vi.mocked(fs.appendFileSync);
    const mockedPathResolve = vi.mocked(path.resolve);
    const mockedDatabaseConstructor = vi.mocked(Database);

    beforeEach(() => {
        vi.resetAllMocks();

        __resetDbInstanceForTest();

        vi.spyOn(process, "cwd").mockReturnValue(MOCK_CWD);

        mockedFsExistsSync.mockReturnValue(true);
        mockedFsReadFileSync.mockReturnValue("");

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        vi.restoreAllMocks();
    });

    describe("getDb()", () => {
        it("should create DB instance, directory, and init schema on first call when directory does not exist", () => {
            mockedFsExistsSync.mockImplementation((p) => {
                if (p === MOCK_DB_DIR_EXPECTED) return false;
                if (p === MOCK_GITIGNORE_PATH_EXPECTED) return false;
                return false;
            });
            mockedFsReadFileSync.mockReturnValue("");

            const db = getDb();

            expect(mockedFsExistsSync).toHaveBeenCalledWith(MOCK_DB_DIR_EXPECTED);
            expect(mockedFsMkdirSync).toHaveBeenCalledWith(MOCK_DB_DIR_EXPECTED, {
                recursive: true,
            });

            expect(mockedPathResolve).toHaveBeenCalledWith(MOCK_CWD, ".gitignore");
            expect(mockedFsExistsSync).toHaveBeenCalledWith(MOCK_GITIGNORE_PATH_EXPECTED);
            expect(mockedFsAppendFileSync).toHaveBeenCalledWith(
                MOCK_GITIGNORE_PATH_EXPECTED,
                expect.stringContaining(".db/"),
            );

            expect(mockedDatabaseConstructor).toHaveBeenCalledOnce();
            expect(mockedDatabaseConstructor).toHaveBeenCalledWith(MOCK_DB_PATH_EXPECTED, expect.any(Object));
            expect(mockDbPragma).toHaveBeenCalledWith("journal_mode = WAL");
            expect(mockDbExec).toHaveBeenCalledTimes(7);
            expect(db).toBe(mockDatabaseInstance);
        });

        it("should create DB instance and init schema but NOT update gitignore if dir exists and gitignore has entry", () => {
            mockedFsExistsSync.mockImplementation((p) => {
                if (p === MOCK_DB_DIR_EXPECTED) return true;
                if (p === MOCK_GITIGNORE_PATH_EXPECTED) return true;
                return false;
            });
            mockedFsReadFileSync.mockReturnValueOnce("# Some rules\n.db/\n# More rules");

            const db = getDb();

            expect(mockedFsExistsSync).toHaveBeenCalledWith(MOCK_DB_DIR_EXPECTED);
            expect(mockedFsMkdirSync).not.toHaveBeenCalled();

            expect(mockedPathResolve).toHaveBeenCalledWith(MOCK_CWD, ".gitignore");
            expect(mockedFsExistsSync).toHaveBeenCalledWith(MOCK_GITIGNORE_PATH_EXPECTED);
            expect(mockedFsReadFileSync).toHaveBeenCalledWith(MOCK_GITIGNORE_PATH_EXPECTED, "utf8");
            expect(mockedFsAppendFileSync).not.toHaveBeenCalled();

            expect(mockedDatabaseConstructor).toHaveBeenCalledOnce();
            expect(mockedDatabaseConstructor).toHaveBeenCalledWith(MOCK_DB_PATH_EXPECTED, expect.any(Object));
            expect(mockDbPragma).toHaveBeenCalledWith("journal_mode = WAL");
            expect(mockDbExec).toHaveBeenCalledTimes(7);
            expect(db).toBe(mockDatabaseInstance);
        });

        it("should create DB instance and init schema AND update gitignore if dir exists but gitignore does NOT have entry", () => {
            mockedFsExistsSync.mockImplementation((p) => {
                if (p === MOCK_DB_DIR_EXPECTED) return true;
                if (p === MOCK_GITIGNORE_PATH_EXPECTED) return true;
                return false;
            });
            mockedFsReadFileSync.mockReturnValueOnce("");

            const db = getDb();

            expect(mockedFsExistsSync).toHaveBeenCalledWith(MOCK_DB_DIR_EXPECTED);
            expect(mockedFsMkdirSync).not.toHaveBeenCalled();

            expect(mockedPathResolve).toHaveBeenCalledWith(MOCK_CWD, ".gitignore");
            expect(mockedFsExistsSync).toHaveBeenCalledWith(MOCK_GITIGNORE_PATH_EXPECTED);
            expect(mockedFsReadFileSync).toHaveBeenCalledWith(MOCK_GITIGNORE_PATH_EXPECTED, "utf8");
            expect(mockedFsAppendFileSync).toHaveBeenCalledWith(
                MOCK_GITIGNORE_PATH_EXPECTED,
                expect.stringContaining(".db/"),
            );

            expect(mockedDatabaseConstructor).toHaveBeenCalledOnce();
            expect(mockedDatabaseConstructor).toHaveBeenCalledWith(MOCK_DB_PATH_EXPECTED, expect.any(Object));
            expect(mockDbPragma).toHaveBeenCalledWith("journal_mode = WAL");
            expect(mockDbExec).toHaveBeenCalledTimes(7);
            expect(db).toBe(mockDatabaseInstance);
        });

        it("should return the same DB instance on subsequent calls without re-initializing", () => {
            mockedFsExistsSync.mockImplementation((p) => {
                if (p === MOCK_DB_DIR_EXPECTED) return true;
                if (p === MOCK_GITIGNORE_PATH_EXPECTED) return true;
                return false;
            });
            mockedFsReadFileSync.mockReturnValueOnce("# Some rules\n.db/\n# More rules");

            const db1 = getDb();

            vi.clearAllMocks();

            const db2 = getDb();

            expect(db2).toBe(db1);

            expect(mockedDatabaseConstructor).not.toHaveBeenCalled();
            expect(mockDbExec).not.toHaveBeenCalled();
            expect(mockDbPragma).not.toHaveBeenCalled();
            expect(mockedFsExistsSync).not.toHaveBeenCalled();
            expect(mockedFsMkdirSync).not.toHaveBeenCalled();
            expect(mockedFsAppendFileSync).not.toHaveBeenCalled();
            expect(mockedFsReadFileSync).not.toHaveBeenCalled();
        });

        it("should handle error when updating .gitignore", () => {
            mockedFsExistsSync.mockImplementation((p) => {
                if (p === MOCK_DB_DIR_EXPECTED) return false;
                if (p === MOCK_GITIGNORE_PATH_EXPECTED) return true;
                return false;
            });
            mockedFsReadFileSync.mockReturnValueOnce("");
            const appendError = new Error("Permission denied");
            mockedFsAppendFileSync.mockImplementationOnce(() => {
                throw appendError;
            });

            const db = getDb();

            expect(mockedFsAppendFileSync).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith("Could not automatically update .gitignore:", appendError);

            expect(mockedDatabaseConstructor).toHaveBeenCalledOnce();
            expect(db).toBe(mockDatabaseInstance);
        });
    });

    describe("setSetting()", () => {
        it("should prepare statement and run it with key and value", () => {
            const testKey = "myKey";
            const testValue = "myValue";

            mockedFsExistsSync.mockReturnValue(true);
            mockedFsReadFileSync.mockReturnValue(".db/");

            setSetting(testKey, testValue);

            expect(mockDbPrepare).toHaveBeenCalledOnce();
            expect(mockDbPrepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE INTO settings"));
            expect(mockDbRun).toHaveBeenCalledOnce();
            expect(mockDbRun).toHaveBeenCalledWith(testKey, testValue);
        });
    });

    describe("getSetting()", () => {
        it("should prepare statement and get value by key", () => {
            const testKey = "myKey";
            const expectedValue = "storedValue";
            mockDbGet.mockReturnValue({ value: expectedValue });

            mockedFsExistsSync.mockReturnValue(true);
            mockedFsReadFileSync.mockReturnValue(".db/");

            const result = getSetting(testKey);

            expect(mockDbPrepare).toHaveBeenCalledOnce();
            expect(mockDbPrepare).toHaveBeenCalledWith(
                expect.stringContaining("SELECT value FROM settings WHERE key = ?"),
            );
            expect(mockDbGet).toHaveBeenCalledOnce();
            expect(mockDbGet).toHaveBeenCalledWith(testKey);
            expect(result).toBe(expectedValue);
        });

        it("should return null if setting key is not found", () => {
            const testKey = "nonExistentKey";
            mockDbGet.mockReturnValue(undefined);

            mockedFsExistsSync.mockReturnValue(true);
            mockedFsReadFileSync.mockReturnValue(".db/");

            const result = getSetting(testKey);

            expect(mockDbPrepare).toHaveBeenCalledOnce();
            expect(mockDbPrepare).toHaveBeenCalledWith(
                expect.stringContaining("SELECT value FROM settings WHERE key = ?"),
            );
            expect(mockDbGet).toHaveBeenCalledOnce();
            expect(mockDbGet).toHaveBeenCalledWith(testKey);
            expect(result).toBeNull();
        });
    });
});
