// API Provider Layer for Task Funnel System
// Minimal wrapper to support both local storage and Supabase backends

(function(global){
  const CONFIG = (global.CONFIG = global.CONFIG || {});

  /**
   * LocalProvider - Uses existing localStorage behavior
   * Delegates to DataManager's internal local methods
   */
  class LocalProvider {
    constructor(dataManager){ 
      this.dm = dataManager; 
    }
    
    async init(){ 
      return { ok: true }; 
    }
    
    async listTasks(){ 
      return this.dm._listTasksLocal(); 
    }
    
    async upsertTask(task){ 
      return this.dm._upsertTaskLocal(task); 
    }
    
    async bulkUpsert(tasks){ 
      return this.dm._bulkUpsertLocal(tasks); 
    }
    
    async listPeople(){ 
      return this.dm._listPeopleLocal(); 
    }
    
    async listJobs(){ 
      return this.dm._listJobsLocal(); 
    }
  }

  /**
   * SupabaseProvider - REST API calls to Supabase PostgREST
   * Uses lightweight fetch to avoid bundler dependencies
   */
  class SupabaseProvider {
    constructor(dm){
      this.dm = dm;
      this.url = CONFIG?.supabase?.url;
      this.key = CONFIG?.supabase?.anonKey;
      this.client = null;
    }
    
    async init(){
      if(!this.url || !this.key) {
        console.warn('Supabase config missing - url or anonKey not set');
        return { ok: false, error: "Missing Supabase config" };
      }
      return { ok: true };
    }
    
    // Helper to build headers with auth
    _headers(){ 
      return { 
        "apikey": this.key, 
        "Authorization": `Bearer ${this.key}`, 
        "Content-Type": "application/json" 
      }; 
    }
    
    async listTasks(){
      const res = await fetch(`${this.url}/rest/v1/tasks?select=*`, { 
        headers: this._headers() 
      });
      if(!res.ok) throw new Error(`listTasks failed: ${res.status}`);
      return res.json();
    }
    
    async upsertTask(task){
      // First save locally for optimistic update
      const saved = this.dm._upsertTaskLocal(task);
      
      // Filter only allowed keys for Supabase table
      const allowedKeys = [
        "id", "title", "job_id", "assignee_id",
        "start_at", "due_at", "priority", "status",
        "notes", "required_proof", "location",
        "depends_on_ids", "subtasks", "media",
        "created_by", "created_at", "updated_at"
      ];
      const clean = {};
      for (const k of allowedKeys) {
        if (k in saved) clean[k] = saved[k];
      }
      
      // Use POST with merge-duplicates preference for true upsert
      const res = await fetch(`${this.url}/rest/v1/tasks`, {
        method: "POST", 
        headers: { 
          ...this._headers(), 
          "Prefer": "resolution=merge-duplicates,return=minimal" 
        }, 
        body: JSON.stringify(clean)
      });
      
      // PostgREST returns 201 or 204 on successful upsert
      if(res.status === 201 || res.status === 204 || res.ok) return saved;
      
      throw new Error(`upsertTask failed: ${res.status} ${res.statusText}`);
    }
    
    async bulkUpsert(tasks){
      // First save locally
      const result = this.dm._bulkUpsertLocal(tasks);
      
      // Filter only allowed keys for Supabase table
      const allowedKeys = [
        "id", "title", "job_id", "assignee_id",
        "start_at", "due_at", "priority", "status",
        "notes", "required_proof", "location",
        "depends_on_ids", "subtasks", "media",
        "created_by", "created_at", "updated_at"
      ];
      const cleanTasks = tasks.map(task => {
        const clean = {};
        for (const k of allowedKeys) {
          if (k in task) clean[k] = task[k];
        }
        return clean;
      });
      
      // Use POST with merge-duplicates preference for bulk upsert
      const res = await fetch(`${this.url}/rest/v1/tasks`, {
        method: "POST",
        headers: { 
          ...this._headers(), 
          "Prefer": "resolution=merge-duplicates,return=minimal" 
        },
        body: JSON.stringify(cleanTasks)
      });
      
      if(res.ok || res.status === 201 || res.status === 204) {
        return result;
      }
      
      throw new Error(`bulkUpsert failed: ${res.status} ${res.statusText}`);
    }
    
    async listPeople(){
      const res = await fetch(`${this.url}/rest/v1/people?select=*`, { 
        headers: this._headers() 
      });
      if(!res.ok) throw new Error(`listPeople failed: ${res.status}`);
      return res.json();
    }
    
    async listJobs(){
      const res = await fetch(`${this.url}/rest/v1/jobs?select=*`, { 
        headers: this._headers() 
      });
      if(!res.ok) throw new Error(`listJobs failed: ${res.status}`);
      return res.json();
    }
  }

  /**
   * Factory function to create the appropriate provider
   * based on CONFIG.backend setting
   */
  function createProvider(dm){
    const mode = CONFIG.backend || "local";
    if(mode === "supabase") {
      return new SupabaseProvider(dm);
    }
    return new LocalProvider(dm);
  }

  // Expose API factory to global scope
  global.API = { createProvider };

})(window);
