--joiNUS Initial Database Schema
-- Supabase PostgreSQL
-- =====================================================

-- Optional but useful for UUID generation.
-- Supabase usually already has this available, but this is safe.
create extension if not exists "pgcrypto";


-- =====================================================
-- 1. PROFILES
-- One profile belongs to one Supabase Auth user.
-- Supabase Auth stores login info.
-- This table stores app-specific user info.
-- =====================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  username text unique not null,
  display_name text not null,

  major text,
  year_of_study int,
  bio text,
  avatar_url text,

  skills text[] not null default '{}',
  interests text[] not null default '{}',

  collaboration_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =====================================================
-- 2. POSTS
-- One post is created by one profile.
-- powers Home page / Create page.
-- =====================================================

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
-- generates random user id 
  creator_id uuid not null references profiles(id) on delete cascade,
-- if profile is deleted, delete everything 
  title text not null,
  description text not null,

  topic text,
  category text not null,
  meeting_mode text,

  max_members int,
  current_members int not null default 1,

  status text not null default 'open',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =====================================================
-- 3. SAVED POSTS
-- Many-to-many relationship:
-- One user can save many posts.
-- One post can be saved by many users.
-- =====================================================

create table if not exists saved_posts (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,

  created_at timestamptz not null default now(),

  primary key (user_id, post_id)
);


-- =====================================================
-- 4. JOIN REQUESTS
-- A user can request to join a post/collaboration.
-- =====================================================

create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null references posts(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,

  message text,
  status text not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (post_id, requester_id)
);


-- =====================================================
-- 5. CONSTRAINTS
-- preventing invalid data.
-- =====================================================

alter table profiles
drop constraint if exists profiles_year_of_study_check;

alter table profiles
add constraint profiles_year_of_study_check
check (year_of_study is null or year_of_study between 1 and 6);


alter table profiles
drop constraint if exists profiles_collaboration_count_check;

alter table profiles
add constraint profiles_collaboration_count_check
check (collaboration_count >= 0);


alter table posts
drop constraint if exists posts_max_members_check;

alter table posts
add constraint posts_max_members_check
check (max_members is null or max_members >= 1);


alter table posts
drop constraint if exists posts_current_members_check;

alter table posts
add constraint posts_current_members_check
check (current_members >= 1);


alter table posts
drop constraint if exists posts_member_count_check;

alter table posts
add constraint posts_member_count_check
check (max_members is null or current_members <= max_members);


alter table posts
drop constraint if exists posts_status_check;

alter table posts
add constraint posts_status_check
check (status in ('open', 'closed', 'completed'));


alter table posts
drop constraint if exists posts_category_check;

alter table posts
add constraint posts_category_check
check (
  category in (
    'Study',
    'Project',
    'Hackathon',
    'CCA',
    'Music',
    'Sports',
    'Research',
    'Startup',
    'Other'
  )
);


alter table posts
drop constraint if exists posts_meeting_mode_check;

alter table posts
add constraint posts_meeting_mode_check
check (
  meeting_mode is null or meeting_mode in (
    'Online',
    'In-person',
    'Hybrid'
  )
);


alter table join_requests
drop constraint if exists join_requests_status_check;

alter table join_requests
add constraint join_requests_status_check
check (
  status in (
    'pending',
    'accepted',
    'rejected',
    'cancelled'
  )
);


-- =====================================================
-- 6. UPDATED_AT TRIGGER
-- Automatically updates updated_at when rows are edited.
-- =====================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


drop trigger if exists set_profiles_updated_at on profiles;

create trigger set_profiles_updated_at
before update on profiles
for each row
execute function set_updated_at();


drop trigger if exists set_posts_updated_at on posts;

create trigger set_posts_updated_at
before update on posts
for each row
execute function set_updated_at();


drop trigger if exists set_join_requests_updated_at on join_requests;

create trigger set_join_requests_updated_at
before update on join_requests
for each row
execute function set_updated_at();


-- =====================================================
-- 7. INDEXES
-- These make common queries faster.
-- =====================================================

create index if not exists profiles_username_idx
on profiles (username); -- finding profiles by username 


create index if not exists posts_creator_id_idx
on posts (creator_id); -- all posts by a user


create index if not exists posts_category_idx
on posts (category); -- filter by category


create index if not exists posts_topic_idx
on posts (topic); -- filter by topic/module 


create index if not exists posts_status_idx
on posts (status); -- filter open/closed/completed posts 


create index if not exists posts_created_at_idx
on posts (created_at desc); -- newest posts on homepage 


create index if not exists join_requests_post_id_idx
on join_requests (post_id); --find join requests for a post 


create index if not exists join_requests_requester_id_idx
on join_requests (requester_id); -- Find join requests made by a user 