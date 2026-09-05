CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id" bigint PRIMARY KEY
        GENERATED ALWAYS AS IDENTITY,

    "user_id" bigint NOT NULL,

    "refresh_token_hash" text NOT NULL
        CONSTRAINT "uq_user_sessions_refresh_token_hash"
        UNIQUE,

    "expires_at" timestamp with time zone NOT NULL,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,

    "last_used_at" timestamp with time zone,

    "revoked_at" timestamp with time zone,

    "ip_address" inet,

    "user_agent" text,

    CONSTRAINT "fk_user_sessions_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users" ("id")
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_id"
    ON "user_sessions" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires_at"
    ON "user_sessions" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_active"
    ON "user_sessions" ("user_id", "revoked_at", "expires_at");