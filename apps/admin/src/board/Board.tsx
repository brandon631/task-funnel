import { useState, useEffect } from 'react';
import { Lane } from './Lane';

interface Task {
  id: string;
  title: string;
  status?: string;
  assignee_id?: string | null;
  lane?: string;
  priority?: number;
}

type LaneKind = 'backlog' | 'this_week' | 'today' | 'in_progress' | 'done';

const LANES: { id: LaneKind; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'this_week', title: 'This Week' },
  { id: 'today', title: 'Today' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export function Board() {
  const [laneData, setLaneData] = useState<Record<LaneKind, Task[]>>({
    backlog: [],
    this_week: [],
    today: [],
    in_progress: [],
    done: [],
  });

  const loadTasks = () => {
    if (window.TF?.board) {
      const newData: Record<LaneKind, Task[]> = {
        backlog: [],
        this_week: [],
        today: [],
        in_progress: [],
        done: [],
      };
      
      LANES.forEach(({ id }) => {
        newData[id] = window.TF.board.listByLane(id);
      });
      
      setLaneData(newData);
    }
  };

  useEffect(() => {
    loadTasks();
    
    // Refresh on storage changes (for multi-tab sync)
    const handleStorage = () => loadTasks();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleDrop = (taskId: string, targetLane: string, index: number) => {
    if (window.TF?.board) {
      window.TF.board.moveTask(taskId, targetLane as LaneKind, index);
      loadTasks();
    }
  };

  const handleMove = (taskId: string, direction: 'left' | 'right') => {
    const task = Object.values(laneData)
      .flat()
      .find((t) => t.id === taskId);
    if (!task || !window.TF?.board) return;

    const currentLaneIndex = LANES.findIndex((l) => l.id === task.lane);
    if (currentLaneIndex === -1) return;

    const newIndex =
      direction === 'left' ? currentLaneIndex - 1 : currentLaneIndex + 1;
    if (newIndex < 0 || newIndex >= LANES.length) return;

    const newLane = LANES[newIndex].id;
    const newLaneTasks = laneData[newLane] || [];
    window.TF.board.moveTask(taskId, newLane, newLaneTasks.length);
    loadTasks();
  };

  const handleReorder = (taskId: string, direction: 'up' | 'down') => {
    const task = Object.values(laneData)
      .flat()
      .find((t) => t.id === taskId);
    if (!task || !window.TF?.board) return;

    const currentLane = task.lane as LaneKind;
    const laneTasks = laneData[currentLane] || [];
    const currentIndex = laneTasks.findIndex((t) => t.id === taskId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= laneTasks.length) return;

    window.TF.board.moveTask(taskId, currentLane, newIndex);
    loadTasks();
  };

  const handlePromoteToThisWeek = (taskId: string) => {
    if (window.TF?.board) {
      window.TF.board.promoteToThisWeek(taskId);
      loadTasks();
    }
  };

  const handlePromoteToToday = (taskId: string) => {
    if (window.TF?.board) {
      window.TF.board.promoteToToday(taskId);
      loadTasks();
    }
  };

  const handleStart = (taskId: string) => {
    if (window.TF?.board) {
      window.TF.board.setStatus(taskId, 'in_progress');
      loadTasks();
    }
  };

  const handleComplete = (taskId: string) => {
    if (window.TF?.board) {
      window.TF.board.setStatus(taskId, 'done');
      loadTasks();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
      {LANES.map((lane) => (
        <Lane
          key={lane.id}
          title={lane.title}
          laneId={lane.id}
          tasks={laneData[lane.id]}
          onDrop={handleDrop}
          onMove={handleMove}
          onReorder={handleReorder}
          onPromoteToThisWeek={handlePromoteToThisWeek}
          onPromoteToToday={handlePromoteToToday}
          onStart={handleStart}
          onComplete={handleComplete}
        />
      ))}
    </div>
  );
}
