-- ============================================================================
-- APPLIED 2026-11-01 19:29 BA to production (user replied yes to the explicit question at 19:22-19:23): server-side, atomic merge of user_settings.txLinks.
--
-- Why: saveAll replaces the whole settings document (read-merge-write, not
-- atomic). Two devices saving at once can drop each other's txLinks entries,
-- and a client running an OLDER app version (which does not know txLinks)
-- wipes them on every save. The client mitigation (fresh re-read + verify and
-- repair) narrows the window but cannot close it.
--
-- What: a BEFORE UPDATE trigger on user_settings that, per movement id, keeps
-- the entry with the latest "at" between the stored document and the incoming
-- one. Entries absent from the incoming document are KEPT (absence never
-- means "unlinked"; an unlink is an explicit {"g": null, "at": ...} entry).
-- Row-level locking serializes concurrent UPDATEs and Postgres re-runs the
-- BEFORE trigger against the newest committed row version, so no interleaving
-- loses an entry. This also protects links from old clients (rollback safe).
--
-- Limits: it only covers txLinks (other settings keys keep the existing
-- whole-document replace). Entries of deleted movements are not pruned by the
-- trigger (harmless; the client prunes tombstoned ids on its next save).
-- Idempotent. Verified: tests/links-merge-trigger-concurrency.test.ts.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.merge_tx_links_on_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_links JSONB := COALESCE(OLD.settings -> 'txLinks', '{}'::jsonb);
  new_links JSONB := COALESCE(NEW.settings -> 'txLinks', '{}'::jsonb);
  merged JSONB := old_links;
  k TEXT;
  v JSONB;
  new_at NUMERIC;
  old_at NUMERIC;
BEGIN
  IF jsonb_typeof(old_links) <> 'object' THEN old_links := '{}'::jsonb; merged := '{}'::jsonb; END IF;
  IF jsonb_typeof(new_links) <> 'object' THEN new_links := '{}'::jsonb; END IF;
  FOR k, v IN SELECT key, value FROM jsonb_each(new_links) LOOP
    new_at := CASE WHEN jsonb_typeof(v -> 'at') = 'number' THEN (v ->> 'at')::numeric ELSE 0 END;
    old_at := CASE WHEN jsonb_typeof(merged -> k -> 'at') = 'number' THEN (merged -> k ->> 'at')::numeric ELSE 0 END;
    IF NOT (merged ? k) OR new_at >= old_at THEN
      merged := jsonb_set(merged, ARRAY[k], v);
    END IF;
  END LOOP;
  IF jsonb_typeof(NEW.settings) = 'object' AND merged <> '{}'::jsonb THEN
    NEW.settings := jsonb_set(NEW.settings, '{txLinks}', merged);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merge_tx_links_on_settings ON public.user_settings;
CREATE TRIGGER trg_merge_tx_links_on_settings
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.merge_tx_links_on_settings();

-- ROLLBACK (removes only this trigger and function; txLinks data is untouched):
--   DROP TRIGGER IF EXISTS trg_merge_tx_links_on_settings ON public.user_settings;
--   DROP FUNCTION IF EXISTS public.merge_tx_links_on_settings();
