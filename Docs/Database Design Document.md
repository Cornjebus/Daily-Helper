# Database Design Document

## 1. Introduction

This document details the database design for the **AI for Daily Life — Unified Focus Assistant**. It includes the database schema, an Entity-Relationship Diagram (ERD), indexing strategies, and Row-Level Security (RLS) policies.

## 2. Database Schema (DDL)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connections table
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'gmail', 'slack', 'google_calendar', 'calendly', 'notion', 'linear', 'trello'
    tokens JSONB NOT NULL,
    settings JSONB, -- provider-specific settings (database_id for Notion, team_id for Linear, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL, -- 'gmail', 'slack', 'google_calendar', 'calendly'
    payload_json JSONB NOT NULL,
    priority INT,
    status VARCHAR(50) DEFAULT 'new',
    ai_cost DECIMAL(10,6), -- cost in USD for AI processing this item
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actions table
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'snooze', 'delegate', 'schedule', 'create_task', 'create_notion_page', 'create_linear_issue', 'create_trello_card'
    metadata JSONB,
    external_id VARCHAR(255), -- ID from external system (Notion page ID, Linear issue ID, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage Tracking table
CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    operation VARCHAR(50) NOT NULL, -- 'scoring', 'summarization', 'bundling'
    tokens_used INT NOT NULL,
    cost DECIMAL(10,6) NOT NULL,
    model VARCHAR(100) NOT NULL,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Management Integration table
CREATE TABLE task_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'notion', 'linear', 'trello'
    external_id VARCHAR(255) NOT NULL,
    external_url TEXT,
    status VARCHAR(50) DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Digests table
CREATE TABLE digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    html TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. Entity-Relationship Diagram (ERD)

_(Placeholder for the ERD. This will be a visual representation of the database schema.)_

## 4. Indexes

- **users**: `email`
- **connections**: `user_id`, `provider`
- **items**: `user_id`, `source`, `status`, `ai_cost`
- **actions**: `item_id`, `type`, `external_id`
- **digests**: `user_id`
- **ai_usage**: `user_id`, `operation`, `created_at`
- **task_integrations**: `user_id`, `item_id`, `platform`, `external_id`

## 5. Row-Level Security (RLS) Examples

```sql
-- Enable RLS on the items table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own items
CREATE POLICY "user_items_policy" ON items
FOR SELECT USING (auth.uid() = user_id);
```

## 6. pgvector Usage

For semantic search capabilities, `pgvector` can be enabled in Supabase. This would involve adding a `vector` column to the `items` table to store embeddings of the item content.

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add a vector column to the items table
ALTER TABLE items ADD COLUMN embedding vector(1536);

-- Create an index for the vector column
CREATE INDEX ON items USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Example query for similarity search
SELECT * FROM items ORDER BY embedding <-> (SELECT embedding FROM items WHERE id = 'some-item-id') LIMIT 10;
```

