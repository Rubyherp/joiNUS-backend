-- joiNUS Schema (reconciled with backend code)

-- ============================================================================
-- TABLE: profiles
-- Note: id comes from auth.users (req.user.id in backend)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar TEXT DEFAULT '',
  major TEXT DEFAULT '',
  year SMALLINT,
  contact TEXT DEFAULT '',
  about TEXT DEFAULT '',
  skills TEXT DEFAULT '',
  experiences TEXT DEFAULT '',
  modules TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE: communities
-- ============================================================================
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE: posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  more_details TEXT,
  requirements TEXT,
  member_limit INT,
  deadline TIMESTAMPTZ,
  community_id UUID,
  member_count INT DEFAULT 0 NOT NULL,
  is_anonymous BOOLEAN DEFAULT false NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL
);

-- Safe to run against an existing database created before location sharing.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS location_name TEXT;

-- ============================================================================
-- TABLE: community_follows
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_follows (
  user_id UUID NOT NULL,
  community_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, community_id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: post_saves
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_saves (
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: join_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: push_tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: direct_messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  sender_id UUID,
  content TEXT NOT NULL,
  has_attachments BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE: message_attachments
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (message_id) REFERENCES direct_messages(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: community_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- VIEW: dm_conversations
-- ============================================================================
CREATE OR REPLACE VIEW dm_conversations AS
SELECT DISTINCT ON (room_id)
  room_id,
  content AS last_message,
  created_at AS last_message_at,
  sender_id,
  CASE 
    WHEN sender_id::text = split_part(room_id, '_', 1) THEN split_part(room_id, '_', 2)::uuid
    ELSE split_part(room_id, '_', 1)::uuid
  END AS other_user_id
FROM direct_messages
ORDER BY room_id, created_at DESC;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_post_id ON join_requests(post_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_requester_id ON join_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_room_id ON direct_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_community_requests_requester_id ON community_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON communities(created_by);
