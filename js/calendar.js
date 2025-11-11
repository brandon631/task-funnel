// Calendar functionality for Steve's Task Funnel System

// Debug flag; toggle at runtime with: window.calendar.testMode = true
window.calendar = window.calendar || {};
if (typeof window.calendar.testMode === 'undefined') window.calendar.testMode = false;
const CAL_LOG = (...args) => void 0; // Disabled for production
const CAL_WARN = (...args) => void 0; // Disabled for production

// Small debounce helper for layout work
function debounce(fn, wait = 180) {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), wait);
    };
}

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.taskCellHeight = 22;
        this.maxTasksPerDay = 10;
        this.currentViewMode = 'month'; // Default view - easier overview for planning
        this.desktopViewMode = 'month';
        this.isMobile = false;
        this.mobileMediaQuery = null;
        
        // Initialize filters
        this.filters = {
            jobId: 'all',
            assigneeId: 'all',
            priority: 'all',
            status: 'all'
        };
        this.visibleRangeStart = null;
        this.visibleRangeEnd = null;
        this.quickPanel = null;
        this.quickPanelElements = {};
        this.quickPanelInitialized = false;
        this.quickPanelLastAssignee = '';
        this.resizeSession = null;
        this.boundResizeMove = null;
        this.boundResizeEnd = null;
        this.boundResizeCancel = null;
        this.boundResizeKey = null;
        this.previewElements = new Map();
        this.isTouchDevice = this.detectTouchDevice();
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isAndroid = /Android/.test(navigator.userAgent);
        
        // Allow many visible stacked rows per day; keep conservative default
        this.maxLanesPerDay = 12; // was effectively ~3 before
        this.lanesByDay = {}; // Track lanes used per day for dynamic height
        
        // Debounced layout reflow used by both window resize and ResizeObserver
        this._reflowAfterResize = debounce(() => {
            try {
                // Re-measure grid and realign items without changing current view mode
                if (typeof this.measureGrid === 'function') this.measureGrid();
                if (typeof this.refreshTaskPositioning === 'function') {
                    this.refreshTaskPositioning();
                } else if (typeof this.renderCalendar === 'function') {
                    this.renderCalendar(); // fallback to light re-render
                }
                // Remove any stale preview segments that might have been left behind
                document.querySelectorAll('.task-resize-preview[data-preview="true"]').forEach(el => el.remove());
                // Re-apply lane variables after reflow
                requestAnimationFrame(() => this._writeLaneVariablesToCells());
                CAL_LOG('🧩 Reflow completed after size change');
            } catch (e) {
                console.error('Reflow after size change failed', e);
            }
        }, 200);

        // ResizeObserver to catch container size changes (e.g., side panel open, CSS breakpoints)
        this._containerResizeObserver = null;
        
        // Responsive defaults before binding controls
        this.setupResponsiveMode();

        // Initialize view controls
        this.initializeViewControls();
        
        // Window resize → debounced reflow (keeps current pointer/touch wiring intact)
        window.addEventListener('resize', this._reflowAfterResize, { passive: true });

        // Observe calendar container itself for layout collapses (e.g., Month → Day on narrow width)
        try {
            const container = document.getElementById('calendar-view') || document.querySelector('.calendar-view');
            if (container && 'ResizeObserver' in window) {
                this._containerResizeObserver = new ResizeObserver(() => this._reflowAfterResize());
                this._containerResizeObserver.observe(container);
                CAL_LOG('🔭 ResizeObserver attached to calendar container');
            }
        } catch (e) {
            CAL_WARN('ResizeObserver not available or failed to attach', e);
        }
    }
    
    initializeViewControls() {
        const initButtons = () => {
            const viewButtons = document.querySelectorAll('.view-mode-btn');
            if (viewButtons.length === 0) {
                // Retry after a short delay if buttons aren't ready
                setTimeout(initButtons, 100);
                return;
            }
            
            viewButtons.forEach(btn => {
                // Remove any existing listeners
                btn.removeEventListener('click', this.handleViewButtonClick);
                // Add new listener
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const viewMode = btn.getAttribute('data-view');
                    
                    if (viewMode === 'lead-table') {
                        // Switch to Lead Table view
                        this.hideCalendarShowTable();
                        this.setActiveButton('lead-table');
                    } else if (viewMode === 'postits') {
                        // Switch to Post-its view
                        this.hideCalendarShowPostits();
                        this.setActiveButton('postits');
                    } else {
                        // Switch to calendar view
                        this.showCalendarHideTable();
                        this.showCalendarHidePostits();
                        this.setViewMode(viewMode);
                    }
                });
            });
            
            // Set initial active button respecting responsive defaults
            this.setActiveButton(this.currentViewMode || 'month');
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initButtons);
        } else {
            initButtons();
        }
    }

    hideCalendarShowTable() {
        const calendarGrid = document.getElementById('calendarGrid');
        const calendarToolbar = document.querySelector('.calendar-toolbar');
        const tableWrap = document.getElementById('leadTableWrap');
        
        if (calendarGrid) calendarGrid.style.display = 'none';
        if (calendarToolbar) calendarToolbar.style.display = 'none';
        if (tableWrap) {
            tableWrap.style.display = 'block';
            // Render the table if appController is available
            if (typeof appController !== 'undefined' && appController.renderLeadTable) {
                appController.renderLeadTable();
            }
        }
    }

    showCalendarHideTable() {
        const calendarGrid = document.getElementById('calendarGrid');
        const calendarToolbar = document.querySelector('.calendar-toolbar');
        const tableWrap = document.getElementById('leadTableWrap');
        
        if (calendarGrid) calendarGrid.style.display = '';
        if (calendarToolbar) calendarToolbar.style.display = '';
        if (tableWrap) tableWrap.style.display = 'none';
    }

    hideCalendarShowPostits() {
        const calendarView = document.getElementById('calendar-view');
        const calendarGrid = document.getElementById('calendarGrid');
        const calendarToolbar = document.querySelector('.calendar-toolbar');
        const tableWrap = document.getElementById('leadTableWrap');
        const postitsView = document.getElementById('postits-view');
        
        if (calendarView) calendarView.style.display = 'none';
        if (calendarGrid) calendarGrid.style.display = 'none';
        if (calendarToolbar) calendarToolbar.style.display = 'none';
        if (tableWrap) tableWrap.style.display = 'none';
        if (postitsView) {
            postitsView.style.display = 'block';
            // Render the post-its view if appController is available
            if (typeof appController !== 'undefined' && appController.renderPostits) {
                appController.renderPostits();
            }
        }
    }

    showCalendarHidePostits() {
        const calendarView = document.getElementById('calendar-view');
        const calendarGrid = document.getElementById('calendarGrid');
        const calendarToolbar = document.querySelector('.calendar-toolbar');
        const postitsView = document.getElementById('postits-view');
        
        if (calendarView) calendarView.style.display = 'block';
        if (calendarGrid) calendarGrid.style.display = '';
        if (calendarToolbar) calendarToolbar.style.display = '';
        if (postitsView) postitsView.style.display = 'none';
    }

    detectTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }

    detectTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }

    setupResponsiveMode() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            this.isMobile = false;
            return;
        }

        this.mobileMediaQuery = window.matchMedia('(max-width: 768px)');
        this.isMobile = this.mobileMediaQuery.matches;
        if (this.isMobile) {
            this.desktopViewMode = this.currentViewMode || 'month';
            this.currentViewMode = 'day';
        } else {
            this.desktopViewMode = this.currentViewMode || 'month';
        }

        const applyViewportState = () => {
            if (typeof document === 'undefined' || !document.body) {
                return;
            }
            document.body.classList.toggle('mobile-calendar', this.isMobile);
            this.setActiveButton(this.currentViewMode || 'month');
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyViewportState, { once: true });
        } else {
            applyViewportState();
        }

        this.mobileMediaQuery.addEventListener('change', (event) => {
            this.isMobile = event.matches;
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.toggle('mobile-calendar', this.isMobile);
            }

            if (this.isMobile) {
                this.desktopViewMode = this.currentViewMode || this.desktopViewMode || 'month';
                if (this.currentViewMode !== 'day') {
                    this.setViewMode('day');
                } else {
                    this.renderCalendar();
                }
            } else {
                const targetView = this.desktopViewMode && this.desktopViewMode !== 'day'
                    ? this.desktopViewMode
                    : 'month';
                if (this.currentViewMode !== targetView) {
                    this.setViewMode(targetView);
                } else {
                    this.renderCalendar();
                }
            }
        });
    }

    initializeQuickPanel() {
        if (this.quickPanelInitialized) {
            return;
        }

        const panel = document.getElementById('taskQuickPanel');
        if (!panel) {
            return;
        }

        this.quickPanel = panel;
        this.quickPanelElements = {
            title: panel.querySelector('.task-quick-title'),
            job: panel.querySelector('.task-quick-job'),
            assignee: panel.querySelector('.task-quick-assignee'),
            dates: panel.querySelector('.task-quick-dates'),
            status: panel.querySelector('.task-quick-status'),
            count: panel.querySelector('.task-quick-count'),
            subtaskList: panel.querySelector('#quickSubtaskList'),
            form: panel.querySelector('#quickSubtaskForm'),
            description: panel.querySelector('#quickSubtaskDescription'),
            assigneeSelect: panel.querySelector('#quickSubtaskAssignee'),
            dateInput: panel.querySelector('#quickSubtaskDate'),
            closeBtn: panel.querySelector('#quickPanelClose'),
            fullBtn: panel.querySelector('#quickOpenFull')
        };

        panel.classList.remove('open');

        if (this.quickPanelElements.closeBtn) {
            this.quickPanelElements.closeBtn.addEventListener('click', () => this.closeTaskQuickPanel());
        }

        if (this.quickPanelElements.fullBtn) {
            this.quickPanelElements.fullBtn.addEventListener('click', () => {
                if (this.selectedTask) {
                    this.closeTaskQuickPanel();
                    openUnifiedTaskModal(this.selectedTask.id);
                }
            });
        }

        if (this.quickPanelElements.form) {
            this.quickPanelElements.form.addEventListener('submit', (event) => this.handleQuickSubtaskSubmit(event));
            
            // Add keyboard shortcuts and enhanced UX
            this.setupSubtaskFormEnhancements();
        }

        if (this.quickPanelElements.subtaskList) {
            this.quickPanelElements.subtaskList.addEventListener('click', (event) => this.handleQuickSubtaskActions(event));
            this.quickPanelElements.subtaskList.addEventListener('change', (event) => this.handleQuickSubtaskToggle(event));
        }

        document.addEventListener('click', (event) => {
            if (!this.quickPanel || !this.quickPanel.classList.contains('open')) {
                return;
            }
            if (this.quickPanel.contains(event.target)) {
                return;
            }
            if (event.target.closest('.task-item')) {
                return;
            }
            this.closeTaskQuickPanel();
        });

        // Reposition panel on window resize
        window.addEventListener('resize', () => {
            if (this.quickPanel && this.quickPanel.classList.contains('open')) {
                this.positionQuickPanel();
            }
        });

        this.quickPanelInitialized = true;
    }

    setupSubtaskFormEnhancements() {
        const descInput = this.quickPanelElements.description;
        const clearBtn = document.getElementById('quickSubtaskClear');
        const form = this.quickPanelElements.form;
        
        // Clear button functionality
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSubtaskForm();
                descInput?.focus();
            });
        }
        
        // Keyboard shortcuts
        if (descInput) {
            descInput.addEventListener('keydown', (event) => {
                // Ctrl+Enter to quick submit
                if (event.ctrlKey && event.key === 'Enter') {
                    event.preventDefault();
                    this.handleQuickSubtaskSubmit(event);
                }
                
                // Escape to clear form
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.clearSubtaskForm();
                }
            });
            
            // Auto-focus when panel opens
            descInput.addEventListener('focus', () => {
                descInput.select();
            });
        }
        
        // Smart defaults for assignee and date
        const assigneeSelect = this.quickPanelElements.assigneeSelect;
        if (assigneeSelect) {
            assigneeSelect.addEventListener('change', () => {
                this.quickPanelLastAssignee = assigneeSelect.value;
            });
        }
        
        // Form validation feedback
        if (form) {
            form.addEventListener('invalid', (event) => {
                event.preventDefault();
                this.showSubtaskFormValidationError();
            }, true);
        }
    }

    clearSubtaskForm() {
        if (this.quickPanelElements.description) {
            this.quickPanelElements.description.value = '';
        }
        if (this.quickPanelElements.dateInput) {
            // Reset to today or the task's start date
            const preferredDate = this.selectedTask?.startDate || 
                                this.selectedTask?.dueAt?.slice(0, 10) || 
                                new Date().toISOString().slice(0, 10);
            this.quickPanelElements.dateInput.value = preferredDate;
        }
        // Keep the assignee selection for convenience
    }

    showSubtaskFormValidationError() {
        const form = this.quickPanelElements.form;
        if (!form) return;
        
        let message = 'Please fill in all required fields:';
        
        if (!this.quickPanelElements.description?.value.trim()) {
            message += ' Description';
        }
        if (!this.quickPanelElements.assigneeSelect?.value) {
            message += ' Assignee';
        }
        if (!this.quickPanelElements.dateInput?.value) {
            message += ' Date';
        }
        
        // Show brief visual feedback
        form.classList.add('form-invalid');
        setTimeout(() => form.classList.remove('form-invalid'), 2000);
        
        this.showFeedback(message);
    }

    ensureQuickPanelReady() {
        if (!this.quickPanelInitialized) {
            this.initializeQuickPanel();
        }
        return Boolean(this.quickPanel);
    }

    openTaskQuickPanel(task, taskElement = null) {
        // Don't open panel if we're actively resizing
        if (this.resizeSession) {
            console.log('🚫 Quick panel blocked - resize in progress');
            return false;
        }
        
        if (!this.ensureQuickPanelReady()) {
            return false;
        }
        this.populateQuickPanel(task);
        this.positionQuickPanel(taskElement);
        this.quickPanel.classList.add('open');
        return true;
    }

    positionQuickPanel(taskElement) {
        if (!this.quickPanel) return;
        
        // Reset all positioning
        this.quickPanel.style.right = '';
        this.quickPanel.style.left = '';
        this.quickPanel.style.top = '';
        this.quickPanel.style.transform = '';
        
        const panelWidth = 380; // Updated to match CSS
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const safeMargin = 20;
        
        let left, top;
        
        if (taskElement) {
            const taskRect = taskElement.getBoundingClientRect();
            
            // Calculate available space on both sides
            const spaceOnRight = viewportWidth - taskRect.right;
            const spaceOnLeft = taskRect.left;
            
            // Choose side with more space, but prefer right if both are adequate
            if (spaceOnRight >= panelWidth + safeMargin) {
                // Position to the right
                left = taskRect.right + 12;
            } else if (spaceOnLeft >= panelWidth + safeMargin) {
                // Position to the left
                left = taskRect.left - panelWidth - 12;
            } else {
                // Not enough space on either side, center it
                left = (viewportWidth - panelWidth) / 2;
            }
            
            // Vertical positioning
            top = Math.max(80, taskRect.top - 20);
            
            // Ensure vertical bounds
            const maxTop = viewportHeight - 400 - safeMargin; // Assume min 400px height
            if (top > maxTop) {
                top = Math.max(80, maxTop);
            }
        } else {
            // Default center positioning
            left = (viewportWidth - panelWidth) / 2;
            top = 120;
        }
        
        // Final safety clamp to ensure it's always visible
        left = Math.max(safeMargin, Math.min(left, viewportWidth - panelWidth - safeMargin));
        top = Math.max(80, top);
        
        // Debug log
        console.log(`Positioning panel: left=${left}, top=${top}, viewport=${viewportWidth}x${viewportHeight}, panelWidth=${panelWidth}`);
        
        this.quickPanel.style.left = `${left}px`;
        this.quickPanel.style.top = `${top}px`;
    }

    closeTaskQuickPanel() {
        if (this.quickPanel) {
            this.quickPanel.classList.remove('open');
        }
    }

    populateQuickPanel(task) {
        if (!this.ensureQuickPanelReady()) {
            return;
        }

        this.selectedTask = task;
        const elements = this.quickPanelElements;
        const job = dataManager.getJobById(task.jobId);
        const assignee = dataManager.getPersonById(task.assigneeId);
        const start = new Date(task.startAt || task.startDate || task.dueAt);
        const end = new Date(task.dueAt);
        const sameDay = start.toDateString() === end.toDateString();
        const defaultAssignee = this.quickPanelLastAssignee || task.assigneeId || '';

        if (elements.title) {
            elements.title.textContent = task.title;
        }
        if (elements.job) {
            elements.job.textContent = job ? job.name : 'No Job Assigned';
        }
        if (elements.assignee) {
            elements.assignee.textContent = assignee ? assignee.name : 'Unassigned';
        }
        if (elements.dates) {
            elements.dates.textContent = sameDay
                ? `Due ${this.formatDate(start)}`
                : `${this.formatDate(start)} → ${this.formatDate(end)}`;
        }
        if (elements.status) {
            elements.status.textContent = `Status: ${task.status.toUpperCase()}`;
        }
        if (elements.count) {
            const total = Array.isArray(task.subtasks) ? task.subtasks.length : 0;
            elements.count.textContent = `${total} total`;
        }
        if (elements.description) {
            elements.description.value = '';
        }

        this.populateQuickPanelAssignees(defaultAssignee);

        if (elements.dateInput) {
            const preferred = task.startDate || task.dueAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
            elements.dateInput.value = preferred;
        }

        this.renderQuickPanelSubtasks(task);
        
        // Auto-focus the description field for quick entry
        setTimeout(() => {
            if (this.quickPanelElements.description) {
                this.quickPanelElements.description.focus();
            }
        }, 100);
    }

    populateQuickPanelAssignees(selectedId) {
        if (!this.quickPanelElements.assigneeSelect) {
            return;
        }

        const select = this.quickPanelElements.assigneeSelect;
        const previousValue = select.value;
        select.innerHTML = '';

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Assign to...';
        select.appendChild(placeholderOption);

        const people = dataManager.getPeople()
            .filter(person => person.role !== 'client')
            .sort((a, b) => a.name.localeCompare(b.name));

        people.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            select.appendChild(option);
        });

        const targetValue = selectedId || previousValue || '';
        if (targetValue && select.querySelector(`option[value="${targetValue}"]`)) {
            select.value = targetValue;
        } else {
            select.value = '';
        }
    }

    renderQuickPanelSubtasks(task) {
        const container = this.quickPanelElements.subtaskList;
        if (!container) {
            return;
        }

        const subtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
        if (subtasks.length === 0) {
            container.innerHTML = '<div class="task-quick-empty">No tasks yet</div>';
            return;
        }

        subtasks.sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));

        container.innerHTML = subtasks.map(subtask => {
            const person = dataManager.getPersonById(subtask.assigneeId);
            const personName = person ? person.name : 'Unassigned';
            const subtaskDate = subtask.date ? new Date(subtask.date).toLocaleDateString() : 'No date';
            const completed = subtask.status === 'done';
            return `
                <div class="quick-subtask-item" data-subtask-id="${subtask.id}">
                    <label class="quick-subtask-toggle">
                        <input type="checkbox" class="quick-subtask-checkbox" ${completed ? 'checked' : ''}>
                        <span></span>
                    </label>
                    <div class="quick-subtask-main">
                        <div class="quick-subtask-desc ${completed ? 'done' : ''}">${subtask.description}</div>
                        <div class="quick-subtask-meta">${personName} • ${subtaskDate}</div>
                    </div>
                    <button type="button" class="quick-subtask-remove" title="Remove sub-task">&times;</button>
                </div>
            `;
        }).join('');
    }

    handleQuickSubtaskSubmit(event) {
        event.preventDefault();
        if (!this.selectedTask || !this.quickPanelElements.description || !this.quickPanelElements.assigneeSelect || !this.quickPanelElements.dateInput) {
            return;
        }

        const description = this.quickPanelElements.description.value.trim();
        const assigneeId = this.quickPanelElements.assigneeSelect.value;
        const dateValue = this.quickPanelElements.dateInput.value;

        if (!description || !assigneeId || !dateValue) {
            alert('Please provide a description, assignee, and date for the task.');
            return;
        }

        const subtask = {
            id: `subtask-${Date.now()}`,
            description,
            assigneeId,
            date: dateValue,
            status: 'open',
            createdAt: new Date().toISOString(),
            parentTaskId: this.selectedTask.id
        };

        const updatedSubtasks = Array.isArray(this.selectedTask.subtasks)
            ? [...this.selectedTask.subtasks, subtask]
            : [subtask];

        this.quickPanelLastAssignee = assigneeId;

        this.applyQuickTaskUpdate(this.selectedTask.id, { subtasks: updatedSubtasks }, `Task added for ${dataManager.getPersonById(assigneeId)?.name || 'assignee'}`);
        
        // Clear the form but keep smart defaults
        this.clearSubtaskForm();
        
        // Auto-focus for quick entry of another subtask
        setTimeout(() => {
            if (this.quickPanelElements.description) {
                this.quickPanelElements.description.focus();
            }
        }, 50);
    }

    handleQuickSubtaskActions(event) {
        if (!this.selectedTask) {
            return;
        }

        const removeBtn = event.target.closest('.quick-subtask-remove');
        if (removeBtn) {
            const wrapper = event.target.closest('.quick-subtask-item');
            if (wrapper) {
                const subtaskId = wrapper.dataset.subtaskId;
                this.removeQuickSubtask(subtaskId);
            }
        }
    }

    handleQuickSubtaskToggle(event) {
        if (!this.selectedTask) {
            return;
        }

        const checkbox = event.target.closest('.quick-subtask-checkbox');
        if (!checkbox) {
            return;
        }

        const wrapper = checkbox.closest('.quick-subtask-item');
        if (!wrapper) {
            return;
        }

        const subtaskId = wrapper.dataset.subtaskId;
        this.toggleQuickSubtask(subtaskId, checkbox.checked);
    }

    toggleQuickSubtask(subtaskId, completed) {
        if (!this.selectedTask) {
            return;
        }

        const updatedSubtasks = (this.selectedTask.subtasks || []).map(subtask => {
            if (subtask.id === subtaskId) {
                return {
                    ...subtask,
                    status: completed ? 'done' : 'open',
                    completedAt: completed ? new Date().toISOString() : null
                };
            }
            return subtask;
        });

        this.applyQuickTaskUpdate(
            this.selectedTask.id,
            { subtasks: updatedSubtasks },
            completed ? 'Task marked complete' : 'Task reopened'
        );
    }

    removeQuickSubtask(subtaskId) {
        if (!this.selectedTask) {
            return;
        }

        const updatedSubtasks = (this.selectedTask.subtasks || []).filter(subtask => subtask.id !== subtaskId);
        this.applyQuickTaskUpdate(this.selectedTask.id, { subtasks: updatedSubtasks }, 'Task removed');
    }

    applyQuickTaskUpdate(taskId, updates, feedbackMessage) {
        const updatedTask = dataManager.updateTask(taskId, updates);
        if (!updatedTask) {
            this.showFeedback('Unable to update task');
            return;
        }

        const wasOpen = this.quickPanel?.classList.contains('open');
        this.selectedTask = updatedTask;
        if (wasOpen) {
            this.populateQuickPanel(updatedTask);
        }
        this.renderCalendar();
        this.syncUnifiedModalTask(updatedTask);
        this.refreshQuickPanelIfSelected(updatedTask, wasOpen);

        // Notify app controller to refresh Today Prep
        if (typeof appController !== 'undefined' && appController.refreshTodayPrep) {
            appController.refreshTodayPrep();
        }

        if (feedbackMessage) {
            this.showFeedback(feedbackMessage);
        }
    }

    syncUnifiedModalTask(updatedTask) {
        if (typeof currentUnifiedTask === 'undefined' || !currentUnifiedTask) {
            return;
        }

        if (currentUnifiedTask.id !== updatedTask.id) {
            return;
        }

        currentUnifiedTask = {
            ...currentUnifiedTask,
            ...updatedTask
        };

        if (typeof renderUnifiedSubtasks === 'function') {
            renderUnifiedSubtasks();
        }
    }

    refreshQuickPanelIfSelected(updatedTask, forceOpen = false) {
        if (!updatedTask || !this.selectedTask || this.selectedTask.id !== updatedTask.id) {
            return;
        }

        this.selectedTask = updatedTask;
        const wasOpen = this.quickPanel?.classList.contains('open');
        const shouldOpen = forceOpen ? true : wasOpen;

        if (!shouldOpen || !this.ensureQuickPanelReady()) {
            return;
        }

        setTimeout(() => {
            if (this.selectedTask && this.selectedTask.id === updatedTask.id) {
                this.populateQuickPanel(this.selectedTask);
                this.quickPanel.classList.add('open');
            }
        }, 20);
    }
    
    setActiveButton(viewMode) {
        const viewButtons = document.querySelectorAll('.view-mode-btn');
        viewButtons.forEach(btn => btn.classList.remove('active'));
        
        const activeBtn = document.querySelector(`.view-mode-btn[data-view="${viewMode}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    getWeekStart(date) {
        const working = new Date(date);
        const day = working.getDay();
        const diff = working.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        working.setDate(diff);
        working.setHours(0, 0, 0, 0);
        return working;
    }

    getMonthStart(date) {
        const working = new Date(date);
        working.setDate(1);
        working.setHours(0, 0, 0, 0);
        return working;
    }

    setViewMode(viewMode) {
        this.currentViewMode = viewMode;
        if (!this.isMobile) {
            this.desktopViewMode = viewMode;
        }
        this.setActiveButton(viewMode);
        this.renderCalendar();
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    formatWeekRange(startDate) {
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + (this.visibleDays - 1));
        return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
    }

    calculateVisibleRange() {
        if (this.currentViewMode === 'month') {
            const monthStart = new Date(this.currentMonthStart);
            const rangeStart = new Date(monthStart);
            rangeStart.setDate(rangeStart.getDate() - monthStart.getDay());
            rangeStart.setHours(0, 0, 0, 0);

            const rangeEnd = new Date(rangeStart);
            rangeEnd.setDate(rangeEnd.getDate() + 41);
            rangeEnd.setHours(23, 59, 59, 999);

            return { start: rangeStart, end: rangeEnd };
        }

        let daysToShow = 7;
        if (this.currentViewMode === 'work-week') {
            daysToShow = 5;
        } else if (this.currentViewMode === 'day') {
            daysToShow = 1;
        }

        const rangeStart = new Date(this.currentWeekStart);
        rangeStart.setHours(0, 0, 0, 0);

        const rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeStart.getDate() + (daysToShow - 1));
        rangeEnd.setHours(23, 59, 59, 999);

        return { start: rangeStart, end: rangeEnd };
    }

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const weekDisplay = document.getElementById('calendarWeekDisplay');
        if (!grid || !weekDisplay) return;

        // Reset lane tracking for new render
        this.lanesByDay = {};

        // Initialize date ranges if not set
        this.currentWeekStart = this.getWeekStart(this.currentDate);
        this.currentMonthStart = this.getMonthStart(this.currentDate);
        
        // Set visible days based on view mode
        if (this.currentViewMode === 'work-week') {
            this.visibleDays = 5;
        } else if (this.currentViewMode === 'full-week') {
            this.visibleDays = 7;
        } else if (this.currentViewMode === 'day') {
            this.visibleDays = 1;
        } else {
            this.visibleDays = 7; // month view uses 7 columns
        }

        const { start: rangeStart, end: rangeEnd } = this.calculateVisibleRange();
        this.visibleRangeStart = rangeStart;
        this.visibleRangeEnd = rangeEnd;

        // Update display text based on view mode
        if (this.currentViewMode === 'month') {
            const monthName = this.currentMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            weekDisplay.textContent = monthName;
        } else if (this.currentViewMode === 'day') {
            const dayName = this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            weekDisplay.textContent = dayName;
        } else {
            const weekTitle = this.currentViewMode === 'work-week' ? 'Work Week' : 'Full Week';
            weekDisplay.textContent = `${weekTitle} of ${this.formatWeekRange(this.currentWeekStart)}`;
        }

        grid.innerHTML = '';
        
        // Remove existing view classes
        grid.classList.remove('month-view', 'week-view');
        
        if (this.currentViewMode === 'month') {
            grid.classList.add('month-view');
            grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
            // Use auto-sizing rows to allow expansion based on cell content
            grid.style.gridTemplateRows = '';
            this.renderMonthView(grid);
        } else {
            grid.classList.add('week-view');
            let minColWidth = '120px';
            if (this.currentViewMode === 'work-week') {
                minColWidth = '140px';
            } else if (this.currentViewMode === 'day') {
                minColWidth = '400px'; // Wider for single day view
            }
            grid.style.gridTemplateColumns = `repeat(${this.visibleDays}, minmax(${minColWidth}, 1fr))`;
            // Use auto-sizing rows to allow expansion based on cell content
            grid.style.gridTemplateRows = '';
            this.renderWeekView(grid);
        }

        this.populateCalendarTasks();
        this.highlightHighPriorityTasks();
        
        // Reposition all tasks after calendar is rendered to handle overlaps
        setTimeout(() => {
            this.repositionAllTasks();
            // Write lane CSS variables after tasks are positioned
            this._writeLaneVariablesToCells();
        }, 10);
    }

    renderWeekView(grid) {
        if (this.currentViewMode === 'day') {
            // Day view - show only the current date
            grid.appendChild(this.createDateHeader(this.currentDate));
            grid.appendChild(this.createDayCell(this.currentDate));
            return;
        }
        
        const daysToShow = this.currentViewMode === 'work-week' ? 5 : 7;
        
        // Create headers
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const date = new Date(this.currentWeekStart);
            date.setDate(this.currentWeekStart.getDate() + dayOffset);
            
            // Skip weekends in work week view
            if (this.currentViewMode === 'work-week' && (date.getDay() === 0 || date.getDay() === 6)) {
                continue;
            }
            
            grid.appendChild(this.createDateHeader(date));
        }

        // Create day cells
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const date = new Date(this.currentWeekStart);
            date.setDate(this.currentWeekStart.getDate() + dayOffset);
            
            // Skip weekends in work week view
            if (this.currentViewMode === 'work-week' && (date.getDay() === 0 || date.getDay() === 6)) {
                continue;
            }
            
            grid.appendChild(this.createDayCell(date));
        }
    }

    renderMonthView(grid) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Create day name headers
        dayNames.forEach(dayName => {
            const header = document.createElement('div');
            header.className = 'calendar-header month-day-header';
            header.textContent = dayName;
            grid.appendChild(header);
        });

        // Use the precomputed range start so task queries and cells stay aligned
        const startDate = new Date(this.visibleRangeStart || this.currentMonthStart);

        // Create 42 day cells (6 weeks)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const cell = this.createDayCell(date);
            
            // Add class for days not in current month
            if (date.getMonth() !== this.currentMonthStart.getMonth()) {
                cell.classList.add('other-month');
            }
            
            grid.appendChild(cell);
        }
    }

    createDateHeader(date) {
        const cell = document.createElement('div');
        cell.className = 'calendar-header';

        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNumber = date.getDate();
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });

        cell.innerHTML = `
            <div>${dayName}</div>
            <div>${monthName} ${dayNumber}</div>
        `;

        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }

        return cell;
    }

    createDayCell(date) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        cell.dataset.date = date.toISOString();

        // Add day number at the top of the cell
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = date.getDate();
        cell.appendChild(dayNumber);

        // Add tasks container
        const tasksContainer = document.createElement('div');
        tasksContainer.className = 'calendar-cell-tasks';
        cell.appendChild(tasksContainer);

        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }

        cell.addEventListener('click', (event) => {
            if (event.target === cell || event.target === dayNumber) {
                this.handleCellClick(date);
            }
        });

        cell.addEventListener('dragover', (event) => this.handleDragOver(event));
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', (event) => this.handleDrop(event));

        return cell;
    }

    populateCalendarTasks() {
        if (!this.visibleRangeStart || !this.visibleRangeEnd) {
            return;
        }

        const startDate = new Date(this.visibleRangeStart);
        const endDate = new Date(this.visibleRangeEnd);
        
        const tasks = dataManager
            .getTasksForDateRange(startDate, endDate)
            .filter(task => this.passesFilters(task))
            .sort((a, b) => this.sortTasks(a, b));

        // THREE-PASS RENDERING to fix stacking and spanning issues:
        
        // PASS 1: Analyze all tasks and calculate lane requirements per cell
        console.log('🔄 PASS 1: Analyzing lane requirements for', tasks.length, 'tasks');
        const laneRequirementsByCell = new Map(); // cell -> max lane needed
        
        tasks.forEach(task => {
            const viewStart = new Date(this.visibleRangeStart);
            const viewEnd = new Date(this.visibleRangeEnd);
            const rawStart = new Date(task.startAt || task.startDate || task.dueAt);
            const rawEnd = new Date(task.dueAt);
            
            if (rawEnd < viewStart || rawStart > viewEnd) return;
            
            const visibleStart = rawStart < viewStart ? new Date(viewStart) : new Date(rawStart);
            const visibleEnd = rawEnd > viewEnd ? new Date(viewEnd) : new Date(rawEnd);
            visibleStart.setHours(0, 0, 0, 0);
            visibleEnd.setHours(0, 0, 0, 0);
            
            // Get all cells this task will occupy
            const cells = this.getCellsForDateRange(visibleStart, visibleEnd);
            if (cells.length === 0) return;
            
            // Find which lane this task needs
            const lane = this.findBestLaneForCells(cells, laneRequirementsByCell);
            
            // Record this lane usage in all affected cells
            cells.forEach(cell => {
                const currentMax = laneRequirementsByCell.get(cell) || 0;
                laneRequirementsByCell.set(cell, Math.max(currentMax, lane + 1));
            });
        });
        
        // PASS 2: Set cell heights based on lane requirements BEFORE positioning
        console.log('📏 PASS 2: Setting cell heights for', laneRequirementsByCell.size, 'cells');
        const taskHeight = 22;
        const taskSpacing = 1;
        const headerHeight = 34;
        const basePadding = 4;
        
        laneRequirementsByCell.forEach((maxLanes, cell) => {
            const requiredHeight = headerHeight + (maxLanes * (taskHeight + taskSpacing)) + basePadding;
            cell.style.minHeight = `${requiredHeight}px`;
            // Also update CSS variable for reference
            cell.style.setProperty('--lanes-used', String(maxLanes));
        });
        
        // PASS 3: Position tasks with stable offsetTop values
        console.log('📍 PASS 3: Positioning tasks with stable coordinates');
        this.deferCellHeightUpdates = true; // Prevent further height changes
        this.pendingCellHeights = new Map();
        
        tasks.forEach(task => this.addTaskToCalendar(task));
        
        this.deferCellHeightUpdates = false;
        
        console.log('✅ Three-pass rendering complete');
    }

    applyPendingCellHeights() {
        // Apply all pending cell height updates collected during task rendering
        if (this.pendingCellHeights && this.pendingCellHeights.size > 0) {
            this.pendingCellHeights.forEach((minHeight, cell) => {
                cell.style.minHeight = `${minHeight}px`;
            });
            this.pendingCellHeights.clear();
        }
    }
    
    findBestLaneForCells(cells, laneRequirementsByCell) {
        // Find the first lane that's available across ALL cells
        // This is used during the analysis pass (Pass 1)
        const maxLanes = this.maxLanesPerDay || 12;
        
        for (let lane = 0; lane < maxLanes; lane++) {
            let laneAvailable = true;
            
            // Check if this lane is free in all cells
            for (const cell of cells) {
                const usedLanes = laneRequirementsByCell.get(cell) || 0;
                if (lane < usedLanes) {
                    // This lane is already occupied in this cell
                    laneAvailable = false;
                    break;
                }
            }
            
            if (laneAvailable) {
                return lane;
            }
        }
        
        // Fallback: use next available lane
        let maxLane = 0;
        cells.forEach(cell => {
            const usedLanes = laneRequirementsByCell.get(cell) || 0;
            maxLane = Math.max(maxLane, usedLanes);
        });
        
        return maxLane;
    }

    passesFilters(task) {
        const { jobId, assigneeId, priority, status } = this.filters;

        if (jobId !== 'all' && task.jobId !== jobId) return false;
        if (assigneeId !== 'all' && task.assigneeId !== assigneeId) return false;
        if (priority !== 'all' && task.priority !== priority) return false;
        if (status !== 'all' && task.status !== status) return false;

        if (this.searchTerm) {
            const assignee = dataManager.getPersonById(task.assigneeId);
            const job = dataManager.getJobById(task.jobId);
            const haystack = [
                task.title,
                task.notes,
                task.location,
                assignee ? assignee.name : '',
                job ? job.name : ''
            ].join(' ').toLowerCase();

            if (!haystack.includes(this.searchTerm)) {
                return false;
            }
        }

        return true;
    }

    sortTasks(a, b) {
        const startA = new Date(a.startAt || a.startDate || a.dueAt);
        const startB = new Date(b.startAt || b.startDate || b.dueAt);
        if (startA.getTime() !== startB.getTime()) {
            return startA - startB;
        }

        const priorityOrder = ['urgent', 'high', 'normal', 'low'];
        const priorityA = priorityOrder.indexOf(a.priority);
        const priorityB = priorityOrder.indexOf(b.priority);
        if (priorityA !== priorityB) {
            const weightA = priorityA === -1 ? priorityOrder.length : priorityA;
            const weightB = priorityB === -1 ? priorityOrder.length : priorityB;
            return weightA - weightB;
        }

        return (a.title || '').localeCompare(b.title || '');
    }

    addTaskToCalendar(task) {
        if (!this.visibleRangeStart || !this.visibleRangeEnd) {
            return;
        }

        const viewStart = new Date(this.visibleRangeStart);
        const viewEnd = new Date(this.visibleRangeEnd);

        const rawStart = new Date(task.startAt || task.startDate || task.dueAt);
        const rawEnd = new Date(task.dueAt);

        if (rawEnd < viewStart || rawStart > viewEnd) {
            return;
        }

        const visibleStart = rawStart < viewStart ? new Date(viewStart) : new Date(rawStart);
        const visibleEnd = rawEnd > viewEnd ? new Date(viewEnd) : new Date(rawEnd);

        visibleStart.setHours(0, 0, 0, 0);
        visibleEnd.setHours(0, 0, 0, 0);

        const spanDays = this.calculateSpanDays(visibleStart, visibleEnd);
        
        if (spanDays === 1) {
            // Single day task - use existing logic
            const targetCell = this.findCellForDate(visibleStart);
            if (!targetCell) return;
            
            const taskElement = this.createTaskElement(
                task,
                spanDays,
                rawStart < viewStart,
                rawEnd > viewEnd
            );
            taskElement.dataset.originDate = visibleStart.toISOString();
            
            this.positionTaskElement(targetCell, taskElement, spanDays);
        } else {
            // Multi-day task - create task segments for each day
            this.createMultiDayTask(task, visibleStart, visibleEnd, rawStart < viewStart, rawEnd > viewEnd);
        }
    }

    createMultiDayTask(task, visibleStart, visibleEnd, clippedStart, clippedEnd) {
        // Calculate cells per row based on view mode
        const cellsInRow = this.currentViewMode === 'month' ? 7 : this.visibleDays;
        
        // Get all cells for the task's date range
        const cells = this.getCellsForDateRange(visibleStart, visibleEnd);
        if (cells.length === 0) return;
        
        // Group cells into rows
        const rowGroups = [];
        let currentRow = [];
        let lastCellIndex = -1;
        
        cells.forEach((cell, idx) => {
            const allCells = Array.from(cell.parentElement.children).filter(el => 
                el.classList.contains('calendar-day-cell'));
            const cellIndex = allCells.indexOf(cell);
            
            // Check if this cell starts a new row
            if (lastCellIndex >= 0 && cellIndex <= lastCellIndex) {
                // New row detected
                rowGroups.push(currentRow);
                currentRow = [cell];
            } else if (lastCellIndex >= 0 && (cellIndex % cellsInRow) === 0) {
                // New row by column position
                rowGroups.push(currentRow);
                currentRow = [cell];
            } else {
                currentRow.push(cell);
            }
            
            lastCellIndex = cellIndex;
        });
        
        // Add the last row
        if (currentRow.length > 0) {
            rowGroups.push(currentRow);
        }
        
        // CRITICAL FIX: Calculate the best vertical position ONCE for the entire task
        // by analyzing all cells across all rows. This ensures all segments use the same lane.
        const totalSpanDays = cells.length;
        const bestPosition = this.findBestTaskPositionForEntireSpan(cells, totalSpanDays);
        
        // CRITICAL: Reserve shadows for ALL cells ONCE before creating segments
        // This ensures proper lane detection for subsequent tasks
        if (totalSpanDays > 1) {
            // Create a temporary element just for shadow reservation
            const tempElement = document.createElement('div');
            tempElement.dataset.taskId = task.id;
            // Pass the actual cells array to ensure shadows are created in ALL cells across ALL rows
            this.reserveShadowsForCells(cells, bestPosition, tempElement);
        }
        
        // Create a task segment for each row, using the shared vertical position
        rowGroups.forEach((rowCells, rowIndex) => {
            if (rowCells.length === 0) return;
            
            const firstCell = rowCells[0];
            const segmentSpanDays = rowCells.length;
            
            // Determine if this segment is clipped
            const isFirstSegment = rowIndex === 0;
            const isLastSegment = rowIndex === rowGroups.length - 1;
            const segmentClippedStart = isFirstSegment && clippedStart;
            const segmentClippedEnd = isLastSegment && clippedEnd;
            
            const taskElement = this.createTaskElement(
                task,
                segmentSpanDays,
                segmentClippedStart,
                segmentClippedEnd
            );
            taskElement.classList.add('task-span');
            taskElement.dataset.spanStart = visibleStart.toISOString();
            taskElement.dataset.spanEnd = visibleEnd.toISOString();
            taskElement.dataset.originDate = visibleStart.toISOString();
            taskElement.dataset.segmentIndex = rowIndex;

            // Use the shared vertical position for all segments
            // Note: We skip shadow creation here since we already did it above for all cells
            this.positionTaskElementAtPosition(firstCell, taskElement, segmentSpanDays, bestPosition, true);
            
            // Ensure multi-day task visibility
            taskElement.style.display = 'flex';
            taskElement.style.visibility = 'visible';
            taskElement.style.opacity = '1';
        });
    }
    
    getCellsForDateRange(startDate, endDate) {
        const cells = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const cell = this.findCellForDate(currentDate);
            if (cell) {
                cells.push(cell);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return cells;
    }
    


    createTaskElement(task, spanDays, clippedStart, clippedEnd) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item priority-${task.priority} status-${task.status}`;
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.spanDays = spanDays;
        taskElement.draggable = true;

        const assignee = dataManager.getPersonById(task.assigneeId);
        const job = dataManager.getJobById(task.jobId);
        const startDate = new Date(task.startAt || task.startDate || task.dueAt);
        const endDate = new Date(task.dueAt);
        const canResize = (dataManager.getPersonById(dataManager.getCurrentUser())?.role || 'admin') !== 'crew';

        const footerLabel = spanDays > 1
            ? `${this.formatDate(startDate)} -> ${this.formatDate(endDate)}`
            : `Due ${this.formatDate(startDate)}`;

        const subtaskCount = (task.subtasks || []).length;
        const dependencyCount = (task.dependencies || []).length;
        const isBlocked = this.isTaskBlocked(task);
        const blockedClass = isBlocked ? 'task-blocked' : '';

        // Compact display like Excel cells
        const assigneeName = assignee ? assignee.name.split(' ')[0] : 'Unassigned'; // First name only
        const jobName = job ? job.name.substring(0, 15) + (job.name.length > 15 ? '...' : '') : 'No Job';
        
        const indicators = [];
        if (isBlocked) indicators.push('🚫');
        if (dependencyCount > 0) indicators.push(`🔗${dependencyCount}`);
        if (subtaskCount > 0) indicators.push(`📋${subtaskCount}`);
        if (task.requiredProof !== 'none') indicators.push(task.requiredProof === 'photo' ? '📷' : '✓');
        
        // Display the task title with flexible truncation when needed
        const titleText = (task.title || '').trim() || '(No title)';
        const fullTooltip = `${titleText}\\nAssigned: ${assignee ? assignee.name : 'Unassigned'}\\nJob: ${jobName}\\nDates: ${footerLabel}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-title';
        titleSpan.textContent = titleText;
        taskElement.appendChild(titleSpan);
        
        if (!Number.isNaN(startDate.getTime())) {
            taskElement.dataset.originDate = startDate.toISOString();
        }
        
        taskElement.setAttribute('title', fullTooltip);
        
        // Ensure task is visible
        taskElement.style.display = 'flex';
        taskElement.style.visibility = 'visible';
        taskElement.style.opacity = '1';

        // Apply status classes for color coding
        taskElement.classList.add(`status-${task.status}`);
        
        // Apply status classes for color coding
        taskElement.classList.add(`status-${task.status}`);
        
        if (task.status === 'done') {
            taskElement.classList.add('completed');
        } else if (task.status === 'doing') {
            taskElement.classList.add('in-progress');
        }

        if (clippedStart) {
            taskElement.classList.add('clipped-start');
        }

        if (clippedEnd) {
            taskElement.classList.add('clipped-end');
        }

        if (canResize) {
            taskElement.classList.add('task-resizable');
            const startHandle = this.buildResizeHandle(task, taskElement, 'start');
            const endHandle = this.buildResizeHandle(task, taskElement, 'end');
            taskElement.appendChild(startHandle);
            taskElement.appendChild(endHandle);
        }

        // Add blocked class if task is blocked by dependencies
        if (isBlocked) {
            taskElement.classList.add(blockedClass);
        }

        taskElement.addEventListener('click', (event) => this.handleTaskClick(task, event));
        taskElement.addEventListener('dragstart', (event) => this.handleDragStart(event, task));
        taskElement.addEventListener('dragend', (event) => this.handleDragEnd(event));

        return taskElement;
    }

    isTaskBlocked(task) {
        if (!task.dependencies || task.dependencies.length === 0) {
            return false;
        }
        
        const allTasks = dataManager.getTasks();
        const dependencyTasks = allTasks.filter(t => task.dependencies.includes(t.id));
        
        return dependencyTasks.some(depTask => depTask.status !== 'done');
    }

    findCellForDate(date) {
        if (!date || isNaN(date.getTime())) {
            console.warn('findCellForDate: invalid date', date);
            return null;
        }
        
        const cells = document.querySelectorAll('.calendar-day-cell');
        // Only log excessive searches - reduce console spam
        if (!this.findCellLogCounter) this.findCellLogCounter = 0;
        this.findCellLogCounter++;
        if (this.findCellLogCounter % 50 === 1) {
            console.log(`findCellForDate: searching ${cells.length} cells (logged every 50 calls)`);
        }
        
        for (const cell of cells) {
            if (!cell.dataset.date) continue;
            
            const cellDate = new Date(cell.dataset.date);
            if (isNaN(cellDate.getTime())) continue;
            
            if (cellDate.toDateString() === date.toDateString()) {
                return cell;
            }
        }
        
        // Only log missing cells occasionally to avoid spam
        if (this.findCellLogCounter % 100 === 1) {
            console.warn(`findCellForDate: no cell found for ${date.toDateString()}`);
        }
        return null;
    }

    /**
     * Find the calendar cell at the given mouse coordinates
     * Returns the cell element or null if not over a calendar cell
     */
    findCellAtMousePosition(clientX, clientY) {
        const element = document.elementFromPoint(clientX, clientY);
        if (!element) return null;
        
        // Check if the element itself is a calendar cell
        if (element.classList.contains('calendar-day-cell')) {
            return element;
        }
        
        // Check if it's inside a calendar cell
        const cell = element.closest('.calendar-day-cell');
        return cell;
    }
    
    /**
     * Get the date from a calendar cell element
     * Returns a Date object or null if the cell doesn't have a valid date
     */
    getCellDate(cellElement) {
        if (!cellElement || !cellElement.dataset.date) {
            return null;
        }
        
        const date = new Date(cellElement.dataset.date);
        if (isNaN(date.getTime())) {
            return null;
        }
        
        date.setHours(0, 0, 0, 0);
        return date;
    }
    
    /**
     * Calculate the difference in days between two dates
     * Returns a positive number if date2 is after date1, negative if before
     */
    calculateDayDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        
        const diffMs = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    calculateSpanDays(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff + 1);
    }

    positionTaskElement(targetCell, taskElement, spanDays) {
        const cellRect = targetCell.getBoundingClientRect();
        const cellWidth = cellRect.width || 120;
        const gridElement = targetCell.parentElement;
        let gap = 0;
        if (gridElement) {
            const gapValue = parseFloat(window.getComputedStyle(gridElement).getPropertyValue('gap'));
            if (!Number.isNaN(gapValue)) {
                gap = gapValue;
            }
        }
        const horizontalPadding = 4;
        
        // Calculate width for multi-day tasks with seamless spanning
        let totalWidth;
        if (spanDays > 1) {
            const effectiveCellWidth = cellWidth + gap;
            totalWidth = (effectiveCellWidth * spanDays) - gap - horizontalPadding;
        } else {
            totalWidth = cellWidth - horizontalPadding;
        }
        
        // Ensure minimum width for usability and visibility
        totalWidth = Math.max(60, totalWidth);

        taskElement.style.position = 'absolute';
        taskElement.style.width = `${totalWidth}px`;
        taskElement.style.zIndex = 2;

        // Find the best vertical position to avoid overlaps across all affected cells
        const bestPosition = this.findBestTaskPositionMultiDay(targetCell, taskElement, spanDays);
        
        if (spanDays > 1) {
            // Place multi-day spans relative to the calendar grid so they stay aligned as rows grow
            this.placeSpanElement(taskElement, targetCell, bestPosition);
        } else {
            // Single day tasks use the tasks container within the cell
            taskElement.style.left = `${bestPosition.left}px`;
            taskElement.style.top = `${bestPosition.top}px`;
            const tasksContainer = targetCell.querySelector('.calendar-cell-tasks');
            (tasksContainer || targetCell).appendChild(taskElement);
        }
        taskElement.dataset.positioned = 'true';
        
        // Force visibility and proper display with important flags
        taskElement.style.display = 'flex';
        taskElement.style.visibility = 'visible';
        taskElement.style.opacity = '1';
        taskElement.style.minHeight = '20px';
        
        this.reserveSlotForSpan(targetCell, bestPosition, spanDays, taskElement);

        // Update height for all affected cells
        this.updateCellHeightsForSpan(targetCell, spanDays, bestPosition.top + 22);
        
        // Track lanes used for each day and update CSS variables
        this.updateLanesForSpan(targetCell, spanDays, bestPosition.top);
    }

    findBestTaskPositionMultiDay(startCell, newTaskElement, spanDays) {
        const taskHeight = 22;
        const taskSpacing = 1;
        const leftMargin = 2;
        const headerHeight = 34;
        
        // Get all cells this task will span across
        const affectedCells = this.getCellsForSpan(startCell, spanDays);
        
        // Collect existing tasks with improved filtering for resize operations
        const occupiedSlots = new Map(); // track occupied vertical slots
        const allExistingTasks = [];
        
        affectedCells.forEach((cell, cellIndex) => {
            const tasksInCell = Array.from(cell.querySelectorAll('.task-item, .task-shadow, .task-resize-preview'))
                .filter(task => {
                    // Skip the element being positioned
                    if (task === newTaskElement) return false;
                    
                    // Skip resize preview elements for the same task (during resize operations)
                    if (task.classList.contains('task-resize-preview') && 
                        newTaskElement.dataset.taskId === task.dataset.taskId) {
                        return false;
                    }
                    
                    // Include properly positioned elements
                    return task.classList.contains('task-shadow') || 
                           task.dataset.positioned === 'true' ||
                           task.classList.contains('task-resize-preview');
                });
            
            tasksInCell.forEach(task => {
                const taskTop = parseInt(task.style.top) || headerHeight;
                const taskLeft = parseInt(task.style.left) || leftMargin;
                const taskWidth = parseInt(task.style.width) || 100;
                
                // Create a unique key for this vertical slot across the span
                const slotKey = `${taskTop}-${taskHeight}`;
                
                if (!occupiedSlots.has(slotKey)) {
                    occupiedSlots.set(slotKey, []);
                }
                occupiedSlots.get(slotKey).push({
                    cellIndex,
                    left: taskLeft,
                    width: taskWidth,
                    top: taskTop
                });
                
                allExistingTasks.push({
                    top: taskTop,
                    height: taskHeight,
                    width: taskWidth,
                    left: taskLeft,
                    cellIndex
                });
            });
        });

        // Sort by top position for easier slot finding
        allExistingTasks.sort((a, b) => a.top - b.top);

        // Find first available vertical slot that works across all cells
        let currentTop = headerHeight;
        const maxAttempts = this.maxLanesPerDay || 12; // Use dynamic lane count
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const slotKey = `${currentTop}-${taskHeight}`;
            const existingInSlot = occupiedSlots.get(slotKey) || [];
            
            // Check if this slot is free across all affected cells
            let slotAvailable = true;
            
            // Simple approach: if any cell in this slot has a task, move down
            if (existingInSlot.length > 0) {
                slotAvailable = false;
            }
            
            if (slotAvailable) {
                return { top: currentTop, left: leftMargin };
            }
            
            // Move to next slot
            currentTop += taskHeight + taskSpacing;
            attempts++;
        }

        // Fallback: stack at the bottom
        const maxTop = Math.max(headerHeight, ...allExistingTasks.map(t => t.top + t.height + taskSpacing));
        return { top: maxTop, left: leftMargin };
    }

    findBestTaskPositionForEntireSpan(allCells, totalSpanDays) {
        const taskHeight = 22;
        const taskSpacing = 1;
        const leftMargin = 2;
        const headerHeight = 34;
        
        console.log(`🔍 findBestTaskPositionForEntireSpan: Analyzing ${allCells.length} cells for ${totalSpanDays} day span`);
        
        // Analyze ALL cells that this task will span (including across multiple rows)
        // to find a consistent vertical lane that's available across the entire span
        // We rely on shadow elements being placed in cells for proper detection
        const occupiedSlotsByLane = new Map(); // lane index -> set of cell indices that are occupied
        
        // Check tasks and shadows within each cell
        allCells.forEach((cell, cellIndex) => {
            const tasksInCell = Array.from(cell.querySelectorAll('.task-item, .task-shadow'))
                .filter(task => {
                    // Include properly positioned elements
                    return task.dataset.positioned === 'true';
                });
            
            if (tasksInCell.length > 0) {
                console.log(`  Cell ${cellIndex} (${cell.dataset.date}): ${tasksInCell.length} positioned elements`);
            }
            
            tasksInCell.forEach(task => {
                const taskTop = parseInt(task.style.top) || headerHeight;
                // Calculate which lane this task occupies (0-based)
                const laneIndex = Math.floor((taskTop - headerHeight) / (taskHeight + taskSpacing));
                
                if (laneIndex >= 0 && laneIndex < 50) { // Sanity check
                    if (!occupiedSlotsByLane.has(laneIndex)) {
                        occupiedSlotsByLane.set(laneIndex, new Set());
                    }
                    occupiedSlotsByLane.get(laneIndex).add(cellIndex);
                }
            });
        });
        
        console.log(`  Occupied lanes:`, Array.from(occupiedSlotsByLane.keys()).sort((a,b) => a-b));
        
        // Find the first lane that's completely free across all cells
        const maxLanes = this.maxLanesPerDay || 12;
        for (let lane = 0; lane < maxLanes; lane++) {
            const occupiedCells = occupiedSlotsByLane.get(lane);
            
            // If this lane is completely unoccupied across all cells, use it
            if (!occupiedCells || occupiedCells.size === 0) {
                const top = headerHeight + (lane * (taskHeight + taskSpacing));
                console.log(`  ✅ Found free lane ${lane} at top=${top}`);
                return { top, left: leftMargin };
            }
            
            // Check if this lane is free for ALL our cells
            let hasConflict = false;
            for (let cellIdx = 0; cellIdx < allCells.length; cellIdx++) {
                if (occupiedCells.has(cellIdx)) {
                    hasConflict = true;
                    break;
                }
            }
            
            if (!hasConflict) {
                const top = headerHeight + (lane * (taskHeight + taskSpacing));
                console.log(`  ✅ Found free lane ${lane} (no conflicts) at top=${top}`);
                return { top, left: leftMargin };
            }
        }
        
        // Fallback: use the next available lane after the highest occupied lane
        let maxLane = -1;
        occupiedSlotsByLane.forEach((cells, lane) => {
            if (cells.size > 0 && lane > maxLane) {
                maxLane = lane;
            }
        });
        
        const top = headerHeight + ((maxLane + 1) * (taskHeight + taskSpacing));
        console.log(`  ⚠️ Using fallback lane ${maxLane + 1} at top=${top}`);
        return { top, left: leftMargin };
    }

    getCellsForSpan(startCell, spanDays) {
        const cells = [startCell];
        if (spanDays <= 1) return cells;

        const grid = startCell.parentElement;
        const allCells = Array.from(grid.querySelectorAll('.calendar-day-cell'));
        const startIndex = allCells.indexOf(startCell);
        
        for (let i = 1; i < spanDays && startIndex + i < allCells.length; i++) {
            cells.push(allCells[startIndex + i]);
        }
        
        return cells;
    }

    positionTaskElementAtPosition(targetCell, taskElement, spanDays, precalculatedPosition, skipShadows = false) {
        // Similar to positionTaskElement but uses a pre-calculated vertical position
        // This ensures all segments of a multi-row task use the same lane
        const cellRect = targetCell.getBoundingClientRect();
        const cellWidth = cellRect.width || 120;
        const gridElement = targetCell.parentElement;
        let gap = 0;
        if (gridElement) {
            const gapValue = parseFloat(window.getComputedStyle(gridElement).getPropertyValue('gap'));
            if (!Number.isNaN(gapValue)) {
                gap = gapValue;
            }
        }
        const horizontalPadding = 4;
        
        // Calculate width for multi-day tasks with seamless spanning
        let totalWidth;
        if (spanDays > 1) {
            const effectiveCellWidth = cellWidth + gap;
            totalWidth = (effectiveCellWidth * spanDays) - gap - horizontalPadding;
        } else {
            totalWidth = cellWidth - horizontalPadding;
        }
        
        // Ensure minimum width for usability and visibility
        totalWidth = Math.max(60, totalWidth);

        taskElement.style.position = 'absolute';
        taskElement.style.width = `${totalWidth}px`;
        taskElement.style.zIndex = 2;

        if (spanDays > 1) {
            // Place multi-day spans relative to the grid using the shared lane coordinates
            this.placeSpanElement(taskElement, targetCell, precalculatedPosition);
        } else {
            // Single day tasks use the tasks container within the cell
            taskElement.style.left = `${precalculatedPosition.left}px`;
            taskElement.style.top = `${precalculatedPosition.top}px`;
            const tasksContainer = targetCell.querySelector('.calendar-cell-tasks');
            (tasksContainer || targetCell).appendChild(taskElement);
        }
        taskElement.dataset.positioned = 'true';
        
        // Force visibility and proper display with important flags
        taskElement.style.display = 'flex';
        taskElement.style.visibility = 'visible';
        taskElement.style.opacity = '1';
        taskElement.style.minHeight = '20px';
        
        // Only reserve shadows if not already done (for multi-row tasks, shadows are created once for all cells)
        if (!skipShadows) {
            this.reserveSlotForSpan(targetCell, precalculatedPosition, spanDays, taskElement);
        }

        // Update height for all affected cells
        this.updateCellHeightsForSpan(targetCell, spanDays, precalculatedPosition.top + 22);
        
        // Track lanes used for each day and update CSS variables
        this.updateLanesForSpan(targetCell, spanDays, precalculatedPosition.top);
    }

    updateCellHeightsForSpan(startCell, spanDays, minBottom) {
        const affectedCells = this.getCellsForSpan(startCell, spanDays);
        const minHeight = Math.max(60, minBottom + 4);
        
        if (this.deferCellHeightUpdates) {
            // Defer updates - just track the maximum required height per cell
            affectedCells.forEach(cell => {
                const currentPending = this.pendingCellHeights.get(cell) || 0;
                this.pendingCellHeights.set(cell, Math.max(currentPending, minHeight));
            });
        } else {
            // Apply immediately
            affectedCells.forEach(cell => {
                cell.style.minHeight = `${minHeight}px`;
            });
        }
    }

    // Helper: Update lane usage tracking for a span
    updateLanesForSpan(startCell, spanDays, taskTop) {
        const taskHeight = 22;
        const taskSpacing = 1;
        const headerHeight = 34;
        
        // Calculate which lane this task is in (0-based)
        const laneIndex = Math.floor((taskTop - headerHeight) / (taskHeight + taskSpacing));
        
        const affectedCells = this.getCellsForSpan(startCell, spanDays);
        affectedCells.forEach(cell => {
            const dayKey = cell.dataset.date || cell.dataset.day;
            if (!dayKey) return;
            
            // Track max lane used for this day (convert to 1-based count)
            const currentMax = this.lanesByDay[dayKey] || 0;
            this.lanesByDay[dayKey] = Math.max(currentMax, laneIndex + 1);
            
            // Update CSS variable for dynamic cell height
            cell.style.setProperty('--lanes-used', this.lanesByDay[dayKey]);
        });
    }

    // Helper: Get number of lanes used for a specific day
    _lanesUsedForDay(dayKey) {
        return this.lanesByDay[dayKey] || 0;
    }

    // Helper: Write --lanes-used CSS variables to all visible day cells
    _writeLaneVariablesToCells() {
        try {
            const grid = document.getElementById('calendarGrid');
            if (!grid) return;
            
            const cells = grid.querySelectorAll('.calendar-day-cell');
            if (!cells || !cells.length) return;

            cells.forEach(cell => {
                const dayKey = cell.dataset.date;
                if (!dayKey) return;
                
                // Get lane count from tracking map, fallback to counting positioned tasks
                let lanesUsed = this.lanesByDay[dayKey] || 0;
                
                if (lanesUsed === 0) {
                    // Fallback: count visible task items in this cell
                    const tasks = cell.querySelectorAll('.task-item[data-positioned="true"]');
                    lanesUsed = Math.max(1, tasks.length);
                }
                
                cell.style.setProperty('--lanes-used', String(lanesUsed));
            });
        } catch (e) {
            console.error('Failed to write --lanes-used to cells', e);
        }
    }

    // Helper: Write --lanes-used CSS variables to all visible day cells
    _writeLaneVariablesToCells() {
        try {
            const grid = document.getElementById('calendarGrid');
            if (!grid) return;
            
            const cells = grid.querySelectorAll('.calendar-day-cell');
            if (!cells || !cells.length) return;

            cells.forEach(cell => {
                const dayKey = cell.dataset.date;
                if (!dayKey) return;
                
                // Get lane count from tracking map, fallback to counting positioned tasks
                let lanesUsed = this.lanesByDay[dayKey] || 0;
                
                if (lanesUsed === 0) {
                    // Fallback: count visible task items in this cell
                    const tasks = cell.querySelectorAll('.task-item[data-positioned="true"]');
                    lanesUsed = Math.max(1, tasks.length);
                }
                
                cell.style.setProperty('--lanes-used', String(lanesUsed));
            });
        } catch (e) {
            console.error('Failed to write --lanes-used to cells', e);
        }
    }

    placeSpanElement(taskElement, startCell, position) {
        if (!startCell) {
            return;
        }

        // Position relative to the grid to allow multi-day spanning
        // With pre-calculated cell heights (Pass 2), offsetTop is now stable
        const grid = document.getElementById('calendarGrid');
        if (!grid) {
            console.error('Calendar grid not found');
            return;
        }
        
        const baseLeft = startCell.offsetLeft || 0;
        const baseTop = startCell.offsetTop || 0;
        const left = baseLeft + position.left;
        const top = baseTop + position.top;
        
        taskElement.style.left = `${left}px`;
        taskElement.style.top = `${top}px`;
        taskElement.style.position = 'absolute';
        
        // Append to grid to allow visual spanning across multiple cells
        grid.appendChild(taskElement);
    }

    reserveSlotForSpan(startCell, position, spanDays, sourceElement) {
        if (spanDays <= 1) {
            return;
        }

        const affectedCells = this.getCellsForSpan(startCell, spanDays);
        const shadowLeft = position.left;
        const shadowTop = position.top;
        const taskId = sourceElement?.dataset?.taskId || '';

        // Clean up any existing shadows for this task first
        affectedCells.forEach(cell => {
            const existingShadows = cell.querySelectorAll(`[data-shadow-for="${taskId}"]`);
            existingShadows.forEach(shadow => shadow.remove());
        });

        // Create new shadows for each affected cell so lane calculations stay consistent
        affectedCells.forEach(cell => {
            if (!cell) return;
            
            const shadow = document.createElement('div');
            shadow.className = 'task-shadow';
            shadow.style.position = 'absolute';
            shadow.style.left = `${shadowLeft}px`;
            shadow.style.top = `${shadowTop}px`;
            shadow.style.width = '1px';
            shadow.style.height = '24px';
            shadow.style.pointerEvents = 'none';
            shadow.style.visibility = 'hidden'; // Hidden but reserves space
            shadow.dataset.shadowFor = taskId;
            shadow.dataset.taskId = taskId;
            shadow.dataset.positioned = 'true';
            cell.appendChild(shadow);
        });
    }

    reserveShadowsForCells(cells, position, sourceElement) {
        // Similar to reserveSlotForSpan but takes an explicit array of cells
        // This is used for multi-row tasks where getCellsForSpan doesn't work correctly
        const shadowLeft = position.left;
        const shadowTop = position.top;
        const taskId = sourceElement?.dataset?.taskId || '';

        console.log(`🔵 reserveShadowsForCells: Creating shadows for task ${taskId} in ${cells.length} cells at top=${shadowTop}`);

        // Clean up any existing shadows for this task first
        cells.forEach(cell => {
            if (!cell) return;
            const existingShadows = cell.querySelectorAll(`[data-shadow-for="${taskId}"]`);
            existingShadows.forEach(shadow => shadow.remove());
        });

        // Create new shadows for each cell so lane calculations stay consistent
        let createdCount = 0;
        cells.forEach((cell, idx) => {
            if (!cell) {
                console.warn(`⚠️ Cell ${idx} is null/undefined`);
                return;
            }
            
            const shadow = document.createElement('div');
            shadow.className = 'task-shadow';
            shadow.style.position = 'absolute';
            shadow.style.left = `${shadowLeft}px`;
            shadow.style.top = `${shadowTop}px`;
            shadow.style.width = '1px';
            shadow.style.height = '24px';
            shadow.style.pointerEvents = 'none';
            shadow.style.visibility = 'hidden'; // Hidden but reserves space
            shadow.dataset.shadowFor = taskId;
            shadow.dataset.taskId = taskId;
            shadow.dataset.positioned = 'true';
            cell.appendChild(shadow);
            createdCount++;
        });
        
        console.log(`✅ Created ${createdCount} shadows for task ${taskId}`);
    }

    cleanupTaskElements(taskId) {
        // Remove all elements related to a specific task
        const elements = document.querySelectorAll(`[data-task-id="${taskId}"]`);
        elements.forEach(element => {
            if (element.classList.contains('task-shadow') || 
                element.classList.contains('task-resize-preview')) {
                element.remove();
            }
        });
        
        // Also clean up shadows marked with shadowFor
        const shadows = document.querySelectorAll(`[data-shadow-for="${taskId}"]`);
        shadows.forEach(shadow => shadow.remove());
    }

    refreshTaskPositioning() {
        // Force a complete re-render to fix any positioning issues
        // This is called after resize operations to ensure clean state
        const allCells = document.querySelectorAll('.calendar-day-cell');
        
        // Clear all shadows and reset cell heights
        allCells.forEach(cell => {
            const shadows = cell.querySelectorAll('.task-shadow');
            shadows.forEach(shadow => shadow.remove());
            
            const previews = cell.querySelectorAll('.task-resize-preview');
            previews.forEach(preview => preview.remove());
            
            // Reset minimum height
            cell.style.minHeight = '';
        });
        
        // Clear the preview elements map
        this.previewElements.clear();
        
        // Re-render calendar to rebuild positioning
        this.renderCalendar();
        
        // Force visibility refresh for all task elements
        setTimeout(() => {
            const allTaskElements = document.querySelectorAll('.task-item');
            allTaskElements.forEach(taskEl => {
                taskEl.style.display = '';
                taskEl.style.visibility = 'visible';
                taskEl.style.opacity = '1';
            });
            // Update lane variables after repositioning
            this._writeLaneVariablesToCells();
        }, 100);
    }

    findBestTaskPosition(cell, newTaskElement, spanDays) {
        const existingTasks = Array
            .from(cell.querySelectorAll('.task-item, .task-shadow'))
            .filter(task => task !== newTaskElement && (task.classList.contains('task-shadow') || task.dataset.positioned === 'true'));
        const taskHeight = 24; // Compact task height like Excel rows
        const taskSpacing = 2; // Minimal spacing like Excel
        const leftMargin = 2;
        const headerHeight = 30; // Account for day header
        
        let bestTop = headerHeight; // Start after header
        let bestLeft = leftMargin;
        
        if (existingTasks.length === 0) {
            return { top: bestTop, left: bestLeft };
        }
        
        // Sort existing tasks by top position to stack properly
        const sortedTasks = existingTasks
            .map(task => ({
                task,
                top: parseInt(task.style.top) || headerHeight,
                height: taskHeight
            }))
            .sort((a, b) => a.top - b.top);
        
        // Find the first available slot
        let currentTop = headerHeight;
        
        for (const existingTask of sortedTasks) {
            if (currentTop + taskHeight <= existingTask.top) {
                // Found a gap before this task
                return { top: currentTop, left: bestLeft };
            }
            // Move past this task
            currentTop = existingTask.top + existingTask.height + taskSpacing;
        }
        
        // If no gaps found, place at the end
        return { top: currentTop, left: bestLeft };
    }
    
    rectsOverlap(rect1, rect2) {
        return !(rect1.right <= rect2.left || 
                rect1.left >= rect2.right || 
                rect1.bottom <= rect2.top || 
                rect1.top >= rect2.bottom);
    }
    
    updateCellHeight(cell) {
        const tasks = cell.querySelectorAll('.task-item');
        const headerHeight = 30;
        
        if (tasks.length === 0) {
            cell.style.minHeight = '60px'; // Compact like Excel
            return;
        }
        
        let maxBottom = headerHeight;
        tasks.forEach(task => {
            const top = parseInt(task.style.top) || headerHeight;
            const height = 22; // Consistent task height
            maxBottom = Math.max(maxBottom, top + height);
        });
        
        const existingHeight = parseFloat(cell.style.minHeight) || 0;
        const minHeight = Math.max(60, maxBottom + 4, existingHeight);
        cell.style.minHeight = `${minHeight}px`;
    }
    
    repositionAllTasks() {
        // Simple approach: just re-render all tasks from scratch
        // This is more reliable than trying to reposition existing elements
        
        // Remove all existing task-related elements
        document.querySelectorAll('.task-item, .task-segment, .task-shadow').forEach(element => {
            element.remove();
        });

        // Reset all cell heights
        document.querySelectorAll('.calendar-day-cell').forEach(cell => {
            cell.style.minHeight = '60px';
        });

        // Re-populate all tasks fresh from data
        this.populateCalendarTasks();
    }

    createFallbackTask(taskData) {
        if (!taskData) return null;
        
        const taskElement = document.createElement('div');
        taskElement.className = `task-item priority-${taskData.priority} status-${taskData.status}`;
        taskElement.dataset.taskId = taskData.id;
        taskElement.style.position = 'absolute';
        taskElement.style.left = '2px';
        taskElement.style.top = '30px';
        taskElement.style.width = 'calc(100% - 8px)';
        taskElement.style.height = '22px';
        taskElement.style.zIndex = '2';
        
        const assignee = dataManager.getPersonById(taskData.assigneeId);
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-title';
        titleSpan.textContent = (taskData.title || '').trim() || '(No title)';
        taskElement.appendChild(titleSpan);
        
        if (taskData.startAt || taskData.startDate || taskData.dueAt) {
            const start = new Date(taskData.startAt || taskData.startDate || taskData.dueAt);
            if (!Number.isNaN(start.getTime())) {
                taskElement.dataset.originDate = start.toISOString();
            }
        }
        
        taskElement.addEventListener('click', (event) => this.handleTaskClick(taskData, event));
        
        return taskElement;
    }

    updateSpecificTask(taskData) {
        // Remove all existing elements for this task
        const existingElements = document.querySelectorAll(`[data-task-id="${taskData.id}"]`);
        existingElements.forEach(el => el.remove());
        
        // Re-add the task with updated data
        this.addTaskToCalendar(taskData);
        
        // Update cell heights for affected cells
        const taskStart = new Date(taskData.startAt || taskData.startDate || taskData.dueAt);
        const taskEnd = new Date(taskData.dueAt);
        taskStart.setHours(0, 0, 0, 0);
        taskEnd.setHours(0, 0, 0, 0);
        
        const affectedCells = this.getCellsForDateRange(taskStart, taskEnd);
        affectedCells.forEach(cell => this.updateCellHeight(cell));
    }

    handleCellClick(date) {
        showTaskModal();

        const startInput = document.getElementById('taskStartDate');
        const dueInput = document.getElementById('taskDueDate');
        if (startInput && dueInput) {
            const isoDate = date.toISOString().slice(0, 10);
            startInput.value = isoDate;
            dueInput.value = isoDate;
        }
    }

    handleTaskClick(task, event) {
        // Prevent click during active resize
        if (this.resizeSession) {
            CAL_LOG('🚫 Ignoring click - resize in progress');
            event?.preventDefault();
            event?.stopPropagation();
            return;
        }
        
        // Prevent click from firing immediately after a resize operation
        if (this.justFinishedResize) {
            CAL_LOG('🚫 Ignoring click - just finished resize');
            return;
        }
        
        const currentUser = dataManager.getPersonById(dataManager.getCurrentUser());
        this.selectedTask = task;

        if (event) {
            event.stopPropagation();
        }

        if (currentUser && currentUser.role === 'admin') {
            const taskElement = event ? event.currentTarget : null;
            const opened = this.openTaskQuickPanel(task, taskElement);
            if (!opened) {
                openUnifiedTaskModal(task.id);
            }
            return;
        }

        // Non-admin users should also be able to edit tasks via the unified modal
        this.closeTaskQuickPanel();
        openUnifiedTaskModal(task.id);
    }

    showTaskContextMenu(task, event) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.task-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'task-context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        menu.style.zIndex = '1000';
        menu.style.background = 'white';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '6px';
        menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        menu.style.padding = '0.5rem 0';

        const subtaskCount = (task.subtasks || []).length;
        
        menu.innerHTML = `
            <div class="context-menu-item" onclick="editTask('${task.id}')">
                <i class="fas fa-edit" style="margin-right: 0.5rem;"></i>
                Edit Task
            </div>
            <div class="context-menu-item" onclick="openSubtaskModal('${task.id}')">
                <i class="fas fa-tasks" style="margin-right: 0.5rem;"></i>
                Manage Sub-tasks ${subtaskCount > 0 ? `(${subtaskCount})` : ''}
            </div>
        `;

        // Add click handlers to menu items
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.style.padding = '0.75rem 1rem';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid #f0f0f0';
            item.addEventListener('mouseover', () => {
                item.style.background = '#f8f9fa';
            });
            item.addEventListener('mouseout', () => {
                item.style.background = 'white';
            });
        });

        document.body.appendChild(menu);

        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }

    populateTaskModal(task) {
        document.getElementById('modalTitle').textContent = 'Edit Task';
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskJob').value = task.jobId;
        document.getElementById('taskAssignee').value = task.assigneeId;

        const startDate = (task.startAt || task.startDate || task.dueAt).slice(0, 10);
        const dueDate = task.dueAt.slice(0, 10);

        document.getElementById('taskStartDate').value = startDate;
        document.getElementById('taskDueDate').value = dueDate;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskProof').value = task.requiredProof;
        document.getElementById('taskLocation').value = task.location || '';
        document.getElementById('taskNotes').value = task.notes || '';

        // Populate dependencies dropdown
        this.populateDependenciesDropdown(task);
    }

    populateDependenciesDropdown(currentTask) {
        const select = document.getElementById('taskDependencies');
        const allTasks = dataManager.getTasks();
        
        // Clear existing options
        select.innerHTML = '';
        
        // Filter out the current task and get incomplete tasks only
        const availableTasks = allTasks.filter(task => 
            task.id !== currentTask.id && 
            task.status !== 'done' &&
            task.jobId === currentTask.jobId // Only tasks from same job
        );
        
        availableTasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task.id;
            option.textContent = `${task.title} (${task.assigneeId ? dataManager.getPersonById(task.assigneeId)?.name || 'Unassigned' : 'Unassigned'})`;
            
            // Select if this task is already a dependency
            if (currentTask.dependencies && currentTask.dependencies.includes(task.id)) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        if (availableTasks.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No available tasks for dependencies';
            option.disabled = true;
            select.appendChild(option);
        }
    }

    handleDragStart(event, task) {
        this.draggedTask = task;
        this.draggedElement = event.target;
        event.target.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
        
        // If this is a multi-day task, add visual feedback to all segments
        const allSegments = document.querySelectorAll(`[data-task-id="${task.id}"]`);
        allSegments.forEach(segment => {
            segment.classList.add('dragging-related');
        });
    }

    handleDragEnd(event) {
        event.target.classList.remove('dragging');
        document.querySelectorAll('.calendar-day-cell.drag-over').forEach(cell => cell.classList.remove('drag-over'));
        document.querySelectorAll('.dragging-related').forEach(element => element.classList.remove('dragging-related'));
        
        // Ensure task visibility after drag
        setTimeout(() => {
            if (event.target && event.target.classList.contains('task-item')) {
                event.target.style.visibility = 'visible';
                event.target.style.opacity = '1';
            }
        }, 50);
        
        this.draggedTask = null;
        this.draggedElement = null;
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const cell = event.target.classList.contains('calendar-day-cell')
            ? event.target
            : event.target.closest('.calendar-day-cell');
        if (cell) {
            cell.classList.add('drag-over');
        }
    }

    handleDrop(event) {
        event.preventDefault();
        if (!this.draggedTask) {
            return;
        }

        const targetCell = event.target.classList.contains('calendar-day-cell')
            ? event.target
            : event.target.closest('.calendar-day-cell');
        if (!targetCell) {
            return;
        }
        targetCell.classList.remove('drag-over');

        const targetDate = new Date(targetCell.dataset.date);
        if (isNaN(targetDate.getTime())) {
            return;
        }

        const originalStart = new Date(this.draggedTask.startAt || this.draggedTask.startDate || this.draggedTask.dueAt);
        const originalEnd = new Date(this.draggedTask.dueAt);
        
        if (isNaN(originalStart.getTime()) || isNaN(originalEnd.getTime())) {
            return;
        }
        
        // Allow dragging to any date while preserving the original span length
        const spanDays = Math.max(1, this.calculateSpanDays(originalStart, originalEnd));

        const newStart = new Date(targetDate);
        newStart.setHours(
            originalStart.getHours(),
            originalStart.getMinutes(),
            originalStart.getSeconds(),
            originalStart.getMilliseconds()
        );

        const newEnd = new Date(newStart);
        newEnd.setDate(newEnd.getDate() + spanDays - 1);
        newEnd.setHours(
            originalEnd.getHours(),
            originalEnd.getMinutes(),
            originalEnd.getSeconds(),
            originalEnd.getMilliseconds()
        );

        const updatedTask = dataManager.updateTask(this.draggedTask.id, {
            startAt: newStart.toISOString(),
            startDate: newStart.toISOString().slice(0, 10),
            dueAt: newEnd.toISOString()
        });

        if (updatedTask) {
            // If task moved to a different week/month, update current view to show it
            if (this.currentViewMode !== 'month') {
                const taskWeekStart = this.getWeekStart(newStart);
                if (taskWeekStart.getTime() !== this.currentWeekStart.getTime()) {
                    this.currentDate = new Date(newStart);
                }
            } else {
                const taskMonthStart = this.getMonthStart(newStart);
                if (taskMonthStart.getTime() !== this.currentMonthStart.getTime()) {
                    this.currentDate = new Date(newStart);
                }
            }
            
            this.showFeedback(`Project moved to ${this.formatDate(newStart)}`);
            
            // Clean up any orphaned elements
            this.cleanupTaskElements(this.draggedTask.id);
            
            // Force a clean re-render
            this.refreshTaskPositioning();
            this.refreshQuickPanelIfSelected(updatedTask);
        } else {
            this.showFeedback('Failed to move project');
            this.refreshTaskPositioning();
        }
    }

    buildResizeHandle(task, element, direction) {
        const handle = document.createElement('div');
        handle.className = `task-resize-handle task-resize-handle--${direction}`;
        handle.dataset.direction = direction;
        handle.dataset.taskId = task.id;
        handle.setAttribute('role', 'button');
        handle.tabIndex = 0;
        handle.setAttribute('aria-label', direction === 'start' ? 'Drag or use arrow keys to move project earlier or later' : 'Drag or use arrow keys to extend or reduce project duration');
        handle.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
        const tooltip = direction === 'start'
            ? 'Drag or use arrow keys to adjust project start date'
            : 'Drag or use arrow keys to adjust project end date';
        handle.title = tooltip;
        handle.addEventListener('dragstart', (dragEvent) => dragEvent.preventDefault());
        
        // Prevent click events from bubbling up to the task element
        handle.addEventListener('click', (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
        }, { capture: true });
        
        // Store a flag on the handle itself to track if pointer events are supported
        let lastEventTime = 0;
        let lastEventType = null;
        
        // Add event listeners - use only ONE event per interaction
        handle.addEventListener('pointerdown', (pointerEvent) => {
            const now = Date.now();
            // If we just handled an event within 150ms, skip (duplicate from touchpad)
            if (lastEventTime && (now - lastEventTime) < 150) {
                CAL_LOG('⏭️ Skipping duplicate pointerdown event (within 150ms)');
                return;
            }
            lastEventTime = now;
            lastEventType = 'pointer';
            
            pointerEvent.stopPropagation();
            pointerEvent.preventDefault();
            this.startResize(pointerEvent, task, element, direction);
        }, { passive: false });
        
        // Mousedown as fallback - skip if we just handled a pointer event
        handle.addEventListener('mousedown', (mouseEvent) => {
            const now = Date.now();
            // Skip if we just handled a pointer event (prevents duplicate on touchpads)
            if (lastEventType === 'pointer' && lastEventTime && (now - lastEventTime) < 150) {
                CAL_LOG('⏭️ Skipping mousedown - already handled via pointerdown (within 150ms)');
                return;
            }
            lastEventTime = now;
            lastEventType = 'mouse';
            
            mouseEvent.stopPropagation();
            mouseEvent.preventDefault();
            this.startResize(mouseEvent, task, element, direction);
        }, { passive: false });
        
        // Touchstart for touch devices
        handle.addEventListener('touchstart', (touchEvent) => {
            const now = Date.now();
            // Skip if we just handled a pointer event
            if (lastEventType === 'pointer' && lastEventTime && (now - lastEventTime) < 150) {
                CAL_LOG('⏭️ Skipping touchstart - already handled via pointerdown (within 150ms)');
                return;
            }
            lastEventTime = now;
            lastEventType = 'touch';
            
            touchEvent.stopPropagation();
            touchEvent.preventDefault();
            this.startResize(touchEvent, task, element, direction);
        }, { passive: false });
        
        handle.addEventListener('keydown', (keyEvent) => this.handleResizeHandleKeydown(keyEvent, task, direction));
        return handle;
    }

    handleResizeHandleKeydown(event, task, direction) {
        const { key, shiftKey } = event;
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            event.preventDefault();
            const step = shiftKey ? 7 : 1;
            const delta = key === 'ArrowLeft' ? -step : step;
            this.nudgeTaskResize(task, direction, delta);
            return;
        }
    }

    nudgeTaskResize(task, direction, deltaDays) {
        if (!deltaDays) {
            return;
        }

        const sourceTask = dataManager.getTaskById ? (dataManager.getTaskById(task.id) || task) : task;

        const originalStartFull = new Date(sourceTask.startAt || sourceTask.startDate || sourceTask.dueAt);
        const originalEndFull = new Date(sourceTask.dueAt);
        if (Number.isNaN(originalStartFull.getTime()) || Number.isNaN(originalEndFull.getTime())) {
            return;
        }

        const originalStart = new Date(originalStartFull);
        originalStart.setHours(0, 0, 0, 0);
        const originalEnd = new Date(originalEndFull);
        originalEnd.setHours(0, 0, 0, 0);
        const originalSpan = this.calculateSpanDays(originalStart, originalEnd);

        const maxSpan = 365;

        const newStart = new Date(originalStart);
        const newEnd = new Date(originalEnd);

        if (direction === 'end') {
            newEnd.setDate(newEnd.getDate() + deltaDays);
            if (newEnd < newStart) {
                newEnd.setTime(newStart.getTime());
            }
            const maxEnd = new Date(newStart);
            maxEnd.setDate(maxEnd.getDate() + maxSpan - 1);
            if (newEnd > maxEnd) {
                newEnd.setTime(maxEnd.getTime());
            }
        } else {
            newStart.setDate(newStart.getDate() + deltaDays);
            if (newStart > newEnd) {
                newStart.setTime(newEnd.getTime());
            }
            const minStart = new Date(newEnd);
            minStart.setDate(minStart.getDate() - maxSpan + 1);
            if (newStart < minStart) {
                newStart.setTime(minStart.getTime());
            }
        }

        if (newStart.getTime() === originalStart.getTime() && newEnd.getTime() === originalEnd.getTime()) {
            return;
        }

        const spanDays = this.calculateSpanDays(newStart, newEnd);

        const updatedStart = new Date(newStart);
        updatedStart.setHours(
            originalStartFull.getHours(),
            originalStartFull.getMinutes(),
            originalStartFull.getSeconds(),
            originalStartFull.getMilliseconds()
        );

        const updatedEnd = new Date(newEnd);
        updatedEnd.setHours(
            originalEndFull.getHours(),
            originalEndFull.getMinutes(),
            originalEndFull.getSeconds(),
            originalEndFull.getMilliseconds()
        );

        const updateData = {
            dueAt: updatedEnd.toISOString()
        };

        if (direction === 'start') {
            updateData.startAt = updatedStart.toISOString();
            updateData.startDate = updatedStart.toISOString().slice(0, 10);
        }

        const updatedTask = dataManager.updateTask(sourceTask.id, updateData);
        if (updatedTask) {
            const rangeText = `${this.formatDate(newStart)} → ${this.formatDate(newEnd)}`;
            const movement =
                direction === 'start'
                    ? (deltaDays < 0 ? 'Start extended earlier' : 'Start moved later')
                    : (deltaDays < 0 ? 'End pulled in' : 'End extended');
            this.showFeedback(`${movement}: ${rangeText} (${spanDays} day${spanDays === 1 ? '' : 's'})`);
            this.renderCalendar();
            this.refreshQuickPanelIfSelected(updatedTask);
        } else {
            this.showFeedback('Failed to resize project');
        }
    }

    startResize(event, task, element, direction = 'end') {
        // Prevent duplicate calls FIRST - before any logging or processing
        const now = Date.now();
        if (this.lastResizeStartTime && (now - this.lastResizeStartTime) < 150) {
            CAL_LOG('⏭️ Skipping duplicate startResize call within 150ms', { 
                eventType: event?.type, 
                timeSinceLastCall: now - this.lastResizeStartTime 
            });
            return;
        }
        this.lastResizeStartTime = now;
        
        CAL_LOG('✅ startResize accepted', { task: task.id, direction, eventType: event?.type });
        
        // Temporarily bypass user check for debugging
        const currentUser = dataManager.getPersonById(dataManager.getCurrentUser());
        if (!currentUser || currentUser.role === 'crew') {
            CAL_LOG('startResize would be blocked - user role:', currentUser?.role, 'but allowing for debug');
            // return; // Commented out for debugging
        }

        // End any existing resize session
        if (this.resizeSession) {
            CAL_LOG('❌ Ending existing resize session before starting new one');
            this.finishResizeInteraction(false);
            // CRITICAL: Clear bound handlers to prevent stale references
            this.boundResizeMove = null;
            this.boundResizeEnd = null;
            this.boundResizeCancel = null;
            this.boundResizeKey = null;
        }

        // Handle different event types (pointer, touch, mouse)
        const isPointerEvent = event?.type?.startsWith('pointer');
        const isTouchEvent = event?.type?.startsWith('touch');
        const isMouseEvent = event?.type?.startsWith('mouse');

        // Reject non-primary button clicks
        if ((isPointerEvent || isMouseEvent) && event.button !== 0) {
            return;
        }

        event?.preventDefault?.();
        event?.stopPropagation?.();

        let originCell = element.closest('.calendar-day-cell');
        if (!originCell) {
            const originDateValue = element.dataset.originDate || element.dataset.spanStart;
            if (originDateValue) {
                const originDate = new Date(originDateValue);
                if (!Number.isNaN(originDate.getTime())) {
                    originCell = this.findCellForDate(originDate);
                }
            }
        }
        if (!originCell) {
            console.warn('startResize: unable to locate origin cell for task', task.id);
            return;
        }

        // Get initial coordinates
        let initialX, initialY;
        if (isPointerEvent) {
            initialX = event.clientX;
            initialY = event.clientY;
        } else if (isTouchEvent && event.touches?.[0]) {
            initialX = event.touches[0].clientX;
            initialY = event.touches[0].clientY;
        } else if (isMouseEvent) {
            initialX = event.clientX;
            initialY = event.clientY;
        } else {
            console.log('? No valid event type for coordinates');
            return;
        }
        
        CAL_LOG('?? Initial coordinates extracted:', {
            eventType: event?.type,
            initialX,
            initialY,
            isPointer: isPointerEvent,
            isTouch: isTouchEvent,
            isMouse: isMouseEvent
        });

        // Calculate grid and cell dimensions
        const cellRect = originCell.getBoundingClientRect();
        
        // Find the grid element - it might be the parent, or we need to search upward
        let gridElement = originCell.parentElement;
        if (!gridElement || !gridElement.classList.contains('calendar-grid')) {
            // Try to find the grid by looking for .calendar-grid class
            gridElement = originCell.closest('.calendar-grid');
            if (!gridElement) {
                // Fallback: use the parent element if it exists
                gridElement = originCell.parentElement;
            }
        }
        
        if (!gridElement) {
            console.error('❌ startResize: no grid element found', {
                originCell,
                hasParent: !!originCell.parentElement,
                elementClass: originCell.className
            });
            return;
        }
        
        const gridStyles = window.getComputedStyle(gridElement);
        const columnGap = parseFloat(gridStyles.columnGap || gridStyles.gap || '0') || 0;
        const cellWidth = Math.max(cellRect.width, 50);

        // Parse task dates
        const originalStartFull = new Date(task.startAt || task.startDate || task.dueAt);
        const originalEndFull = new Date(task.dueAt);
        if (isNaN(originalStartFull.getTime()) || isNaN(originalEndFull.getTime())) {
            return;
        }

        const originalStart = new Date(originalStartFull);
        originalStart.setHours(0, 0, 0, 0);
        const originalEnd = new Date(originalEndFull);
        originalEnd.setHours(0, 0, 0, 0);

        // Find all related task elements
        const relatedElements = Array.from(document.querySelectorAll(`[data-task-id="${task.id}"]`));
        relatedElements.forEach(el => {
            el.classList.add('resizing-active');
            el.style.pointerEvents = 'none'; // Prevent clicks during resize
        });

        // Create resize session
        CAL_LOG('🚀 Resize started:', `${task.title} (${direction})`);
        
        const session = {
            task,
            direction,
            element,
            handleElement: event.currentTarget || element,
            pointerId: isPointerEvent ? event.pointerId : null,
            originCell,
            gridElement,
            columnGap,
            cellWidth,
            originalStart: new Date(originalStart),
            originalEnd: new Date(originalEnd),
            originalStartFull: new Date(originalStartFull),
            originalEndFull: new Date(originalEndFull),
            originalSpan: this.calculateSpanDays(originalStart, originalEnd),
            previewStart: new Date(originalStart),
            previewEnd: new Date(originalEnd),
            deltaDays: 0,
            initialX,
            initialY,
            relatedElements,
            originalStyles: {
                width: element.style.width,
                left: element.style.left,
                right: element.style.right
            },
            maxSpan: 365,
            minSpan: 1,
            // CRITICAL FIX: Only use touch events for ACTUAL touch events, not touchpad
            // this.isTouchDevice may incorrectly detect touchpad as touch device
            isTouch: isTouchEvent  // Removed: || this.isTouchDevice
        };

        CAL_LOG('🔍 Session created with isTouch:', session.isTouch, '(isTouchEvent:', isTouchEvent, ', this.isTouchDevice:', this.isTouchDevice, ')');

        this.resizeSession = session;

        // Set up event listeners based on input type
        this.setupResizeEventListeners(session);

        // Add visual feedback
        element.classList.add('resizing');
        this.createResizePreview(session);
        this.updateResizePreview();
        // Provide haptic feedback on supported devices
        if (this.isIOS && window.navigator?.vibrate) {
            window.navigator.vibrate(10);
        }
    }

    setupResizeEventListeners(session) {
        // Create wrapper that logs before calling the actual handler
        const moveHandlerWithLogging = (event) => {
            CAL_LOG('🔔 Move handler INVOKED!', { 
                type: event.type, 
                target: event.target?.className,
                hasSession: !!this.resizeSession 
            });
            this.onResizeDrag(event);
        };
        
        this.boundResizeMove = moveHandlerWithLogging;
        this.boundResizeEnd = this.endResizeDrag.bind(this);
        this.boundResizeCancel = this.cancelResizeDrag.bind(this);
        this.boundResizeKey = (keyEvent) => {
            if (keyEvent.key === 'Escape') {
                keyEvent.preventDefault();
                this.cancelResizeDrag();
            }
        };

        CAL_LOG('🔧 About to attach event listeners. Session exists:', !!this.resizeSession);

        if (session.isTouch) {
            // Touch events
            document.addEventListener('touchmove', this.boundResizeMove, { passive: false, capture: true });
            document.addEventListener('touchend', this.boundResizeEnd, { passive: false, capture: true });
            document.addEventListener('touchcancel', this.boundResizeCancel, { passive: false, capture: true });
            CAL_LOG('✅ Touch listeners attached');
        } else {
            // Pointer/Mouse events - CRITICAL FIX for touchpad:
            // Attach to WINDOW instead of document for better touchpad support
            window.addEventListener('pointermove', this.boundResizeMove, { passive: false, capture: true });
            window.addEventListener('pointerup', this.boundResizeEnd, { passive: false, capture: true });
            window.addEventListener('pointercancel', this.boundResizeCancel, { passive: false, capture: true });
            window.addEventListener('mousemove', this.boundResizeMove, { passive: false, capture: true });
            window.addEventListener('mouseup', this.boundResizeEnd, { passive: false, capture: true });
            CAL_LOG('✅ Pointer/Mouse listeners attached to WINDOW (with capture:true, passive:false)');
        }

        document.addEventListener('keydown', this.boundResizeKey, { capture: true });

        // CRITICAL: Try pointer capture on the calendar view container instead of the handle
        // This may help touchpads register drag events
        const calendarView = document.getElementById('calendar-view') || document.body;
        if (session.pointerId != null && calendarView.setPointerCapture) {
            try {
                calendarView.setPointerCapture(session.pointerId);
                CAL_LOG('✅ Pointer capture set on calendar-view for pointerId:', session.pointerId);
            } catch (e) {
                CAL_LOG('⚠️ Pointer capture failed:', e.message);
            }
        }

        // Test listener to verify events flow correctly
        const testListener = (e) => {
            CAL_LOG('🧪 TEST LISTENER received pointermove - our handler should fire too!');
            // Only log once
            window.removeEventListener('pointermove', testListener, true);
        };
        window.addEventListener('pointermove', testListener, { capture: true, passive: true });
        
        CAL_LOG('📡 All event listeners attached - waiting for movement...');
        CAL_LOG('🎯 Move your touchpad NOW to test if events fire...');
    }

    onResizeDrag(event) {
        const session = this.resizeSession;
        if (!session) {
            CAL_LOG('❌ onResizeDrag called but no session exists');
            return;
        }

        // Prevent default to avoid scrolling on touch
        event?.preventDefault?.();
        
        // Only log drag activity occasionally to reduce console spam
        if (!session.logCounter) session.logCounter = 0;
        session.logCounter++;
        
        // Log the FIRST drag event to confirm we're receiving drag events
        if (session.logCounter === 1) {
            CAL_LOG('🎯 FIRST drag event received!', { 
                eventType: event?.type,
                direction: session.direction,
                task: session.task.id 
            });
        }
        
        if (session.logCounter % 20 === 1) { // Log every 20th drag event
            CAL_LOG('🔄 onResizeDrag active (count: ' + session.logCounter + ')', { 
                direction: session.direction, 
                deltaDays: session.deltaDays,
                eventType: event?.type
            });
        }

        // Get current coordinates from different event types
        let currentX, currentY;
        if (event?.type?.startsWith('pointer') || event?.type?.startsWith('mouse')) {
            currentX = event.clientX;
            currentY = event.clientY;
        } else if (event?.type?.startsWith('touch') && event.touches?.[0]) {
            currentX = event.touches[0].clientX;
            currentY = event.touches[0].clientY;
        } else {
            console.log('? Invalid event type in onResizeDrag:', event?.type);
            return;
        }

        if (typeof currentX !== 'number') {
            console.log('? Invalid currentX:', currentX);
            return;
        }

        // NEW 2D CELL-BASED DRAG CALCULATION
        // Instead of using pixel distance, find which calendar cell the mouse is over
        // This allows dragging UP to previous weeks and DOWN to future weeks
        
        const currentCell = this.findCellAtMousePosition(currentX, currentY);
        
        // If not over a calendar cell, keep the last known position
        if (!currentCell) {
            // Mouse is outside the calendar - could be above, below, or to the sides
            // Keep the current preview state but don't update
            return;
        }
        
        const currentCellDate = this.getCellDate(currentCell);
        if (!currentCellDate) {
            console.warn('⚠️ Cell found but no valid date');
            return;
        }
        
        // Calculate the requested delta based on which cell we're over
        let requestedDelta;
        if (session.direction === 'start') {
            // Dragging the start handle - calculate days from current cell to original start
            requestedDelta = this.calculateDayDifference(session.originalStart, currentCellDate);
        } else {
            // Dragging the end handle - calculate days from original end to current cell
            requestedDelta = this.calculateDayDifference(session.originalEnd, currentCellDate);
        }
        
        const previousDelta = session.deltaDays || 0;
        
        // Apply maximum span constraint (allow up to 365 days)
        const maxDelta = Math.min(365, session.maxSpan);
        if (requestedDelta > maxDelta) {
            requestedDelta = maxDelta;
        } else if (requestedDelta < -maxDelta) {
            requestedDelta = -maxDelta;
        }
        
        // Log detailed information for debugging
        if (session.logCounter % 10 === 1) {
            CAL_LOG('🔍 2D Cell-based drag details:', {
                currentCell: currentCellDate.toDateString(),
                direction: session.direction,
                originalStart: session.originalStart.toDateString(),
                originalEnd: session.originalEnd.toDateString(),
                requestedDelta,
                previousDelta,
                mouseX: Math.round(currentX),
                mouseY: Math.round(currentY)
            });
        }
        
        // Only log meaningful changes to reduce console spam
        if (requestedDelta !== previousDelta) {
            CAL_LOG('📏 Resize drag (cell-based)', {
                direction: session.direction,
                targetCell: currentCellDate.toDateString(),
                requestedDelta,
                previousDelta
            });
        }

        // Calculate new dates based on direction
        let newStart = new Date(session.originalStart);
        let newEnd = new Date(session.originalEnd);

        if (session.direction === 'end') {
            // Resizing the end date
            newEnd.setDate(newEnd.getDate() + requestedDelta);

            // Ensure end is not before start
            if (newEnd < newStart) {
                newEnd = new Date(newStart);
            }

            // Apply maximum span constraint
            const maxEnd = new Date(newStart);
            maxEnd.setDate(maxEnd.getDate() + session.maxSpan - 1);
            if (newEnd > maxEnd) {
                newEnd = new Date(maxEnd);
            }
        } else {
            // Resizing the start date
            newStart.setDate(newStart.getDate() + requestedDelta);

            // Ensure start is not after end
            if (newStart > newEnd) {
                newStart = new Date(newEnd);
            }

            // Apply maximum span constraint
            const minStart = new Date(newEnd);
            minStart.setDate(minStart.getDate() - session.maxSpan + 1);
            if (newStart < minStart) {
                newStart = new Date(minStart);
            }
        }

        const dayMs = 24 * 60 * 60 * 1000;
        const appliedDelta = session.direction === 'end'
            ? Math.round((newEnd.getTime() - session.originalEnd.getTime()) / dayMs)
            : Math.round((newStart.getTime() - session.originalStart.getTime()) / dayMs);

        if (appliedDelta === previousDelta &&
            session.previewStart?.getTime?.() === newStart.getTime() &&
            session.previewEnd?.getTime?.() === newEnd.getTime()) {
            return;
        }

        session.deltaDays = appliedDelta;

        // Only log final results for meaningful changes
        if (Math.abs(appliedDelta) > 0 && appliedDelta !== previousDelta) {
            CAL_LOG('📅 Resize result:', {
                direction: session.direction,
                newStart: newStart.toDateString(),
                newEnd: newEnd.toDateString(),
                span: this.calculateSpanDays(newStart, newEnd) + ' days'
            });
        }

        session.previewStart = newStart;
        session.previewEnd = newEnd;
        session.previewSpan = this.calculateSpanDays(newStart, newEnd);

        this.updateResizePreview();

        if (this.isIOS && Math.abs(appliedDelta) > 0 && Math.abs(appliedDelta) !== Math.abs(session.lastHapticDelta || 0)) {
            session.lastHapticDelta = appliedDelta;
            if (window.navigator?.vibrate) {
                window.navigator.vibrate(5);
            }
        }
    }

    positionPreviewElement(previewElement, startDate, endDate, spanDays) {
        const firstCell = this.findCellForDate(startDate);
        if (!firstCell) {
            console.error('❌ positionPreviewElement: no cell found for start date', startDate.toDateString());
            return;
        }

        const cellWidth = firstCell.offsetWidth || firstCell.getBoundingClientRect().width || 120;
        const gridElement = document.getElementById('calendarGrid') || firstCell.parentElement;
        if (!gridElement) {
            console.error('❌ positionPreviewElement: no grid element found');
            return;
        }
        
        let gap = 0;
        const gapValue = parseFloat(window.getComputedStyle(gridElement).getPropertyValue('gap'));
        if (!Number.isNaN(gapValue)) {
            gap = gapValue;
        }
        const horizontalPadding = 4;
        
        // Calculate how many days fit in the same row as the start cell
        // For week views, we need to check if we're crossing a week boundary
        const isMonthView = this.currentViewMode === 'month';
        const columnsPerRow = isMonthView ? 7 : this.visibleDays;
        
        // Calculate days remaining in the current row from start date
        const startDayOfWeek = startDate.getDay(); // 0 = Sunday, 6 = Saturday
        let daysInCurrentRow;
        
        if (this.currentViewMode === 'work-week') {
            // Work week: Monday (1) to Friday (5)
            // If it's Monday, we have 5 days. If it's Friday, we have 1 day.
            if (startDayOfWeek === 0 || startDayOfWeek === 6) {
                // Weekend - shouldn't happen in work-week but handle it
                daysInCurrentRow = 1;
            } else {
                daysInCurrentRow = 6 - startDayOfWeek; // Days until end of work week
            }
        } else if (this.currentViewMode === 'day') {
            daysInCurrentRow = 1;
        } else {
            // Full week or month view - calculate days until end of week (Saturday)
            daysInCurrentRow = 7 - startDayOfWeek;
        }
        
        // Limit the display span to only the current row
        const displaySpan = Math.min(spanDays, daysInCurrentRow);
        
        // Calculate width only for the visible portion in the current row
        let totalWidth;
        if (displaySpan > 1) {
            const effectiveCellWidth = cellWidth + gap;
            totalWidth = (effectiveCellWidth * displaySpan) - gap - horizontalPadding;
        } else {
            totalWidth = cellWidth - horizontalPadding;
        }
        
        // Ensure minimum width
        totalWidth = Math.max(60, totalWidth);
        
        const leftOffset = (firstCell.offsetLeft ?? 0) + 2;
        // Add offset for day number height (typically 24-30px) so preview doesn't overlap
        const topOffset = (firstCell.offsetTop ?? 0) + 28;
        
        // Set positioning styles relative to the calendar grid
        previewElement.style.position = 'absolute';
        previewElement.style.left = `${leftOffset}px`;
        previewElement.style.top = `${topOffset}px`;
        previewElement.style.width = `${totalWidth}px`;
        previewElement.style.overflow = 'visible';
        previewElement.style.whiteSpace = 'normal';
        previewElement.style.zIndex = '9999';
        previewElement.style.pointerEvents = 'none';
        
        CAL_LOG('📐 Preview positioned (row-aware):', {
            span: spanDays,
            displaySpan,
            daysInCurrentRow,
            startDayOfWeek,
            width: totalWidth,
            left: leftOffset,
            top: topOffset,
            cellWidth,
            gap,
            viewMode: this.currentViewMode
        });
    }

    clearResizePreview() {
        this.previewElements.forEach((element, key) => {
            element.remove();
        });
        this.previewElements.clear();
    }

    createResizePreview(session) {
        this.clearResizePreview();
        
        // Hide the original task element during resize
        session.element.style.opacity = '0.3';
        session.element.style.pointerEvents = 'none';
        
        // Initialize preview with current span
        this.renderResizePreview(session);
    }

    renderResizePreview(session) {
        const previewSpan = this.calculateSpanDays(session.previewStart, session.previewEnd);
        
        // Check if we need to update or recreate
        const existingPreviews = Array.from(this.previewElements.values());
        if (existingPreviews.length > 0) {
            CAL_LOG('🔄 Updating existing preview segments');
            this.clearResizePreview();
        } else {
            CAL_LOG('🆕 Creating new preview segments');
        }
        
        CAL_LOG('renderResizePreview:', {
            previewStart: session.previewStart.toDateString(),
            previewEnd: session.previewEnd.toDateString(),
            previewSpan,
            visibleRangeStart: this.visibleRangeStart?.toDateString(),
            visibleRangeEnd: this.visibleRangeEnd?.toDateString()
        });
        
        // Check if preview dates are within visible range
        if (this.visibleRangeStart && this.visibleRangeEnd) {
            const previewOutOfRange = session.previewStart > this.visibleRangeEnd || 
                                    session.previewEnd < this.visibleRangeStart;
            if (previewOutOfRange) {
                console.warn('⚠️ Preview dates are outside visible calendar range');
            }
        }
        
        // Create preview segments for each week/row the task spans
        this.createMultiRowPreviewSegments(session, previewSpan);
    }

    createMultiRowPreviewSegments(session, totalSpan) {
        const startDate = new Date(session.previewStart);
        const endDate = new Date(session.previewEnd);
        
        // Calculate how many days per row based on view mode
        const isMonthView = this.currentViewMode === 'month';
        const isWorkWeek = this.currentViewMode === 'work-week';
        
        // Guard against duplicate previews on rapid pointer moves
        const addedDayKeys = new Set();
        
        let currentDate = new Date(startDate);
        let segmentIndex = 0;
        const previewContainer = document.getElementById('calendarGrid') || document.body;
        
        while (currentDate <= endDate) {
            // Guard against duplicate segments for the same day
            const dayKey = currentDate.toISOString().slice(0, 10);
            if (addedDayKeys.has(dayKey)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
            addedDayKeys.add(dayKey);
            
            // Calculate how many days until the end of the current week (Saturday)
            const dayOfWeek = currentDate.getDay();
            let daysUntilWeekEnd;
            
            if (this.currentViewMode === 'day') {
                daysUntilWeekEnd = 1;
            } else if (isWorkWeek) {
                // Work week: only Mon-Fri
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    // Skip weekends - move to Monday
                    const daysToAdd = dayOfWeek === 0 ? 1 : 2; // Sunday -> Monday, Saturday -> Monday
                    currentDate.setDate(currentDate.getDate() + daysToAdd);
                    continue;
                }
                // Days remaining until Friday (inclusive)
                daysUntilWeekEnd = 5 - dayOfWeek + 1; // Mon=1 to Fri=5
            } else {
                // Full week or month view: days remaining until Saturday (inclusive)
                // Sunday = 0, so 6-0+1 = 7 days (Sun-Sat)
                // Saturday = 6, so 6-6+1 = 1 day (just Sat)
                daysUntilWeekEnd = 6 - dayOfWeek + 1;
            }
            
            // Calculate the segment end date (min of week end or task end)
            const segmentEndDate = new Date(currentDate);
            segmentEndDate.setDate(currentDate.getDate() + daysUntilWeekEnd - 1);
            const actualSegmentEnd = segmentEndDate > endDate ? endDate : segmentEndDate;
            
            const segmentSpan = this.calculateSpanDays(currentDate, actualSegmentEnd);
            
            // Find the cell for this segment
            const segmentCell = this.findCellForDate(currentDate);
            if (!segmentCell) {
                console.warn(`⚠️ No cell found for segment starting ${currentDate.toDateString()}`);
                // Move to next week (skip to Sunday of next week)
                const daysToNextWeek = 7 - currentDate.getDay();
                currentDate.setDate(currentDate.getDate() + daysToNextWeek);
                continue;
            }
            
            CAL_LOG(`✅ Creating segment ${segmentIndex}: ${currentDate.toDateString()} to ${actualSegmentEnd.toDateString()} (${segmentSpan} days)`);
            
            // Create preview element for this segment
            const previewElement = document.createElement('div');
            previewElement.className = `task-item task-resize-preview task-span priority-${session.task.priority} status-${session.task.status}`;
            previewElement.dataset.taskId = session.task.id;
            previewElement.dataset.segmentIndex = segmentIndex;
            previewElement.dataset.spanDays = segmentSpan;
            previewElement.dataset.spanStart = currentDate.toISOString();
            previewElement.dataset.spanEnd = actualSegmentEnd.toISOString();
            
            // Style the preview with extra visibility for debugging
            previewElement.style.opacity = '0.95';
            previewElement.style.border = '3px dashed #1976d2';
            previewElement.style.backgroundColor = segmentIndex === 0 ? 'rgba(25, 118, 210, 0.2)' : 'rgba(255, 152, 0, 0.2)'; // Orange for 2nd segment
            previewElement.style.zIndex = `${10000 + segmentIndex}`; // Increment z-index for each segment
            previewElement.style.height = '22px';
            previewElement.style.fontSize = '10px';
            previewElement.style.fontWeight = 'bold';
            previewElement.style.display = 'flex';
            previewElement.style.visibility = 'visible';
            previewElement.style.pointerEvents = 'none';
            previewElement.style.alignItems = 'center';
            previewElement.style.paddingLeft = '6px';
            previewElement.style.borderRadius = '4px';
            
            // Add content BEFORE positioning (so we know the width)
            const tempWidth = (segmentSpan * 87.33) - 8; // Estimate width for text calculation
            const maxLength = Math.max(8, Math.floor(tempWidth / 8));
            let displayText = session.task.title;
            if (totalSpan > 1) {
                displayText = `${session.task.title} (${totalSpan}d)`;
            }
            const shortTitle = displayText.length > maxLength ? 
                displayText.substring(0, maxLength) + '...' : displayText;
            previewElement.innerHTML = `<span style="font-style: italic; font-weight: 600;">${shortTitle}</span>`;
            
            // Add to container BEFORE positioning (required for getBoundingClientRect to work)
            previewContainer.appendChild(previewElement);
            
            // NOW position this segment (after it's in the DOM)
            this.positionPreviewElement(previewElement, currentDate, actualSegmentEnd, segmentSpan);
            
            // Debug: Log actual computed position
            const computedStyle = window.getComputedStyle(previewElement);
            const rect = previewElement.getBoundingClientRect();
            CAL_LOG(`🔍 Segment ${segmentIndex} after positioning:`, {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                position: computedStyle.position,
                zIndex: computedStyle.zIndex,
                top: computedStyle.top,
                left: computedStyle.left,
                width: computedStyle.width,
                height: computedStyle.height,
                boundingRect: {
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                },
                isVisible: rect.width > 0 && rect.height > 0
            });
            
            // Track this segment
            this.previewElements.set(`segment-${segmentIndex}`, previewElement);
            
            // Move to next week/row
            currentDate = new Date(actualSegmentEnd);
            currentDate.setDate(currentDate.getDate() + 1);
            segmentIndex++;
        }
        
        CAL_LOG(`🎨 Created ${segmentIndex} preview segment(s) for ${totalSpan} day span`);
    }

    endResizeDrag() {
        this.finishResizeInteraction(true);
    }

    cancelResizeDrag() {
        this.finishResizeInteraction(false);
    }

    finishResizeInteraction(applyChanges) {
        const session = this.resizeSession;
        if (!session) {
            return;
        }

        // Set flag to prevent click events immediately after resize
        this.justFinishedResize = true;
        setTimeout(() => {
            this.justFinishedResize = false;
        }, 500); // Prevent clicks for 500ms after resize ends (increased from 300ms)

        if (session.handleElement && session.pointerId != null && session.handleElement.releasePointerCapture) {
            try {
                session.handleElement.releasePointerCapture(session.pointerId);
            } catch (error) {
                // ignore pointer capture issues
            }
        }

        // Also try releasing from calendar-view
        const calendarView = document.getElementById('calendar-view');
        if (calendarView && session.pointerId != null && calendarView.releasePointerCapture) {
            try {
                calendarView.releasePointerCapture(session.pointerId);
                console.log('✅ Released pointer capture from calendar-view');
            } catch (error) {
                // ignore pointer capture issues
            }
        }

        if (session.isTouch) {
            document.removeEventListener('touchmove', this.boundResizeMove, { passive: false, capture: true });
            document.removeEventListener('touchend', this.boundResizeEnd, { passive: false, capture: true });
            document.removeEventListener('touchcancel', this.boundResizeCancel, { passive: false, capture: true });
        } else {
            // Remove from WINDOW to match where we added them
            window.removeEventListener('pointermove', this.boundResizeMove, { passive: false, capture: true });
            window.removeEventListener('pointerup', this.boundResizeEnd, { passive: false, capture: true });
            window.removeEventListener('pointercancel', this.boundResizeCancel, { passive: false, capture: true });
            window.removeEventListener('mousemove', this.boundResizeMove, { passive: false, capture: true });
            window.removeEventListener('mouseup', this.boundResizeEnd, { passive: false, capture: true });
            console.log('✅ Event listeners removed from window');
        }
        document.removeEventListener('keydown', this.boundResizeKey, { capture: true });

        session.relatedElements.forEach(el => {
            el.classList.remove('resizing', 'resizing-active', 'resizing-preview');
            el.style.pointerEvents = 'auto'; // Restore pointer events
            delete el.dataset.resizeSpan;
            delete el.dataset.resizeTooltip;
            delete el.dataset.resizeDirection;
        });

        session.element.classList.remove('resizing');
        session.element.style.opacity = '1';
        session.element.style.pointerEvents = 'auto';
        if (session.originalStyles) {
            session.element.style.width = session.originalStyles.width || '';
            session.element.style.left = session.originalStyles.left || '';
            session.element.style.right = session.originalStyles.right || '';
        }

        this.clearResizePreview();

        this.boundResizeMove = null;
        this.boundResizeEnd = null;
        this.boundResizeCancel = null;
        this.boundResizeKey = null;

        const startChanged = session.previewStart?.getTime?.() !== session.originalStart?.getTime?.();
        const endChanged = session.previewEnd?.getTime?.() !== session.originalEnd?.getTime?.();

        if (!applyChanges || (!startChanged && !endChanged)) {
            this.refreshTaskPositioning();
            this.resizeSession = null;
            return;
        }

        const updatedStart = new Date(session.previewStart);
        updatedStart.setHours(
            session.originalStartFull.getHours(),
            session.originalStartFull.getMinutes(),
            session.originalStartFull.getSeconds(),
            session.originalStartFull.getMilliseconds()
        );

        const updatedEnd = new Date(session.previewEnd);
        updatedEnd.setHours(
            session.originalEndFull.getHours(),
            session.originalEndFull.getMinutes(),
            session.originalEndFull.getSeconds(),
            session.originalEndFull.getMilliseconds()
        );

        const updateData = {
            dueAt: updatedEnd.toISOString()
        };

        if (startChanged) {
            updateData.startAt = updatedStart.toISOString();
            updateData.startDate = updatedStart.toISOString().slice(0, 10);
        }

        const updatedTask = dataManager.updateTask(session.task.id, updateData);
        if (updatedTask) {
            const previewSpan = this.calculateSpanDays(session.previewStart, session.previewEnd);
            const action =
                previewSpan > session.originalSpan ? 'extended' :
                previewSpan < session.originalSpan ? 'shortened' : 'kept';
            const rangeText = `${this.formatDate(session.previewStart)} -> ${this.formatDate(session.previewEnd)}`;
            const verb = action === 'kept' ? 'kept at' : action;
            this.showFeedback(`Project ${verb} ${rangeText} (${previewSpan} day${previewSpan === 1 ? '' : 's'})`);
            this.renderCalendar();
            this.refreshQuickPanelIfSelected(updatedTask);
        } else {
            this.showFeedback('Failed to resize project');
            this.renderCalendar();
        }

        this.resizeSession = null;
    }

    updateResizePreview() {
        const session = this.resizeSession;
        if (!session) {
            return;
        }

        const previewSpan = this.calculateSpanDays(session.previewStart, session.previewEnd);
        session.previewSpan = previewSpan;

        const startLabel = this.formatDate(session.previewStart);
        const endLabel = this.formatDate(session.previewEnd);
        const tooltip = `Resizing: ${startLabel} -> ${endLabel} (${previewSpan} day${previewSpan === 1 ? '' : 's'})`;

        // Only re-render if preview doesn't exist or span changed significantly
        const existingPreview = this.previewElements.get('main-preview');
        const currentSpan = existingPreview ? parseInt(existingPreview.dataset.spanDays) : 0;
        
        if (!existingPreview || currentSpan !== previewSpan) {
            console.log('📝 Updating preview - span changed from', currentSpan, 'to', previewSpan);
            this.renderResizePreview(session);
        } else {
            console.log('⚡ Preview span unchanged, skipping re-render');
        }

        session.relatedElements.forEach((el) => {
            el.classList.add('resizing-preview');
            el.dataset.resizeSpan = String(previewSpan);
            el.dataset.resizeDirection = session.direction;
            el.dataset.resizeTooltip = tooltip;
        });

        session.element.title = tooltip;
    }


    setFilter(filterKey, value) {
        if (!Object.prototype.hasOwnProperty.call(this.filters, filterKey)) return;
        this.filters[filterKey] = value || 'all';
        this.renderCalendar();
    }

    resetFilters() {
        this.filters = {
            jobId: 'all',
            assigneeId: 'all',
            priority: 'all',
            status: 'all'
        };
        this.searchTerm = '';
        this.renderCalendar();
    }

    filterTasksByAssignee(assigneeId) {
        this.setFilter('assigneeId', assigneeId || 'all');
    }

    filterTasksByJob(jobId) {
        this.setFilter('jobId', jobId || 'all');
    }

    searchTasks(query) {
        this.searchTerm = (query || '').trim().toLowerCase();
        this.renderCalendar();
    }

    highlightHighPriorityTasks() {
        // additional highlighting handled via CSS classes
    }



    bulkUpdateTasks(taskIds, updates) {
        (taskIds || []).forEach(taskId => {
            dataManager.updateTask(taskId, updates);
        });
        this.renderCalendar();
        this.showFeedback(`Updated ${taskIds.length} task(s)`);
    }

    setCalendarView(viewType) {
        switch (viewType) {
            case '1-week':
                this.visibleDays = 7;
                break;
            case 'month':
                this.visibleDays = 28;
                break;
            default:
                this.visibleDays = 14;
        }
        this.renderCalendar();
    }

    previousWeek() {
        if (this.currentViewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else if (this.currentViewMode === 'day') {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        }
        this.renderCalendar();
    }

    nextWeek() {
        if (this.currentViewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else if (this.currentViewMode === 'day') {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        }
        this.renderCalendar();
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }

    refreshCalendar() {
        this.renderCalendar();
    }

    describeSpan(spanDays) {
        return spanDays === 1 ? '1 day' : `${spanDays} days`;
    }

    getStatusGlyph(status) {
        switch ((status || '').toLowerCase()) {
            case 'done':
                return 'OK';
            case 'doing':
                return 'IP';
            case 'waiting':
                return 'WT';
            case 'urgent':
                return 'UR';
            default:
                return '--';
        }
    }

    showFeedback(message) {
        const feedback = document.createElement('div');
        feedback.className = 'calendar-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1976d2;
            color: #fff;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 2800);
    }
}

const calendarManager = new CalendarManager();

// Ensure calendar renders when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    calendarManager.initializeQuickPanel();
    calendarManager.renderCalendar();
});

function previousWeek() {
    calendarManager.previousWeek();
}

function nextWeek() {
    calendarManager.nextWeek();
}

function previousPeriod() {
    calendarManager.previousWeek();
}

function nextPeriod() {
    calendarManager.nextWeek();
}

function goToToday() {
    calendarManager.goToToday();
}









