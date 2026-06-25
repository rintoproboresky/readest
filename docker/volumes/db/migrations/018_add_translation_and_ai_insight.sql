-- Add translation and ai_insight columns to book_notes table for cloud synchronization
ALTER TABLE public.book_notes ADD COLUMN IF NOT EXISTS translation text;
ALTER TABLE public.book_notes ADD COLUMN IF NOT EXISTS ai_insight jsonb;
