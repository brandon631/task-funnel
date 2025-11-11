// Data Models and Storage for Steve's Task Funnel System

class DataManager {
    constructor() {
        this.dataCache = null;
        this.api = null;
        this.initialized = this.initializeData();
    }

    async initializeData() {
        const stored = localStorage.getItem('taskFunnelData');

        if (stored) {
            const parsed = this.ensureDataShape(JSON.parse(stored));
            if (this.isLegacySample(parsed)) {
                const seed = await this.loadExternalSeed();
                const refreshed = this.buildSampleData(seed);
                this.saveData(refreshed);
            } else {
                this.saveData(parsed);
            }
        } else {
            const seed = await this.loadExternalSeed();
            const sampleData = this.buildSampleData(seed);
            this.saveData(sampleData);
        }

        // Initialize API provider
        if (window.API) {
            this.api = window.API.createProvider(this);
            if (this.api && window.Sync) {
                window.Sync.setStrip();
                await this.api.init();
            }
        }
    }

    async loadExternalSeed() {
        try {
            const response = await fetch('data.json', { cache: 'no-cache' });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Unable to load data.json seed', error);
        }
        return null;
    }

    getData() {
        if (this.dataCache) {
            return this.dataCache;
        }

        const stored = localStorage.getItem('taskFunnelData');
        if (stored) {
            this.dataCache = this.ensureDataShape(JSON.parse(stored));
            return this.dataCache;
        }

        this.dataCache = this.getDefaultData();
        return this.dataCache;
    }

    saveData(data) {
        this.dataCache = this.ensureDataShape(data);
        localStorage.setItem('taskFunnelData', JSON.stringify(this.dataCache));
    }

    getDefaultData() {
        return {
            people: [],
            jobs: [],
            tasks: [],
            voiceNotes: [],
            mediaLinks: [],
            clientUpdates: [],
            settings: {
                currentUser: null,
                defaultDueTime: '07:00'
            }
        };
    }

    buildSampleData(seed) {
        const defaults = this.getDefaultData();
        const people = this.createPeopleFromSeed(seed?.employees);
        const jobs = this.createJobsFromSeed(seed?.jobs, people);
        const tasks = this.createSampleTasks(people, jobs);

        return {
            ...defaults,
            people,
            jobs,
            tasks,
            settings: {
                currentUser: people.find(person => person.role === 'admin')?.id || people[0]?.id || null,
                defaultDueTime: '07:00'
            }
        };
    }

    isLegacySample(data) {
        if (!data || !Array.isArray(data.people) || data.people.length === 0) {
            return false;
        }

        const legacyIds = ['steve', 'victor', 'jeremy', 'nick-c', 'nick-s', 'jose'];
        const ids = data.people.map(person => person.id);
        return legacyIds.every(id => ids.includes(id));
    }

    ensureDataShape(data) {
        const defaults = this.getDefaultData();
        const safe = {
            ...defaults,
            ...(data || {}),
            people: Array.isArray(data?.people) ? data.people : [],
            jobs: Array.isArray(data?.jobs) ? data.jobs : [],
            tasks: Array.isArray(data?.tasks) ? data.tasks : [],
            voiceNotes: Array.isArray(data?.voiceNotes) ? data.voiceNotes : [],
            mediaLinks: Array.isArray(data?.mediaLinks) ? data.mediaLinks : [],
            clientUpdates: Array.isArray(data?.clientUpdates) ? data.clientUpdates : [],
            settings: {
                ...defaults.settings,
                ...(data?.settings || {})
            }
        };

        safe.people = safe.people.map((person, index) => ({
            ...person,
            id: person.id || this.slugify(person.name || `person-${index + 1}`),
            name: this.formatPersonName(person.name || `Crew Member ${index + 1}`),
            role: person.role || 'crew',
            defaultChannel: person.defaultChannel || (person.role === 'admin' ? 'email' : 'sms')
        }));

        safe.jobs = safe.jobs.map((job, index) => ({
            ...job,
            id: job.id || this.slugify(`${job.name || 'job'}-${index + 1}`),
            name: this.formatJobName(job.name || `Project ${index + 1}`),
            status: job.status || 'active'
        }));

        safe.tasks = safe.tasks.map((task, index) => this.normalizeTask(task, index));

        if (!safe.settings.currentUser && safe.people.length > 0) {
            safe.settings.currentUser = safe.people.find(person => person.role === 'admin')?.id || safe.people[0].id;
        }

        return safe;
    }

    createPeopleFromSeed(employees = []) {
        const fallback = [
            {
                id: 'admin-steve',
                name: 'Steven Hurtt',
                role: 'admin',
                phone: this.generatePhone(0),
                email: 'steven.hurtt@taskfunnel.local',
                defaultChannel: 'email'
            },
            {
                id: 'lead-kerry',
                name: 'Kerry Ellis',
                role: 'lead',
                phone: this.generatePhone(1),
                email: 'kerry.ellis@taskfunnel.local',
                defaultChannel: 'sms'
            },
            {
                id: 'lead-victor',
                name: 'Victor Maldonado',
                role: 'lead',
                phone: this.generatePhone(2),
                email: 'victor.maldonado@taskfunnel.local',
                defaultChannel: 'sms'
            },
            {
                id: 'crew-nicholas',
                name: 'Nicholas Hurtt',
                role: 'crew',
                phone: this.generatePhone(3),
                email: 'nicholas.hurtt@taskfunnel.local',
                defaultChannel: 'sms'
            },
            {
                id: 'crew-cody',
                name: 'Cody Thompson',
                role: 'crew',
                phone: this.generatePhone(4),
                email: 'cody.thompson@taskfunnel.local',
                defaultChannel: 'sms'
            },
            {
                id: 'crew-jean',
                name: 'Jean Jonas',
                role: 'crew',
                phone: this.generatePhone(5),
                email: 'jean.jonas@taskfunnel.local',
                defaultChannel: 'sms'
            }
        ];

        if (!employees.length) {
            return fallback;
        }

        const roleOverrides = {
            'STEVEN G HURTT': 'admin',
            'KERRY ELLIS': 'lead',
            'BRANDON HURTT': 'lead',
            'CARL P HURTT': 'lead',
            'VICTOR H MALDONADO': 'lead',
            'TRINIDAD VARGAS MALDONADO': 'lead'
        };

        return employees.map((employee, index) => {
            const rawName = this.compactWhitespace(employee.name || `Crew Member ${index + 1}`);
            const normalizedName = this.formatPersonName(rawName);
            const roleKey = rawName.toUpperCase();
            const role = roleOverrides[roleKey] || 'crew';

            return {
                id: employee.id || this.slugify(normalizedName),
                name: normalizedName,
                role,
                phone: employee.phone || this.generatePhone(index),
                email: employee.email || this.generateEmail(normalizedName, employee.id || index),
                defaultChannel: role === 'admin' ? 'email' : 'sms'
            };
        });
    }

    createJobsFromSeed(jobNames = [], people = []) {
        const fallbackJobs = [
            {
                id: 'alton-t-a-phase-2',
                name: 'Alton T.A - Phase 2',
                address: 'TBD',
                clientName: 'Alton T.A.',
                clientPhone: this.generatePhone(40),
                clientEmail: 'alton.phase2@taskfunnel.local',
                pocPersonId: people.find(person => person.role === 'lead')?.id || people[0]?.id || null,
                status: 'active',
                startDate: this.getUpcomingMonday().toISOString().split('T')[0],
                estimatedCompletion: this.getUpcomingMonday(10).toISOString().split('T')[0]
            },
            {
                id: 'calhoun-j-maint-2024',
                name: 'Calhoun J - Maintenance 2024',
                address: 'TBD',
                clientName: 'Calhoun J.',
                clientPhone: this.generatePhone(41),
                clientEmail: 'calhoun.maintenance@taskfunnel.local',
                pocPersonId: people.find(person => person.role === 'lead')?.id || people[0]?.id || null,
                status: 'active',
                startDate: this.getUpcomingMonday(2).toISOString().split('T')[0],
                estimatedCompletion: this.getUpcomingMonday(14).toISOString().split('T')[0]
            },
            {
                id: 'downtown-office-complex',
                name: 'Downtown Office Complex',
                address: 'TBD',
                clientName: 'Downtown Office',
                clientPhone: this.generatePhone(42),
                clientEmail: 'downtown.office@taskfunnel.local',
                pocPersonId: people.find(person => person.role === 'lead')?.id || people[0]?.id || null,
                status: 'active',
                startDate: this.getUpcomingMonday(3).toISOString().split('T')[0],
                estimatedCompletion: this.getUpcomingMonday(21).toISOString().split('T')[0]
            }
        ];

        if (!jobNames.length) {
            return fallbackJobs;
        }

        const baseDate = this.getUpcomingMonday();
        const leads = people.filter(person => person.role === 'lead');
        const owner = leads[0]?.id || people.find(person => person.role === 'admin')?.id || people[0]?.id || null;

        return jobNames.map((name, index) => {
            const normalizedName = this.formatJobName(name || `Project ${index + 1}`);
            const start = new Date(baseDate);
            start.setDate(start.getDate() + (index % 7));
            const end = new Date(start);
            end.setDate(end.getDate() + 10);

            const poc = leads.length ? leads[index % leads.length].id : owner;

            return {
                id: this.slugify(normalizedName || `project-${index + 1}`),
                name: normalizedName,
                address: '',
                clientName: normalizedName.split('-')[0].trim(),
                clientPhone: this.generatePhone(100 + index),
                clientEmail: this.generateEmail(normalizedName, `job${index + 1}`),
                pocPersonId: poc,
                status: 'active',
                startDate: start.toISOString().split('T')[0],
                estimatedCompletion: end.toISOString().split('T')[0]
            };
        });
    }

    createSampleTasks(people, jobs) {
        if (!people.length || !jobs.length) {
            return [];
        }

        const admin = people.find(person => person.role === 'admin') || people[0];
        const leads = people.filter(person => person.role === 'lead');
        const crews = people.filter(person => person.role === 'crew');
        const baseDate = this.getUpcomingMonday();
        let counter = 1;

        const assign = (options) => {
            const job = options.job || jobs[options.jobIndex ?? 0] || jobs[0];
            const assignee = options.assignee || crews[options.crewIndex ?? 0] || leads[options.leadIndex ?? 0] || admin;
            if (!job || !assignee) {
                return null;
            }

            const start = new Date(baseDate);
            start.setDate(start.getDate() + (options.dayOffset || 0));
            start.setHours(options.startHour ?? 7, options.startMinute ?? 0, 0, 0);

            const end = new Date(start);
            const spanDays = Math.max(1, options.durationDays || 1);
            end.setDate(end.getDate() + spanDays - 1);
            end.setHours(options.endHour ?? start.getHours() + 1, start.getMinutes(), 0, 0);

            return {
                id: `task-${counter++}`,
                title: (options.title || 'Task').toUpperCase(),
                jobId: job.id,
                assigneeId: assignee.id,
                startAt: start.toISOString(),
                dueAt: end.toISOString(),
                priority: options.priority || 'normal',
                requiredProof: options.requiredProof || 'none',
                location: options.location || '',
                notes: options.notes || '',
                status: options.status || 'open',
                createdAt: new Date(baseDate).toISOString(),
                createdBy: admin.id
            };
        };

        const tasks = [
            assign({
                title: 'Stage materials along east elevation',
                jobIndex: 0,
                assignee: leads[0] || crews[0],
                dayOffset: 0,
                durationDays: 2,
                priority: 'high',
                requiredProof: 'photo',
                notes: 'Lay tarps before unloading. Capture progress photos.',
                location: 'East elevation scaffold',
                status: 'doing'
            }),
            assign({
                title: 'Rough in electrical feeders',
                jobIndex: 1,
                assignee: crews[1] || leads[1] || crews[0],
                dayOffset: 1,
                startHour: 9,
                durationDays: 3,
                priority: 'urgent',
                requiredProof: 'client_ok',
                notes: 'Coordinate with inspector for end-of-week check.',
                location: 'Main mechanical room',
                status: 'open'
            }),
            assign({
                title: 'Client punch list walk-through',
                jobIndex: 2,
                assignee: leads[1] || leads[0] || crews[0],
                dayOffset: 4,
                startHour: 10,
                priority: 'normal',
                requiredProof: 'client_ok',
                notes: 'Prepare updated scope sheet for client review.',
                location: 'Lobby entrance',
                status: 'waiting'
            }),
            assign({
                title: 'Seal masonry joints',
                jobIndex: 3,
                assignee: crews[2] || crews[0],
                dayOffset: 5,
                startHour: 8,
                durationDays: 2,
                priority: 'normal',
                requiredProof: 'photo',
                notes: 'Use low-temp sealant, document before/after.',
                location: 'North parapet',
                status: 'open'
            }),
            assign({
                title: 'Safety audit and toolbox talk',
                jobIndex: 4,
                assignee: admin,
                dayOffset: 0,
                startHour: 6,
                priority: 'high',
                requiredProof: 'none',
                notes: 'Review harness usage. Attendance sheet stored in office.',
                location: 'Job trailer',
                status: 'done'
            })
        ];

        return tasks.filter(Boolean);
    }

    normalizeTask(task, index = 0) {
        const id = task.id || `task-${Date.now()}-${index}`;
        const startISO = this.coerceISO(task.startAt || task.startDate || task.dueAt);
        const startDate = startISO ? new Date(startISO) : new Date();
        const dueISO = this.coerceISO(task.dueAt) || startDate.toISOString();
        const dueDate = new Date(dueISO);

        if (dueDate < startDate) {
            dueDate.setTime(startDate.getTime());
        }

        return {
            ...task,
            id,
            title: (task.title || 'Task').toUpperCase(),
            startAt: startDate.toISOString(),
            startDate: startDate.toISOString().split('T')[0],
            dueAt: dueDate.toISOString(),
            priority: task.priority || 'normal',
            requiredProof: task.requiredProof || 'none',
            notes: task.notes || '',
            status: task.status || 'open',
            subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
            dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
            photos: Array.isArray(task.photos) ? task.photos : [],
            documents: Array.isArray(task.documents) ? task.documents : [],
            mediaCategories: task.mediaCategories || { 
                before: [], 
                progress: [], 
                after: [], 
                issues: [],
                documents: []
            }
        };
    }

    formatPersonName(name) {
        const compact = this.compactWhitespace(name);
        if (!compact) {
            return 'Crew Member';
        }

        return compact
            .split(' ')
            .filter(Boolean)
            .map(part => part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    formatJobName(name) {
        const compact = this.compactWhitespace(name);
        if (!compact) {
            return 'Project';
        }

        return compact
            .split(' ')
            .filter(Boolean)
            .map(part => {
                if (/^[A-Z\d&]+$/.test(part)) {
                    return part;
                }
                return part[0].toUpperCase() + part.slice(1).toLowerCase();
            })
            .join(' ');
    }

    slugify(value) {
        return this.compactWhitespace(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    }

    compactWhitespace(value) {
        return (value || '').replace(/\s+/g, ' ').trim();
    }

    generateEmail(name, fallback) {
        const base = this.slugify(name).replace(/-/g, '.');
        const suffix = typeof fallback === 'string' ? fallback : `id${fallback}`;
        return `${base || 'user'}.${suffix}@taskfunnel.local`.toLowerCase();
    }

    generatePhone(index) {
        const base = 1000 + (index % 9000);
        return `555-${base.toString().padStart(4, '0')}`;
    }

    coerceISO(value) {
        if (!value) {
            return null;
        }

        if (value.includes('T')) {
            return new Date(value).toISOString();
        }

        return new Date(`${value}T07:00:00`).toISOString();
    }

    getUpcomingMonday(offsetDays = 0) {
        const today = new Date();
        const day = today.getDay();
        const diff = day === 0 ? 1 : 1 - day;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff + offsetDays);
        monday.setHours(7, 0, 0, 0);
        return monday;
    }

    // Helper methods for data manipulation
    getPeople() {
        return this.getData().people;
    }

    getJobs() {
        return this.getData().jobs;
    }

    getTasks() {
        return this.getData().tasks;
    }

    // Aliases for consistency
    getAllPeople() {
        return this.getPeople();
    }

    getAllJobs() {
        return this.getJobs();
    }

    getTasksForPerson(personId) {
        return this.getTasks().filter(task => task.assigneeId === personId);
    }

    getTasksForJob(jobId) {
        return this.getTasks().filter(task => task.jobId === jobId);
    }

    getTasksForDate(date) {
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        return this.getTasks().filter(task => {
            const taskStart = new Date(task.startAt || task.startDate || task.dueAt);
            const taskEnd = new Date(task.dueAt);
            taskStart.setHours(0, 0, 0, 0);
            taskEnd.setHours(0, 0, 0, 0);
            return taskStart <= target && taskEnd >= target;
        });
    }

    getTasksForDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return this.getTasks().filter(task => {
            const taskStart = new Date(task.startAt || task.startDate || task.dueAt);
            const taskEnd = new Date(task.dueAt);
            return taskStart <= end && taskEnd >= start;
        });
    }

    addTask(task) {
        const data = this.getData();
        const enriched = {
            ...task,
            id: 'task-' + Date.now(),
            createdAt: new Date().toISOString(),
            createdBy: data.settings.currentUser || task.createdBy
        };

        const normalized = this.normalizeTask(enriched, data.tasks.length);
        data.tasks.push(normalized);
        this.saveData(data);
        
        // Enqueue for Supabase sync if configured
        if (window.CONFIG && window.CONFIG.backend === 'supabase' && window.Sync && this.api) {
            window.Sync.enqueue({ type: 'upsertTask', payload: normalized }, this.api);
        }
        
        return normalized;
    }

    updateTask(taskId, updates) {
        const data = this.getData();
        const taskIndex = data.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            const oldTask = data.tasks[taskIndex];
            const merged = { ...oldTask, ...updates };
            data.tasks[taskIndex] = this.normalizeTask(merged, taskIndex);
            this.saveData(data);
            
            // Check for status change to trigger automatic updates
            if (typeof statusUpdateManager !== 'undefined' && updates.status && oldTask.status !== updates.status) {
                if (updates.status === 'done' && oldTask.status !== 'done') {
                    // Task completed - send automatic update
                    setTimeout(() => statusUpdateManager.sendTaskCompletedUpdate(taskId), 100);
                }
            }
            
            // Enqueue for Supabase sync if configured
            if (window.CONFIG && window.CONFIG.backend === 'supabase' && window.Sync && this.api) {
                window.Sync.enqueue({ type: 'upsertTask', payload: data.tasks[taskIndex] }, this.api);
            }
            
            return data.tasks[taskIndex];
        }
        return null;
    }

    deleteTask(taskId) {
        const data = this.getData();
        data.tasks = data.tasks.filter(task => task.id !== taskId);
        this.saveData(data);
    }

    // Local storage helper methods for API providers
    _listTasksLocal() {
        const data = this.getData();
        return data.tasks || [];
    }

    _upsertTaskLocal(task) {
        const data = this.getData();
        const taskIndex = data.tasks.findIndex(t => t.id === task.id);
        
        if (taskIndex !== -1) {
            data.tasks[taskIndex] = this.normalizeTask(task, taskIndex);
        } else {
            data.tasks.push(this.normalizeTask(task, data.tasks.length));
        }
        
        this.saveData(data);
        return taskIndex !== -1 ? data.tasks[taskIndex] : data.tasks[data.tasks.length - 1];
    }

    _bulkUpsertLocal(tasks) {
        const data = this.getData();
        
        tasks.forEach(task => {
            const taskIndex = data.tasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                data.tasks[taskIndex] = this.normalizeTask(task, taskIndex);
            } else {
                data.tasks.push(this.normalizeTask(task, data.tasks.length));
            }
        });
        
        this.saveData(data);
        return { count: tasks.length };
    }

    _listPeopleLocal() {
        const data = this.getData();
        return data.people || [];
    }

    _listJobsLocal() {
        const data = this.getData();
        return data.jobs || [];
    }

    addVoiceNote(transcript) {
        const data = this.getData();
        const voiceNote = {
            id: 'voice-' + Date.now(),
            audioUrl: null,
            transcript: transcript,
            createdBy: data.settings.currentUser,
            createdAt: new Date().toISOString(),
            parsed: false,
            taskIds: []
        };
        data.voiceNotes.push(voiceNote);
        this.saveData(data);
        return voiceNote;
    }

    addMediaLink(jobId, taskId, uploaderId, url, caption) {
        const data = this.getData();
        const mediaLink = {
            id: 'media-' + Date.now(),
            jobId: jobId,
            taskId: taskId,
            uploaderId: uploaderId,
            url: url,
            capturedAt: new Date().toISOString(),
            caption: caption || ''
        };
        data.mediaLinks.push(mediaLink);
        this.saveData(data);
        return mediaLink;
    }

    addClientUpdate(jobId, channel, body, recipient) {
        const data = this.getData();
        const update = {
            id: 'update-' + Date.now(),
            jobId: jobId,
            channel: channel,
            sentAt: new Date().toISOString(),
            body: body,
            recipient: recipient,
            sentBy: data.settings.currentUser
        };
        data.clientUpdates.push(update);
        this.saveData(data);
        return update;
    }

    getCurrentUser() {
        return this.getData().settings.currentUser;
    }

    setCurrentUser(userId) {
        const data = this.getData();
        data.settings.currentUser = userId;
        this.saveData(data);
    }

    getPersonById(id) {
        return this.getPeople().find(person => person.id === id);
    }

    getJobById(id) {
        return this.getJobs().find(job => job.id === id);
    }

    getTaskById(id) {
        return this.getTasks().find(task => task.id === id);
    }

    // Business logic helpers
    parseVoiceToTasks(transcript) {
        // Simple parser for voice commands
        // Format: "Person - task - job - timeframe. Additional notes."
        const tasks = [];
        const sentences = transcript.split(/[.!?]+/);
        
        for (let sentence of sentences) {
            sentence = sentence.trim();
            if (!sentence) continue;

            const parts = sentence.split(' - ');
            if (parts.length >= 3) {
                const assigneeName = parts[0].trim();
                const taskDescription = parts[1].trim();
                const jobReference = parts[2].trim();
                
                // Find assignee by name (handle nicknames)
                const assignee = this.findPersonByName(assigneeName);
                const job = this.findJobByName(jobReference);
                
                if (assignee && job) {
                    const task = {
                        title: taskDescription.toUpperCase(),
                        jobId: job.id,
                        assigneeId: assignee.id,
                        dueAt: this.parseTimeframe(parts.length > 3 ? parts[3] : 'today'),
                        priority: 'normal',
                        location: '',
                        notes: sentence,
                        requiredProof: this.detectProofRequirement(sentence),
                        status: 'open',
                        createdBy: this.getCurrentUser()
                    };
                    tasks.push(task);
                }
            }
        }
        
        return tasks;
    }

    findPersonByName(name) {
        if (!name) {
            return null;
        }

        const people = this.getPeople();
        const normalized = this.compactWhitespace(name).toLowerCase();

        // Direct name match
        let person = people.find(p => p.name.toLowerCase() === normalized);
        if (person) {
            return person;
        }

        const nicknames = {
            'steve': 'steven hurtt',
            'steven': 'steven hurtt',
            'stephen': 'steven hurtt',
            'vic': 'victor h maldonado',
            'victor': 'victor h maldonado',
            'trini': 'trinidad vargas maldonado',
            'kerry': 'kerry ellis',
            'nick': 'nicholas g hurtt',
            'nicky': 'nicholas g hurtt',
            'cody': 'cody m thompson',
            'jean': 'jean jonas',
            'fred': 'frederick h banlowe, jr',
            'freddy': 'frederick h banlowe, jr',
            'jose': 'jose m rivas',
            'andre': 'andrew lenihan',
            'andrew': 'andrew lenihan'
        };

        const alias = nicknames[normalized];
        if (alias) {
            person = people.find(p => p.name.toLowerCase() === alias);
            if (person) {
                return person;
            }
        }

        // Match by first name
        person = people.find(p => p.name.toLowerCase().split(' ')[0] === normalized);
        if (person) {
            return person;
        }

        // Partial match fallback
        return people.find(p => p.name.toLowerCase().includes(normalized)) || null;
    }

    findJobByName(name) {
        const jobs = this.getJobs();
        const lowerName = name.toLowerCase();
        
        // Direct name match
        let job = jobs.find(j => j.name.toLowerCase().includes(lowerName));
        if (job) return job;
        
        // ID match
        job = jobs.find(j => j.id.toLowerCase().includes(lowerName));
        return job;
    }

    parseTimeframe(timeframe) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        timeframe = timeframe.toLowerCase().trim();
        
        if (timeframe.includes('today')) {
            today.setHours(7, 0, 0, 0); // Default 7 AM
            return today.toISOString();
        } else if (timeframe.includes('tomorrow')) {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            tomorrow.setHours(7, 0, 0, 0);
            return tomorrow.toISOString();
        } else if (timeframe.includes('monday')) {
            const monday = this.getNextWeekday(1); // Monday = 1
            monday.setHours(7, 0, 0, 0);
            return monday.toISOString();
        } else if (timeframe.includes('tuesday')) {
            const tuesday = this.getNextWeekday(2);
            tuesday.setHours(7, 0, 0, 0);
            return tuesday.toISOString();
        } else if (timeframe.includes('wednesday')) {
            const wednesday = this.getNextWeekday(3);
            wednesday.setHours(7, 0, 0, 0);
            return wednesday.toISOString();
        } else if (timeframe.includes('thursday')) {
            const thursday = this.getNextWeekday(4);
            thursday.setHours(7, 0, 0, 0);
            return thursday.toISOString();
        } else if (timeframe.includes('friday')) {
            const friday = this.getNextWeekday(5);
            friday.setHours(7, 0, 0, 0);
            return friday.toISOString();
        }
        
        // Default to next business day
        const nextBusiness = new Date(today);
        nextBusiness.setDate(today.getDate() + 1);
        if (nextBusiness.getDay() === 0) nextBusiness.setDate(nextBusiness.getDate() + 1); // Skip Sunday
        if (nextBusiness.getDay() === 6) nextBusiness.setDate(nextBusiness.getDate() + 2); // Skip Saturday
        nextBusiness.setHours(7, 0, 0, 0);
        return nextBusiness.toISOString();
    }

    getNextWeekday(dayOfWeek) {
        const today = new Date();
        const currentDay = today.getDay();
        let daysUntilTarget = dayOfWeek - currentDay;
        if (daysUntilTarget <= 0) daysUntilTarget += 7; // Next week
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntilTarget);
        return targetDate;
    }

    detectProofRequirement(sentence) {
        const lowerSentence = sentence.toLowerCase();
        if (lowerSentence.includes('photo') || lowerSentence.includes('picture') || lowerSentence.includes('send photos')) {
            return 'photo';
        } else if (lowerSentence.includes('client ok') || lowerSentence.includes('client approval')) {
            return 'client_ok';
        }
        return 'none';
    }

    // Task status management
    canCompleteTask(taskId) {
        const task = this.getTaskById(taskId);
        if (!task) return false;
        
        if (task.requiredProof === 'none') return true;
        
        if (task.requiredProof === 'photo') {
            const mediaLinks = this.getData().mediaLinks;
            return mediaLinks.some(media => media.taskId === taskId);
        }
        
        if (task.requiredProof === 'client_ok') {
            // Check for client updates or manual approval
            return task.clientApproved === true;
        }
        
        return false;
    }

    getTasksNeedingAttention() {
        const now = new Date();
        return this.getTasks().filter(task => {
            const dueDate = new Date(task.dueAt);
            return task.status === 'open' && dueDate < now;
        });
    }

    getClientsNeedingUpdates() {
        const jobs = this.getJobs();
        const updates = this.getData().clientUpdates;
        const now = new Date();
        
        return jobs.filter(job => {
            if (job.status !== 'active') return false;
            
            const lastUpdate = updates
                .filter(update => update.jobId === job.id)
                .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
            
            if (!lastUpdate) return true; // No updates sent
            
            const hoursSinceUpdate = (now - new Date(lastUpdate.sentAt)) / (1000 * 60 * 60);
            return hoursSinceUpdate > 48; // 48 hour SLA
        });
    }

    // Photo and Document Management
    addTaskPhoto(taskId, photoData, category = 'progress') {
        const data = this.getData();
        const task = data.tasks.find(t => t.id === taskId);
        if (!task) return false;

        const photo = {
            id: `photo-${Date.now()}`,
            url: photoData.url || photoData.dataUrl,
            caption: photoData.caption || '',
            category: category,
            timestamp: new Date().toISOString(),
            uploadedBy: this.getCurrentUser(),
            location: photoData.location || '',
            taskId: taskId
        };

        // Add to task's media categories
        if (!task.mediaCategories) {
            task.mediaCategories = { before: [], progress: [], after: [], issues: [], documents: [] };
        }
        
        if (!task.mediaCategories[category]) {
            task.mediaCategories[category] = [];
        }
        
        task.mediaCategories[category].push(photo);

        // Also add to legacy photos array for backward compatibility
        if (!task.photos) task.photos = [];
        task.photos.push(photo);

        this.saveData(data);
        return photo;
    }

    addTaskDocument(taskId, documentData) {
        const data = this.getData();
        const task = data.tasks.find(t => t.id === taskId);
        if (!task) return false;

        const document = {
            id: `doc-${Date.now()}`,
            name: documentData.name,
            url: documentData.url,
            type: documentData.type || 'unknown',
            size: documentData.size,
            timestamp: new Date().toISOString(),
            uploadedBy: this.getCurrentUser(),
            taskId: taskId
        };

        if (!task.mediaCategories) {
            task.mediaCategories = { before: [], progress: [], after: [], issues: [], documents: [] };
        }
        
        task.mediaCategories.documents.push(document);

        if (!task.documents) task.documents = [];
        task.documents.push(document);

        this.saveData(data);
        return document;
    }

    getTaskMedia(taskId, category = null) {
        const task = this.getTaskById(taskId);
        if (!task || !task.mediaCategories) return [];

        if (category) {
            return task.mediaCategories[category] || [];
        }

        // Return all media organized by category
        return task.mediaCategories;
    }

    removeTaskMedia(taskId, mediaId) {
        const data = this.getData();
        const task = data.tasks.find(t => t.id === taskId);
        if (!task || !task.mediaCategories) return false;

        let removed = false;
        
        // Remove from all categories
        Object.keys(task.mediaCategories).forEach(category => {
            const index = task.mediaCategories[category].findIndex(item => item.id === mediaId);
            if (index !== -1) {
                task.mediaCategories[category].splice(index, 1);
                removed = true;
            }
        });

        // Remove from legacy arrays
        if (task.photos) {
            const photoIndex = task.photos.findIndex(p => p.id === mediaId);
            if (photoIndex !== -1) {
                task.photos.splice(photoIndex, 1);
            }
        }

        if (task.documents) {
            const docIndex = task.documents.findIndex(d => d.id === mediaId);
            if (docIndex !== -1) {
                task.documents.splice(docIndex, 1);
            }
        }

        if (removed) {
            this.saveData(data);
        }
        
        return removed;
    }

    // Lead Table helpers
    getAllTasks() {
        return this.getTasks().map(task => ({
            ...task,
            id: task.id,
            title: task.title,
            jobId: task.jobId,
            assigneeId: task.assigneeId,
            startAt: task.startAt,
            dueAt: task.dueAt,
            priority: task.priority || 'normal',
            status: task.status || 'open',
            requiredProof: task.requiredProof || 'none',
            dependsOnIds: task.dependsOnIds || [],
            notes: task.notes || '',
            subtasks: task.subtasks || []
        }));
    }

    bulkMergeTasks(externalTasks, options = {}) {
        const { dryRun = true } = options;
        const data = this.getData();
        const currentTasks = new Map(data.tasks.map(t => [t.id, t]));
        
        const summary = {
            created: [],
            updated: [],
            unchanged: [],
            conflicts: []
        };

        for (const extTask of externalTasks) {
            if (!extTask.id) {
                summary.conflicts.push({
                    task: extTask,
                    reason: 'Missing task ID'
                });
                continue;
            }

            const currentTask = currentTasks.get(extTask.id);
            
            if (!currentTask) {
                // New task
                summary.created.push(extTask);
                if (!dryRun) {
                    const normalized = this.normalizeTask(extTask, data.tasks.length);
                    data.tasks.push(normalized);
                }
            } else {
                // Existing task - check for changes
                const hasChanges = this.hasTaskChanges(currentTask, extTask);
                
                if (!hasChanges) {
                    summary.unchanged.push(extTask.id);
                } else {
                    // Check for conflicts (DONE tasks with required_proof or dependencies)
                    if (this.isConflictingUpdate(currentTask, extTask)) {
                        summary.conflicts.push({
                            task: extTask,
                            reason: 'Cannot modify DONE task with required proof or open dependencies'
                        });
                    } else {
                        summary.updated.push({
                            id: extTask.id,
                            changes: this.getTaskDiff(currentTask, extTask)
                        });
                        if (!dryRun) {
                            const merged = { ...currentTask, ...extTask };
                            const taskIndex = data.tasks.findIndex(t => t.id === extTask.id);
                            if (taskIndex !== -1) {
                                data.tasks[taskIndex] = this.normalizeTask(merged, taskIndex);
                            }
                        }
                    }
                }
            }
        }

        if (!dryRun) {
            this.saveData(data);
        }

        // Generate sample for preview (first 10 changes)
        const sample = [];
        summary.created.slice(0, 5).forEach(task => {
            sample.push({ type: 'created', task });
        });
        summary.updated.slice(0, 5).forEach(update => {
            sample.push({ type: 'updated', ...update });
        });
        summary.conflicts.slice(0, 5).forEach(conflict => {
            sample.push({ type: 'conflict', ...conflict });
        });

        return {
            ...summary,
            sample,
            total: externalTasks.length
        };
    }

    hasTaskChanges(current, external) {
        const fields = ['title', 'jobId', 'assigneeId', 'startAt', 'dueAt', 
                       'priority', 'status', 'notes', 'requiredProof'];
        
        for (const field of fields) {
            const currentVal = current[field];
            const externalVal = external[field];
            if (currentVal !== externalVal) {
                return true;
            }
        }

        // Check depends_on_ids array
        const currentDeps = JSON.stringify((current.dependsOnIds || []).sort());
        const externalDeps = JSON.stringify((external.dependsOnIds || external.depends_on_ids || []).sort());
        if (currentDeps !== externalDeps) {
            return true;
        }

        return false;
    }

    getTaskDiff(current, external) {
        const changes = {};
        const fields = ['title', 'jobId', 'assigneeId', 'startAt', 'dueAt', 
                       'priority', 'status', 'notes', 'requiredProof'];
        
        for (const field of fields) {
            if (current[field] !== external[field]) {
                changes[field] = {
                    from: current[field],
                    to: external[field]
                };
            }
        }

        return changes;
    }

    isConflictingUpdate(current, external) {
        // Conflict if trying to change a DONE task that has required_proof or dependencies
        if (current.status === 'done' && external.status !== 'done') {
            if (current.requiredProof && current.requiredProof !== 'none') {
                return true;
            }
        }
        
        // Check if task has open dependencies
        if (current.dependsOnIds && current.dependsOnIds.length > 0) {
            const hasOpenDeps = current.dependsOnIds.some(depId => {
                const depTask = this.getTaskById(depId);
                return depTask && depTask.status !== 'done';
            });
            if (hasOpenDeps && external.status === 'done' && current.status !== 'done') {
                return true;
            }
        }

        return false;
    }
}

// Initialize global data manager
const dataManager = new DataManager();

