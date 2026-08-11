-- ==========================================
-- FINLEV - SUPABASE DATABASE SCHEMA
-- ==========================================

-- Execute this SQL script in your Supabase SQL Editor
-- to set up tables, indexes, and Row Level Security (RLS) for Google OAuth users.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    category TEXT NOT NULL,
    account TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'CC_PAYMENT')),
    to_account TEXT,
    installments INTEGER,
    installment_number INTEGER,
    total_installments INTEGER,
    original_amount NUMERIC,
    statement_close_date TEXT,
    transfer_amount NUMERIC,
    transfer_currency TEXT,
    fx_rate NUMERIC,
    receive_amount NUMERIC,
    receive_currency TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist on existing transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_currency TEXT;

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b',
    type TEXT NOT NULL DEFAULT 'EXPENSE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'BANK',
    currency TEXT NOT NULL DEFAULT 'ARS',
    color TEXT NOT NULL DEFAULT '#3b82f6',
    initial_balance NUMERIC DEFAULT 0,
    closing_rule JSONB,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_members JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist on existing accounts table if created previously
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS closing_rule JSONB;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS shared_members JSONB DEFAULT '[]'::jsonb;

-- 5. BUDGETS TABLE
CREATE TABLE IF NOT EXISTS public.budgets (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    monthly_limit NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. USER SETTINGS TABLE (Stores preferences, credit card period statuses, closing rules map)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. INDEXES FOR HIGH-PERFORMANCE QUERIES
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- 8. SECURITY DEFINER FUNCTION FOR WORKSPACE SHARING
-- This function allows checking if a user has shared their workspace with the current user,
-- bypassing RLS on user_settings so that we can evaluate policies correctly.
CREATE OR REPLACE FUNCTION public.is_workspace_shared_with_me(owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_settings us
        WHERE us.user_id = owner_id
        AND (us.settings->'workspaceSharing'->>'isShared')::boolean = true
        AND jsonb_typeof(us.settings->'workspaceSharing'->'members') = 'array'
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(us.settings->'workspaceSharing'->'members') AS member
            WHERE LOWER(TRIM(member->>'email')) = LOWER(TRIM(auth.jwt()->>'email'))
        )
    );
$$;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Transactions Policies
DROP POLICY IF EXISTS "Users can select own or shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own or shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own or shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own or shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can select own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "Users can select own or shared transactions" ON public.transactions 
    FOR SELECT USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can insert own or shared transactions" ON public.transactions 
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can update own or shared transactions" ON public.transactions 
    FOR UPDATE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can delete own or shared transactions" ON public.transactions 
    FOR DELETE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));

-- Categories Policies
DROP POLICY IF EXISTS "Users can select own or shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own or shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own or shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own or shared categories" ON public.categories;
DROP POLICY IF EXISTS "Users can select own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can select own or shared categories" ON public.categories 
    FOR SELECT USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can insert own or shared categories" ON public.categories 
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can update own or shared categories" ON public.categories 
    FOR UPDATE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can delete own or shared categories" ON public.categories 
    FOR DELETE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));

-- Accounts Policies
DROP POLICY IF EXISTS "Users can select own or shared accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own or shared accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own or shared accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own or shared accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can select own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "Users can select own or shared accounts" ON public.accounts 
    FOR SELECT USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can insert own or shared accounts" ON public.accounts 
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can update own or shared accounts" ON public.accounts 
    FOR UPDATE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can delete own or shared accounts" ON public.accounts 
    FOR DELETE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));

-- Budgets Policies
DROP POLICY IF EXISTS "Users can select own or shared budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own or shared budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own or shared budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own or shared budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can select own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

CREATE POLICY "Users can select own or shared budgets" ON public.budgets 
    FOR SELECT USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can insert own or shared budgets" ON public.budgets 
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can update own or shared budgets" ON public.budgets 
    FOR UPDATE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can delete own or shared budgets" ON public.budgets 
    FOR DELETE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));

-- User Settings Policies
DROP POLICY IF EXISTS "Users can select own or shared settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own or shared settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own or shared settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own or shared settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

CREATE POLICY "Users can select own or shared settings" ON public.user_settings 
    FOR SELECT USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can insert own or shared settings" ON public.user_settings 
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can update own or shared settings" ON public.user_settings 
    FOR UPDATE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can delete own or shared settings" ON public.user_settings 
    FOR DELETE USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));

