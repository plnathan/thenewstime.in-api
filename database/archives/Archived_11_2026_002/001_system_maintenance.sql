-- Run once on Neon before deploying Phase 3.
CREATE TABLE IF NOT EXISTS public.system_maintenance (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  message_ta text NOT NULL DEFAULT 'எங்கள் இணையதளத்தில் பராமரிப்புப் பணிகள் நடைபெற்று வருகின்றன. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
  expected_restoration_at timestamptz,
  updated_by bigint REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.system_maintenance(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
-- Access control reuses existing SECURITY permissions.read / permissions.update.
-- Grant those permissions only to administrators authorized to manage maintenance.
