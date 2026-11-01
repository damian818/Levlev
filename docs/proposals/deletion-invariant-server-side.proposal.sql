-- ============================================================================
-- PROPOSED — NOT APPLIED. Deletion invariant enforced server-side.
-- ============================================================================
-- Why: the client-side fix (union of cloud tombstones before every save) is a
-- read-merge-write and is NOT atomic: two sessions can interleave and still
-- lose a tombstone / resurrect a row (documented in
-- tests/resurrection-scenarios.test.ts, "known limitation"). Closing that gap
-- requires the database to enforce the invariant.
--
-- Status: proposal for review. Requires:
--   1. Manual run in the Supabase SQL editor (no client applies it).
--   2. Verification on a real instance: PostgREST upsert issues
--      INSERT ... ON CONFLICT DO UPDATE, which fires UPDATE triggers — the
--      trigger below must cover both, and its behavior under the app's real
--      RLS policies must be tested before rollout.
--   3. Client follow-up: route deletes through delete_transactions() and keep
--      deletedTxIds reads for backward compatibility during migration.
-- ============================================================================

-- 1) Tombstones as their own insert-only table (no shared document to clobber).
CREATE TABLE IF NOT EXISTS public.deleted_transactions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.deleted_transactions ENABLE ROW LEVEL SECURITY;

-- TODO: adjust policy names/expressions to match the project's existing RLS style.
CREATE POLICY IF NOT EXISTS deleted_transactions_owner_select
    ON public.deleted_transactions FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS deleted_transactions_owner_insert
    ON public.deleted_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
-- Intentionally no UPDATE/DELETE policies: tombstones are append-only.

-- 2) Reject resurrection: no insert/update of a transaction whose id (in any
--    variant) is tombstoned. Covers PostgREST upsert (fires INSERT on new
--    rows, UPDATE on conflict).
CREATE OR REPLACE FUNCTION public.reject_tombstoned_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    clean_id TEXT;
BEGIN
    clean_id := substring(NEW.id from position('_' in NEW.id) + 1);
    IF EXISTS (
        SELECT 1 FROM public.deleted_transactions d
        WHERE d.id = NEW.id OR d.id = clean_id
    ) THEN
        RAISE EXCEPTION 'transaction % is tombstoned (deleted); resurrection rejected', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_reject_tombstoned ON public.transactions;
CREATE TRIGGER transactions_reject_tombstoned
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.reject_tombstoned_transaction();

-- 3) Atomic delete: row removal and tombstone insert in one transaction.
CREATE OR REPLACE FUNCTION public.delete_transactions(p_ids TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pid TEXT;
    clean_id TEXT;
BEGIN
    FOREACH pid IN ARRAY p_ids LOOP
        clean_id := substring(pid from position('_' in pid) + 1);
        DELETE FROM public.transactions WHERE id = pid OR id = clean_id;
        INSERT INTO public.deleted_transactions (id, user_id)
        VALUES (pid, auth.uid())
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.deleted_transactions (id, user_id)
        VALUES (clean_id, auth.uid())
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END;
$$;

-- Migration path for existing tombstones stored in user_settings.settings->'deletedTxIds':
-- INSERT INTO public.deleted_transactions (id, user_id)
-- SELECT jsonb_array_elements_text(settings->'deletedTxIds'), user_id
-- FROM public.user_settings
-- WHERE settings ? 'deletedTxIds'
-- ON CONFLICT (id) DO NOTHING;
