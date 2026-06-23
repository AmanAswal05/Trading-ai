/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { isSupabaseConfigured } from './db';

export interface JobStatus {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number; // 0 to 100
  recordsProcessed: number;
  totalRecords: number;
  recordsVerified: number;
  databaseWrites: number; // successfulWrites
  failedWrites?: number;
  skippedRows?: number;
  successRate: number;
  executionTime: number; // in ms
  startedAt: string;
  estimatedTimeRemaining: number; // in seconds
  error?: string;
  failures: string[];
}

const getMockJobsPath = () => {
  if (typeof window !== 'undefined') return '';
  const path = require('path');
  return path.join(process.cwd(), 'lib', 'mock-jobs-db.json');
};

const readMockJobs = (): Record<string, JobStatus> => {
  if (typeof window !== 'undefined') return {};
  const fs = require('fs');
  const dbPath = getMockJobsPath();
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(data) || {};
    }
  } catch (err) {
    console.error('Error reading mock jobs DB:', err);
  }
  return {};
};

const writeMockJobs = (data: Record<string, JobStatus>): boolean => {
  if (typeof window !== 'undefined') return false;
  const fs = require('fs');
  const dbPath = getMockJobsPath();
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing mock jobs DB:', err);
    return false;
  }
};

// Fallback in-memory cache
const inMemoryJobs: Record<string, JobStatus> = {};

export const JobsDbService = {
  async createJob(id: string, totalRecords: number): Promise<JobStatus> {
    const job: JobStatus = {
      id,
      status: 'QUEUED',
      progress: 0,
      recordsProcessed: 0,
      totalRecords,
      recordsVerified: 0,
      databaseWrites: 0,
      successRate: 0,
      executionTime: 0,
      startedAt: new Date().toISOString(),
      estimatedTimeRemaining: 0,
      failures: [],
    };

    inMemoryJobs[id] = job;
    const db = readMockJobs();
    db[id] = job;
    writeMockJobs(db);

    return job;
  },

  async updateJobProgress(id: string, updates: Partial<JobStatus>): Promise<JobStatus> {
    const db = readMockJobs();
    const current = db[id] || inMemoryJobs[id];

    if (!current) {
      throw new Error(`Job with ID ${id} not found.`);
    }

    const updatedJob: JobStatus = {
      ...current,
      ...updates,
      id,
    };

    // Calculate execution time dynamically
    const elapsedMs = Date.now() - new Date(updatedJob.startedAt).getTime();
    updatedJob.executionTime = elapsedMs;

    if (updatedJob.status === 'RUNNING') {
      // Estimate time remaining
      if (updatedJob.progress > 0 && updatedJob.progress < 100) {
        const timePerPercent = elapsedMs / updatedJob.progress;
        const remainingPercent = 100 - updatedJob.progress;
        updatedJob.estimatedTimeRemaining = Math.max(0, Math.round((timePerPercent * remainingPercent) / 1000));
      }
    } else if (updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED' || updatedJob.status === 'CANCELLED') {
      updatedJob.estimatedTimeRemaining = 0;
    }

    inMemoryJobs[id] = updatedJob;
    db[id] = updatedJob;
    writeMockJobs(db);

    return updatedJob;
  },

  async getJobStatus(id: string): Promise<JobStatus | null> {
    const db = readMockJobs();
    const job = db[id] || inMemoryJobs[id];
    return job || null;
  },

  async cancelJob(id: string): Promise<JobStatus | null> {
    const db = readMockJobs();
    const current = db[id] || inMemoryJobs[id];

    if (!current) return null;

    const cancelledJob: JobStatus = {
      ...current,
      status: 'CANCELLED',
      estimatedTimeRemaining: 0,
    };

    inMemoryJobs[id] = cancelledJob;
    db[id] = cancelledJob;
    writeMockJobs(db);

    return cancelledJob;
  },
};
