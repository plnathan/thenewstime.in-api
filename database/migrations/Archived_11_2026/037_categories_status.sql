-- Run against the intended Neon environment before deploying Category CRUD.
--ALTER TABLE categories ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='categories_status_valid') THEN
   ALTER TABLE categories ADD CONSTRAINT categories_status_valid CHECK (status IN ('ACTIVE','INACTIVE'));
 END IF;
END $$;
-- Grant NEWS/news.category/create and NEWS/news.category/update to the relevant roles in your existing RBAC configuration.
