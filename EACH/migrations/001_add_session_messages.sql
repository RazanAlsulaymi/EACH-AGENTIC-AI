-- Add messages column to sessions for chat history persistence
-- Run in Supabase SQL Editor: migrations/001_add_session_messages.sql
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS messages jsonb DEFAULT '[]';
