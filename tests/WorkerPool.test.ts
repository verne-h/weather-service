import { WorkerPool, runWorker } from '../src/workers/WorkerPool';
import { Worker } from 'worker_threads';
import path from 'path';

// Mock worker_threads
jest.mock('worker_threads', () => ({
    Worker: jest.fn(),
}));

describe('WorkerPool', () => {
    const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
    let mockWorkerInstances: any[];

    beforeEach(() => {
        jest.clearAllMocks();
        mockWorkerInstances = [];

        // Mock Worker constructor
        MockedWorker.mockImplementation((() => {
            const mockWorker = {
                on: jest.fn(),
                off: jest.fn(),
                postMessage: jest.fn(),
                terminate: jest.fn().mockResolvedValue(undefined),
            };
            mockWorkerInstances.push(mockWorker);
            return mockWorker as any;
        }) as any);
    });

    describe('WorkerPool initialization', () => {
        it('should create pool with specified size', async () => {
            const pool = new WorkerPool('/mock/worker.js', 4);
            await pool.initialize();

            expect(MockedWorker).toHaveBeenCalledTimes(4);
            expect(MockedWorker).toHaveBeenCalledWith('/mock/worker.js');
        });

        it('should default to CPU count if no size specified', async () => {
            const cpuCount = require('os').cpus().length;
            const pool = new WorkerPool('/mock/worker.js');
            await pool.initialize();

            expect(MockedWorker).toHaveBeenCalledTimes(cpuCount);
        });

        it('should not reinitialize if already initialized', async () => {
            const pool = new WorkerPool('/mock/worker.js', 2);
            await pool.initialize();
            await pool.initialize();

            // Should only be called once
            expect(MockedWorker).toHaveBeenCalledTimes(2);
        });
    });

    describe('WorkerPool execution', () => {
        it('should execute task using available worker', async () => {
            const pool = new WorkerPool('/mock/worker.js', 2);
            const testData = { test: 'data' };
            const expectedResult = { result: 'success' };

            // Simulate worker responding with message
            const executePromise = pool.execute(testData);

            // Wait a bit for initialization
            await new Promise(resolve => setTimeout(resolve, 10));

            // Get the message handler that was registered
            const messageHandler = mockWorkerInstances[0].on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )?.[1];

            // Simulate worker sending result
            if (messageHandler) {
                messageHandler(expectedResult);
            }

            const result = await executePromise;

            expect(mockWorkerInstances[0].postMessage).toHaveBeenCalledWith(testData);
            expect(result).toEqual(expectedResult);
        });

        it('should handle worker errors', async () => {
            const pool = new WorkerPool('/mock/worker.js', 1);
            const testData = { test: 'data' };
            const testError = new Error('Worker failed');

            const executePromise = pool.execute(testData);

            await new Promise(resolve => setTimeout(resolve, 10));

            // Get the error handler
            const errorHandler = mockWorkerInstances[0].on.mock.calls.find(
                (call: any) => call[0] === 'error'
            )?.[1];

            // Simulate worker error
            if (errorHandler) {
                errorHandler(testError);
            }

            await expect(executePromise).rejects.toThrow('Worker failed');
        });

        it('should queue tasks when all workers are busy', async () => {
            const pool = new WorkerPool('/mock/worker.js', 2);

            // Start first task (will use worker 0)
            const task1 = pool.execute({ id: 1 });
            await new Promise(resolve => setTimeout(resolve, 10));

            // Start second task (will use worker 1)
            const task2 = pool.execute({ id: 2 });
            await new Promise(resolve => setTimeout(resolve, 10));

            // Start third task (should be queued)
            const task3 = pool.execute({ id: 3 });
            await new Promise(resolve => setTimeout(resolve, 10));

            // Both workers should be used
            expect(mockWorkerInstances[0].postMessage).toHaveBeenCalledWith({ id: 1 });
            expect(mockWorkerInstances[1].postMessage).toHaveBeenCalledWith({ id: 2 });

            // Complete first task to free up worker
            const messageHandler = mockWorkerInstances[0].on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )?.[1];

            if (messageHandler) {
                messageHandler({ result: 1 });
            }

            await task1;
            await new Promise(resolve => setTimeout(resolve, 10));

            // Now third task should execute on freed worker
            expect(mockWorkerInstances[0].postMessage).toHaveBeenCalledWith({ id: 3 });
        });
    });

    describe('WorkerPool termination', () => {
        it('should terminate all workers', async () => {
            const pool = new WorkerPool('/mock/worker.js', 3);
            await pool.initialize();

            await pool.terminate();

            expect(mockWorkerInstances[0].terminate).toHaveBeenCalled();
            expect(mockWorkerInstances[1].terminate).toHaveBeenCalled();
            expect(mockWorkerInstances[2].terminate).toHaveBeenCalled();
        });

        it('should clear workers array after termination', async () => {
            const pool = new WorkerPool('/mock/worker.js', 2);
            await pool.initialize();

            const statsBefore = pool.getStats();
            expect(statsBefore.total).toBe(2);

            await pool.terminate();

            const statsAfter = pool.getStats();
            expect(statsAfter.total).toBe(0);
            expect(statsAfter.busy).toBe(0);
            expect(statsAfter.queued).toBe(0);
        });
    });

    describe('WorkerPool stats', () => {
        it('should return correct pool statistics', async () => {
            const pool = new WorkerPool('/mock/worker.js', 3);
            await pool.initialize();

            const stats = pool.getStats();

            expect(stats).toEqual({
                total: 3,
                busy: 0,
                queued: 0,
            });
        });

        it('should track busy workers correctly', async () => {
            const pool = new WorkerPool('/mock/worker.js', 2);

            // Start a task
            pool.execute({ test: 'data' });
            await new Promise(resolve => setTimeout(resolve, 10));

            const stats = pool.getStats();

            expect(stats.busy).toBe(1);
            expect(stats.total).toBe(2);
        });
    });
});

describe('runWorker utility', () => {
    const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
    let mockWorkerInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockWorkerInstance = {
            on: jest.fn(),
            terminate: jest.fn().mockResolvedValue(undefined),
        };

        MockedWorker.mockImplementation((() => mockWorkerInstance) as any);
    });

    it('should create worker with workerData', () => {
        const testData = { test: 'data' };
        runWorker('/mock/worker.js', testData);

        expect(MockedWorker).toHaveBeenCalledWith('/mock/worker.js', {
            workerData: testData,
        });
    });

    it('should resolve with worker message result', async () => {
        const testData = { input: 'data' };
        const expectedResult = { output: 'result' };

        const resultPromise = runWorker('/mock/worker.js', testData);

        // Get the message handler
        const messageHandler = mockWorkerInstance.on.mock.calls.find(
            (call: any) => call[0] === 'message'
        )?.[1];

        // Simulate worker sending result
        if (messageHandler) {
            messageHandler(expectedResult);
        }

        const result = await resultPromise;

        expect(result).toEqual(expectedResult);
        expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it('should reject on worker error', async () => {
        const testData = { input: 'data' };
        const testError = new Error('Worker error');

        const resultPromise = runWorker('/mock/worker.js', testData);

        // Get the error handler
        const errorHandler = mockWorkerInstance.on.mock.calls.find(
            (call: any) => call[0] === 'error'
        )?.[1];

        // Simulate worker error
        if (errorHandler) {
            errorHandler(testError);
        }

        await expect(resultPromise).rejects.toThrow('Worker error');
        expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it('should reject on non-zero exit code', async () => {
        const testData = { input: 'data' };

        const resultPromise = runWorker('/mock/worker.js', testData);

        // Get the exit handler
        const exitHandler = mockWorkerInstance.on.mock.calls.find(
            (call: any) => call[0] === 'exit'
        )?.[1];

        // Simulate worker exit with non-zero code
        if (exitHandler) {
            exitHandler(1);
        }

        await expect(resultPromise).rejects.toThrow('Worker stopped with exit code 1');
    });

    it('should not reject on zero exit code', async () => {
        const testData = { input: 'data' };
        const expectedResult = { output: 'result' };

        const resultPromise = runWorker('/mock/worker.js', testData);

        // Get handlers
        const messageHandler = mockWorkerInstance.on.mock.calls.find(
            (call: any) => call[0] === 'message'
        )?.[1];
        const exitHandler = mockWorkerInstance.on.mock.calls.find(
            (call: any) => call[0] === 'exit'
        )?.[1];

        // Simulate successful completion
        if (messageHandler) {
            messageHandler(expectedResult);
        }
        if (exitHandler) {
            exitHandler(0);
        }

        const result = await resultPromise;
        expect(result).toEqual(expectedResult);
    });
});
