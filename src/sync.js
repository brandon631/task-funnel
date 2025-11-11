// Sync Queue Manager for Optimistic Updates
// Handles online/offline state, queueing, and retry logic

(function(global){
  
  // Internal sync state
  const state = {
    online: navigator.onLine,
    queue: [],
    processing: false,
    lastError: null
  };

  /**
   * Update the sync status strip UI
   */
  function setStrip(){
    const strip = document.getElementById('sync-strip');
    if(!strip) return;
    
    // Show the strip
    strip.style.display = 'flex';
    
    // Clear old state classes
    strip.classList.remove('sync-online', 'sync-offline', 'sync-error');
    
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const queueCount = document.getElementById('sync-queue-count');
    
    // Apply appropriate state class
    if(state.lastError) {
      strip.classList.add('sync-error');
      const errorMsg = state.lastError?.message || state.lastError || 'Unknown error';
      const truncated = errorMsg.length > 40 ? errorMsg.substring(0, 40) + '...' : errorMsg;
      text.textContent = `SYNC: error - ${truncated}`;
    } else {
      strip.classList.add(state.online ? 'sync-online' : 'sync-offline');
      text.textContent = `SYNC: ${state.online ? 'online' : 'offline'}`;
    }
    
    // Show queue count if non-empty
    queueCount.textContent = state.queue.length ? `queue: ${state.queue.length}` : '';
  }

  /**
   * Process queued jobs when online
   * Drains queue one by one, stops on error
   */
  async function drain(api){
    if(state.processing) return;
    if(!state.online) return;
    
    state.processing = true;
    
    try {
      while(state.queue.length && state.online){
        const job = state.queue[0];
        
        try {
          // Execute the queued operation
          if(job.type === 'upsertTask'){ 
            await api.upsertTask(job.payload); 
          } else if(job.type === 'bulkUpsert'){ 
            await api.bulkUpsert(job.payload); 
          }
          
          // Success - remove from queue and clear error
          state.queue.shift();
          state.lastError = null;
          
        } catch(e) {
          // Error - stop processing and record error
          console.error('Sync error:', e);
          state.lastError = e;
          break;
        }
        
        // Update UI after each job
        setStrip();
      }
    } finally {
      state.processing = false;
    }
  }

  /**
   * Add a job to the queue and attempt to drain
   */
  function enqueue(job, api){
    state.queue.push(job);
    setStrip();
    
    // Attempt to drain immediately if online
    if(state.online && api) {
      drain(api);
    }
  }

  /**
   * Network event listeners
   */
  window.addEventListener('online', () => { 
    state.online = true;
    state.lastError = null; 
    setStrip();
    
    // Attempt to drain queue when back online
    if (typeof dataManager !== 'undefined' && dataManager.api && state.queue.length > 0) {
      drain(dataManager.api);
    }
  });
  
  window.addEventListener('offline', () => { 
    state.online = false; 
    setStrip(); 
  });

  // Expose sync API to global scope
  global.Sync = { 
    enqueue, 
    setStrip, 
    drain, 
    state 
  };

})(window);
