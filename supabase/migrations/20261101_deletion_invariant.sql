-- ============================================================================
-- Deletion invariant enforced server-side (finalized from
-- docs/proposals/deletion-invariant-server-side.proposal.sql).
--
-- Why: the client-side fix (union of cloud tombstones before every save) is a
-- read-merge-write and is NOT atomic: two sessions can interleave and still
-- lose a tombstone / resurrect a row (tests/resurrection-scenarios.test.ts,
-- "known limitation"). This migration moves the invariant into the database:
--
--   1. deleted_transactions: tombstones as their own append-only table
--      (no shared JSON document to clobber).
--   2. reject_tombstoned_transaction(): BEFORE INSERT/UPDATE trigger on
--      transactions that refuses to write a tombstoned id. Covers PostgREST
--      upsert (INSERT on new rows, UPDATE on conflict), which is what the
--      app's saveAll uses.
--   3. sync_tombstones_from_settings(): AFTER trigger on user_settings that
--      copies settings->deletedTxIds into deleted_transactions. This keeps
--      OLD clients (which only write tombstones into the settings document)
--      fully enforced server-side during the rollout.
--   4. delete_transactions(TEXT[]): SECURITY DEFINER RPC that tombstones and
--      deletes atomically, with the same own-or-shared permission rules as
--      the table RLS policies.
--
-- Apply manually in the Supabase SQL editor. Verified against real Postgres
-- (PGlite) including RLS emulation: tests/deletion-invariant-db.test.ts.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- 1) Tombstones as their own insert-only table -------------------------------
CREATE TABLE IF NOT EXISTS public.deleted_transactions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_transactions_user_id ON public.deleted_transactions(user_id);

ALTER TABLE public.deleted_transactions ENABLE ROW LEVEL SECURITY;

-- Same own-or-shared style as the rest of the schema (supabase-schema.sql).
DROP POLICY IF EXISTS "Users can select own or shared tombstones" ON public.deleted_transactions;
DROP POLICY IF EXISTS "Users can insert own or shared tombstones" ON public.deleted_transactions;
CREATE POLICY "Users can select own or shared tombstones" ON public.deleted_transactions
    FOR SELECT USING (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
CREATE POLICY "Users can insert own or shared tombstones" ON public.deleted_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_workspace_shared_with_me(user_id));
-- Intentionally no UPDATE/DELETE policies: tombstones are append-only.

-- 2) Reject resurrection ----------------------------------------------------
-- Fires on INSERT and UPDATE so PostgREST upsert is covered on both paths.
-- SECURITY DEFINER so the check can never be silently empty because of RLS
-- on deleted_transactions; the function only reads ids, never user content.
--
-- Isolation: a tombstone only constrains its OWN user's rows
-- (d.user_id = NEW.user_id). Nobody can block another user's current or
-- future ids. Legitimate cross-user deletes (shared household) are attributed
-- to the row owner by delete_transactions(), so they still enforce.
--
-- Serialization: the SHARE lock on deleted_transactions conflicts with the
-- ROW EXCLUSIVE lock held by an uncommitted delete_transactions() call, so a
-- write whose statement started before a concurrent delete COMMITs waits for
-- that delete, then re-checks with a fresh snapshot and rejects. Without it,
-- an INSERT already in flight when the delete commits could land afterwards
-- and resurrect the row. Corner case, self-resolving: an UPDATE of exactly
-- the row being deleted at the same instant can deadlock-abort one side
-- (Postgres deadlock detector, ~1s); the client's retry then converges to the
-- correct outcome.
CREATE OR REPLACE FUNCTION public.reject_tombstoned_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_id TEXT;
    owner_prefixed TEXT;
BEGIN
    -- Same id-variant expansion as the client (src/services/tombstones.ts):
    -- raw, un-prefixed and owner-prefixed forms.
    clean_id := NEW.id;
    IF position('_' in NEW.id) > 0 THEN
        clean_id := substring(NEW.id from position('_' in NEW.id) + 1);
    END IF;
    owner_prefixed := NEW.user_id::text || '_' || clean_id;

    -- Serialize against in-flight deletes; see the header comment.
    LOCK TABLE public.deleted_transactions IN SHARE MODE;

    IF EXISTS (
        SELECT 1 FROM public.deleted_transactions d
        WHERE d.id IN (NEW.id, clean_id, owner_prefixed)
          AND d.user_id = NEW.user_id
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

-- 3) Keep settings-document tombstones flowing into the table ---------------
-- Old clients (and the current saveAll) record tombstones in
-- user_settings.settings->deletedTxIds. Copying them here means the reject
-- trigger enforces those deletions server-side even before every device
-- runs a client that calls delete_transactions().
CREATE OR REPLACE FUNCTION public.sync_tombstones_from_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF jsonb_typeof(NEW.settings->'deletedTxIds') = 'array' THEN
        INSERT INTO public.deleted_transactions (id, user_id)
        SELECT DISTINCT elem, NEW.user_id
        FROM jsonb_array_elements_text(NEW.settings->'deletedTxIds') AS elem
        WHERE elem <> ''
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_sync_tombstones ON public.user_settings;
CREATE TRIGGER user_settings_sync_tombstones
    AFTER INSERT OR UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.sync_tombstones_from_settings();

-- 4) Atomic delete RPC -------------------------------------------------------
-- Tombstones + deletes in one transaction. Rows are only touched when the
-- caller owns them or the workspace is shared with them (same rule as the
-- RLS policies). Ids with no matching row anywhere are still tombstoned (a
-- row created offline and deleted before its first upload must stay dead);
-- ids whose row exists are only ever tombstoned through the permission-
-- checked delete, so nobody can poison another user's live transactions.
CREATE OR REPLACE FUNCTION public.delete_transactions(ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target RECORD;
    affected INTEGER := 0;
    expanded TEXT[];
    req_id TEXT;
BEGIN
    IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    -- Conflicts with the SHARE lock taken by the reject trigger: a concurrent
    -- transaction write blocks until this delete commits, then re-checks and
    -- rejects. (Inserts below would take this lock implicitly; taking it up
    -- front makes the serialization point explicit and covers the whole call.)
    LOCK TABLE public.deleted_transactions IN ROW EXCLUSIVE MODE;

    -- Expand variants (raw, clean, own-prefixed) like the client does.
    expanded := ARRAY[]::TEXT[];
    FOREACH req_id IN ARRAY ids LOOP
        IF req_id IS NULL OR req_id = '' THEN CONTINUE; END IF;
        expanded := expanded || req_id;
        IF position('_' in req_id) > 0 THEN
            expanded := expanded || substring(req_id from position('_' in req_id) + 1);
        ELSE
            expanded := expanded || (auth.uid()::text || '_' || req_id);
        END IF;
    END LOOP;
    expanded := ARRAY(SELECT DISTINCT unnest(expanded));

    -- Delete only rows the caller may touch, tombstoning each deleted row in
    -- both stored and clean id forms.
    FOR target IN
        DELETE FROM public.transactions t
        WHERE t.id = ANY (expanded)
          AND (t.user_id = auth.uid() OR public.is_workspace_shared_with_me(t.user_id))
        RETURNING t.id, t.user_id
    LOOP
        INSERT INTO public.deleted_transactions (id, user_id)
        VALUES
            (target.id, target.user_id),
            (substring(target.id from position('_' in target.id) + 1), target.user_id)
        ON CONFLICT (id) DO NOTHING;
        affected := affected + 1;
    END LOOP;

    -- Tombstone ids that exist NOWHERE in the table (a row created offline and
    -- deleted before its first upload must stay dead). Ids with an existing
    -- row are handled exclusively by the permission-checked loop above, so a
    -- caller can never tombstone somebody else's live row.
    INSERT INTO public.deleted_transactions (id, user_id)
    SELECT e, auth.uid()
    FROM unnest(expanded) AS e
    WHERE NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.id = e
           OR substring(t.id from position('_' in t.id) + 1) = e
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_transactions(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_transactions(TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_transactions(TEXT[]) TO authenticated;

-- 5) Backfill existing tombstones from the settings documents ---------------
INSERT INTO public.deleted_transactions (id, user_id)
SELECT DISTINCT elem, us.user_id
FROM public.user_settings us,
     LATERAL jsonb_array_elements_text(us.settings->'deletedTxIds') AS elem
WHERE jsonb_typeof(us.settings->'deletedTxIds') = 'array'
  AND elem <> ''
ON CONFLICT (id) DO NOTHING;
