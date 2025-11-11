// Main Application Controller for Steve's Task Funnel System

class AppController {
    constructor() {
        this.currentUser = null;
        this.currentView = 'calendar';
        this.isReady = false;
        this.postitsToolbarInitialized = false;
        this.postitsFiltersInitialized = false;
        this.postitDragState = null;
        this.postitDragGhost = null;

        const initPromise = dataManager?.initialized instanceof Promise
            ? dataManager.initialized
            : Promise.resolve();

        initPromise
            .catch(error => {
                console.error('Failed to initialize data', error);
            })
            .finally(() => {
                this.currentUser = dataManager.getCurrentUser();
                this.initialize();
            });
    }

    initialize() {
        if (this.isReady) {
            return;
        }
        this.isReady = true;

        this.currentUser = this.currentUser || dataManager.getCurrentUser();
        this.setupUserInterface();
        this.setupEventListeners();
        this.loadInitialView();
        this.updateUserInterface();
        this.setupTaskFormAutoSave(); // Add auto-save functionality
        
        // Initialize sync strip display
        if (window.Sync) {
            window.Sync.setStrip();
        }
        
        // Calendar will auto-render when DOM is ready
        if (typeof calendarManager !== 'undefined') {
            calendarManager.renderCalendar();
        }
    }

    setupUserInterface() {
        this.populateDropdowns();
        this.populateCalendarFilters();
        this.populateUserSelect();
        this.updateNavigationForUser();
    }

    populateDropdowns() {
        // Populate job dropdowns
        const jobSelects = document.querySelectorAll('#taskJob, #jobSelect');
        const jobs = dataManager.getJobs().slice().sort((a, b) => a.name.localeCompare(b.name));
        
        jobSelects.forEach(select => {
            // Clear existing options except first
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            jobs.forEach(job => {
                const option = document.createElement('option');
                option.value = job.id;
                option.textContent = job.name;
                select.appendChild(option);
            });
        });

        // Populate assignee dropdowns
        const assigneeSelects = document.querySelectorAll('#taskAssignee, #personSelect');
        const people = dataManager.getPeople().slice().sort((a, b) => a.name.localeCompare(b.name));
        
        assigneeSelects.forEach(select => {
            // Clear existing options except first
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            people.forEach(person => {
                const option = document.createElement('option');
                option.value = person.id;
                option.textContent = person.name;
                select.appendChild(option);
            });
        });
    }

    populateUserSelect() {
        const userSelect = document.getElementById('userSelect');
        if (!userSelect) return;

        const people = dataManager.getPeople().slice().sort((a, b) => a.name.localeCompare(b.name));
        const previousValue = userSelect.value;

        userSelect.innerHTML = '';

        people.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = `${person.name} (${this.getRoleLabel(person.role)})`;
            userSelect.appendChild(option);
        });

        if (!this.currentUser && people.length > 0) {
            this.currentUser = people.find(person => person.role === 'admin')?.id || people[0].id;
        }

        const targetValue = this.currentUser || previousValue;
        if (targetValue && Array.from(userSelect.options).some(opt => opt.value === targetValue)) {
            userSelect.value = targetValue;
        }
    }

    populateCalendarFilters() {
        if (typeof calendarManager === 'undefined') return;

        const jobFilter = document.getElementById('calendarJobFilter');
        const assigneeFilter = document.getElementById('calendarAssigneeFilter');
        const priorityFilter = document.getElementById('calendarPriorityFilter');
        const statusFilter = document.getElementById('calendarStatusFilter');

        const jobs = dataManager.getJobs().slice().sort((a, b) => a.name.localeCompare(b.name));
        const people = dataManager.getPeople().slice().sort((a, b) => a.name.localeCompare(b.name));

        this.populateFilterSelect(jobFilter, jobs, 'All Jobs', calendarManager.filters.jobId);
        this.populateFilterSelect(assigneeFilter, people, 'All People', calendarManager.filters.assigneeId);

        if (priorityFilter) {
            const targetPriority = calendarManager.filters.priority || 'all';
            priorityFilter.value = Array.from(priorityFilter.options).some(opt => opt.value === targetPriority)
                ? targetPriority
                : 'all';
        }

        if (statusFilter) {
            const targetStatus = calendarManager.filters.status || 'all';
            statusFilter.value = Array.from(statusFilter.options).some(opt => opt.value === targetStatus)
                ? targetStatus
                : 'all';
        }
    }

    populateFilterSelect(select, items, allLabel, selectedValue) {
        if (!select) return;

        const previousValue = selectedValue ?? select.value ?? 'all';
        select.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = allLabel;
        select.appendChild(allOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });

        const targetValue = Array.from(select.options).some(opt => opt.value === previousValue) ? previousValue : 'all';
        select.value = targetValue;
    }

    handleCalendarFilterChange(filterKey, value) {
        if (typeof calendarManager === 'undefined') return;
        calendarManager.setFilter(filterKey, value);
    }

    getRoleLabel(role) {
        const labels = {
            admin: 'Admin',
            lead: 'Lead',
            crew: 'Crew'
        };
        return labels[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Team');
    }

    updateNavigationForUser() {
        const user = dataManager.getPersonById(this.currentUser);
        if (!user) return;

        // Show/hide menu items based on user role
        const calendarBtn = document.getElementById('calendarBtn');
        const postitsBtn = document.getElementById('postitsBtn');
        const todayPrepBtn = document.getElementById('todayPrepBtn');
        const personFunnelBtn = document.getElementById('personFunnelBtn');
        const jobHubBtn = document.getElementById('jobHubBtn');
        const clientTouchesBtn = document.getElementById('clientTouchesBtn');
        const crewTodayBtn = document.getElementById('crewTodayBtn');

        if (user.role === 'crew') {
            // Crew only sees their daily tasks
            calendarBtn.style.display = 'none';
            todayPrepBtn.style.display = 'none';
            personFunnelBtn.style.display = 'none';
            jobHubBtn.style.display = 'none';
            clientTouchesBtn.style.display = 'none';
            crewTodayBtn.style.display = 'block';
            if (postitsBtn) postitsBtn.style.display = 'none';
            
            // Default to crew view
            this.showView('crew-today');
        } else if (user.role === 'lead') {
            // Lead sees most views but limited scope
            calendarBtn.style.display = 'block';
            todayPrepBtn.style.display = 'block';
            personFunnelBtn.style.display = 'block';
            jobHubBtn.style.display = 'block';
            clientTouchesBtn.style.display = 'block';
            crewTodayBtn.style.display = 'none';
            if (postitsBtn) postitsBtn.style.display = 'block';
        } else {
            // Admin sees everything
            calendarBtn.style.display = 'block';
            todayPrepBtn.style.display = 'block';
            personFunnelBtn.style.display = 'block';
            jobHubBtn.style.display = 'block';
            clientTouchesBtn.style.display = 'block';
            crewTodayBtn.style.display = 'none';
            if (postitsBtn) postitsBtn.style.display = 'block';
        }
    }

    setupEventListeners() {
        // Modal form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // User switching
        document.getElementById('userSelect').addEventListener('change', (e) => {
            this.switchUser(e.target.value);
        });

        // Job selection change for dependencies
        document.getElementById('taskJob').addEventListener('change', (e) => {
            this.updateDependenciesForJob(e.target.value);
        });

        // Calendar filters
        const jobFilter = document.getElementById('calendarJobFilter');
        if (jobFilter) {
            jobFilter.addEventListener('change', (e) => this.handleCalendarFilterChange('jobId', e.target.value));
        }

        const assigneeFilter = document.getElementById('calendarAssigneeFilter');
        if (assigneeFilter) {
            assigneeFilter.addEventListener('change', (e) => this.handleCalendarFilterChange('assigneeId', e.target.value));
        }

        const priorityFilter = document.getElementById('calendarPriorityFilter');
        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => this.handleCalendarFilterChange('priority', e.target.value));
        }

        const statusFilter = document.getElementById('calendarStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => this.handleCalendarFilterChange('status', e.target.value));
        }

        const clearFiltersBtn = document.getElementById('calendarClearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (typeof calendarManager !== 'undefined') {
                    calendarManager.resetFilters();
                    this.populateCalendarFilters();
                }
            });
        }

        // Close task modal when clicking backdrop
        const taskModal = document.getElementById('taskModal');
        if (taskModal) {
            taskModal.addEventListener('click', (e) => {
                if (e.target === taskModal) {
                    this.closeTaskModal();
                }
            });
        }

        // Close checklist modal when clicking backdrop
        const checklistModal = document.getElementById('checklistModal');
        if (checklistModal) {
            checklistModal.addEventListener('click', (e) => {
                if (e.target === checklistModal) {
                    closeChecklistModal();
                }
            });
        }

        // Allow closing modals with the Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    if (activeModal.id === 'taskModal') {
                        this.closeTaskModal();
                    } else if (activeModal.id === 'checklistModal') {
                        closeChecklistModal();
                    }
                }
            }
            
            // Keyboard shortcuts
            if (!e.target.matches('input, textarea, select')) {
                switch (e.key.toLowerCase()) {
                    case 'n':
                        if (!document.querySelector('.modal.active')) {
                            this.showTaskModal();
                        }
                        break;
                    case 't':
                        if (!document.querySelector('.modal.active')) {
                            this.showView('today-prep');
                        }
                        break;
                    case 'c':
                        if (!document.querySelector('.modal.active')) {
                            this.showView('calendar');
                        }
                        break;
                }
            }
            
            // Form shortcuts
            if (e.ctrlKey && e.key === 'Enter') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    if (activeModal.id === 'taskModal') {
                        this.saveTask();
                    } else if (activeModal.id === 'checklistModal') {
                        saveChecklist();
                    }
                }
            }
        });
    }

    loadInitialView() {
        if (this.currentUser) {
            const user = dataManager.getPersonById(this.currentUser);
            if (user && user.role === 'crew') {
                this.showView('crew-today');
            } else {
                this.showView('calendar');
            }
        }
    }

    updateUserInterface() {
        const userSelect = document.getElementById('userSelect');
        if (userSelect && this.currentUser) {
            const hasOption = Array.from(userSelect.options).some(opt => opt.value === this.currentUser);
            if (hasOption) {
                userSelect.value = this.currentUser;
            }
        }
    }

    switchUser(userId) {
        this.currentUser = userId;
        dataManager.setCurrentUser(userId);
        this.updateNavigationForUser();
        this.loadInitialView();
        this.populateCalendarFilters();
        this.updateUserInterface();
        this.refreshCurrentView();
    }

    showView(viewName) {
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            targetView.style.display = 'block';
            this.currentView = viewName;

            // Update active menu item
            const menuItems = document.querySelectorAll('.menu-item');
            menuItems.forEach(item => item.classList.remove('active'));
            
            const activeMenuItem = document.querySelector(`[onclick="showView('${viewName}')"]`);
            if (activeMenuItem) {
                activeMenuItem.classList.add('active');
            }

            // Load view-specific data
            this.loadViewData(viewName);
            
            // Auto-refresh Today Prep when switching to it
            if (viewName === 'today-prep') {
                // Small delay to ensure view is visible
                setTimeout(() => this.refreshTodayPrep(), 100);
            }
        }
    }

    loadViewData(viewName) {
        switch (viewName) {
            case 'calendar':
                if (typeof calendarManager !== 'undefined') {
                    if (typeof calendarManager.showCalendarHidePostits === 'function') {
                        calendarManager.showCalendarHidePostits();
                    }
                    calendarManager.renderCalendar();
                }
                break;
            case 'today-prep':
                this.loadTodayPrep();
                break;
            case 'person-funnel':
                this.loadPersonFunnel();
                break;
            case 'job-hub':
                this.loadJobHub();
                break;
            case 'client-touches':
                this.loadClientTouches();
                break;
            case 'postits':
                this.renderPostits();
                break;
            case 'crew-today':
                this.loadCrewToday();
                break;
        }
    }

    loadTodayPrep() {
        const prepGrid = document.getElementById('prepGrid');
        if (!prepGrid) return;

        const people = dataManager.getPeople().filter(p => p.role !== 'admin');
        const todayIso = new Date().toISOString().split('T')[0];
        
        prepGrid.innerHTML = people.map(person => {
            const tasks = dataManager.getTasksForPerson(person.id)
                .filter(task => this.isTaskOnDate(task, todayIso) && task.status !== 'done');
            
            const issues = this.getPersonIssues(person, tasks);
            
            return `
                <div class="prep-card ${issues.length > 0 ? 'has-issues' : ''}">
                    <h3>${person.name}</h3>
                    <div class="prep-status">
                        <div class="status-indicator ${this.getStatusClass(issues)}"></div>
                        <span>${issues.length === 0 ? 'Ready' : `${issues.length} issue(s)`}</span>
                    </div>
                    <ul class="prep-tasks">
                        ${tasks.slice(0, 3).map(task => `<li>${task.title}</li>`).join('')}
                        ${tasks.length > 3 ? `<li>+${tasks.length - 3} more tasks</li>` : ''}
                    </ul>
                    <div class="prep-issues">
                        ${issues.map(issue => `<div class="issue">${issue}</div>`).join('')}
                    </div>
                    <button class="btn-primary" onclick="sendChecklistToPerson('${person.id}')">
                        Open Checklist
                    </button>
                </div>
            `;
        }).join('');
    }

    refreshTodayPrep() {
        if (this.currentView === 'today-prep') {
            this.loadTodayPrep();
        }
    }

    setupTaskFormAutoSave() {
        const formInputs = [
            'taskTitle', 'taskJob', 'taskAssignee', 'taskStartDate', 
            'taskDueDate', 'taskPriority', 'taskLocation', 'taskNotes'
        ];
        
        formInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    this.saveFormDraft();
                });
            }
        });
    }
    
    saveFormDraft() {
        const draft = {
            title: document.getElementById('taskTitle')?.value || '',
            jobId: document.getElementById('taskJob')?.value || '',
            assigneeId: document.getElementById('taskAssignee')?.value || '',
            startDate: document.getElementById('taskStartDate')?.value || '',
            dueDate: document.getElementById('taskDueDate')?.value || '',
            priority: document.getElementById('taskPriority')?.value || 'normal',
            location: document.getElementById('taskLocation')?.value || '',
            notes: document.getElementById('taskNotes')?.value || '',
            timestamp: Date.now()
        };
        
        // Remember last used combinations for smart defaults
        this.saveSmartDefaults(draft);
        
        localStorage.setItem('taskFormDraft', JSON.stringify(draft));
    }
    
    saveSmartDefaults(draft) {
        if (draft.jobId && draft.assigneeId) {
            const defaults = JSON.parse(localStorage.getItem('taskSmartDefaults') || '{}');
            
            // Remember last assignee per job
            if (!defaults.jobAssignees) defaults.jobAssignees = {};
            defaults.jobAssignees[draft.jobId] = draft.assigneeId;
            
            // Remember typical task duration per job
            if (draft.startDate && draft.dueDate) {
                const start = new Date(draft.startDate);
                const due = new Date(draft.dueDate);
                const daysDiff = Math.ceil((due - start) / (1000 * 60 * 60 * 24));
                
                if (!defaults.jobDurations) defaults.jobDurations = {};
                defaults.jobDurations[draft.jobId] = daysDiff;
            }
            
            // Remember common locations per job
            if (draft.location && draft.location.trim()) {
                if (!defaults.jobLocations) defaults.jobLocations = {};
                if (!defaults.jobLocations[draft.jobId]) defaults.jobLocations[draft.jobId] = [];
                
                const locations = defaults.jobLocations[draft.jobId];
                if (!locations.includes(draft.location)) {
                    locations.unshift(draft.location);
                    // Keep only last 5 locations
                    defaults.jobLocations[draft.jobId] = locations.slice(0, 5);
                }
            }
            
            localStorage.setItem('taskSmartDefaults', JSON.stringify(defaults));
        }
    }
    
    applySmartDefaults() {
        const defaults = JSON.parse(localStorage.getItem('taskSmartDefaults') || '{}');
        
        // Set today as default start date
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById('taskStartDate').value) {
            document.getElementById('taskStartDate').value = today;
        }
        
        // Listen for job selection to apply smart defaults
        const jobSelect = document.getElementById('taskJob');
        if (jobSelect) {
            jobSelect.addEventListener('change', (e) => {
                const jobId = e.target.value;
                if (!jobId || !defaults.jobAssignees) return;
                
                // Auto-select last used assignee for this job
                const lastAssignee = defaults.jobAssignees[jobId];
                if (lastAssignee) {
                    const assigneeSelect = document.getElementById('taskAssignee');
                    if (assigneeSelect && assigneeSelect.querySelector(`option[value="${lastAssignee}"]`)) {
                        assigneeSelect.value = lastAssignee;
                    }
                }
                
                // Auto-calculate due date based on typical duration
                const duration = defaults.jobDurations?.[jobId] || 1;
                const startDate = document.getElementById('taskStartDate').value || today;
                if (startDate && !document.getElementById('taskDueDate').value) {
                    const due = new Date(startDate);
                    due.setDate(due.getDate() + duration);
                    document.getElementById('taskDueDate').value = due.toISOString().split('T')[0];
                }
                
                // Add location suggestions
                this.addLocationSuggestions(jobId, defaults.jobLocations?.[jobId] || []);
            });
        }
    }
    
    addLocationSuggestions(jobId, locations) {
        const locationInput = document.getElementById('taskLocation');
        if (!locationInput || locations.length === 0) return;
        
        // Remove existing datalist
        const existingList = document.getElementById('locationSuggestions');
        if (existingList) existingList.remove();
        
        // Create new datalist
        const datalist = document.createElement('datalist');
        datalist.id = 'locationSuggestions';
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            datalist.appendChild(option);
        });
        
        document.body.appendChild(datalist);
        locationInput.setAttribute('list', 'locationSuggestions');
    }
    
    loadFormDraft() {
        const draftData = localStorage.getItem('taskFormDraft');
        if (!draftData) return false;
        
        try {
            const draft = JSON.parse(draftData);
            
            // Only load if draft is less than 24 hours old
            if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('taskFormDraft');
                return false;
            }
            
            // Populate form with draft data
            if (draft.title) document.getElementById('taskTitle').value = draft.title;
            if (draft.jobId) document.getElementById('taskJob').value = draft.jobId;
            if (draft.assigneeId) document.getElementById('taskAssignee').value = draft.assigneeId;
            if (draft.startDate) document.getElementById('taskStartDate').value = draft.startDate;
            if (draft.dueDate) document.getElementById('taskDueDate').value = draft.dueDate;
            if (draft.priority) document.getElementById('taskPriority').value = draft.priority;
            if (draft.location) document.getElementById('taskLocation').value = draft.location;
            if (draft.notes) document.getElementById('taskNotes').value = draft.notes;
            
            return true;
        } catch (error) {
            console.error('Error loading form draft:', error);
            localStorage.removeItem('taskFormDraft');
            return false;
        }
    }
    
    clearFormDraft() {
        localStorage.removeItem('taskFormDraft');
    }

    getPersonIssues(person, tasks) {
        const issues = [];
        
        // Check for overdue tasks
        const now = new Date();
        const overdueTasks = tasks.filter(task => new Date(task.dueAt) < now);
        if (overdueTasks.length > 0) {
            issues.push(`${overdueTasks.length} overdue task(s)`);
        }

        // Check for high priority tasks
        const urgentTasks = tasks.filter(task => task.priority === 'urgent');
        if (urgentTasks.length > 0) {
            issues.push(`${urgentTasks.length} urgent task(s)`);
        }

        // Check for missing proof on completed tasks
        const needingProof = tasks.filter(task => 
            task.status === 'done' && 
            task.requiredProof !== 'none' && 
            !dataManager.canCompleteTask(task.id)
        );
        if (needingProof.length > 0) {
            issues.push(`${needingProof.length} task(s) need proof`);
        }

        return issues;
    }

    getStatusClass(issues) {
        if (issues.length === 0) return '';
        if (issues.some(issue => issue.includes('overdue') || issue.includes('urgent'))) return 'error';
        return 'warning';
    }

    isTaskOnDate(task, isoDate) {
        if (!task || !isoDate) return false;

        const target = new Date(`${isoDate}T00:00:00`);
        target.setHours(0, 0, 0, 0);

        const start = new Date(task.startAt || task.startDate || task.dueAt);
        const end = new Date(task.dueAt);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return start <= target && end >= target;
    }

    getDefaultStartTime() {
        const settings = dataManager.getData().settings || {};
        return settings.defaultDueTime || '07:00';
    }

    getDefaultEndTime() {
        const settings = dataManager.getData().settings || {};
        const businessHours = settings.businessHours || {};
        return businessHours.end || '17:00';
    }

    combineDateAndTime(dateString, timeString) {
        if (!dateString) return null;
        const time = timeString || '07:00';
        return new Date(`${dateString}T${time}:00`).toISOString();
    }

    getTaskWindowSummary(task) {
        const start = new Date(task.startAt || task.startDate || task.dueAt);
        const end = new Date(task.dueAt);
        const sameDay = start.toDateString() === end.toDateString();

        const dateOptions = { month: 'short', day: 'numeric' };
        const timeOptions = { hour: 'numeric', minute: '2-digit' };

        if (sameDay) {
            return `${start.toLocaleDateString('en-US', dateOptions)} - ${start.toLocaleTimeString('en-US', timeOptions)} -> ${end.toLocaleTimeString('en-US', timeOptions)}`;
        }

        return `${start.toLocaleDateString('en-US', dateOptions)} -> ${end.toLocaleDateString('en-US', dateOptions)}`;
    }

    loadPersonFunnel() {
        const personSelect = document.getElementById('personSelect');
        const kanbanBoard = document.getElementById('kanbanBoard');
        
        if (!personSelect || !kanbanBoard) return;

        const selectedPersonId = personSelect.value;
        if (!selectedPersonId) {
            kanbanBoard.innerHTML = '<p>Please select a person to view their task funnel.</p>';
            return;
        }

        const tasks = dataManager.getTasksForPerson(selectedPersonId);
        const columns = {
            inbox: tasks.filter(task => task.status === 'open'),
            next: tasks.filter(task => task.status === 'next'),
            doing: tasks.filter(task => task.status === 'doing'),
            waiting: tasks.filter(task => task.status === 'waiting'),
            done: tasks.filter(task => task.status === 'done')
        };

        kanbanBoard.innerHTML = `
            ${Object.entries(columns).map(([status, statusTasks]) => `
                <div class="kanban-column" data-status="${status}">
                    <div class="kanban-header">${status.toUpperCase()} (${statusTasks.length})</div>
                    <div class="kanban-tasks">
                        ${statusTasks.map(task => this.createKanbanTask(task)).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    }

    createKanbanTask(task) {
        const job = dataManager.getJobById(task.jobId);
        const dueDate = new Date(task.dueAt);
        
        return `
            <div class="kanban-task" draggable="true" data-task-id="${task.id}">
                <h4>${task.title}</h4>
                <div class="kanban-task-meta">
                    <span>${job ? job.name : 'Unknown Job'}</span>
                    <span>${dueDate.toLocaleDateString()}</span>
                </div>
                <div class="kanban-task-badges">
                    <span class="badge job">${job ? job.name : 'Job'}</span>
                    <span class="badge due">${dueDate.toLocaleDateString()}</span>
                    ${task.requiredProof !== 'none' ? `<span class="badge proof">${task.requiredProof}</span>` : ''}
                </div>
            </div>
        `;
    }

    loadJobHub() {
        const jobSelect = document.getElementById('jobSelect');
        const jobContent = document.getElementById('jobContent');
        
        if (!jobSelect || !jobContent) return;

        const selectedJobId = jobSelect.value;
        if (!selectedJobId) {
            jobContent.innerHTML = '<p>Please select a job to view details.</p>';
            return;
        }

        // Default to tasks tab
        this.showJobTab('tasks');
    }

    showJobTab(tabName, triggerElement) {
        const jobSelect = document.getElementById('jobSelect');
        const jobContent = document.getElementById('jobContent');
        
        if (!jobSelect || !jobContent) return;

        const selectedJobId = jobSelect.value;
        if (!selectedJobId) return;

        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        
        if (triggerElement) {
            triggerElement.classList.add('active');
        } else {
            const fallbackButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
            if (fallbackButton) {
                fallbackButton.classList.add('active');
            }
        }

        switch (tabName) {
            case 'tasks':
                this.loadJobTasks(selectedJobId, jobContent);
                break;
            case 'photos':
                this.loadJobPhotos(selectedJobId, jobContent);
                break;
            case 'notes':
                this.loadJobNotes(selectedJobId, jobContent);
                break;
            case 'client':
                this.loadJobClient(selectedJobId, jobContent);
                break;
        }
    }

    loadJobTasks(jobId, container) {
        const tasks = dataManager.getTasksForJob(jobId);
        
        container.innerHTML = `
            <div class="job-tasks-list">
                ${tasks.map(task => {
                    const assignee = dataManager.getPersonById(task.assigneeId);
                    return `
                        <div class="job-task-card">
                            <div class="job-task-header">
                                <h4>${task.title}</h4>
                                <span class="task-status status-${task.status}">${task.status}</span>
                            </div>
                            <div class="job-task-details">
                                <div>Assignee: ${assignee ? assignee.name : 'Unknown'}</div>
                                <div>Due: ${new Date(task.dueAt).toLocaleString()}</div>
                                <div>Priority: ${task.priority}</div>
                                ${task.location ? `<div>Location: ${task.location}</div>` : ''}
                            </div>
                            ${task.notes ? `<div class="job-task-notes">${task.notes}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    loadJobPhotos(jobId, container) {
        const mediaLinks = dataManager.getData().mediaLinks.filter(media => media.jobId === jobId);
        
        container.innerHTML = `
            <div class="photo-grid">
                ${mediaLinks.map(media => `
                    <div class="photo-item" onclick="openPhotoModal('${media.url}', '${media.caption}')">
                        <img src="${media.url}" alt="${media.caption}" />
                        <div class="photo-caption">${media.caption}</div>
                    </div>
                `).join('')}
                ${mediaLinks.length === 0 ? '<p>No photos uploaded yet.</p>' : ''}
            </div>
        `;
    }

    loadJobNotes(jobId, container) {
        container.innerHTML = `
            <div class="job-notes">
                <textarea placeholder="Add notes about this job..." rows="10" style="width: 100%; padding: 1rem;"></textarea>
                <button class="btn-primary" style="margin-top: 1rem;">Save Notes</button>
            </div>
        `;
    }

    loadJobClient(jobId, container) {
        const job = dataManager.getJobById(jobId);
        const updates = dataManager.getData().clientUpdates.filter(update => update.jobId === jobId);
        
        if (!job) {
            container.innerHTML = '<p>Job not found.</p>';
            return;
        }

        container.innerHTML = `
            <div class="client-info">
                <h3>Client Information</h3>
                <div class="client-details">
                    <div><strong>Name:</strong> ${job.clientName}</div>
                    <div><strong>Phone:</strong> ${job.clientPhone}</div>
                    <div><strong>Email:</strong> ${job.clientEmail}</div>
                    <div><strong>Address:</strong> ${job.address}</div>
                </div>
            </div>
            <div class="client-updates">
                <h3>Communication History</h3>
                <div class="update-list">
                    ${updates.map(update => `
                        <div class="update-item">
                            <div class="update-header">
                                <span class="update-channel">${update.channel.toUpperCase()}</span>
                                <span class="update-date">${new Date(update.sentAt).toLocaleString()}</span>
                            </div>
                            <div class="update-body">${update.body}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="new-update">
                    <h4>Send Update</h4>
                    <textarea placeholder="Type your message..." rows="3" style="width: 100%; padding: 0.5rem; margin-bottom: 1rem;"></textarea>
                    <button class="btn-primary" onclick="sendClientUpdate('${jobId}')">Send Update</button>
                </div>
            </div>
        `;
    }

    loadClientTouches() {
        const clientList = document.getElementById('clientList');
        if (!clientList) return;

        const clientsNeedingUpdates = dataManager.getClientsNeedingUpdates();
        
        clientList.innerHTML = clientsNeedingUpdates.map(job => `
            <div class="client-card">
                <div class="client-info">
                    <h3>${job.clientName} - ${job.name}</h3>
                    <p>Last update: ${this.getLastUpdateTime(job.id)} ago</p>
                </div>
                <div class="client-actions">
                    <button class="template-btn" onclick="sendQuickUpdate('${job.id}', 'arrival')">
                        Crew Arrives 9AM
                    </button>
                    <button class="template-btn" onclick="sendQuickUpdate('${job.id}', 'materials')">
                        Waiting on Materials
                    </button>
                    <button class="template-btn" onclick="sendQuickUpdate('${job.id}', 'inspection')">
                        Inspection Passed
                    </button>
                </div>
            </div>
        `).join('');

        if (clientsNeedingUpdates.length === 0) {
            clientList.innerHTML = '<p>All clients are up to date.</p>';
        }
    }

    getLastUpdateTime(jobId) {
        const updates = dataManager.getData().clientUpdates.filter(update => update.jobId === jobId);
        if (updates.length === 0) return 'Never';

        const lastUpdate = updates.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
        const timeDiff = Date.now() - new Date(lastUpdate.sentAt).getTime();
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (hours < 1) return 'Less than 1 hour';
        if (hours < 24) return `${hours} hours`;
        return `${Math.floor(hours / 24)} days`;
    }

    loadCrewToday() {
        const crewTaskList = document.getElementById('crewTaskList');
        if (!crewTaskList) return;

        const currentUser = dataManager.getPersonById(this.currentUser);
        if (!currentUser || currentUser.role !== 'crew') return;

        const todayIso = new Date().toISOString().split('T')[0];
        let tasks = dataManager.getTasksForPerson(currentUser.id)
            .filter(task => task.status !== 'done');
        
        // Filter based on current filter
        const activeFilter = document.querySelector('.filter-btn.active');
        const filter = activeFilter ? activeFilter.textContent.toLowerCase() : 'today';
        
        if (filter === 'today') {
            tasks = tasks.filter(task => this.isTaskOnDate(task, todayIso));
        }

        tasks.sort((a, b) => {
            const startA = new Date(a.startAt || a.startDate || a.dueAt);
            const startB = new Date(b.startAt || b.startDate || b.dueAt);
            return startA - startB;
        });

        crewTaskList.innerHTML = tasks.map(task => this.createCrewTaskCard(task)).join('');

        if (tasks.length === 0) {
            crewTaskList.innerHTML = `
                <div class="no-tasks">
                    <p>No tasks for ${filter === 'today' ? 'today' : 'this job'}.</p>
                    <p>Great job staying on top of things!</p>
                </div>
            `;
        }
    }

    createCrewTaskCard(task) {
        const job = dataManager.getJobById(task.jobId);
        const jobName = job ? job.name : 'Unknown Job';
        const windowSummary = this.getTaskWindowSummary(task);
        const proofLabel = task.requiredProof === 'photo'
            ? 'Photo'
            : task.requiredProof === 'client_ok'
                ? 'Client OK'
                : '';
        const proofSummary = proofLabel ? ` | Proof: ${proofLabel}` : '';
        return `
            <div class="crew-task" data-task-id="${task.id}">
                <div class="crew-task-header" onclick="toggleCrewTask('${task.id}')">
                    <div class="crew-task-title">${task.title}</div>
                    <div class="crew-task-meta">
                        <span>${jobName}</span>
                        <span>${windowSummary}${proofSummary}</span>
                    </div>
                </div>
                <div class="crew-task-content">
                    ${task.location ? `<div><strong>Location:</strong> ${task.location}</div>` : ''}
                    ${task.notes ? `<div><strong>Notes:</strong> ${task.notes}</div>` : ''}
                    <div class="crew-task-actions">
                        <button class="action-btn ack" onclick="ackTask('${task.id}')">ACK</button>
                        <button class="action-btn start" onclick="startTask('${task.id}')">START</button>
                        <button class="action-btn flag" onclick="flagTask('${task.id}')">FLAG</button>
                        <button class="action-btn photo" onclick="takePhoto('${task.id}')">PHOTO</button>
                        <button class="action-btn note" onclick="addNote('${task.id}')">NOTE</button>
                    </div>
                </div>
            </div>
        `;
    }

    saveTask() {
        const titleInput = document.getElementById('taskTitle').value;
        const jobId = document.getElementById('taskJob').value;
        const assigneeId = document.getElementById('taskAssignee').value;
        const startDate = document.getElementById('taskStartDate').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const priority = document.getElementById('taskPriority').value;
        const requiredProof = document.getElementById('taskProof').value;
        const location = document.getElementById('taskLocation').value;
        const notes = document.getElementById('taskNotes').value;
        
        // Get selected dependencies
        const dependencySelect = document.getElementById('taskDependencies');
        const dependencies = Array.from(dependencySelect.selectedOptions).map(option => option.value);

        const cleanTitle = titleInput.trim();

        if (!cleanTitle || !jobId || !assigneeId || !dueDate) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate dependencies - check for circular dependencies
        const editingExistingTask = Boolean(calendarManager && calendarManager.selectedTask);
        const currentTaskId = editingExistingTask ? calendarManager.selectedTask.id : null;
        
        if (dependencies.length > 0 && this.hasCircularDependency(currentTaskId, dependencies)) {
            alert('Circular dependency detected! A task cannot depend on itself or create a dependency loop.');
            return;
        }

        const startDateValue = startDate || dueDate;
        const startAt = this.combineDateAndTime(startDateValue, this.getDefaultStartTime());
        const dueAt = this.combineDateAndTime(dueDate, this.getDefaultEndTime());

        const taskData = {
            title: cleanTitle.toUpperCase(),
            jobId: jobId,
            assigneeId: assigneeId,
            startAt,
            startDate: startDateValue,
            dueAt,
            priority: priority,
            requiredProof: requiredProof,
            location: location.trim(),
            notes: notes.trim(),
            dependencies: dependencies
        };

        if (editingExistingTask) {
            // Update existing task
            dataManager.updateTask(calendarManager.selectedTask.id, taskData);
            calendarManager.selectedTask = null;
        } else {
            // Create new task
            taskData.status = 'open';
            taskData.createdBy = this.currentUser;
            dataManager.addTask(taskData);
        }

        this.closeTaskModal();
        this.clearFormDraft(); // Clear draft after successful save
        showNotification(editingExistingTask ? 'Task updated successfully' : 'Task created successfully');
        this.refreshCurrentView();
        
        // Auto-refresh Today Prep when tasks are modified
        this.refreshTodayPrep();
    }

    hasCircularDependency(taskId, newDependencies) {
        if (!taskId) return false; // New tasks can't have circular dependencies
        
        const allTasks = dataManager.getTasks();
        const taskMap = new Map(allTasks.map(task => [task.id, task.dependencies || []]));
        
        // Check if any of the new dependencies eventually depend on this task
        const visited = new Set();
        
        const checkDependency = (depId) => {
            if (depId === taskId) return true; // Found circular dependency
            if (visited.has(depId)) return false; // Already checked this path
            
            visited.add(depId);
            const depDependencies = taskMap.get(depId) || [];
            
            return depDependencies.some(checkDependency);
        };
        
        return newDependencies.some(checkDependency);
    }

    updateDependenciesForJob(jobId) {
        if (!jobId) {
            const depsSelect = document.getElementById('taskDependencies');
            depsSelect.innerHTML = '<option disabled>Select job first</option>';
            return;
        }

        const currentTask = { id: 'new', jobId: jobId, dependencies: [] };
        if (typeof calendarManager !== 'undefined') {
            calendarManager.populateDependenciesDropdown(currentTask);
        }
    }

    refreshCurrentView() {
        this.loadViewData(this.currentView);
    }

    closeTaskModal() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        // Reset form
        document.getElementById('taskForm').reset();
        document.getElementById('modalTitle').textContent = 'Create New Task';
        
        if (calendarManager) {
            calendarManager.selectedTask = null;
        }
    }

    showLeadTableView() {
        const tableWrap = document.getElementById('leadTableWrap');
        const calendarGrid = document.getElementById('calendarGrid');
        const calendarToolbar = document.querySelector('.calendar-toolbar');
        
        if (!tableWrap) return;

        // Hide calendar, show table
        if (calendarGrid) calendarGrid.style.display = 'none';
        if (calendarToolbar) calendarToolbar.style.display = 'none';
        tableWrap.style.display = 'block';

        this.renderLeadTable();
    }

    renderLeadTable() {
        const tableWrap = document.getElementById('leadTableWrap');
        if (!tableWrap) return;

        const tasks = dataManager.getAllTasks();
        const jobs = dataManager.getJobs();
        const people = dataManager.getPeople();

        const jobOptions = jobs.map(j => `<option value="${j.id}">${j.name}</option>`).join('');
        const assigneeOptions = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        const tableHTML = `
            <table class="lead-table">
                <thead>
                    <tr>
                        <th>TITLE</th>
                        <th>JOB</th>
                        <th>ASSIGNEE</th>
                        <th>START</th>
                        <th>DUE</th>
                        <th>STATUS</th>
                        <th>PRIORITY</th>
                        <th>PROOF</th>
                        <th>DEPENDS</th>
                        <th>NOTES</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map(task => this.renderLeadTableRow(task, jobOptions, assigneeOptions)).join('')}
                </tbody>
            </table>
        `;

        tableWrap.innerHTML = tableHTML;
        this.attachLeadTableListeners();
    }

    renderLeadTableRow(task, jobOptions, assigneeOptions) {
        const startDate = task.startAt ? new Date(task.startAt).toISOString().split('T')[0] : '';
        const dueDate = task.dueAt ? new Date(task.dueAt).toISOString().split('T')[0] : '';
        const dependsIds = Array.isArray(task.dependsOnIds) ? task.dependsOnIds.join(', ') : '';

        return `
            <tr data-task-id="${task.id}">
                <td>
                    <input type="text" value="${this.escapeHtml(task.title || '')}" 
                           data-field="title" class="lead-table-input" />
                </td>
                <td>
                    <select data-field="jobId" class="lead-table-input">
                        ${jobOptions.split('<option').map(opt => {
                            if (!opt) return '';
                            const match = opt.match(/value="([^"]+)"/);
                            if (!match) return '<option' + opt;
                            return '<option' + (match[1] === task.jobId ? ' selected' : '') + opt;
                        }).join('')}
                    </select>
                </td>
                <td>
                    <select data-field="assigneeId" class="lead-table-input">
                        ${assigneeOptions.split('<option').map(opt => {
                            if (!opt) return '';
                            const match = opt.match(/value="([^"]+)"/);
                            if (!match) return '<option' + opt;
                            return '<option' + (match[1] === task.assigneeId ? ' selected' : '') + opt;
                        }).join('')}
                    </select>
                </td>
                <td>
                    <input type="date" value="${startDate}" 
                           data-field="startAt" class="lead-table-input" />
                </td>
                <td>
                    <input type="date" value="${dueDate}" 
                           data-field="dueAt" class="lead-table-input" />
                </td>
                <td>
                    <select data-field="status" class="lead-table-input">
                        <option value="open" ${task.status === 'open' ? 'selected' : ''}>Open</option>
                        <option value="next" ${task.status === 'next' ? 'selected' : ''}>Next</option>
                        <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>In Progress</option>
                        <option value="waiting" ${task.status === 'waiting' ? 'selected' : ''}>Waiting</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                    </select>
                </td>
                <td>
                    <select data-field="priority" class="lead-table-input">
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                        <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                    </select>
                </td>
                <td>
                    <select data-field="requiredProof" class="lead-table-input">
                        <option value="none" ${task.requiredProof === 'none' ? 'selected' : ''}>None</option>
                        <option value="photo" ${task.requiredProof === 'photo' ? 'selected' : ''}>Photo</option>
                        <option value="client_ok" ${task.requiredProof === 'client_ok' ? 'selected' : ''}>Client OK</option>
                    </select>
                </td>
                <td>
                    <input type="text" value="${dependsIds}" 
                           data-field="dependsOnIds" class="lead-table-input" 
                           placeholder="task-1, task-2" />
                </td>
                <td>
                    <textarea data-field="notes" class="lead-table-input" rows="2">${this.escapeHtml(task.notes || '')}</textarea>
                </td>
            </tr>
        `;
    }

    attachLeadTableListeners() {
        const inputs = document.querySelectorAll('.lead-table-input');
        
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const row = e.target.closest('tr');
                const taskId = row.dataset.taskId;
                const field = e.target.dataset.field;
                let value = e.target.value;

                // Process value based on field type
                if (field === 'title') {
                    value = value.toUpperCase();
                    e.target.value = value;
                } else if (field === 'startAt' || field === 'dueAt') {
                    if (value) {
                        value = new Date(value + 'T07:00:00').toISOString();
                    }
                } else if (field === 'dependsOnIds') {
                    value = value.split(',').map(id => id.trim()).filter(id => id);
                }

                const update = { [field]: value };
                dataManager.updateTask(taskId, update);
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Post-its Master View
    renderPostits(options = {}) {
        
        // 1) compute the current week (Sun..Sat) from today
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay()); // Sunday
        const days = [...Array(7)].map((_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return {
                d,
                key: d.toISOString().slice(0, 10),
                label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
            };
        });

        // 2) fill weekbar
        const weekbar = document.getElementById('postits-weekbar');
        if (weekbar) {
            weekbar.innerHTML = days.map(x => `<span class="day-chip">${x.label}</span>`).join('');
        }

        // 3) mount columns
        const cols = document.getElementById('postits-columns');
        if (cols) {
            cols.innerHTML = '';
            days.forEach(x => {
                const div = document.createElement('div');
                div.className = 'postits-col';
                div.dataset.date = x.key;
                div.innerHTML = `
                    <div class="col-head">
                        <span class="col-date">${x.label}</span>
                        <button class="col-add" data-date="${x.key}" title="Add sticky to this day">+ Add</button>
                    </div>
                    <div class="postits-empty">Drop tasks here</div>`;
                cols.appendChild(div);
            });
        }

        // 4) render filter lists
        if (options.forceFilters) {
            this.postitsFiltersInitialized = false;
        }
        if (!this.postitsFiltersInitialized) {
            this.renderPostitsFilters();
            this.postitsFiltersInitialized = true;
        }

        // 5) render cards using current filters
        this.renderPostitCards(days);
        this.attachPostitsDnD();

        // 6) initialize theme and toolbar (first render only)
        if (!this.postitsToolbarInitialized) {
            const root = document.body;
            root.classList.add('pt-theme-sticky');
            root.classList.remove('pt-theme-board');
            this.applyPostitsScale(100);
            this.attachPostitsToolbar();
            this.attachPostitsFilterBulk();
            this.attachPostitsQuickCreate();
            this.postitsToolbarInitialized = true;
        }

        // 7) bind per-column add buttons
        const colsEl = document.getElementById('postits-columns');
        if (colsEl) {
            colsEl.querySelectorAll('.col-add').forEach(btn => {
                btn.addEventListener('click', () => this.addStickyForDate(btn.dataset.date));
            });
        }
    }

    renderPostitsFilters() {
        const people = (dataManager?.getAllPeople && dataManager.getAllPeople()) || [];
        const jobs = (dataManager?.getAllJobs && dataManager.getAllJobs()) || [];

        const pplWrap = document.getElementById('filter-people');
        const pplSearch = document.getElementById('filter-people-search');
        const jWrap = document.getElementById('filter-jobs');
        const jSearch = document.getElementById('filter-jobs-search');

        if (!pplWrap || !jWrap) return;

        const draw = () => {
            const pQuery = (pplSearch?.value || '').toLowerCase();
            const jQuery = (jSearch?.value || '').toLowerCase();
            pplWrap.innerHTML = people
                .filter(p => !pQuery || p.name.toLowerCase().includes(pQuery))
                .map(p => `<label class="filter-item"><input type="checkbox" class="pf-person" data-id="${p.id}" checked> ${this.escapeHtml(p.name)}</label>`)
                .join('');
            jWrap.innerHTML = jobs
                .filter(j => !jQuery || j.name.toLowerCase().includes(jQuery))
                .map(j => `<label class="filter-item"><input type="checkbox" class="pf-job" data-id="${j.id}" checked> ${this.escapeHtml(j.name)}</label>`)
                .join('');

            // re-bind change handlers to re-render cards
            pplWrap.querySelectorAll('input.pf-person').forEach(el => el.addEventListener('change', () => this.renderPostits()));
            jWrap.querySelectorAll('input.pf-job').forEach(el => el.addEventListener('change', () => this.renderPostits()));
        };

        if (pplSearch) pplSearch.oninput = draw;
        if (jSearch) jSearch.oninput = draw;
        draw();
    }

    getPostitsActiveFilters() {
        const pplOn = Array.from(document.querySelectorAll('#filter-people input.pf-person:checked')).map(el => el.dataset.id);
        const jobOn = Array.from(document.querySelectorAll('#filter-jobs input.pf-job:checked')).map(el => el.dataset.id);
        return { pplOn, jobOn };
    }

    renderPostitCards(days) {
        const tasks = (dataManager?.getAllTasks && dataManager.getAllTasks()) || [];
        const { pplOn, jobOn } = this.getPostitsActiveFilters();
        const byDay = Object.fromEntries(days.map(x => [x.key, []]));

        // Get person and job names for display
        const people = (dataManager?.getAllPeople && dataManager.getAllPeople()) || [];
        const jobs = (dataManager?.getAllJobs && dataManager.getAllJobs()) || [];
        const personMap = Object.fromEntries(people.map(p => [p.id, p.name]));
        const jobMap = Object.fromEntries(jobs.map(j => [j.id, j.name]));

        // naive day bucket: place tasks with startAt on a day (multi-day later step)
        for (const t of tasks) {
            // Convert startAt to local date for bucketing
            let key;
            if (t.startAt) {
                const d = new Date(t.startAt);
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } else {
                key = new Date().toISOString().slice(0, 10);
            }
            if (!byDay[key]) continue;
            if (pplOn.length && t.assigneeId && !pplOn.includes(t.assigneeId)) continue;
            if (jobOn.length && t.jobId && !jobOn.includes(t.jobId)) continue;
            byDay[key].push(t);
        }

        // render
        days.forEach(d => {
            const col = document.querySelector(`.postits-col[data-date="${d.key}"]`);
            if (!col) return;
            
            // Preserve the header by removing only task cards and empty states
            const existingCards = col.querySelectorAll('.postit-card, .postits-empty');
            existingCards.forEach(el => el.remove());
            
            if (byDay[d.key].length === 0) {
                const empty = document.createElement('div');
                empty.className = 'postits-empty';
                empty.textContent = 'No tasks';
                col.appendChild(empty);
            } else {
                byDay[d.key].forEach(t => {
                    const el = document.createElement('div');
                    el.className = 'postit-card';
                    el.dataset.id = t.id;
                    el.dataset.date = d.key;
                    el.setAttribute('draggable', 'true');
                    el.innerHTML = `
                        <div class="postit-title">${this.escapeHtml(t.title || 'UNTITLED')}</div>
                        <div class="postit-meta">
                            ${t.jobId ? `<span class="chip">JOB: ${this.escapeHtml(jobMap[t.jobId] || t.jobId)}</span>` : ''}
                            ${t.assigneeId ? `<span class="chip">EMP: ${this.escapeHtml(personMap[t.assigneeId] || t.assigneeId)}</span>` : ''}
                            ${t.priority ? `<span class="chip">P:${this.escapeHtml(t.priority)}</span>` : ''}
                        </div>`;
                    
                    // Add click handler to open task editor
                    el.addEventListener('click', (event) => {
                        // Don't open if we're dragging
                        if (el.classList.contains('dragging')) return;
                        event.stopPropagation();
                        this.openPostitTaskEditor(t.id);
                    });
                    
                    col.appendChild(el);
                });
            }
        });
    }

    attachPostitsDnD() {
        const cards = document.querySelectorAll('.postit-card');
        cards.forEach(card => {
            card.addEventListener('dragstart', (event) => this.handlePostitDragStart(event, card));
            card.addEventListener('dragend', () => this.handlePostitDragEnd());
        });

        const columns = document.querySelectorAll('.postits-col');
        columns.forEach(col => {
            col.addEventListener('dragenter', (event) => this.handlePostitColumnDragEnter(event, col));
            col.addEventListener('dragover', (event) => this.handlePostitColumnDragOver(event, col));
            col.addEventListener('dragleave', (event) => this.handlePostitColumnDragLeave(event, col));
            col.addEventListener('drop', (event) => this.handlePostitColumnDrop(event, col));
        });
    }

    handlePostitDragStart(event, card) {
        const taskId = card.dataset.id;
        if (!taskId) return;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', taskId);
        }
        const sourceCol = card.closest('.postits-col');
        this.postitDragState = {
            taskId,
            sourceDate: card.dataset.date || sourceCol?.dataset.date || null,
            card
        };
        card.classList.add('dragging');
        this.createPostitGhost(card, event);
    }

    handlePostitDragEnd() {
        if (this.postitDragState?.card) {
            this.postitDragState.card.classList.remove('dragging');
        }
        this.postitDragState = null;
        this.clearPostitDropTargets();
        this.destroyPostitGhost();
    }

    handlePostitColumnDragEnter(event, col) {
        if (!this.postitDragState) return;
        event.preventDefault();
        this.highlightPostitColumn(col);
    }

    handlePostitColumnDragOver(event, col) {
        if (!this.postitDragState) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        this.highlightPostitColumn(col);
    }

    handlePostitColumnDragLeave(event, col) {
        if (!this.postitDragState) return;
        const nextTarget = event.relatedTarget;
        if (!nextTarget || !col.contains(nextTarget)) {
            col.classList.remove('drop-target');
        }
    }

    handlePostitColumnDrop(event, col) {
        if (!this.postitDragState) return;
        event.preventDefault();
        const { taskId, sourceDate } = this.postitDragState;
        const targetDate = col.dataset.date;
        this.handlePostitDragEnd();
        if (!targetDate || targetDate === sourceDate) {
            return;
        }
        const updatedTask = this.movePostitTaskToDate(taskId, targetDate);
        if (updatedTask && typeof showNotification === 'function') {
            const friendly = new Date(targetDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            showNotification(`Moved "${updatedTask.title}" to ${friendly}`);
        }
    }

    highlightPostitColumn(col) {
        if (col) {
            col.classList.add('drop-target');
        }
    }

    clearPostitDropTargets() {
        document.querySelectorAll('.postits-col.drop-target').forEach(col => col.classList.remove('drop-target'));
    }

    movePostitTaskToDate(taskId, newDateKey) {
        if (!dataManager?.updateTask) {
            return null;
        }
        const tasks = (dataManager.getAllTasks?.() || dataManager.getTasks?.() || []);
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            return null;
        }

        // Parse existing dates
        const start = new Date(task.startAt || task.startDate || task.dueAt || Date.now());
        const due = new Date(task.dueAt || task.startAt || task.startDate || start);
        const durationMs = Math.max(0, due.getTime() - start.getTime());
        
        // Parse target date (newDateKey is in YYYY-MM-DD format, local time)
        const [year, month, day] = newDateKey.split('-').map(Number);
        const targetStart = new Date(year, month - 1, day, start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        
        if (Number.isNaN(targetStart.getTime())) {
            console.error('Invalid target date:', newDateKey);
            return null;
        }
        
        const targetDue = new Date(targetStart.getTime() + durationMs);
        
        const updatedTask = dataManager.updateTask(taskId, {
            startAt: targetStart.toISOString(),
            startDate: targetStart.toISOString().slice(0, 10),
            dueAt: targetDue.toISOString()
        });

        // Refresh Post-its without re-initializing filters
        this.renderPostits();
        if (typeof calendarManager !== 'undefined') {
            calendarManager.renderCalendar();
        }
        return updatedTask;
    }

    openPostitTaskEditor(taskId) {
        const task = dataManager.getTaskById(taskId);
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }
        
        // Use the unified task modal if available
        if (typeof openUnifiedTaskModal === 'function') {
            openUnifiedTaskModal(taskId);
        } else if (typeof editTask === 'function') {
            editTask(taskId);
        } else {
            // Fallback: show basic task info
            alert(`Task: ${task.title}\nJob: ${task.jobId}\nAssignee: ${task.assigneeId}`);
        }
    }

    createPostitGhost(card, event) {
        if (!event?.dataTransfer) {
            return;
        }
        this.destroyPostitGhost();
        const ghost = card.cloneNode(true);
        ghost.classList.add('postit-ghost');
        ghost.style.width = `${card.offsetWidth}px`;
        document.body.appendChild(ghost);
        const offsetX = ghost.offsetWidth / 2;
        const offsetY = ghost.offsetHeight / 2;
        event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        this.postitDragGhost = ghost;
    }

    destroyPostitGhost() {
        if (this.postitDragGhost?.parentNode) {
            this.postitDragGhost.parentNode.removeChild(this.postitDragGhost);
        }
        this.postitDragGhost = null;
    }

    attachPostitsToolbar() {
        const btnSticky = document.getElementById('pt-theme-sticky');
        const btnBoard = document.getElementById('pt-theme-board');
        const slider = document.getElementById('pt-scale');
        const sliderVal = document.getElementById('pt-scale-val');
        const root = document.body;

        if (btnSticky) {
            btnSticky.onclick = () => {
                root.classList.add('pt-theme-sticky');
                root.classList.remove('pt-theme-board');
                btnSticky.classList.add('is-active');
                btnBoard?.classList.remove('is-active');
            };
        }

        if (btnBoard) {
            btnBoard.onclick = () => {
                root.classList.add('pt-theme-board');
                root.classList.remove('pt-theme-sticky');
                btnBoard.classList.add('is-active');
                btnSticky?.classList.remove('is-active');
            };
        }

        if (slider) {
            const apply = () => {
                const v = parseInt(slider.value, 10);
                sliderVal.textContent = `${v}%`;
                this.applyPostitsScale(v);
            };
            slider.oninput = apply;
            apply();
        }
    }

    applyPostitsScale(v) {
        const root = document.body;
        // snap to tens to match CSS classes
        const steps = [90, 100, 110, 120, 130, 140];
        const nearest = steps.reduce((p, c) => Math.abs(c - v) < Math.abs(p - v) ? c : p, 100);
        steps.forEach(s => root.classList.remove(`pt-scale-${s}`));
        root.classList.add(`pt-scale-${nearest}`);
    }

    // --- Bulk filter buttons ---
    attachPostitsFilterBulk() {
        const select = (sel, on) => {
            document.querySelectorAll(sel).forEach(cb => { cb.checked = on; });
            this.renderPostits();
        };
        const peAll = document.getElementById('people-select-all');
        const peNone = document.getElementById('people-unselect-all');
        const jbAll = document.getElementById('jobs-select-all');
        const jbNone = document.getElementById('jobs-unselect-all');
        peAll && (peAll.onclick = () => select('#filter-people input.pf-person', true));
        peNone && (peNone.onclick = () => select('#filter-people input.pf-person', false));
        jbAll && (jbAll.onclick = () => select('#filter-jobs input.pf-job', true));
        jbNone && (jbNone.onclick = () => select('#filter-jobs input.pf-job', false));
    }

    // --- Toolbar quick create (chooses Today's column if visible; else prompts for date) ---
    attachPostitsQuickCreate() {
        const btn = document.getElementById('pt-new-sticky');
        if (!btn) return;
        btn.onclick = () => {
            const todayKey = new Date().toISOString().slice(0, 10);
            const visibleCol = document.querySelector(`.postits-col[data-date="${todayKey}"]`);
            if (visibleCol) this.addStickyForDate(todayKey);
            else {
                const d = prompt('Enter date (YYYY-MM-DD) for the new sticky:', todayKey);
                if (d) this.addStickyForDate(d);
            }
        };
    }

    // --- Create a new sticky for a specific day ---
    async addStickyForDate(dateKey) {
        const title = prompt('Sticky title:', 'NEW STICKY');
        if (!title) return;
        const dm = dataManager;
        const iso = `${dateKey}T00:00:00.000Z`;
        const draft = {
            id: 'new-' + Date.now(),
            title: (title || 'NEW STICKY').toUpperCase(),
            startAt: iso,
            status: 'open'
        };
        try {
            if (typeof dm.addTask === 'function') {
                await dm.addTask(draft);
            } else if (typeof dm.updateTask === 'function') {
                await dm.updateTask(draft.id, draft);
            } else if (typeof dm.saveTask === 'function') {
                await dm.saveTask(draft);
            } else {
                // last resort: merge into local list if helper exists
                const tasks = (dm.getAllTasks && dm.getAllTasks()) || [];
                tasks.push(draft);
            }
            // Re-render board to show it immediately
            this.renderPostits();
        } catch (e) {
            console.error('Failed to create sticky', e);
            alert('Could not create sticky. See console for details.');
        }
    }
}

// Initialize app controller
const appController = new AppController();

// Global functions for HTML event handlers
function showView(viewName) {
    appController.showView(viewName);
}

function switchUser() {
    const userSelect = document.getElementById('userSelect');
    appController.switchUser(userSelect.value);
}

function showTaskModal() {
    const modal = document.getElementById('taskModal');
    if (modal) {
        // Reset modal for new task
        document.getElementById('modalTitle').textContent = 'Create New Task';
        
        // Clear dependencies for new tasks
        const depsSelect = document.getElementById('taskDependencies');
        if (depsSelect) {
            depsSelect.innerHTML = '<option disabled>Select job first to see available tasks</option>';
        }
        
        // Apply smart defaults first
        appController.applySmartDefaults();
        
        // Try to load draft (will override defaults if available)
        const hasDraft = appController.loadFormDraft();
        
        modal.classList.add('active');
        
        if (hasDraft) {
            showNotification('Draft loaded from previous session', 'info');
        }
    }
}

function closeTaskModal() {
    appController.closeTaskModal();
}

function saveTask() {
    appController.saveTask();
}

function updatePersonFunnel() {
    appController.loadPersonFunnel();
}

function updateJobHub() {
    appController.loadJobHub();
}

function showJobTab(tabName, tabButton) {
    appController.showJobTab(tabName, tabButton);
}

function setCrewFilter(filter, triggerButton) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    
    if (triggerButton) {
        triggerButton.classList.add('active');
    }

    appController.loadCrewToday();
}

function toggleCrewTask(taskId) {
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskCard) {
        taskCard.classList.toggle('expanded');
    }
}

// Crew task actions
function ackTask(taskId) {
    const task = dataManager.getTaskById(taskId);
    if (task) {
        dataManager.updateTask(taskId, { acknowledgedAt: new Date().toISOString() });
        showNotification(`Task acknowledged: ${task.title}`);
    }
}

function startTask(taskId) {
    const task = dataManager.getTaskById(taskId);
    if (task) {
        dataManager.updateTask(taskId, { 
            status: 'doing',
            startedAt: new Date().toISOString() 
        });
        
        // Send automatic task started notification
        statusUpdateManager.sendTaskStartedUpdate(taskId);
        
        appController.refreshCurrentView();
        showNotification(`Started task: ${task.title}`);
    }
}

function flagTask(taskId) {
    const flagType = prompt('Flag type:\n1. Need Materials\n2. Need Clarification\n3. Blocked by Other Trade\n4. Weather Delay\n5. Safety Issue');
    
    const flagTypes = {
        '1': 'materials',
        '2': 'clarification', 
        '3': 'other_trade',
        '4': 'weather',
        '5': 'safety'
    };
    
    const type = flagTypes[flagType];
    if (type) {
        const message = prompt('Additional details (optional):');
        // In a real app, this would save the flag
        showNotification(`Task flagged: ${type.replace('_', ' ')}`);
    }
}

function takePhoto(taskId) {
    // Simulate photo capture
    const task = dataManager.getTaskById(taskId);
    const job = dataManager.getJobById(task.jobId);
    
    if (task && job) {
        const photoUrl = `https://via.placeholder.com/400x300?text=Photo+for+${encodeURIComponent(task.title)}`;
        const caption = `Photo for: ${task.title}`;
        
        dataManager.addMediaLink(job.id, task.id, dataManager.getCurrentUser(), photoUrl, caption);
        
        // Check if this completes the task
        if (task.requiredProof === 'photo') {
            dataManager.updateTask(taskId, { status: 'done', completedAt: new Date().toISOString() });
            
            // Send automatic status update
            statusUpdateManager.sendTaskCompletedUpdate(taskId);
            
            showNotification(`Photo submitted and task completed!`);
        } else {
            showNotification(`Photo submitted for task: ${task.title}`);
            
            // Send photo update notification
            statusUpdateManager.sendPhotoUpdate(taskId, 1);
        }
        
        appController.refreshCurrentView();
    }
}

function addNote(taskId) {
    const note = prompt('Add a note about this task:');
    if (note && note.trim()) {
        const task = dataManager.getTaskById(taskId);
        const existingNotes = task.notes || '';
        const timestamp = new Date().toLocaleString();
        const newNotes = existingNotes + `\n[${timestamp}] ${note}`;
        
        dataManager.updateTask(taskId, { notes: newNotes });
        showNotification('Note added to task');
    }
}

// Helper functions
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    const colorMap = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800'
    };

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colorMap[type] || colorMap.success};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function sendChecklistToPerson(personId) {
    const person = dataManager.getPersonById(personId);
    if (person) {
        // Open the checklist builder modal
        openChecklistBuilder();
        
        // Pre-populate with the person's information
        const assigneeSelect = document.getElementById('checklistAssignees');
        if (assigneeSelect) {
            // Select the person in the assignee dropdown
            Array.from(assigneeSelect.options).forEach(option => {
                option.selected = option.value === personId;
            });
        }
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        // Find tasks assigned to this person for today
        const todayTasks = dataManager.getTasks().filter(task => {
            if (task.assigneeId !== personId) return false;
            const taskDate = new Date(task.startAt || task.dueAt).toISOString().split('T')[0];
            return taskDate === today;
        });
        
        // Populate suggested tasks from calendar
        if (todayTasks.length > 0) {
            setTimeout(() => populateChecklistFromTasks(todayTasks, person), 100);
        }
    }
}

function populateChecklistFromTasks(tasks, person) {
    const itemsContainer = document.getElementById('checklistItems');
    const inputForm = itemsContainer.querySelector('.checklist-item-form');
    
    if (tasks.length === 0) {
        return; // No tasks to suggest
    }
    
    // Add a header for suggested items
    const headerEl = document.createElement('div');
    headerEl.className = 'checklist-suggestions-header';
    headerEl.innerHTML = `
        <div style="font-weight: 600; color: #2c3e50; margin-bottom: 0.5rem; font-size: 0.9rem;">
            📋 Suggested from ${person.name}'s tasks today:
        </div>
    `;
    itemsContainer.insertBefore(headerEl, inputForm);
    
    // Add each task as a suggested checklist item
    tasks.forEach(task => {
        const job = dataManager.getJobById(task.jobId);
        const jobName = job ? job.name : 'Unknown Job';
        
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'checklist-suggestion-item';
        suggestionEl.innerHTML = `
            <div class="checklist-suggestion-content">
                <div class="checklist-suggestion-title">${task.title}</div>
                <div class="checklist-suggestion-meta">${jobName} • ${task.priority} priority</div>
            </div>
            <button type="button" class="btn-success btn-sm" onclick="addTaskToChecklist('${task.id}')" title="Add to checklist">
                <i class="fas fa-plus"></i> Add
            </button>
        `;
        itemsContainer.insertBefore(suggestionEl, inputForm);
    });
}

function addTaskToChecklist(taskId) {
    const task = dataManager.getTaskById(taskId);
    if (!task) return;
    
    const job = dataManager.getJobById(task.jobId);
    const jobName = job ? job.name : '';
    
    // Create checklist item text
    let itemText = task.title;
    if (jobName) {
        itemText += ` (${jobName})`;
    }
    if (task.location) {
        itemText += ` - ${task.location}`;
    }
    
    // Add as a checklist item
    addChecklistItemWithText(itemText);
    
    // Remove the suggestion
    const suggestionEl = event.target.closest('.checklist-suggestion-item');
    if (suggestionEl) {
        suggestionEl.style.opacity = '0.3';
        suggestionEl.style.pointerEvents = 'none';
        const addBtn = suggestionEl.querySelector('button');
        if (addBtn) {
            addBtn.innerHTML = '<i class="fas fa-check"></i> Added';
            addBtn.classList.remove('btn-success');
            addBtn.classList.add('btn-secondary');
        }
    }
}

function openChecklistBuilder() {
    // Populate dropdowns
    populateChecklistDropdowns();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('checklistStartDate').value = today;
    
    // Show modal
    document.getElementById('checklistModal').classList.add('active');
}

function closeChecklistModal() {
    document.getElementById('checklistModal').classList.remove('active');
    clearChecklistForm();
}

function populateChecklistDropdowns() {
    // Populate job dropdown
    const jobSelect = document.getElementById('checklistJob');
    const jobs = dataManager.getJobs().slice().sort((a, b) => a.name.localeCompare(b.name));
    
    jobSelect.innerHTML = '<option value="">Select Job</option>';
    jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = job.name;
        jobSelect.appendChild(option);
    });
    
    // Populate assignees dropdown
    const assigneeSelect = document.getElementById('checklistAssignees');
    const people = dataManager.getPeople()
        .filter(person => person.role !== 'client')
        .sort((a, b) => a.name.localeCompare(b.name));
    
    assigneeSelect.innerHTML = '';
    people.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        assigneeSelect.appendChild(option);
    });
}

function loadChecklistTemplate() {
    const template = document.getElementById('checklistTemplate').value;
    const itemsContainer = document.getElementById('checklistItems');
    
    // Clear existing items except the input form
    const existingItems = itemsContainer.querySelectorAll('.checklist-item:not(.checklist-item-form)');
    existingItems.forEach(item => item.remove());
    
    const templates = {
        safety: [
            'PPE properly worn (hard hats, safety glasses, gloves)',
            'Work area clear of hazards and debris',
            'Ladders inspected and properly positioned', 
            'Weather conditions safe for work',
            'Emergency contact information posted',
            'First aid kit location confirmed'
        ],
        inspection: [
            'Site access clear and safe',
            'Material staging area prepared',
            'Utilities marked and identified',
            'Permits and documentation on-site',
            'Neighboring properties protected',
            'Waste disposal plan confirmed'
        ],
        tools: [
            'All required tools present and accounted for',
            'Power tools inspected and functioning',
            'Extension cords and electrical checked',
            'Hand tools organized and accessible',
            'Specialty equipment operational',
            'Tool security plan in place'
        ],
        cleanup: [
            'All debris collected and contained',
            'Tools cleaned and secured',
            'Work area swept and organized', 
            'Materials properly stored or disposed',
            'Site left safe for overnight',
            'Security measures activated'
        ],
        roofing: [
            'Roof access equipment positioned safely',
            'Fall protection systems installed',
            'Weather conditions suitable for roofing',
            'Materials lifted and staged properly',
            'Gutters and drains protected',
            'Surrounding area protected from debris'
        ]
    };
    
    const items = templates[template] || [];
    items.forEach(item => {
        addChecklistItemToList(item);
    });
}

function handleChecklistItemKeypress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addChecklistItem();
    }
}

function addChecklistItem() {
    const input = document.getElementById('newChecklistItem');
    const text = input.value.trim();
    
    if (!text) return;
    
    addChecklistItemToList(text);
    input.value = '';
    input.focus();
}

function addChecklistItemToList(text) {
    const itemsContainer = document.getElementById('checklistItems');
    const inputForm = itemsContainer.querySelector('.checklist-item-form');
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item';
    itemDiv.innerHTML = `
        <input type="checkbox" disabled checked>
        <span class="checklist-item-text">${text}</span>
        <button type="button" onclick="removeChecklistItem(this)" class="btn-icon remove-item">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    itemsContainer.insertBefore(itemDiv, inputForm);
}

function populateChecklistFromTasks(tasks, person) {
    const itemsContainer = document.getElementById('checklistItems');
    const inputForm = itemsContainer.querySelector('.checklist-item-form');
    
    if (tasks.length === 0) {
        return; // No tasks to suggest
    }
    
    // Add a header for suggested items
    const headerEl = document.createElement('div');
    headerEl.className = 'checklist-suggestions-header';
    headerEl.innerHTML = `
        <div style="font-weight: 600; color: #2c3e50; margin: 1rem 0 0.75rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid #e0e0e0; font-size: 0.95rem;">
            📋 Suggested from ${person.name}'s calendar tasks:
        </div>
    `;
    itemsContainer.insertBefore(headerEl, inputForm);
    
    // Add each task as a suggested checklist item
    tasks.forEach(task => {
        const job = dataManager.getJobById(task.jobId);
        const jobName = job ? job.name : 'Unknown Job';
        
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'checklist-suggestion-item';
        suggestionEl.dataset.taskId = task.id;
        suggestionEl.innerHTML = `
            <div class="checklist-suggestion-content">
                <div class="checklist-suggestion-title">${task.title}</div>
                <div class="checklist-suggestion-meta">${jobName} • ${task.priority} priority</div>
            </div>
            <button type="button" class="btn-success btn-sm" onclick="addTaskToChecklist('${task.id}')" title="Add to checklist">
                <i class="fas fa-plus"></i> Add
            </button>
        `;
        itemsContainer.insertBefore(suggestionEl, inputForm);
    });
}

function addTaskToChecklist(taskId) {
    const task = dataManager.getTaskById(taskId);
    if (!task) return;
    
    const job = dataManager.getJobById(task.jobId);
    const jobName = job ? job.name : '';
    
    // Create checklist item text
    let itemText = task.title;
    if (jobName) {
        itemText += ` (${jobName})`;
    }
    if (task.location) {
        itemText += ` - ${task.location}`;
    }
    
    // Add as a checklist item
    addChecklistItemToList(itemText);
    
    // Remove/disable the suggestion
    const suggestionEl = document.querySelector(`.checklist-suggestion-item[data-task-id="${taskId}"]`);
    if (suggestionEl) {
        suggestionEl.style.opacity = '0.5';
        suggestionEl.style.pointerEvents = 'none';
        const addBtn = suggestionEl.querySelector('button');
        if (addBtn) {
            addBtn.innerHTML = '<i class="fas fa-check"></i> Added';
            addBtn.classList.remove('btn-success');
            addBtn.classList.add('btn-secondary');
            addBtn.disabled = true;
        }
    }
}

function removeChecklistItem(button) {
    button.closest('.checklist-item').remove();
}

function saveChecklist() {
    const title = document.getElementById('checklistTitle').value.trim();
    const jobId = document.getElementById('checklistJob').value;
    const assigneeSelect = document.getElementById('checklistAssignees');
    const schedule = document.getElementById('checklistSchedule').value;
    const startDate = document.getElementById('checklistStartDate').value;
    
    if (!title || !jobId) {
        alert('Please provide a title and select a job site.');
        return;
    }
    
    const assignees = Array.from(assigneeSelect.selectedOptions).map(option => option.value);
    if (assignees.length === 0) {
        alert('Please assign the checklist to at least one person.');
        return;
    }
    
    // Collect checklist items
    const items = Array.from(document.querySelectorAll('.checklist-item:not(.checklist-item-form) .checklist-item-text'))
        .map(span => span.textContent);
    
    if (items.length === 0) {
        alert('Please add at least one checklist item.');
        return;
    }
    
    // Create checklist data
    const checklist = {
        id: 'checklist-' + Date.now(),
        title,
        jobId,
        items,
        assignees,
        schedule,
        startDate,
        createdAt: new Date().toISOString(),
        createdBy: dataManager.getCurrentUser(),
        status: 'active'
    };
    
    // Save to data manager (we'll need to add checklist support to data.js)
    const data = dataManager.getData();
    if (!data.checklists) {
        data.checklists = [];
    }
    data.checklists.push(checklist);
    dataManager.saveData(data);
    
    // Create actual tasks based on schedule
    createChecklistTasks(checklist);
    
    closeChecklistModal();
    showNotification(`Checklist "${title}" created and assigned!`);
    
    // Refresh current view
    appController.refreshTodayPrep();
    if (typeof calendarManager !== 'undefined') {
        calendarManager.renderCalendar();
    }
}

function createChecklistTasks(checklist) {
    const job = dataManager.getJobById(checklist.jobId);
    if (!job) return;
    
    const dates = getChecklistDates(checklist);
    
    dates.forEach(date => {
        checklist.assignees.forEach(assigneeId => {
            // Create a single task for the entire checklist
            const taskData = {
                title: checklist.title,
                jobId: checklist.jobId,
                assigneeId: assigneeId,
                startDate: date,
                dueAt: new Date(date + 'T17:00:00').toISOString(),
                priority: 'normal',
                status: 'open',
                checklistId: checklist.id,
                checklistItems: checklist.items.map(item => ({
                    text: item,
                    completed: false
                })),
                requiredProof: 'photo',
                location: 'Site-wide',
                notes: `Checklist: ${checklist.items.join(', ')}`
            };
            
            dataManager.addTask(taskData);
        });
    });
}

function getChecklistDates(checklist) {
    const startDate = new Date(checklist.startDate);
    const dates = [];
    
    switch (checklist.schedule) {
        case 'one-time':
            dates.push(checklist.startDate);
            break;
        case 'daily':
            // Generate 30 days worth for now
            for (let i = 0; i < 30; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                // Skip weekends for daily checklists
                if (date.getDay() !== 0 && date.getDay() !== 6) {
                    dates.push(date.toISOString().split('T')[0]);
                }
            }
            break;
        case 'weekly':
            // Generate 12 weeks worth
            for (let i = 0; i < 12; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + (i * 7));
                dates.push(date.toISOString().split('T')[0]);
            }
            break;
        case 'project-start':
        case 'project-end':
            dates.push(checklist.startDate);
            break;
    }
    
    return dates;
}

function clearChecklistForm() {
    document.getElementById('checklistTitle').value = '';
    document.getElementById('checklistJob').value = '';
    document.getElementById('checklistTemplate').value = '';
    document.getElementById('checklistSchedule').value = 'daily';
    
    // Clear assignees
    const assigneeSelect = document.getElementById('checklistAssignees');
    Array.from(assigneeSelect.options).forEach(option => option.selected = false);
    
    // Clear checklist items and suggestions
    const itemsContainer = document.getElementById('checklistItems');
    const existingItems = itemsContainer.querySelectorAll('.checklist-item:not(.checklist-item-form), .checklist-suggestion-item, .checklist-suggestions-header');
    existingItems.forEach(item => item.remove());
    
    document.getElementById('newChecklistItem').value = '';
}

function sendQuickUpdate(jobId, template) {
    const job = dataManager.getJobById(jobId);
    if (!job) return;

    const templates = {
        arrival: 'Crew will arrive at 9:00 AM to begin work on your project.',
        materials: 'We are waiting on materials to arrive. Will update you as soon as we have a delivery date.',
        inspection: 'Inspection passed successfully! Work is proceeding on schedule.'
    };

    const message = templates[template];
    if (message) {
        dataManager.addClientUpdate(jobId, 'sms', message, job.clientPhone);
        showNotification(`Update sent to ${job.clientName}`);
        appController.loadClientTouches();
    }
}

function sendClientUpdate(jobId) {
    const textarea = document.querySelector('.new-update textarea');
    const message = textarea.value.trim();
    
    if (!message) {
        alert('Please enter a message');
        return;
    }

    const job = dataManager.getJobById(jobId);
    if (job) {
        dataManager.addClientUpdate(jobId, 'email', message, job.clientEmail);
        showNotification(`Update sent to ${job.clientName}`);
        textarea.value = '';
        appController.showJobTab('client');
    }
}

function openPhotoModal(url, caption) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>Photo</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center;">
                <img src="${url}" alt="${caption}" style="max-width: 100%; height: auto;" />
                <p style="margin-top: 1rem;">${caption}</p>
            </div>
        </div>
    `;
    modal.classList.add('active');
    document.body.appendChild(modal);
}

// Sub-task Management
let currentTaskForSubtasks = null;

function openSubtaskModal(taskId) {
    const task = dataManager.getTaskById(taskId);
    if (!task) return;
    
    currentTaskForSubtasks = task;
    const modal = document.getElementById('subtaskModal');
    const jobTitleEl = document.getElementById('subtaskJobTitle');
    const jobDatesEl = document.getElementById('subtaskJobDates');
    
    // Get job info
    const job = dataManager.getJobById(task.jobId);
    jobTitleEl.textContent = job ? job.name : 'Unknown Job';
    
    const startDate = new Date(task.startAt);
    const endDate = new Date(task.dueAt);
    const isSameDay = startDate.toDateString() === endDate.toDateString();
    
    if (isSameDay) {
        jobDatesEl.textContent = `Task: ${startDate.toLocaleDateString()}`;
    } else {
        jobDatesEl.textContent = `Task: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }
    
    // Populate assignee dropdown
    populateSubtaskAssigneeDropdown();
    
    // Set default date to task start date
    document.getElementById('subtaskDate').value = task.startDate;
    
    // Load existing subtasks
    renderSubtasks();
    
    modal.classList.add('active');
}

function closeSubtaskModal() {
    const modal = document.getElementById('subtaskModal');
    modal.classList.remove('active');
    currentTaskForSubtasks = null;
    
    // Clear form
    document.getElementById('subtaskDescription').value = '';
    document.getElementById('subtaskAssignee').value = '';
    document.getElementById('subtaskDate').value = '';
}

function populateSubtaskAssigneeDropdown() {
    const select = document.getElementById('subtaskAssignee');
    const people = dataManager.getPeople().filter(p => p.role === 'crew').sort((a, b) => a.name.localeCompare(b.name));
    
    // Clear existing options except first
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    people.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        select.appendChild(option);
    });
}

function addSubtask() {
    if (!currentTaskForSubtasks) return;
    
    const description = document.getElementById('subtaskDescription').value.trim();
    const assigneeId = document.getElementById('subtaskAssignee').value;
    const date = document.getElementById('subtaskDate').value;
    
    if (!description || !assigneeId || !date) {
        alert('Please fill in all fields');
        return;
    }
    
    const subtask = {
        id: `subtask-${Date.now()}`,
        description: description,
        assigneeId: assigneeId,
        date: date,
        status: 'open',
        createdAt: new Date().toISOString(),
        parentTaskId: currentTaskForSubtasks.id
    };
    
    // Add to current task's subtasks
    if (!currentTaskForSubtasks.subtasks) {
        currentTaskForSubtasks.subtasks = [];
    }
    currentTaskForSubtasks.subtasks.push(subtask);
    
    // Clear form
    document.getElementById('subtaskDescription').value = '';
    document.getElementById('subtaskAssignee').value = '';
    
    // Re-render subtasks
    renderSubtasks();
}

function renderSubtasks() {
    if (!currentTaskForSubtasks) return;
    
    const container = document.getElementById('subtaskItems');
    const subtasks = currentTaskForSubtasks.subtasks || [];
    
    if (subtasks.length === 0) {
        container.innerHTML = '<p style="color: #6c757d; font-style: italic; text-align: center; padding: 2rem;">No sub-tasks added yet</p>';
        return;
    }
    
    container.innerHTML = subtasks.map(subtask => {
        const person = dataManager.getPersonById(subtask.assigneeId);
        const personName = person ? person.name : 'Unknown';
        const taskDate = new Date(subtask.date).toLocaleDateString();
        
        return `
            <div class="subtask-item">
                <div class="subtask-description">${subtask.description}</div>
                <div class="subtask-assignee">${personName}</div>
                <div class="subtask-date">${taskDate}</div>
                <div class="subtask-actions">
                    <button class="btn-subtask danger small" onclick="removeSubtask('${subtask.id}')">Remove</button>
                </div>
            </div>
        `;
    }).join('');
}

function removeSubtask(subtaskId) {
    if (!currentTaskForSubtasks) return;
    
    currentTaskForSubtasks.subtasks = (currentTaskForSubtasks.subtasks || []).filter(st => st.id !== subtaskId);
    renderSubtasks();
}

function saveSubtasks() {
    if (!currentTaskForSubtasks) return;
    
    // Update the task in the data manager
    dataManager.updateTask(currentTaskForSubtasks.id, currentTaskForSubtasks);
    
    // Refresh the calendar view
    if (typeof calendarManager !== 'undefined') {
        calendarManager.renderCalendar();
    }
    
    // Close the modal
    closeSubtaskModal();
    
    showNotification('Sub-tasks saved successfully');
}

function editTask(taskId) {
    const task = dataManager.getTaskById(taskId);
    if (!task) return;
    
    calendarManager.selectedTask = task;
    openUnifiedTaskModal(taskId);
    
    // Remove context menu
    const menu = document.querySelector('.task-context-menu');
    if (menu) menu.remove();
}

// Automated Status Updates
class StatusUpdateManager {
    constructor() {
        this.templates = {
            taskCompleted: (task, job, assignee) => ({
                subject: `Task Completed: ${job.name}`,
                body: `Hello ${job.clientName || 'Valued Client'},\n\nWe've completed the following task on your project:\n\n✅ ${task.title}\nCompleted by: ${assignee.name}\nCompleted: ${new Date().toLocaleDateString()}\n\n${task.notes ? 'Notes: ' + task.notes + '\n\n' : ''}We'll keep you updated on our progress.\n\nBest regards,\nSteven Hurtt Construction`
            }),
            taskStarted: (task, job, assignee) => ({
                subject: `Work Started: ${job.name}`,
                body: `Hello ${job.clientName || 'Valued Client'},\n\nWe've started work on your project:\n\n🔨 ${task.title}\nStarted by: ${assignee.name}\nStarted: ${new Date().toLocaleDateString()}\n\n${task.notes ? 'Details: ' + task.notes + '\n\n' : ''}We'll notify you when this task is complete.\n\nBest regards,\nSteven Hurtt Construction`
            }),
            photoUpdate: (task, job, photoCount) => ({
                subject: `Progress Photos: ${job.name}`,
                body: `Hello ${job.clientName || 'Valued Client'},\n\nWe've uploaded ${photoCount} new progress photo${photoCount > 1 ? 's' : ''} for your project:\n\n📸 ${task.title}\nPhotos taken: ${new Date().toLocaleDateString()}\n\nYou can view these photos in your project portal.\n\nBest regards,\nSteven Hurtt Construction`
            })
        };
        
        this.autoUpdateSettings = {
            taskCompleted: true,
            taskStarted: false,
            photoUpdates: true,
            issues: true
        };
    }

    async sendTaskCompletedUpdate(taskId) {
        if (!this.autoUpdateSettings.taskCompleted) return;
        
        const task = dataManager.getTaskById(taskId);
        if (!task) return;
        
        const job = dataManager.getJobById(task.jobId);
        const assignee = dataManager.getPersonById(task.assigneeId);
        
        if (!job || !assignee) return;
        
        const update = this.templates.taskCompleted(task, job, assignee);
        
        // Get recent photos for this task
        const recentPhotos = this.getRecentTaskPhotos(taskId, 24); // Last 24 hours
        
        if (recentPhotos.length > 0) {
            update.body += `\n\n📷 ${recentPhotos.length} photo${recentPhotos.length > 1 ? 's' : ''} attached from this work.`;
        }
        
        // Simulate sending email/SMS
        this.simulateNotification(job, update, 'email');
        
        // Log the update
        dataManager.addClientUpdate(job.id, 'email', update.body, job.clientEmail);
    }

    async sendTaskStartedUpdate(taskId) {
        if (!this.autoUpdateSettings.taskStarted) return;
        
        const task = dataManager.getTaskById(taskId);
        if (!task) return;
        
        const job = dataManager.getJobById(task.jobId);
        const assignee = dataManager.getPersonById(task.assigneeId);
        
        if (!job || !assignee) return;
        
        const update = this.templates.taskStarted(task, job, assignee);
        
        this.simulateNotification(job, update, 'sms');
        dataManager.addClientUpdate(job.id, 'sms', update.body, job.clientPhone);
    }

    async sendPhotoUpdate(taskId, photoCount) {
        if (!this.autoUpdateSettings.photoUpdates) return;
        
        const task = dataManager.getTaskById(taskId);
        if (!task) return;
        
        const job = dataManager.getJobById(task.jobId);
        
        if (!job) return;
        
        const update = this.templates.photoUpdate(task, job, photoCount);
        
        this.simulateNotification(job, update, 'email');
        dataManager.addClientUpdate(job.id, 'email', update.body, job.clientEmail);
    }

    getRecentTaskPhotos(taskId, hoursBack = 24) {
        const task = dataManager.getTaskById(taskId);
        if (!task || !task.mediaCategories) return [];
        
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - hoursBack);
        
        const allPhotos = [
            ...(task.mediaCategories.before || []),
            ...(task.mediaCategories.progress || []),
            ...(task.mediaCategories.after || []),
            ...(task.mediaCategories.issues || [])
        ];
        
        return allPhotos.filter(photo => new Date(photo.timestamp) > cutoffTime);
    }

    simulateNotification(job, update, method) {
        const notification = document.createElement('div');
        notification.className = 'auto-update-notification';
        notification.innerHTML = `
            <div class="notification-header">
                <i class="fas fa-${method === 'email' ? 'envelope' : 'sms'}"></i>
                Auto-Update Sent
            </div>
            <div class="notification-body">
                <strong>To:</strong> ${job.clientName} (${method === 'email' ? job.clientEmail : job.clientPhone})<br>
                <strong>Subject:</strong> ${update.subject}
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 6px;
            padding: 1rem;
            max-width: 300px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    updateSettings(newSettings) {
        this.autoUpdateSettings = { ...this.autoUpdateSettings, ...newSettings };
    }
}

// Initialize status update manager
const statusUpdateManager = new StatusUpdateManager();

// Calendar View Controls
// Removed - using calendarManager.setViewMode directly

function previousPeriod() {
    calendarManager.previousWeek();
}

function nextPeriod() {
    calendarManager.nextWeek();
}

// Unified Task Modal
let currentUnifiedTask = null;

function openUnifiedTaskModal(taskId) {
    const sourceTask = dataManager.getTaskById(taskId);
    if (!sourceTask) return;

    // Work on a shallow clone so edits are staged until saved
    currentUnifiedTask = JSON.parse(JSON.stringify(sourceTask));
    currentUnifiedTask.id = sourceTask.id;

    const modal = document.getElementById('unifiedTaskModal');

    // Populate dropdowns before assigning selected values
    populateUnifiedDropdowns(currentUnifiedTask);
    populateUnifiedDependencies(currentUnifiedTask);

    const startDateValue = currentUnifiedTask.startDate
        || (currentUnifiedTask.startAt ? currentUnifiedTask.startAt.slice(0, 10) : '')
        || (currentUnifiedTask.dueAt ? currentUnifiedTask.dueAt.slice(0, 10) : '');
    const dueDateValue = currentUnifiedTask.dueAt
        ? new Date(currentUnifiedTask.dueAt).toISOString().slice(0, 10)
        : '';

    // Populate edit form
    document.getElementById('unifiedModalTitle').textContent = currentUnifiedTask.title || 'Project';
    document.getElementById('unifiedTaskTitle').value = currentUnifiedTask.title || '';
    document.getElementById('unifiedTaskJob').value = currentUnifiedTask.jobId || '';
    document.getElementById('unifiedTaskAssignee').value = currentUnifiedTask.assigneeId || '';
    document.getElementById('unifiedTaskStartDate').value = startDateValue || '';
    document.getElementById('unifiedTaskDueDate').value = dueDateValue || '';
    document.getElementById('unifiedTaskPriority').value = currentUnifiedTask.priority || 'normal';
    document.getElementById('unifiedTaskNotes').value = currentUnifiedTask.notes || '';

    // Reset subtask form defaults
    document.getElementById('unifiedSubtaskDescription').value = '';
    document.getElementById('unifiedSubtaskAssignee').value = currentUnifiedTask.assigneeId || '';
    document.getElementById('unifiedSubtaskDate').value = dueDateValue || startDateValue || '';

    const jobSelect = document.getElementById('unifiedTaskJob');
    if (jobSelect) {
        jobSelect.onchange = () => {
            currentUnifiedTask.jobId = jobSelect.value;
            populateUnifiedDependencies(currentUnifiedTask);
        };
    }

    const assigneeSelect = document.getElementById('unifiedTaskAssignee');
    if (assigneeSelect) {
        assigneeSelect.onchange = () => {
            currentUnifiedTask.assigneeId = assigneeSelect.value;
        };
    }

    renderUnifiedSubtasks();
    setUnifiedTab('edit'); // ensure primary tab active

    modal.classList.add('active');
}

function closeUnifiedTaskModal() {
    document.getElementById('unifiedTaskModal').classList.remove('active');
    currentUnifiedTask = null;
}

function switchUnifiedTab(tabName, button) {
    // Update tab buttons
    document.querySelectorAll('.unified-tab').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.unified-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`unified-${tabName}-tab`).classList.add('active');
    
    // Refresh subtasks when switching to the subtasks tab
    if (tabName === 'subtasks') {
        renderUnifiedSubtasks();
    }
}

function setUnifiedTab(tabName) {
    const tabButton = document.querySelector(`.unified-tab[data-tab-name="${tabName}"]`);
    if (tabButton) {
        document.querySelectorAll('.unified-tab').forEach(tab => tab.classList.remove('active'));
        tabButton.classList.add('active');
    }
    document.querySelectorAll('.unified-tab-content').forEach(content => content.classList.remove('active'));
    const target = document.getElementById(`unified-${tabName}-tab`);
    if (target) {
        target.classList.add('active');
    }
}

function populateUnifiedDropdowns(task) {
    // Populate job dropdown
    const jobSelect = document.getElementById('unifiedTaskJob');
    const jobs = dataManager.getJobs().sort((a, b) => a.name.localeCompare(b.name));
    jobSelect.innerHTML = '<option value="">Select Job</option>';
    jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = job.name;
        jobSelect.appendChild(option);
    });
    
    // Populate assignee dropdowns
    const assigneeSelects = [document.getElementById('unifiedTaskAssignee'), document.getElementById('unifiedSubtaskAssignee')];
    const people = dataManager.getPeople().sort((a, b) => a.name.localeCompare(b.name));
    
    assigneeSelects.forEach(select => {
        select.innerHTML = '<option value="">Select Person</option>';
        people.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            select.appendChild(option);
        });
    });

    if (task) {
        jobSelect.value = task.jobId || '';
        assigneeSelects[0].value = task.assigneeId || '';
        if (task.assigneeId) {
            assigneeSelects[1].value = task.assigneeId;
        }
    }
}

function populateUnifiedDependencies(task) {
    const select = document.getElementById('unifiedTaskDependencies');
    const allTasks = dataManager.getTasks().filter(t => 
        t.id !== task.id && 
        t.status !== 'done' && 
        t.jobId === task.jobId
    );
    
    select.innerHTML = '';
    allTasks.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = `${t.title} (${dataManager.getPersonById(t.assigneeId)?.name || 'Unassigned'})`;
        if (task.dependencies && task.dependencies.includes(t.id)) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function addUnifiedSubtask() {
    if (!currentUnifiedTask) return;
    
    const description = document.getElementById('unifiedSubtaskDescription').value.trim();
    const assigneeId = document.getElementById('unifiedSubtaskAssignee').value;
    const date = document.getElementById('unifiedSubtaskDate').value;
    
    if (!description || !assigneeId || !date) {
        alert('Please fill in all fields');
        return;
    }
    
    const subtask = {
        id: `subtask-${Date.now()}`,
        description: description,
        assigneeId: assigneeId,
        date: date,
        status: 'open',
        createdAt: new Date().toISOString(),
        parentTaskId: currentUnifiedTask.id
    };
    
    if (!currentUnifiedTask.subtasks) {
        currentUnifiedTask.subtasks = [];
    }
    currentUnifiedTask.subtasks.push(subtask);
    
    // Clear form (keep assignee selected for convenience)
    document.getElementById('unifiedSubtaskDescription').value = '';
    // Keep the assignee selected so user can quickly add multiple subtasks to same person
    // document.getElementById('unifiedSubtaskAssignee').value = '';
    
    renderUnifiedSubtasks();
}

function renderUnifiedSubtasks() {
    if (!currentUnifiedTask) return;
    
    const container = document.getElementById('unifiedSubtaskItems');
    const subtasks = [...(currentUnifiedTask.subtasks || [])].sort((a, b) => {
        const dateA = new Date(a.date || a.dueDate || a.createdAt || 0);
        const dateB = new Date(b.date || b.dueDate || b.createdAt || 0);
        return dateA - dateB;
    });
    
    if (subtasks.length === 0) {
        container.innerHTML = '<p class="no-subtasks">No sub-tasks</p>';
        return;
    }
    
    container.innerHTML = subtasks.map(subtask => {
        const person = dataManager.getPersonById(subtask.assigneeId);
        const dateLabel = subtask.date ? new Date(subtask.date).toLocaleDateString() : 'No date';
        const statusLabel = (subtask.status || 'open').toUpperCase();
        return `
            <div class="unified-subtask-item">
                <div class="subtask-info">
                    <strong>${subtask.description}</strong><br>
                    <span>${person ? person.name : 'Unknown'} · ${dateLabel} · ${statusLabel}</span>
                </div>
                <button onclick="removeUnifiedSubtask('${subtask.id}')" class="remove-btn">Remove</button>
            </div>
        `;
    }).join('');
}

function removeUnifiedSubtask(subtaskId) {
    if (!currentUnifiedTask) return;
    
    currentUnifiedTask.subtasks = (currentUnifiedTask.subtasks || []).filter(st => st.id !== subtaskId);
    renderUnifiedSubtasks();
}

function saveUnifiedTask() {
    if (!currentUnifiedTask) return;
    
    // Update task data - explicitly include subtasks to ensure they're saved
    const updatedTask = {
        ...currentUnifiedTask,
        title: document.getElementById('unifiedTaskTitle').value.toUpperCase(),
        jobId: document.getElementById('unifiedTaskJob').value,
        assigneeId: document.getElementById('unifiedTaskAssignee').value,
        startDate: document.getElementById('unifiedTaskStartDate').value,
        dueAt: new Date(document.getElementById('unifiedTaskDueDate').value + 'T23:59:59').toISOString(),
        priority: document.getElementById('unifiedTaskPriority').value,
        notes: document.getElementById('unifiedTaskNotes').value,
        dependencies: Array.from(document.getElementById('unifiedTaskDependencies').selectedOptions).map(opt => opt.value),
        subtasks: currentUnifiedTask.subtasks || [] // Explicitly preserve subtasks
    };
    
    // Update startAt if startDate changed
    if (updatedTask.startDate) {
        updatedTask.startAt = new Date(updatedTask.startDate + 'T07:00:00').toISOString();
    }
    
    console.log('💾 Saving task with subtasks:', {
        taskId: currentUnifiedTask.id,
        subtaskCount: updatedTask.subtasks.length,
        subtasks: updatedTask.subtasks
    });
    
    // Save to data manager
    dataManager.updateTask(currentUnifiedTask.id, updatedTask);
    
    // Refresh calendar
    calendarManager.renderCalendar();
    
    closeUnifiedTaskModal();
    showNotification('Task updated successfully');
}

// Initialize unified modal tabs
// NOTE: Tab switching is handled by switchUnifiedTab() function called via onclick handlers
// This DOMContentLoaded is kept for any additional initialization if needed in the future
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching is already handled by inline onclick handlers in HTML
    // No additional setup needed here
});

// Export/Import Functions
function exportTasksJSON() {
    const tasks = dataManager.getAllTasks();
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Tasks exported to JSON');
}

function exportTasksCSV() {
    const tasks = dataManager.getAllTasks();
    const jobs = dataManager.getJobs();
    const people = dataManager.getPeople();
    
    // Helper to escape CSV fields
    const escapeCSV = (field) => {
        if (field == null) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };
    
    // CSV header
    const headers = ['ID', 'TITLE', 'JOB', 'ASSIGNEE', 'START', 'DUE', 'STATUS', 'PRIORITY', 'PROOF', 'DEPENDS', 'NOTES'];
    let csv = headers.join(',') + '\n';
    
    // CSV rows
    tasks.forEach(task => {
        const job = jobs.find(j => j.id === task.jobId);
        const assignee = people.find(p => p.id === task.assigneeId);
        const startDate = task.startAt ? new Date(task.startAt).toISOString().split('T')[0] : '';
        const dueDate = task.dueAt ? new Date(task.dueAt).toISOString().split('T')[0] : '';
        const dependsIds = Array.isArray(task.dependsOnIds) ? task.dependsOnIds.join(';') : '';
        
        const row = [
            escapeCSV(task.id),
            escapeCSV(task.title),
            escapeCSV(job?.name || ''),
            escapeCSV(assignee?.name || ''),
            escapeCSV(startDate),
            escapeCSV(dueDate),
            escapeCSV(task.status),
            escapeCSV(task.priority),
            escapeCSV(task.requiredProof),
            escapeCSV(dependsIds),
            escapeCSV(task.notes)
        ];
        
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Tasks exported to CSV');
}

function triggerImportJSON() {
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

let pendingImportData = null;

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            
            // Handle both array format and object with tasks property
            let tasks = Array.isArray(content) ? content : content.tasks;
            
            if (!Array.isArray(tasks)) {
                showNotification('Invalid JSON format: expected array of tasks', 'error');
                return;
            }
            
            // Run dry-run merge to get preview
            const preview = dataManager.bulkMergeTasks(tasks, { dryRun: true });
            pendingImportData = tasks;
            
            showImportPreview(preview);
            
        } catch (error) {
            console.error('Import error:', error);
            showNotification('Error parsing JSON file: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}

function showImportPreview(preview) {
    const modal = document.getElementById('importPreviewModal');
    const summaryDiv = document.getElementById('importPreviewSummary');
    const sampleDiv = document.getElementById('importPreviewSample');
    
    if (!modal || !summaryDiv || !sampleDiv) return;
    
    // Build summary
    const summaryHTML = `
        <div class="summary-item">
            <strong>Total tasks in file:</strong>
            <span>${preview.total}</span>
        </div>
        <div class="summary-item">
            <strong>New tasks (to create):</strong>
            <span>${preview.created.length}</span>
        </div>
        <div class="summary-item">
            <strong>Existing tasks (to update):</strong>
            <span>${preview.updated.length}</span>
        </div>
        <div class="summary-item">
            <strong>Unchanged tasks:</strong>
            <span>${preview.unchanged.length}</span>
        </div>
        <div class="summary-item">
            <strong>Conflicts (skipped):</strong>
            <span style="color: #dc3545;">${preview.conflicts.length}</span>
        </div>
    `;
    
    summaryDiv.innerHTML = summaryHTML;
    
    // Build sample (first 10 changes)
    let sampleHTML = '<h4>Sample Changes (first 10):</h4>';
    
    preview.sample.forEach(item => {
        if (item.type === 'created') {
            sampleHTML += `
                <div class="sample-change created">
                    <strong>CREATE:</strong> ${item.task.title || 'Untitled'} (${item.task.id})
                </div>
            `;
        } else if (item.type === 'updated') {
            const changes = Object.keys(item.changes).join(', ');
            sampleHTML += `
                <div class="sample-change updated">
                    <strong>UPDATE:</strong> ${item.id}<br>
                    <small>Changed fields: ${changes}</small>
                </div>
            `;
        } else if (item.type === 'conflict') {
            sampleHTML += `
                <div class="sample-change conflict">
                    <strong>CONFLICT:</strong> ${item.task?.title || item.task?.id || 'Unknown'}<br>
                    <small>${item.reason}</small>
                </div>
            `;
        }
    });
    
    if (preview.sample.length === 0) {
        sampleHTML += '<p>No changes detected.</p>';
    }
    
    sampleDiv.innerHTML = sampleHTML;
    
    // Show modal
    modal.classList.add('active');
}

function closeImportPreviewModal() {
    const modal = document.getElementById('importPreviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
    pendingImportData = null;
}

function applyImport() {
    if (!pendingImportData) {
        showNotification('No import data available', 'error');
        return;
    }
    
    try {
        const result = dataManager.bulkMergeTasks(pendingImportData, { dryRun: false });
        
        // Refresh both table and calendar views
        if (appController.currentView === 'calendar') {
            const tableWrap = document.getElementById('leadTableWrap');
            if (tableWrap && tableWrap.style.display !== 'none') {
                appController.renderLeadTable();
            }
        }
        
        if (typeof calendarManager !== 'undefined') {
            calendarManager.renderCalendar();
        }
        
        closeImportPreviewModal();
        
        const message = `Import complete: ${result.created.length} created, ${result.updated.length} updated, ${result.conflicts.length} conflicts`;
        showNotification(message);
        
    } catch (error) {
        console.error('Apply import error:', error);
        showNotification('Error applying import: ' + error.message, 'error');
    }
}





