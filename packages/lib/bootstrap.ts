// Bootstrap - Initialize Task Funnel system on load
// Sets up CONFIG, DataManager, API provider, sync strip, and TF helpers

import { DataManager } from './data-manager';
import type { Task, LaneKind } from './data-manager';

// Initialize CONFIG with sensible defaults
if (!window.CONFIG) {
  window.CONFIG = {};
}
if (!window.CONFIG.backend) {
  window.CONFIG.backend = 'local';
}

// Instantiate DataManager
const dataManager = new DataManager();

// Expose to window for sync.js and other global access
window.dataManager = dataManager as any;

// Create API provider and attach to dataManager
window.dataManager.api = window.API.createProvider(window.dataManager);

// Initialize the API provider
await window.dataManager.api.init();

// Set up TF convenience helpers
window.TF = {
  listTasks: async () => {
    return await window.dataManager.api.listTasks();
  },
  saveTask: (task: Partial<Task>) => {
    const fullTask = task as Task;
    window.Sync.enqueue(
      { type: 'upsertTask', payload: fullTask },
      window.dataManager.api
    );
    return fullTask;
  },
  board: {
    _listTasksLocal: () => {
      return window.dataManager._listTasksLocal();
    },
    listByLane: (lane: LaneKind) => {
      return window.dataManager.listByLane(lane);
    },
    moveTask: (taskId: string, lane: LaneKind, newIndex: number) => {
      window.dataManager.moveWithinLane(taskId, lane, newIndex);
      window.Sync.enqueue(
        { type: 'moveTask', payload: { taskId, lane, newIndex } },
        window.dataManager.api
      );
    },
    promoteToThisWeek: (taskId: string) => {
      window.dataManager.promoteToThisWeek(taskId);
      window.Sync.enqueue(
        { type: 'promoteToThisWeek', payload: { taskId } },
        window.dataManager.api
      );
    },
    promoteToToday: (taskId: string) => {
      window.dataManager.promoteToToday(taskId);
      window.Sync.enqueue(
        { type: 'promoteToToday', payload: { taskId } },
        window.dataManager.api
      );
    },
    setStatus: (taskId: string, status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'done') => {
      window.dataManager.setStatus(taskId, status);
      window.Sync.enqueue(
        { type: 'setStatus', payload: { taskId, status } },
        window.dataManager.api
      );
    },
    getTaskCountsByDate: () => {
      return window.dataManager.getTaskCountsByDate();
    },
  },
};

// Initialize sync strip UI
if (typeof window.Sync !== 'undefined' && window.Sync.setStrip) {
  window.Sync.setStrip();
}

console.log('✓ Task Funnel bootstrap complete:', {
  backend: window.CONFIG.backend,
  tasks: dataManager._listTasksLocal().length,
  people: dataManager._listPeopleLocal().length,
  jobs: dataManager._listJobsLocal().length,
});
