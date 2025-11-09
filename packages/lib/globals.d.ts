// Global type definitions for Task Funnel
// Extends window object with runtime globals from api.js, sync.js, and bootstrap

import type { Task, LaneKind } from './data-manager';

declare global {
  interface Window {
    CONFIG: {
      backend?: 'local' | 'supabase';
      role?: 'admin' | 'lead' | 'crew';
      supabase?: {
        url?: string;
        anonKey?: string;
      };
    };

    API: {
      createProvider(dataManager: any): {
        init(): Promise<{ ok: boolean; error?: string }>;
        listTasks(): Promise<Task[]>;
        upsertTask(task: Task): Promise<Task>;
        bulkUpsert(tasks: Task[]): Promise<{ count: number }>;
        listPeople(): Promise<any[]>;
        listJobs(): Promise<any[]>;
        listByLane(lane: LaneKind): Promise<Task[]>;
        moveTask(taskId: string, lane: LaneKind, newIndex: number): Promise<void>;
        promoteToThisWeek(taskId: string): Promise<void>;
        promoteToToday(taskId: string): Promise<void>;
        setStatus(taskId: string, status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'done'): Promise<void>;
      };
    };

    Sync: {
      enqueue(job: { type: string; payload: any }, api?: any): void;
      setStrip(): void;
      drain(api: any): Promise<void>;
      state: {
        online: boolean;
        queue: any[];
        processing: boolean;
        lastError: any;
      };
    };

    dataManager: {
      _listTasksLocal(): Task[];
      _upsertTaskLocal(task: Task): Task;
      _bulkUpsertLocal(tasks: Task[]): { count: number };
      _listPeopleLocal(): any[];
      _listJobsLocal(): any[];
      listByLane(lane: LaneKind): Task[];
      moveWithinLane(taskId: string, lane: LaneKind, newIndex: number): void;
      promoteToThisWeek(taskId: string): void;
      promoteToToday(taskId: string): void;
      setStatus(taskId: string, status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'done'): void;
      listByDueDate(date: string): Task[];
      listByAssignee(assigneeId: string): Task[];
      listByDateRange(startDate: string, endDate: string): Task[];
      getTaskCountsByDate(): Record<string, number>;
      api?: any;
    };

    TF: {
      listTasks(): Promise<Task[]>;
      saveTask(task: Partial<Task>): Task;
      board: {
        _listTasksLocal(): Task[];
        listByLane(lane: LaneKind): Task[];
        moveTask(taskId: string, lane: LaneKind, newIndex: number): void;
        promoteToThisWeek(taskId: string): void;
        promoteToToday(taskId: string): void;
        setStatus(taskId: string, status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'done'): void;
        getTaskCountsByDate(): Record<string, number>;
      };
    };
  }
}

export {};
