// Voice Recording and Speech-to-Text functionality

class VoiceManager {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.transcript = '';
        this.initializeSpeechRecognition();
    }

    initializeSpeechRecognition() {
        // Check for browser support
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        if (this.recognition) {
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateVoiceButton();
                this.showVoiceModal();
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.transcript = finalTranscript + interimTranscript;
                this.updateTranscriptDisplay();
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopRecording();
                
                let errorMessage = 'Voice recognition error occurred.';
                switch (event.error) {
                    case 'no-speech':
                        errorMessage = 'No speech detected. Please try again.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'Microphone not available. Please check permissions.';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Microphone access denied. Please enable microphone permissions.';
                        break;
                    case 'network':
                        errorMessage = 'Network error occurred during voice recognition.';
                        break;
                }
                
                this.showError(errorMessage);
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceButton();
                
                if (this.transcript.trim()) {
                    this.processVoiceInput();
                } else {
                    this.hideVoiceModal();
                }
            };
        }
    }

    startRecording() {
        if (!this.recognition) {
            this.showError('Voice recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        // Request microphone permission
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                this.transcript = '';
                this.recognition.start();
            })
            .catch((error) => {
                console.error('Microphone access error:', error);
                this.showError('Microphone access denied. Please enable microphone permissions and try again.');
            });
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    updateVoiceButton() {
        const voiceBtn = document.getElementById('voiceBtn');
        const voiceIcon = document.getElementById('voiceIcon');
        
        if (voiceBtn && voiceIcon) {
            if (this.isRecording) {
                voiceBtn.classList.add('recording');
                voiceIcon.className = 'fas fa-stop';
            } else {
                voiceBtn.classList.remove('recording');
                voiceIcon.className = 'fas fa-microphone';
            }
        }
    }

    showVoiceModal() {
        const modal = document.getElementById('voiceModal');
        if (modal) {
            modal.classList.add('active');
            this.updateTranscriptDisplay();
        }
    }

    hideVoiceModal() {
        const modal = document.getElementById('voiceModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    updateTranscriptDisplay() {
        const transcriptDiv = document.getElementById('voiceTranscript');
        if (transcriptDiv) {
            if (this.transcript.trim()) {
                transcriptDiv.innerHTML = `<p><strong>You said:</strong></p><p>"${this.transcript}"</p>`;
            } else {
                transcriptDiv.innerHTML = '<p>Say something like: "Victor - raise shingles half inch at awning - Mansfield - today. Send photos."</p>';
            }
        }
    }

    processVoiceInput() {
        if (!this.transcript.trim()) return;

        // Save voice note
        const voiceNote = dataManager.addVoiceNote(this.transcript);
        
        // Parse transcript into tasks
        const parsedTasks = dataManager.parseVoiceToTasks(this.transcript);
        
        if (parsedTasks.length > 0) {
            // Show approval screen with parsed tasks
            this.showTaskApprovalScreen(parsedTasks, voiceNote.id);
        } else {
            // Show error - couldn't parse tasks
            this.showParsingError();
        }
    }

    showTaskApprovalScreen(tasks, voiceNoteId) {
        this.hideVoiceModal();
        
        // Create approval modal
        const approvalModal = this.createApprovalModal(tasks, voiceNoteId);
        document.body.appendChild(approvalModal);
        approvalModal.classList.add('active');
    }

    createApprovalModal(tasks, voiceNoteId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'approvalModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Approve & Send Tasks</h3>
                    <button class="close-btn" onclick="this.closeApprovalModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="approval-intro">
                        <p><strong>Parsed ${tasks.length} task(s) from your voice input:</strong></p>
                        <div class="original-transcript">
                            <small><em>"${this.transcript}"</em></small>
                        </div>
                    </div>
                    <div class="task-approval-list" id="taskApprovalList">
                        ${tasks.map((task, index) => this.createTaskApprovalCard(task, index)).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closeApprovalModal()">Discard</button>
                    <button type="button" class="btn-primary" onclick="this.approveAndSendTasks('${voiceNoteId}')">Approve & Send All</button>
                </div>
            </div>
        `;

        // Add close handler
        modal.querySelector('.close-btn').onclick = () => this.closeApprovalModal();
        
        return modal;
    }

    createTaskApprovalCard(task, index) {
        const assignee = dataManager.getPersonById(task.assigneeId);
        const job = dataManager.getJobById(task.jobId);
        const dueDate = new Date(task.dueAt);
        
        return `
            <div class="task-approval-card" data-index="${index}">
                <div class="task-approval-header">
                    <input type="text" class="task-title-input" value="${task.title}" 
                           onchange="this.updateTaskField(${index}, 'title', this.value)">
                    <button class="remove-task-btn" onclick="this.removeTask(${index})" title="Remove task">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="task-approval-details">
                    <div class="task-approval-row">
                        <div class="task-approval-field">
                            <label>Assignee:</label>
                            <select onchange="this.updateTaskField(${index}, 'assigneeId', this.value)">
                                ${dataManager.getPeople().map(person => 
                                    `<option value="${person.id}" ${person.id === task.assigneeId ? 'selected' : ''}>
                                        ${person.name}
                                    </option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="task-approval-field">
                            <label>Job:</label>
                            <select onchange="this.updateTaskField(${index}, 'jobId', this.value)">
                                ${dataManager.getJobs().map(job => 
                                    `<option value="${job.id}" ${job.id === task.jobId ? 'selected' : ''}>
                                        ${job.name}
                                    </option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="task-approval-row">
                        <div class="task-approval-field">
                            <label>Due Date:</label>
                            <input type="datetime-local" 
                                   value="${dueDate.toISOString().slice(0, 16)}"
                                   onchange="this.updateTaskField(${index}, 'dueAt', new Date(this.value).toISOString())">
                        </div>
                        <div class="task-approval-field">
                            <label>Priority:</label>
                            <select onchange="this.updateTaskField(${index}, 'priority', this.value)">
                                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                                <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                                <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                            </select>
                        </div>
                    </div>
                    <div class="task-approval-row">
                        <div class="task-approval-field">
                            <label>Required Proof:</label>
                            <select onchange="this.updateTaskField(${index}, 'requiredProof', this.value)">
                                <option value="none" ${task.requiredProof === 'none' ? 'selected' : ''}>None</option>
                                <option value="photo" ${task.requiredProof === 'photo' ? 'selected' : ''}>Photo</option>
                                <option value="client_ok" ${task.requiredProof === 'client_ok' ? 'selected' : ''}>Client OK</option>
                            </select>
                        </div>
                        <div class="task-approval-field">
                            <label>Location:</label>
                            <input type="text" value="${task.location || ''}" 
                                   onchange="this.updateTaskField(${index}, 'location', this.value)"
                                   placeholder="Specific location">
                        </div>
                    </div>
                    <div class="task-approval-field full-width">
                        <label>Notes:</label>
                        <textarea rows="2" onchange="this.updateTaskField(${index}, 'notes', this.value)"
                                  placeholder="Additional details">${task.notes || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    showParsingError() {
        this.hideVoiceModal();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'voice-error';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h3>Couldn't Parse Tasks</h3>
                <p>I couldn't understand the task format from your voice input:</p>
                <div class="error-transcript">"${this.transcript}"</div>
                <p>Please try using this format:</p>
                <div class="format-example">
                    <strong>Person - Task - Job - Time</strong><br>
                    <em>Example: "Victor - raise shingles half inch - Mansfield - today"</em>
                </div>
                <button onclick="this.dismissError()" class="btn-primary">Try Again</button>
            </div>
        `;
        
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
        `;
        
        errorDiv.querySelector('.error-content').style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 8px;
            max-width: 500px;
            text-align: center;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }

    dismissError() {
        const errorDiv = document.querySelector('.voice-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    closeApprovalModal() {
        const modal = document.getElementById('approvalModal');
        if (modal) {
            modal.remove();
        }
    }

    updateTaskField(index, field, value) {
        // Store the updated value for later use
        if (!window.pendingTasks) window.pendingTasks = [];
        if (!window.pendingTasks[index]) window.pendingTasks[index] = {};
        window.pendingTasks[index][field] = value;
    }

    removeTask(index) {
        const card = document.querySelector(`[data-index="${index}"]`);
        if (card) {
            card.remove();
        }
    }

    approveAndSendTasks(voiceNoteId) {
        const cards = document.querySelectorAll('.task-approval-card');
        const tasksToCreate = [];
        
        cards.forEach((card, index) => {
            const taskData = this.extractTaskDataFromCard(card, index);
            if (taskData) {
                tasksToCreate.push(taskData);
            }
        });
        
        if (tasksToCreate.length === 0) {
            this.showError('No tasks to create');
            return;
        }
        
        // Create tasks and send notifications
        const createdTasks = [];
        tasksToCreate.forEach(taskData => {
            const task = dataManager.addTask(taskData);
            createdTasks.push(task);
        });
        
        // Update voice note with task IDs
        const data = dataManager.getData();
        const voiceNote = data.voiceNotes.find(note => note.id === voiceNoteId);
        if (voiceNote) {
            voiceNote.parsed = true;
            voiceNote.taskIds = createdTasks.map(task => task.id);
            dataManager.saveData(data);
        }
        
        // Send notifications
        this.sendTaskNotifications(createdTasks);
        
        // Close modal and refresh views
        this.closeApprovalModal();
        this.showSuccessMessage(`Created and sent ${createdTasks.length} task(s)`);
        
        // Refresh calendar if visible
        if (typeof calendarManager !== 'undefined') {
            calendarManager.refreshCalendar();
        }
    }

    extractTaskDataFromCard(card, index) {
        const titleInput = card.querySelector('.task-title-input');
        const assigneeSelect = card.querySelector('select');
        const jobSelect = card.querySelectorAll('select')[1];
        const dueDateInput = card.querySelector('input[type="datetime-local"]');
        const prioritySelect = card.querySelectorAll('select')[2];
        const proofSelect = card.querySelectorAll('select')[3];
        const locationInput = card.querySelector('input[type="text"]:not(.task-title-input)');
        const notesTextarea = card.querySelector('textarea');
        
        if (!titleInput || !assigneeSelect || !jobSelect || !dueDateInput) {
            return null;
        }
        
        return {
            title: titleInput.value.toUpperCase(),
            assigneeId: assigneeSelect.value,
            jobId: jobSelect.value,
            dueAt: new Date(dueDateInput.value).toISOString(),
            startDate: new Date(dueDateInput.value).toISOString().split('T')[0],
            priority: prioritySelect ? prioritySelect.value : 'normal',
            requiredProof: proofSelect ? proofSelect.value : 'none',
            location: locationInput ? locationInput.value : '',
            notes: notesTextarea ? notesTextarea.value : '',
            status: 'open',
            createdBy: dataManager.getCurrentUser()
        };
    }

    sendTaskNotifications(tasks) {
        // Simulate SMS/Email sending
        tasks.forEach(task => {
            const assignee = dataManager.getPersonById(task.assigneeId);
            const job = dataManager.getJobById(task.jobId);
            
            if (assignee && job) {
                const message = this.formatTaskMessage(task, assignee, job);
                this.simulateNotification(assignee, message);
            }
        });
    }

    formatTaskMessage(task, assignee, job) {
        const dueDate = new Date(task.dueAt);
        const dateStr = dueDate.toLocaleDateString();
        const timeStr = dueDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        let message = `NEW TASK: ${task.title}\n`;
        message += `Job: ${job.name}\n`;
        message += `Due: ${dateStr} at ${timeStr}\n`;
        
        if (task.location) {
            message += `Location: ${task.location}\n`;
        }
        
        if (task.requiredProof !== 'none') {
            message += `Required Proof: ${task.requiredProof === 'photo' ? 'Photo' : 'Client OK'}\n`;
        }
        
        if (task.notes) {
            message += `Notes: ${task.notes}\n`;
        }
        
        message += `\nView details: [Task Link]`;
        
        return message;
    }

    simulateNotification(assignee, message) {
        // Log to console (in real app, this would send SMS/email)
        console.log(`${assignee.defaultChannel.toUpperCase()} to ${assignee.name} (${assignee.phone}):`, message);
        
        // Show visual notification
        this.showNotificationSent(assignee, message);
    }

    showNotificationSent(assignee, message) {
        const notification = document.createElement('div');
        notification.className = 'notification-sent';
        notification.innerHTML = `
            <strong>Sent to ${assignee.name}</strong><br>
            <small>via ${assignee.defaultChannel.toUpperCase()}</small>
        `;
        
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showSuccessMessage(message) {
        const success = document.createElement('div');
        success.className = 'success-message';
        success.textContent = message;
        success.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 16px 20px;
            border-radius: 6px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-weight: 500;
        `;
        
        document.body.appendChild(success);
        
        setTimeout(() => {
            success.remove();
        }, 5000);
    }

    showError(message) {
        const error = document.createElement('div');
        error.className = 'error-message';
        error.textContent = message;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 16px 20px;
            border-radius: 6px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-weight: 500;
            max-width: 300px;
        `;
        
        document.body.appendChild(error);
        
        setTimeout(() => {
            error.remove();
        }, 7000);
    }
}

// Initialize voice manager
const voiceManager = new VoiceManager();

// Global functions for HTML event handlers
function toggleVoiceRecording() {
    voiceManager.startRecording();
}

function stopVoiceRecording() {
    voiceManager.stopRecording();
}

// Add CSS for approval modal
const approvalStyles = `
    .task-approval-card {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        margin-bottom: 1rem;
        padding: 1rem;
        background: #f9f9f9;
    }
    
    .task-approval-header {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .task-title-input {
        flex: 1;
        font-weight: 600;
        font-size: 1.1rem;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        text-transform: uppercase;
    }
    
    .remove-task-btn {
        background: #f44336;
        color: white;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin-left: 1rem;
        cursor: pointer;
    }
    
    .task-approval-details {
        display: grid;
        gap: 1rem;
    }
    
    .task-approval-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
    
    .task-approval-field {
        display: flex;
        flex-direction: column;
    }
    
    .task-approval-field.full-width {
        grid-column: 1 / -1;
    }
    
    .task-approval-field label {
        font-weight: 500;
        margin-bottom: 0.25rem;
        font-size: 0.9rem;
        color: #666;
    }
    
    .task-approval-field input,
    .task-approval-field select,
    .task-approval-field textarea {
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 0.9rem;
    }
    
    .original-transcript {
        background: #f0f0f0;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
        border-left: 4px solid #1976d2;
    }
    
    .approval-intro p {
        margin-bottom: 0.5rem;
    }
    
    .error-transcript,
    .format-example {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
    }
    
    .format-example {
        border-left: 4px solid #4caf50;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = approvalStyles;
document.head.appendChild(styleSheet);