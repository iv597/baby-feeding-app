-- Check and fix Supabase database schema
-- Run this in your Supabase SQL editor to verify the table structure

-- Check if feed_entries table exists and show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'feed_entries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if babies table exists and show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'babies' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If you see a column named 'babyld' instead of 'babyId', run this to fix it:
-- ALTER TABLE feed_entries RENAME COLUMN "babyld" TO "babyId";

-- Check if the correct schema exists, if not run the main schema.sql file
-- The feed_entries table should have these columns:
-- id, householdId, babyId, type, createdAt, quantityMl, durationMin, side, foodName, foodAmountGrams, notes, updatedAt, deleted

-- If the table structure is completely wrong, you can drop and recreate:
-- DROP TABLE IF EXISTS feed_entries CASCADE;
-- Then run the complete schema.sql file
