import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import cron from "node-cron";
import { runCollectionSync } from "./syncLogic";
import { setupScheduler } from "./scheduler";

vi.mock("./syncLogic", () => ({
    runCollectionSync: vi.fn(),
}));

vi.mock("node-cron", () => ({
    default: {
        validate: vi.fn(),
        schedule: vi.fn(),
    },
    validate: vi.fn(),
    schedule: vi.fn(),
}));

describe("Scheduler (src/lib/scheduler.ts)", () => {
    const DEFAULT_CRON_SCHEDULE = "0 0 * * *";
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    const mockedValidate = vi.mocked(cron.validate);
    const mockedSchedule = vi.mocked(cron.schedule);
    const mockedRunCollectionSync = vi.mocked(runCollectionSync);

    beforeEach(() => {
        vi.resetAllMocks();

        mockedValidate.mockReturnValue(true);
        mockedRunCollectionSync.mockResolvedValue({ message: "Mock Sync Success", itemCount: 0 });

        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    it("should validate and schedule with default cron schedule when SYNC_CRON_SCHEDULE is not set", () => {
        setupScheduler();

        expect(mockedValidate).toHaveBeenCalledWith(DEFAULT_CRON_SCHEDULE);
        expect(mockedSchedule).toHaveBeenCalledOnce();
        expect(mockedSchedule).toHaveBeenCalledWith(
            DEFAULT_CRON_SCHEDULE,
            expect.any(Function),
            expect.objectContaining({ scheduled: true, timezone: "Europe/Berlin" }),
        );
        expect(logSpy).toHaveBeenCalledWith(
            `Using default cron schedule: "${DEFAULT_CRON_SCHEDULE}". Set SYNC_CRON_SCHEDULE to override.`,
        );
        expect(logSpy).toHaveBeenCalledWith(
            `Scheduling collection sync with pattern: "${DEFAULT_CRON_SCHEDULE}"`,
        );
        expect(logSpy).toHaveBeenCalledWith("Cron job scheduled successfully.");
    });

    it("should validate and schedule with custom cron schedule when SYNC_CRON_SCHEDULE is set and valid", () => {
        const customSchedule = "*/5 * * * *";
        vi.stubEnv("SYNC_CRON_SCHEDULE", customSchedule);
        mockedValidate.mockReturnValue(true);

        setupScheduler();

        expect(mockedValidate).toHaveBeenCalledWith(customSchedule);
        expect(mockedSchedule).toHaveBeenCalledOnce();
        expect(mockedSchedule).toHaveBeenCalledWith(
            customSchedule,
            expect.any(Function),
            expect.objectContaining({ scheduled: true, timezone: "Europe/Berlin" }),
        );
        expect(logSpy).toHaveBeenCalledWith(
            `Using custom cron schedule from SYNC_CRON_SCHEDULE: "${customSchedule}"`,
        );
        expect(logSpy).toHaveBeenCalledWith(
            `Scheduling collection sync with pattern: "${customSchedule}"`,
        );
        expect(logSpy).toHaveBeenCalledWith("Cron job scheduled successfully.");
    });

    it("should log an error and not schedule when cron schedule is invalid", () => {
        const invalidSchedule = "invalid-schedule";
        vi.stubEnv("SYNC_CRON_SCHEDULE", invalidSchedule);
        mockedValidate.mockReturnValue(false);

        setupScheduler();

        expect(mockedValidate).toHaveBeenCalledWith(invalidSchedule);
        expect(mockedSchedule).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            `[ERROR] Invalid cron schedule format provided: "${invalidSchedule}". Scheduler will not run.`,
        );
        expect(logSpy).not.toHaveBeenCalledWith("Cron job scheduled successfully.");
    });

    it("should call runCollectionSync and log success when the scheduled task runs successfully", async () => {
        setupScheduler();
        expect(mockedSchedule).toHaveBeenCalled();

        const scheduleCallArgs = mockedSchedule.mock.calls[0];
        const scheduledTask = scheduleCallArgs[1] as () => Promise<void>;

        await scheduledTask();

        expect(mockedRunCollectionSync).toHaveBeenCalledOnce();
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("Cron job triggered. Starting collection sync..."),
        );
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("Scheduled sync finished successfully: Mock Sync Success"),
        );
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should call runCollectionSync and log error when the scheduled task fails", async () => {
        setupScheduler();
        expect(mockedSchedule).toHaveBeenCalled();

        const scheduleCallArgs = mockedSchedule.mock.calls[0];
        const scheduledTask = scheduleCallArgs[1] as () => Promise<void>;
        const testError = new Error("Sync Failed!");
        mockedRunCollectionSync.mockRejectedValue(testError);

        await scheduledTask();

        expect(mockedRunCollectionSync).toHaveBeenCalledOnce();
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("Cron job triggered. Starting collection sync..."),
        );
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining("Scheduled sync failed:"),
            testError,
        );
        expect(logSpy).not.toHaveBeenCalledWith(
            expect.stringContaining("Scheduled sync finished successfully"),
        );
    });
});

