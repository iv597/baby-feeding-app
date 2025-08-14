-- Migration to add gender column to babies table
-- Run this on your Supabase database if you already have the babies table

ALTER TABLE public.babies ADD COLUMN IF NOT EXISTS gender text;
