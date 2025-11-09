import { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';

interface Task {
  id: string;
  title: string;
  status?: string;
  assignee_id?: string | null;
  lane?: string;
  priority?: number;
}

interface TaskCardProps {
  task: Task;
  onMove: (taskId: string, direction: 'left' | 'right') => void;
  onReorder: (taskId: string, direction: 'up' | 'down') => void;
  onPromoteToThisWeek: (taskId: string) => void;
  onPromoteToToday: (taskId: string) => void;
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function TaskCard({
  task,
  onMove,
  onReorder,
  onPromoteToThisWeek,
  onPromoteToToday,
  onStart,
  onComplete,
  isDragging,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.shiftKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      onMove(task.id, 'left');
    } else if (e.shiftKey && e.key === 'ArrowRight') {
      e.preventDefault();
      onMove(task.id, 'right');
    } else if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      onReorder(task.id, 'up');
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      onReorder(task.id, 'down');
    }
  };

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`
        bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-2
        cursor-move shadow-sm hover:shadow-md transition-shadow
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowActions(!showActions);
      }}
      onClick={() => setShowActions(!showActions)}
    >
      <div className="font-medium text-gray-800 text-sm mb-1">{task.title}</div>
      <div className="text-xs text-gray-600 flex gap-2">
        {task.status && <span className="bg-gray-200 px-1 rounded">{task.status}</span>}
        {task.priority && <span className="bg-blue-200 px-1 rounded">P{task.priority}</span>}
      </div>

      {showActions && (
        <div className="mt-2 pt-2 border-t border-yellow-400 space-y-1">
          {task.lane !== 'this_week' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPromoteToThisWeek(task.id);
                setShowActions(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 bg-white hover:bg-gray-100 rounded"
            >
              → This Week
            </button>
          )}
          {(task.lane === 'backlog' || task.lane === 'this_week') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPromoteToToday(task.id);
                setShowActions(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 bg-white hover:bg-gray-100 rounded"
            >
              → Today
            </button>
          )}
          {task.status !== 'in_progress' && task.lane !== 'in_progress' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(task.id);
                setShowActions(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 bg-green-100 hover:bg-green-200 rounded"
            >
              ▶ Start
            </button>
          )}
          {task.status !== 'done' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task.id);
                setShowActions(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded"
            >
              ✓ Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
