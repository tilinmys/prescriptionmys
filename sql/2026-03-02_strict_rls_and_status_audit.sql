-- Ensure workflow enum values exist.
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'doctor_approved';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'admin_verified';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'dispensed';

BEGIN;

-- Helper functions for identity and roles.
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.doctors d
  WHERE lower(d.email) = public.current_user_email()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE lower(u.email) = public.current_user_email()
      AND coalesce(u.is_admin, false) = true
  );
$$;

REVOKE ALL ON FUNCTION public.current_doctor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_doctor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Auto-maintain status approval timestamps and edit metadata.
CREATE OR REPLACE FUNCTION public.prescriptions_status_meta_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.last_edited_at := now();
  NEW.last_edited_by := auth.uid();

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'doctor_approved' AND NEW.approved_by_doctor_at IS NULL THEN
      NEW.approved_by_doctor_at := now();
    END IF;

    IF NEW.status = 'admin_verified' AND NEW.approved_by_admin_at IS NULL THEN
      NEW.approved_by_admin_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_status_meta ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_status_meta
BEFORE INSERT OR UPDATE ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.prescriptions_status_meta_trigger();

-- Insert activity logs automatically on create and status transitions.
CREATE OR REPLACE FUNCTION public.prescriptions_activity_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role text;
BEGIN
  IF public.is_admin() THEN
    resolved_role := 'admin';
  ELSIF public.current_doctor_id() IS NOT NULL THEN
    resolved_role := 'doctor';
  ELSE
    resolved_role := 'authenticated';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.prescription_activity_logs (
      prescription_id,
      actor_id,
      actor_role,
      old_status,
      new_status,
      action_type,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      resolved_role,
      NULL,
      NEW.status,
      'created',
      jsonb_build_object('source', 'trigger'),
      now()
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.prescription_activity_logs (
      prescription_id,
      actor_id,
      actor_role,
      old_status,
      new_status,
      action_type,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      resolved_role,
      OLD.status,
      NEW.status,
      'status_changed',
      jsonb_build_object('source', 'trigger'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_activity_log ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_activity_log
AFTER INSERT OR UPDATE ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.prescriptions_activity_log_trigger();

-- RLS strict mode.
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_attachments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.prescriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_attachments FORCE ROW LEVEL SECURITY;

-- Drop existing policies on prescription domain tables.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('prescriptions','prescription_items','prescription_activity_logs','prescription_attachments')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- prescriptions: read own (doctor) or all (admin)
CREATE POLICY prescriptions_select_strict
ON public.prescriptions
FOR SELECT
TO authenticated
USING (
  public.is_admin() OR doctor_id = public.current_doctor_id()
);

-- prescriptions: insert own (doctor) or any (admin)
CREATE POLICY prescriptions_insert_strict
ON public.prescriptions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin() OR doctor_id = public.current_doctor_id()
);

-- prescriptions: admin full update
CREATE POLICY prescriptions_update_admin
ON public.prescriptions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- prescriptions: doctor update only own and only doctor-side statuses
CREATE POLICY prescriptions_update_doctor
ON public.prescriptions
FOR UPDATE
TO authenticated
USING (
  doctor_id = public.current_doctor_id()
)
WITH CHECK (
  doctor_id = public.current_doctor_id()
  AND status IN ('draft','doctor_approved','cancelled')
);

-- prescriptions: delete admin or doctor own drafts/cancelled only
CREATE POLICY prescriptions_delete_strict
ON public.prescriptions
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR (doctor_id = public.current_doctor_id() AND status IN ('draft','cancelled'))
);

-- items: read based on parent prescription ownership/admin.
CREATE POLICY prescription_items_select_strict
ON public.prescription_items
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
  )
);

-- items: insert/update/delete only for editable parent prescriptions by owner doctor/admin.
CREATE POLICY prescription_items_insert_strict
ON public.prescription_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
      AND p.status IN ('draft','doctor_approved','cancelled')
  )
);

CREATE POLICY prescription_items_update_strict
ON public.prescription_items
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
      AND p.status IN ('draft','doctor_approved','cancelled')
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
      AND p.status IN ('draft','doctor_approved','cancelled')
  )
);

CREATE POLICY prescription_items_delete_strict
ON public.prescription_items
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
      AND p.status IN ('draft','doctor_approved','cancelled')
  )
);

-- logs + attachments: read/write based on parent ownership/admin.
CREATE POLICY prescription_logs_select_strict
ON public.prescription_activity_logs
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
  )
);

CREATE POLICY prescription_logs_insert_strict
ON public.prescription_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
  )
);

CREATE POLICY prescription_attachments_select_strict
ON public.prescription_attachments
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
  )
);

CREATE POLICY prescription_attachments_insert_strict
ON public.prescription_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
  )
);

CREATE POLICY prescription_attachments_delete_strict
ON public.prescription_attachments
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND p.doctor_id = public.current_doctor_id()
  )
);

COMMIT;

-- Post-run verification:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname='public'
--   AND tablename IN ('prescriptions','prescription_items','prescription_activity_logs','prescription_attachments')
-- ORDER BY tablename, policyname;
