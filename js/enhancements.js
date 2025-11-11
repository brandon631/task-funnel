// Keyboard shortcuts and additional UI enhancements

class KeyboardManager {
    constructor() {
        this.shortcuts = {
            'ctrl+n': () => showTaskModal(),
            'ctrl+v': () => toggleVoiceRecording(),
            'ctrl+1': () => showView('calendar'),
            'ctrl+2': () => showView('today-prep'),
            'ctrl+3': () => showView('person-funnel'),
            'ctrl+4': () => showView('job-hub'),
            'ctrl+5': () => showView('client-touches'),
            'escape': () => this.closeModals(),
            'ctrl+s': (e) => { e.preventDefault(); this.saveCurrentForm(); },
            'ctrl+r': (e) => { e.preventDefault(); this.refreshCurrentView(); }
        };
        
        this.initializeKeyboardHandlers();
        this.addHelpModal();
    }

    initializeKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            const key = this.getKeyCombo(e);
            if (this.shortcuts[key]) {
                e.preventDefault();
                this.shortcuts[key](e);
            }
        });
    }

    getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }

    closeModals() {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        
        if (typeof voiceManager !== 'undefined' && voiceManager.isRecording) {
            voiceManager.stopRecording();
        }
    }

    saveCurrentForm() {
        const taskModal = document.getElementById('taskModal');
        if (taskModal && taskModal.classList.contains('active')) {
            saveTask();
        }
    }

    refreshCurrentView() {
        if (typeof appController !== 'undefined') {
            appController.refreshCurrentView();
        }
    }

    addHelpModal() {
        const helpModal = document.createElement('div');
        helpModal.id = 'helpModal';
        helpModal.className = 'modal';
        helpModal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="close-btn" onclick="document.getElementById('helpModal').classList.remove('active')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="shortcut-grid">
                        <div class="shortcut-section">
                            <h4>Navigation</h4>
                            <div class="shortcut"><kbd>Ctrl+1</kbd> Calendar View</div>
                            <div class="shortcut"><kbd>Ctrl+2</kbd> Today Prep</div>
                            <div class="shortcut"><kbd>Ctrl+3</kbd> Person Funnel</div>
                            <div class="shortcut"><kbd>Ctrl+4</kbd> Job Hub</div>
                            <div class="shortcut"><kbd>Ctrl+5</kbd> Client Touches</div>
                        </div>
                        <div class="shortcut-section">
                            <h4>Actions</h4>
                            <div class="shortcut"><kbd>Ctrl+N</kbd> New Task</div>
                            <div class="shortcut"><kbd>Ctrl+V</kbd> Voice Recording</div>
                            <div class="shortcut"><kbd>Ctrl+S</kbd> Save Form</div>
                            <div class="shortcut"><kbd>Ctrl+R</kbd> Refresh View</div>
                            <div class="shortcut"><kbd>Esc</kbd> Close Modals</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        // Add help button to navigation
        const helpButton = document.createElement('button');
        helpButton.innerHTML = '<i class="fas fa-question-circle"></i> Help';
        helpButton.className = 'help-btn';
        helpButton.onclick = () => helpModal.classList.add('active');
        
        const navUser = document.querySelector('.nav-user');
        navUser.insertBefore(helpButton, navUser.firstChild);
    }
}

// Search functionality
class SearchManager {
    constructor() {
        this.addSearchBar();
        this.initializeSearch();
    }

    addSearchBar() {
        const searchBar = document.createElement('div');
        searchBar.className = 'search-bar';
        searchBar.innerHTML = `
            <input type="text" id="globalSearch" placeholder="Search tasks, people, jobs..." />
            <button onclick="this.search()"><i class="fas fa-search"></i></button>
        `;
        
        const viewHeaders = document.querySelectorAll('.view-header');
        viewHeaders.forEach(header => {
            const searchClone = searchBar.cloneNode(true);
            header.appendChild(searchClone);
        });
    }

    initializeSearch() {
        document.addEventListener('input', (e) => {
            if (e.target.id === 'globalSearch' || e.target.classList.contains('global-search')) {
                this.performSearch(e.target.value);
            }
        });
    }

    performSearch(query) {
        if (!query.trim()) {
            this.clearSearchHighlights();
            return;
        }

        this.clearSearchHighlights();
        this.highlightSearchResults(query);
    }

    highlightSearchResults(query) {
        const searchableElements = document.querySelectorAll('.task-item, .crew-task, .kanban-task, .job-task-card');
        searchableElements.forEach(element => {
            const text = element.textContent.toLowerCase();
            if (text.includes(query.toLowerCase())) {
                element.classList.add('search-highlight');
            }
        });
    }

    clearSearchHighlights() {
        const highlighted = document.querySelectorAll('.search-highlight');
        highlighted.forEach(element => {
            element.classList.remove('search-highlight');
        });
    }
}

// Auto-save functionality
class AutoSaveManager {
    constructor() {
        this.saveInterval = 30000; // 30 seconds
        this.initialize();
    }

    initialize() {
        setInterval(() => {
            this.performAutoSave();
        }, this.saveInterval);

        // Save on beforeunload
        window.addEventListener('beforeunload', () => {
            this.performAutoSave();
        });
    }

    performAutoSave() {
        // Data is already saved to localStorage by dataManager
        // This could be extended to sync with server
        console.log('Auto-save triggered');
    }
}

// Theme manager
class ThemeManager {
    constructor() {
        this.themes = {
            light: {
                '--primary-color': '#1976d2',
                '--bg-color': '#f5f5f5',
                '--text-color': '#333',
                '--card-bg': '#ffffff'
            },
            dark: {
                '--primary-color': '#90caf9',
                '--bg-color': '#121212',
                '--text-color': '#ffffff',
                '--card-bg': '#1e1e1e'
            },
            highContrast: {
                '--primary-color': '#ffff00',
                '--bg-color': '#000000',
                '--text-color': '#ffffff',
                '--card-bg': '#333333'
            }
        };
        
        this.currentTheme = localStorage.getItem('taskFunnelTheme') || 'light';
        this.addThemeSelector();
        this.applyTheme(this.currentTheme);
    }

    addThemeSelector() {
        const themeSelector = document.createElement('select');
        themeSelector.id = 'themeSelector';
        themeSelector.innerHTML = `
            <option value="light">Light Theme</option>
            <option value="dark">Dark Theme</option>
            <option value="highContrast">High Contrast</option>
        `;
        themeSelector.value = this.currentTheme;
        themeSelector.onchange = (e) => this.switchTheme(e.target.value);
        
        const navUser = document.querySelector('.nav-user');
        navUser.appendChild(themeSelector);
    }

    switchTheme(themeName) {
        this.currentTheme = themeName;
        localStorage.setItem('taskFunnelTheme', themeName);
        this.applyTheme(themeName);
    }

    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (theme) {
            Object.entries(theme).forEach(([property, value]) => {
                document.documentElement.style.setProperty(property, value);
            });
        }
    }
}

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            taskCreationTime: 0,
            searchTime: 0
        };
        
        this.startTime = performance.now();
        this.initializeMonitoring();
    }

    initializeMonitoring() {
        window.addEventListener('load', () => {
            this.metrics.pageLoadTime = performance.now() - this.startTime;
            console.log(`Page loaded in ${this.metrics.pageLoadTime.toFixed(2)}ms`);
        });
    }

    measureTaskCreation(callback) {
        const start = performance.now();
        const result = callback();
        this.metrics.taskCreationTime = performance.now() - start;
        return result;
    }

    measureSearch(callback) {
        const start = performance.now();
        const result = callback();
        this.metrics.searchTime = performance.now() - start;
        return result;
    }

    getMetrics() {
        return this.metrics;
    }
}

// Initialize enhancements
document.addEventListener('DOMContentLoaded', () => {
    const keyboardManager = new KeyboardManager();
    //const searchManager = new SearchManager();
    const autoSaveManager = new AutoSaveManager();
    //const themeManager = new ThemeManager();
    const performanceMonitor = new PerformanceMonitor();
    
    // Add global reference for debugging
    window.taskFunnelEnhancements = {
        keyboard: keyboardManager,
        //search: searchManager,
        autoSave: autoSaveManager,
        //theme: themeManager,
        performance: performanceMonitor
    };
});

// Add CSS for enhancements
const enhancementStyles = `
    .shortcut-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
    }
    
    .shortcut-section h4 {
        margin-bottom: 1rem;
        color: #1976d2;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 0.5rem;
    }
    
    .shortcut {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .shortcut:last-child {
        border-bottom: none;
    }
    
    kbd {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 3px;
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
        font-family: monospace;
        color: #495057;
    }
    
    .help-btn {
        background: none;
        border: none;
        color: white;
        padding: 0.5rem 1rem;
        margin-right: 1rem;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s;
    }
    
    .help-btn:hover {
        background: rgba(255,255,255,0.1);
    }
    
    .search-bar {
        display: flex;
        align-items: center;
        margin-left: auto;
    }
    
    .search-bar input {
        padding: 0.5rem;
        border: 1px solid #dee2e6;
        border-radius: 4px 0 0 4px;
        width: 200px;
    }
    
    .search-bar button {
        padding: 0.5rem 1rem;
        border: 1px solid #dee2e6;
        border-left: none;
        border-radius: 0 4px 4px 0;
        background: #f8f9fa;
        cursor: pointer;
    }
    
    .search-highlight {
        background: rgba(255, 255, 0, 0.3) !important;
        border: 2px solid #ffeb3b !important;
    }
    
    #themeSelector {
        margin-left: 1rem;
        padding: 0.25rem;
        border: none;
        border-radius: 4px;
        background: rgba(255,255,255,0.1);
        color: white;
    }
    
    @media (max-width: 768px) {
        .shortcut-grid {
            grid-template-columns: 1fr;
        }
        
        .search-bar {
            display: none;
        }
    }
`;

// Inject enhancement styles
const enhancementStyleSheet = document.createElement('style');
enhancementStyleSheet.textContent = enhancementStyles;
document.head.appendChild(enhancementStyleSheet);