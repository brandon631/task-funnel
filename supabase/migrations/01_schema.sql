-- Task Funnel Schema
-- Sticky-note task board with admin/lead/crew roles

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('admin', 'lead', 'crew')),
  created_at timestamptz default now()
);

-- Projects table
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null check (status in ('active', 'archived')) default 'active',
  created_at timestamptz default now(),
  created_by uuid not null references profiles(id)
);

-- Project members (drives access control)
create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'lead', 'crew')),
  primary key (project_id, profile_id)
);

-- Boards (each project has one or more boards)
create table boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null default 'Main',
  created_at timestamptz default now()
);

-- Lanes (columns on the board)
create table lanes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('backlog', 'this_week', 'today', 'in_progress', 'done')),
  position int not null,
  created_at timestamptz default now(),
  unique (board_id, position)
);

-- Tasks (sticky notes)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  lane_id uuid references lanes(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete set null,
  title text not null,
  notes text,
  priority text not null check (priority in ('low', 'med', 'high')) default 'med',
  status text not null check (status in ('new', 'assigned', 'in_progress', 'blocked', 'done')) default 'new',
  assignee_id uuid references profiles(id),
  due_date date,
  order_index numeric not null default 0,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Task dependencies
create table task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id != depends_on_task_id)
);

-- Task events log
create table task_events (
  id bigserial primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated', 'moved', 'status_changed', 'assigned', 'comment', 'dependency_added', 'dependency_removed')),
  payload jsonb,
  actor_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- Attachments
create table attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  type text not null check (type in ('photo', 'file')),
  url text not null,
  meta jsonb,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_project_members_profile on project_members(profile_id);
create index idx_project_members_project on project_members(project_id);
create index idx_boards_project on boards(project_id);
create index idx_lanes_board on lanes(board_id);
create index idx_lanes_position on lanes(board_id, position);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_lane on tasks(lane_id);
create index idx_tasks_assignee on tasks(assignee_id);
create index idx_tasks_parent on tasks(parent_task_id);
create index idx_tasks_lane_order on tasks(lane_id, order_index);
create index idx_task_dependencies_task on task_dependencies(task_id);
create index idx_task_dependencies_depends on task_dependencies(depends_on_task_id);
create index idx_task_events_task on task_events(task_id);
create index idx_task_events_created on task_events(created_at desc);
create index idx_attachments_task on attachments(task_id);

-- Trigger: auto-update tasks.updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row
  execute function update_updated_at_column();

-- Trigger: log task lane moves
create or replace function log_task_move()
returns trigger as $$
begin
  if old.lane_id is distinct from new.lane_id then
    insert into task_events (task_id, event_type, payload, actor_id)
    values (
      new.id,
      'moved',
      jsonb_build_object(
        'from_lane_id', old.lane_id,
        'to_lane_id', new.lane_id,
        'title', new.title
      ),
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tasks_log_move
  after update on tasks
  for each row
  execute function log_task_move();

-- Trigger: log status changes
create or replace function log_task_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into task_events (task_id, event_type, payload, actor_id)
    values (
      new.id,
      'status_changed',
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'title', new.title
      ),
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tasks_log_status
  after update on tasks
  for each row
  execute function log_task_status_change();

-- Trigger: log assignments
create or replace function log_task_assignment()
returns trigger as $$
begin
  if old.assignee_id is distinct from new.assignee_id then
    insert into task_events (task_id, event_type, payload, actor_id)
    values (
      new.id,
      'assigned',
      jsonb_build_object(
        'from_assignee_id', old.assignee_id,
        'to_assignee_id', new.assignee_id,
        'title', new.title
      ),
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tasks_log_assignment
  after update on tasks
  for each row
  execute function log_task_assignment();
