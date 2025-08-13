# Supabase Setup Guide

## Why is the babies table empty?

The babies table in Supabase is empty because the app needs to be configured with your Supabase credentials to sync data. Here's how to fix it:

## Step 1: Get Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project or select an existing one
3. Go to Settings → API
4. Copy your **Project URL** and **anon/public key**

## Step 2: Set Environment Variables

Create a `.env` file in your project root with:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Restart Your App

After adding the environment variables:

1. Stop your Expo development server
2. Run `expo start` again
3. The app will now be able to sync with Supabase

## Step 4: Test Sync

1. Go to Settings → Sync
2. Tap "Sync Now" to manually sync your data
3. Check the console logs to see sync progress
4. Your babies should now appear in the Supabase table

## Troubleshooting

### "Supabase environment variables not configured"

-   Make sure your `.env` file is in the project root
-   Verify the variable names start with `EXPO_PUBLIC_`
-   Restart your development server

### "Sync failed" errors

-   Check that your Supabase project is running
-   Verify your API key has the correct permissions
-   Check the console logs for specific error messages

### "Could not find the 'babyld' column" error

This is a critical schema mismatch error. The database has a column named `babyld` instead of `babyId`.

**To fix this:**

1. Go to your Supabase dashboard → SQL Editor
2. Run the `supabase/check_schema.sql` file to check your table structure
3. If you see `babyld` instead of `babyId`, run:
    ```sql
    ALTER TABLE feed_entries RENAME COLUMN "babyld" TO "babyId";
    ```
4. If the table structure is completely wrong, drop and recreate:
    ```sql
    DROP TABLE IF EXISTS feed_entries CASCADE;
    ```
    Then run the complete `supabase/schema.sql` file

### Data still not syncing

-   Make sure you have a household ID set up
-   Try creating a new baby after setting up Supabase
-   Check that the database schema matches `supabase/schema.sql`
-   Run the database structure verification in the console logs

## Database Schema

The app expects these tables in Supabase:

-   `households` - for organizing family data
-   `babies` - for baby profiles
-   `feed_entries` - for feeding records
-   `stash_items` - for stored breastmilk

Run the SQL from `supabase/schema.sql` in your Supabase SQL editor to create these tables.

## Testing

To test the system:

1. Create a test user account
2. Create a household
3. Share the invite code
4. Verify data isolation works correctly
5. Test logout and session persistence
