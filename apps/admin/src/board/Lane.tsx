import { useState } from 'react';
import { TaskCard } from './TaskCard';

interface Task {
  id: string;
  title: string;
  status?: string;
  assignee_id?: string | null;
  lane?: string;
  priority?: number;
}

interface LaneProps {
  title: string;
  laneId: string;
  tasks: Task[];
  onDrop: (taskId: string, laneId: string, index: number) => void;
  onMove: (taskId: string, direction: 'left' | 'right') => void;
  onReorder: (taskId: string, direction: 'up' | 'down') => void;
  onPromoteToThisWeek: (taskId: string) => void;
  onPromoteToToday: (taskId: string) => void;
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

export function Lane({
  title,
  laneId,
  tasks,
  onDrop,
  onMove,
  onReorder,
  onPromoteToThisWeek,
  onPromoteToToday,
  onStart,
  onComplete,
}: LaneProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    onDrop(taskId, laneId, index);
    setDragOverIndex(null);
    setDraggingTaskId(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 min-h-[500px] flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => handleDrop(e, tasks.length)}
      onDragLeave={handleDragLeave}
      aria-label={`${title} lane`}
    >
      <div className="mb-3 pb-2 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="text-sm text-gray-400">{tasks.length} tasks</div>
      </div>

      <div className="flex-1 space-y-1">
        {tasks.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            No tasks yet
          </div>
        ) : (
          tasks.map((task, index) => (
            <div key={task.id}>
              {dragOverIndex === index && draggingTaskId !== task.id && (
                <div className="h-2 bg-blue-500 rounded mb-2 opacity-50" />
              )}
              <div
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                <TaskCard
                  task={task}
                  onMove={onMove}
                  onReorder={onReorder}
                  onPromoteToThisWeek={onPromoteToThisWeek}
                  onPromoteToToday={onPromoteToToday}
                  onStart={onStart}
                  onComplete={onComplete}
                  isDragging={draggingTaskId === task.id}
                  onDragStart={() => setDraggingTaskId(task.id)}
                  onDragEnd={() => setDraggingTaskId(null)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
