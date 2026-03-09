/**
 * Worker Thread Pool Utility
 * 
 * Manages a pool of reusable worker threads for CPU-intensive tasks.
 * This avoids the overhead of creating new workers for each task.
 */

import { Worker } from 'worker_threads';
import path from 'path';

interface PooledWorker {
    worker: Worker;
    busy: boolean;
}

interface QueuedTask<T, R> {
    data: T;
    resolve: (value: R) => void;
    reject: (reason: Error) => void;
}

export class WorkerPool<TInput, TOutput> {
    private workers: PooledWorker[] = [];
    private taskQueue: QueuedTask<TInput, TOutput>[] = [];
    private workerPath: string;
    private poolSize: number;
    private initialized = false;

    constructor(workerPath: string, poolSize?: number) {
        this.workerPath = workerPath;
        this.poolSize = poolSize || require('os').cpus().length;
    }

    /**
     * Initialize the worker pool
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(this.workerPath);
            this.workers.push({ worker, busy: false });
        }

        this.initialized = true;
        console.log(`Worker pool initialized with ${this.poolSize} workers`);
    }

    /**
     * Execute a task using an available worker
     */
    async execute(data: TInput): Promise<TOutput> {
        if (!this.initialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const availableWorker = this.workers.find(w => !w.busy);

            if (availableWorker) {
                this.runTask(availableWorker, data, resolve, reject);
            } else {
                // Queue the task if no worker is available
                this.taskQueue.push({ data, resolve, reject });
            }
        });
    }

    /**
     * Run a task on a specific worker
     */
    private runTask(
        pooledWorker: PooledWorker,
        data: TInput,
        resolve: (value: TOutput) => void,
        reject: (reason: Error) => void
    ): void {
        pooledWorker.busy = true;

        const handleMessage = (result: TOutput) => {
            pooledWorker.worker.off('message', handleMessage);
            pooledWorker.worker.off('error', handleError);
            pooledWorker.busy = false;
            resolve(result);
            this.processNextTask(pooledWorker);
        };

        const handleError = (error: Error) => {
            pooledWorker.worker.off('message', handleMessage);
            pooledWorker.worker.off('error', handleError);
            pooledWorker.busy = false;
            reject(error);
            this.processNextTask(pooledWorker);
        };

        pooledWorker.worker.on('message', handleMessage);
        pooledWorker.worker.on('error', handleError);
        pooledWorker.worker.postMessage(data);
    }

    /**
     * Process the next queued task if available
     */
    private processNextTask(pooledWorker: PooledWorker): void {
        const nextTask = this.taskQueue.shift();
        if (nextTask) {
            this.runTask(pooledWorker, nextTask.data, nextTask.resolve, nextTask.reject);
        }
    }

    /**
     * Terminate all workers in the pool
     */
    async terminate(): Promise<void> {
        await Promise.all(
            this.workers.map(({ worker }) => worker.terminate())
        );
        this.workers = [];
        this.taskQueue = [];
        this.initialized = false;
        console.log('Worker pool terminated');
    }

    /**
     * Get pool statistics
     */
    getStats(): { total: number; busy: number; queued: number } {
        return {
            total: this.workers.length,
            busy: this.workers.filter(w => w.busy).length,
            queued: this.taskQueue.length,
        };
    }
}

/**
 * Create a simple one-off worker execution
 * Use this for single tasks where a pool isn't needed
 */
export function runWorker<TInput, TOutput>(
    workerPath: string,
    data: TInput
): Promise<TOutput> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, { workerData: data });

        worker.on('message', (result: TOutput) => {
            resolve(result);
            worker.terminate();
        });

        worker.on('error', (error) => {
            reject(error);
            worker.terminate();
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}
