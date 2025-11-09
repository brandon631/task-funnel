import { useState, useEffect } from 'react';
import { Board } from '../board/Board';

export function AdminView() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskCountsByDate, setTaskCountsByDate] = useState<Record<string, number>>({});

  const loadCalendarData = () => {
    if (window.TF?.board) {
      const counts = window.TF.board.getTaskCountsByDate();
      setTaskCountsByDate(counts);
    }
  };

  useEffect(() => {
    loadCalendarData();
    
    const handleStorage = () => loadCalendarData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const createDemoTask = () => {
    if (window.TF && newTaskTitle.trim()) {
      window.TF.saveTask({
        title: newTaskTitle,
        status: 'new',
        lane: 'backlog',
      });
      setNewTaskTitle('');
      setShowCreateForm(false);
      loadCalendarData();
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Get current week days
  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + diff + i);
      days.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toISOString().split('T')[0],
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Calendar Preview Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">This Week's Tasks</h3>
        <div className="flex gap-2">
          {weekDays.map((day) => {
            const count = taskCountsByDate[day.date] || 0;
            const isToday = day.date === new Date().toISOString().split('T')[0];
            
            return (
              <div
                key={day.date}
                className={`flex-1 text-center p-2 rounded ${
                  isToday ? 'bg-blue-900 border border-blue-600' : 'bg-gray-700'
                }`}
              >
                <div className="text-xs text-gray-400">{day.name}</div>
                <div className={`text-lg font-bold ${count > 0 ? 'text-white' : 'text-gray-500'}`}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Task Button */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">Task Board</h2>
        
        <div className="flex items-center gap-3">
          {showCreateForm ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createDemoTask()}
                placeholder="Task title..."
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={createDemoTask}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTaskTitle('');
                }}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              + New Task
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <Board />

      {/* Keyboard shortcuts */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
        <div>Keyboard: Shift+← → to move lanes</div>
        <div>Alt+↑ ↓ to reorder in lane</div>
      </div>
    </div>
  );
}
