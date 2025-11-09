// DataManager - Local storage implementation for Task Funnel
// Provides persistent storage using localStorage with minimal seed data

export type LaneKind = 'backlog' | 'this_week' | 'today' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  job_id?: string | null;
  assignee_id?: string | null;
  start_at?: string | null;
  due_at?: string | null;
  priority?: number;
  status?: string;
  notes?: string;
  required_proof?: string;
  location?: string;
  depends_on_ids?: string[];
  subtasks?: any[];
  media?: any[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  lane?: LaneKind;
  order_index?: number;
}

export interface Person {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface Job {
  id: string;
  title: string;
  client_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface DataManagerOptions {
  storageKeyPrefix?: string;
}

export class DataManager {
  private prefix: string;

  constructor(options: DataManagerOptions = {}) {
    this.prefix = options.storageKeyPrefix || 'tf';
    this._initializeSeeds();
  }

  private _initializeSeeds(): void {
    // Initialize with seed data if empty
    if (!localStorage.getItem(`${this.prefix}.tasks`)) {
      const seedTasks: Task[] = [
        {
          id: 'task-1',
          title: 'Set up initial meeting',
          job_id: 'job-1',
          assignee_id: 'crew-1',
          status: 'new',
          priority: 1,
          lane: 'this_week',
          order_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'task-2',
          title: 'Review project requirements',
          job_id: 'job-1',
          assignee_id: 'crew-2',
          status: 'in_progress',
          priority: 2,
          lane: 'in_progress',
          order_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'task-3',
          title: 'Plan next sprint',
          status: 'new',
          priority: 3,
          lane: 'backlog',
          order_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'task-4',
          title: 'Update documentation',
          status: 'new',
          priority: 1,
          lane: 'today',
          order_index: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(`${this.prefix}.tasks`, JSON.stringify(seedTasks));
    } else {
      // Migrate existing tasks to have lanes if missing
      const tasks = this._listTasksLocal();
      let needsUpdate = false;
      tasks.forEach(task => {
        if (!task.lane) {
          // Assign default lane based on status
          if (task.status === 'done') task.lane = 'done';
          else if (task.status === 'in-progress' || task.status === 'in_progress') task.lane = 'in_progress';
          else task.lane = 'backlog';
          needsUpdate = true;
        }
        if (task.order_index === undefined) {
          task.order_index = 0;
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        localStorage.setItem(`${this.prefix}.tasks`, JSON.stringify(tasks));
      }
    }

    if (!localStorage.getItem(`${this.prefix}.people`)) {
      const seedPeople: Person[] = [
        {
          id: 'lead-1',
          name: 'Lead Manager',
          role: 'lead',
          email: 'lead@example.com',
        },
        {
          id: 'crew-1',
          name: 'Crew Member 1',
          role: 'crew',
          email: 'crew1@example.com',
        },
        {
          id: 'crew-2',
          name: 'Crew Member 2',
          role: 'crew',
          email: 'crew2@example.com',
        },
      ];
      localStorage.setItem(`${this.prefix}.people`, JSON.stringify(seedPeople));
    }

    if (!localStorage.getItem(`${this.prefix}.jobs`)) {
      const seedJobs: Job[] = [
        {
          id: 'job-1',
          title: 'Demo Project',
          client_name: 'Sample Client',
          status: 'active',
          start_date: new Date().toISOString(),
        },
      ];
      localStorage.setItem(`${this.prefix}.jobs`, JSON.stringify(seedJobs));
    }
  }

  _listTasksLocal(): Task[] {
    const data = localStorage.getItem(`${this.prefix}.tasks`);
    return data ? JSON.parse(data) : [];
  }

  _upsertTaskLocal(task: Task): Task {
    const tasks = this._listTasksLocal();
    const now = new Date().toISOString();

    // Generate ID if missing
    if (!task.id) {
      task.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set timestamps
    if (!task.created_at) {
      task.created_at = now;
    }
    task.updated_at = now;

    // Find and update or append
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
      tasks[index] = { ...tasks[index], ...task };
    } else {
      tasks.push(task);
    }

    localStorage.setItem(`${this.prefix}.tasks`, JSON.stringify(tasks));
    return task;
  }

  _bulkUpsertLocal(tasks: Task[]): { count: number } {
    tasks.forEach(task => this._upsertTaskLocal(task));
    return { count: tasks.length };
  }

  _listPeopleLocal(): Person[] {
    const data = localStorage.getItem(`${this.prefix}.people`);
    return data ? JSON.parse(data) : [];
  }

  _listJobsLocal(): Job[] {
    const data = localStorage.getItem(`${this.prefix}.jobs`);
    return data ? JSON.parse(data) : [];
  }

  // Lane-based methods
  listByLane(lane: LaneKind): Task[] {
    const tasks = this._listTasksLocal().filter(t => t.lane === lane);
    // Sort by order_index first, then by created_at
    return tasks.sort((a, b) => {
      const orderDiff = (a.order_index || 0) - (b.order_index || 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
  }

  moveWithinLane(taskId: string, lane: LaneKind, newIndex: number): void {
    const tasks = this._listTasksLocal();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update lane and order_index
    task.lane = lane;
    task.order_index = newIndex;
    task.updated_at = new Date().toISOString();

    // Reindex other tasks in the same lane
    const laneTasks = tasks.filter(t => t.lane === lane && t.id !== taskId);
    laneTasks.forEach((t, idx) => {
      t.order_index = idx >= newIndex ? idx + 1 : idx;
    });

    localStorage.setItem(`${this.prefix}.tasks`, JSON.stringify(tasks));
    this._recordEvent('task.moved', { taskId, lane, newIndex });
  }

  promoteToThisWeek(taskId: string): void {
    const task = this._listTasksLocal().find(t => t.id === taskId);
    if (!task) return;
    
    const thisWeekTasks = this.listByLane('this_week');
    this.moveWithinLane(taskId, 'this_week', thisWeekTasks.length);
    this._recordEvent('task.promoted', { taskId, lane: 'this_week' });
  }

  promoteToToday(taskId: string): void {
    const task = this._listTasksLocal().find(t => t.id === taskId);
    if (!task) return;
    
    const todayTasks = this.listByLane('today');
    this.moveWithinLane(taskId, 'today', todayTasks.length);
    this._recordEvent('task.promoted', { taskId, lane: 'today' });
  }

  setStatus(taskId: string, status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'done'): void {
    const tasks = this._listTasksLocal();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = status;
    task.updated_at = new Date().toISOString();

    // Auto-move to appropriate lane based on status
    if (status === 'in_progress' && task.lane !== 'in_progress') {
      task.lane = 'in_progress';
      task.order_index = this.listByLane('in_progress').length;
    } else if (status === 'done' && task.lane !== 'done') {
      task.lane = 'done';
      task.order_index = this.listByLane('done').length;
    }

    localStorage.setItem(`${this.prefix}.tasks`, JSON.stringify(tasks));
    this._recordEvent('task.status_changed', { taskId, status, lane: task.lane });
  }

  private _recordEvent(type: string, payload: any): void {
    const events = this._getEvents();
    const event = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      task_id: payload.taskId,
      type,
      payload,
      ts: new Date().toISOString(),
    };
    events.push(event);
    localStorage.setItem(`${this.prefix}.events`, JSON.stringify(events));
    console.debug('[DataManager] Event recorded:', event);
  }

  private _getEvents(): any[] {
    const data = localStorage.getItem(`${this.prefix}.events`);
    return data ? JSON.parse(data) : [];
  }

  // Query helpers for views
  listByDueDate(date: string): Task[] {
    // date should be in YYYY-MM-DD format
    const tasks = this._listTasksLocal();
    return tasks.filter(t => {
      if (!t.due_at) return false;
      const taskDate = new Date(t.due_at).toISOString().split('T')[0];
      return taskDate === date;
    });
  }

  listByAssignee(assigneeId: string): Task[] {
    return this._listTasksLocal().filter(t => t.assignee_id === assigneeId);
  }

  listByDateRange(startDate: string, endDate: string): Task[] {
    const tasks = this._listTasksLocal();
    return tasks.filter(t => {
      if (!t.due_at) return false;
      const taskDate = new Date(t.due_at).toISOString().split('T')[0];
      return taskDate >= startDate && taskDate <= endDate;
    });
  }

  getTaskCountsByDate(): Record<string, number> {
    const tasks = this._listTasksLocal();
    const counts: Record<string, number> = {};
    
    tasks.forEach(t => {
      if (t.due_at) {
        const date = new Date(t.due_at).toISOString().split('T')[0];
        counts[date] = (counts[date] || 0) + 1;
      }
    });
    
    return counts;
  }
}

// Export singleton instance for browser use
if (typeof window !== 'undefined') {
  (window as any).dataManager = new DataManager();
}
