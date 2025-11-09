import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  due_at?: string | null;
  status?: string;
  lane?: string;
  notes?: string;
}

export function CrewView() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTodaysTasks = () => {
    if (window.TF?.board) {
      const allTasks = window.TF.board._listTasksLocal();
      const today = new Date().toISOString().split('T')[0];
      
      // Filter for today's tasks or tasks in 'today' lane
      const todayTasks = allTasks.filter((t: Task) => {
        if (t.lane === 'today') return true;
        if (t.due_at) {
          const taskDate = new Date(t.due_at).toISOString().split('T')[0];
          return taskDate === today;
        }
        return false;
      });
      
      setTasks(todayTasks);
    }
  };

  useEffect(() => {
    loadTodaysTasks();
    
    const handleStorage = () => loadTodaysTasks();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleToggleComplete = (task: Task) => {
    if (!window.TF?.board) return;

    const newStatus = task.status === 'done' ? 'in_progress' : 'done';
    window.TF.board.setStatus(task.id, newStatus);
    loadTodaysTasks();
  };

  const handleAddPhoto = (taskId: string) => {
    console.log('photo added for task:', taskId);
    // Future: implement photo upload
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4 sticky top-0 z-10">
        <h2 className="text-xl font-bold">Today's Tasks</h2>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Task List */}
      <div className="px-4 py-4 space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No tasks for today</p>
            <p className="text-sm mt-2">You're all caught up! 🎉</p>
          </div>
        ) : (
          tasks.map((task) => {
            const isDone = task.status === 'done';
            
            return (
              <div
                key={task.id}
                className={`bg-gray-800 rounded-lg p-4 border-2 transition-all ${
                  isDone
                    ? 'border-green-600 bg-gray-800/50'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {/* Task header with checkbox */}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 transition-colors ${
                      isDone
                        ? 'bg-green-600 border-green-600'
                        : 'border-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {isDone && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1">
                    <h3
                      className={`font-semibold text-lg ${
                        isDone ? 'line-through text-gray-500' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </h3>
                    
                    {task.notes && (
                      <p className="text-sm text-gray-400 mt-1">{task.notes}</p>
                    )}

                    {/* Status badge */}
                    {task.status && (
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs mt-2 ${
                          isDone
                            ? 'bg-green-900 text-green-300'
                            : 'bg-blue-900 text-blue-300'
                        }`}
                      >
                        {task.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                {!isDone && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <button
                      onClick={() => handleAddPhoto(task.id)}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium"
                    >
                      📷 Add Photo
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
