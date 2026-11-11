BEGIN;

-- ============================================================
-- 1. ADD USERS.ROLE_ID
-- ============================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role_id integer;


-- ============================================================
-- 2. BACKFILL USERS.ROLE_ID
--
-- Only populate users.role_id when it is currently NULL.
-- Existing Production values are preserved.
--
-- If a user has multiple roles, MIN(role_id) is used
-- deterministically. We validate the result below.
-- ============================================================

UPDATE public.users u
SET role_id = ur.role_id
FROM (
    SELECT
        user_id,
        MIN(role_id) AS role_id
    FROM public.user_roles
    GROUP BY user_id
) ur
WHERE u.id = ur.user_id
  AND u.role_id IS NULL;


-- ============================================================
-- 3. VALIDATE ROLE REFERENCES BEFORE CREATING FK
-- ============================================================

DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*)
    INTO orphan_count
    FROM public.users u
    LEFT JOIN public.roles r
        ON r.id = u.role_id
    WHERE u.role_id IS NOT NULL
      AND r.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
            'Migration stopped: % users have invalid role_id values.',
            orphan_count;
    END IF;
END $$;


-- ============================================================
-- 4. CREATE USERS.ROLE_ID INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_role_id
ON public.users (role_id);


-- ============================================================
-- 5. CREATE USERS -> ROLES FK
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_role'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES public.roles (id)
        ON DELETE RESTRICT;
    END IF;
END $$;


-- ============================================================
-- 6. CREATE USER_ROLES.USER_ID INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
ON public.user_roles (user_id);


-- ============================================================
-- 7. ADD MISSING SECURITY / ADVERTISEMENT PERMISSIONS
--
-- Match by CODE, never by Development numeric ID.
-- ============================================================

INSERT INTO public.permissions (
    code,
    display_name,
    description,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
)
SELECT
    'permissions.update',
    'Update Permissions',
    NULL,
    'SECURITY',
    'permissions',
    'update',
    0,
    FALSE,
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.permissions
    WHERE LOWER(code) = LOWER('permissions.update')
);


INSERT INTO public.permissions (
    code,
    display_name,
    description,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
)
SELECT
    'permissions.create',
    'Create Permissions',
    NULL,
    'SECURITY',
    'permissions',
    'create',
    20,
    TRUE,
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.permissions
    WHERE LOWER(code) = LOWER('permissions.create')
);


INSERT INTO public.permissions (
    code,
    display_name,
    description,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
)
SELECT
    'permissions.delete',
    'Delete Permissions',
    NULL,
    'SECURITY',
    'permissions',
    'delete',
    20,
    TRUE,
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.permissions
    WHERE LOWER(code) = LOWER('permissions.delete')
);


-- Advertisement permission already exists in Development
-- and is not a test permission.

INSERT INTO public.permissions (
    code,
    display_name,
    description,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
)
SELECT
    'advs.read',
    'View Advertisements',
    NULL,
    'advertisement',
    'advs',
    'read',
    0,
    FALSE,
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.permissions
    WHERE LOWER(code) = LOWER('advs.read')
);


-- ============================================================
-- 8. SUPER_ADMIN PERMISSIONS
--
-- Development SUPER_ADMIN has all core Security + News
-- permissions.
--
-- Match by role CODE and permission CODE.
-- Never use Development numeric IDs.
-- ============================================================

INSERT INTO public.role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN (
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'roles.read',
      'roles.create',
      'roles.update',
      'roles.delete',
      'roles.assign',
      'permissions.read',
      'permissions.create',
      'permissions.update',
      'permissions.delete',
      'news.read',
      'news.create',
      'news.update',
      'news.delete',
      'news.approve',
      'news.publish',
      'news.archive'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.role_permissions existing
      WHERE existing.role_id = r.id
        AND existing.permission_id = p.id
  );


-- ============================================================
-- 9. ADMIN PERMISSIONS
--
-- Development ADMIN has these additional permissions that
-- Production currently lacks.
-- ============================================================

INSERT INTO public.role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN (
      'permissions.update',
      'permissions.create',
      'permissions.delete'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.role_permissions existing
      WHERE existing.role_id = r.id
        AND existing.permission_id = p.id
  );


-- ============================================================
-- 10. UPDATE users.role_id FROM CURRENT USER ROLE ASSIGNMENT
--
-- Only NULL role_id values are updated.
-- ============================================================

UPDATE public.users u
SET role_id = ur.role_id
FROM (
    SELECT
        user_id,
        MIN(role_id) AS role_id
    FROM public.user_roles
    GROUP BY user_id
) ur
WHERE u.id = ur.user_id
  AND u.role_id IS NULL;


-- ============================================================
-- 11. FINAL VALIDATION
-- ============================================================

DO $$
DECLARE
    users_without_role integer;
BEGIN
    SELECT COUNT(*)
    INTO users_without_role
    FROM public.users
    WHERE role_id IS NULL;

    IF users_without_role > 0 THEN
        RAISE NOTICE
            'WARNING: % user(s) still have NULL role_id.',
            users_without_role;
    END IF;
END $$;


COMMIT;