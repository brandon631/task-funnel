import { useState, useEffect } from 'react'
import './App.css'
import { AdminView } from './views/AdminView'
import { LeadView } from './views/LeadView'
import { CrewView } from './views/CrewView'

type Role = 'admin' | 'lead' | 'crew';

function App() {
  const [currentRole, setCurrentRole] = useState<Role>('admin');

  // Initialize CONFIG.role
  useEffect(() => {
    if (!window.CONFIG) {
      window.CONFIG = {};
    }
    window.CONFIG.role = currentRole;
  }, [currentRole]);

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as Role; // Remove #
      if (hash === 'admin' || hash === 'lead' || hash === 'crew') {
        setCurrentRole(hash);
      } else {
        // Default to admin
        window.location.hash = '#admin';
        setCurrentRole('admin');
      }
    };

    // Set initial route
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleRoleChange = (role: Role) => {
    window.location.hash = `#${role}`;
    setCurrentRole(role);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Global Header with Role Selector */}
      <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-blue-400">Task Funnel</h1>
          <div className="text-xs text-gray-500">
            Local Storage + Sync
          </div>
        </div>

        {/* Role Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">View as:</span>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => handleRoleChange('admin')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                currentRole === 'admin'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => handleRoleChange('lead')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                currentRole === 'lead'
                  ? 'bg-green-600 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Lead
            </button>
            <button
              onClick={() => handleRoleChange('crew')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                currentRole === 'crew'
                  ? 'bg-purple-600 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Crew
            </button>
          </div>
        </div>
      </div>

      {/* Sync Strip */}
      <div id="sync-strip"></div>

      {/* Route to appropriate view */}
      {currentRole === 'admin' && <AdminView />}
      {currentRole === 'lead' && <LeadView />}
      {currentRole === 'crew' && <CrewView />}
    </div>
  )
}

export default App
