import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  due_at?: string | null;
  assignee_id?: string | null;
  status?: string;
  lane?: string;
}

interface Person {
  id: string;
  name: string;
  role?: string;
}

export function LeadView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedCrew, setSelectedCrew] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const loadData = () => {
    if (window.TF?.board) {
      const allTasks = window.TF.board._listTasksLocal();
      setTasks(allTasks);
    }
    if (window.dataManager) {
      const crew = window.dataManager._listPeopleLocal().filter((p: Person) => p.role === 'crew');
      setPeople(crew);
    }
  };

  useEffect(() => {
    loadData();
    
    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Get current week days
  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + diff + i);
      days.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toISOString().split('T')[0],
        fullDate: date,
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  const getTasksForCrewAndDay = (crewId: string, date: string): Task[] => {
    return tasks.filter((t) => {
      if (t.assignee_id !== crewId) return false;
      if (!t.due_at) return false;
      const taskDate = new Date(t.due_at).toISOString().split('T')[0];
      return taskDate === date;
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    if (!draggedTask || !window.TF) return;

    const task = tasks.find((t) => t.id === draggedTask);
    if (!task) return;

    // Update due_at to the new date
    window.TF.saveTask({
      id: task.id,
      title: task.title,
      assignee_id: task.assignee_id,
      status: task.status,
      due_at: new Date(date).toISOString(),
    });

    setDraggedTask(null);
    loadData();
  };

  const handleAssignTask = () => {
    if (!window.TF || !newTaskTitle.trim() || !selectedCrew || !selectedDate) return;

    window.TF.saveTask({
      title: newTaskTitle,
      assignee_id: selectedCrew,
      due_at: new Date(selectedDate).toISOString(),
      status: 'assigned',
      lane: 'this_week',
    });

    setNewTaskTitle('');
    setSelectedCrew('');
    setSelectedDate('');
    setShowAssignForm(false);
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">Weekly Planner</h2>
        
        <button
          onClick={() => setShowAssignForm(!showAssignForm)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
        >
          + Assign Task
        </button>
      </div>

      {/* Assign Task Form */}
      {showAssignForm && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Task Title</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Crew Member</label>
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select crew...</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Due Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleAssignTask}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
            >
              Assign
            </button>
            <button
              onClick={() => setShowAssignForm(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Weekly Grid */}
      <div className="p-4 overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row with days */}
          <div className="flex mb-2">
            <div className="w-32 flex-shrink-0"></div>
            {weekDays.map((day) => {
              const isToday = day.date === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={day.date}
                  className={`flex-1 min-w-[140px] text-center p-2 rounded ${
                    isToday ? 'bg-blue-900 border border-blue-600' : 'bg-gray-800'
                  } mr-2`}
                >
                  <div className="text-xs text-gray-400">{day.name}</div>
                  <div className="text-xs text-gray-500">
                    {day.fullDate.getMonth() + 1}/{day.fullDate.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Crew rows */}
          {people.map((crew) => (
            <div key={crew.id} className="flex mb-2">
              <div className="w-32 flex-shrink-0 pr-2 py-2 font-semibold text-sm text-gray-300">
                {crew.name}
              </div>
              {weekDays.map((day) => {
                const dayTasks = getTasksForCrewAndDay(crew.id, day.date);
                return (
                  <div
                    key={day.date}
                    className="flex-1 min-w-[140px] min-h-[100px] bg-gray-800 rounded p-2 mr-2"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day.date)}
                  >
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="bg-gray-700 rounded p-2 mb-2 text-xs cursor-move hover:bg-gray-600 border border-gray-600"
                      >
                        <div className="font-medium">{task.title}</div>
                        {task.status && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            {task.status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
        <div>Drag tasks between days to reschedule</div>
      </div>
    </div>
  );
}
