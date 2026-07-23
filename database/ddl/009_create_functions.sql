/****************************************************************************************
 Project     : thenewstime.in
 File        : 009_create_functions.sql
 Description : Common Database Functions
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- FUNCTION : fn_set_updated_at()
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE FUNCTION fn_set_updated_at
    ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
    BEGIN
    NEW.updated_at := NOW
    ();
RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_set_updated_at
()
IS 'Automatically updates updated_at timestamp.';

-----------------------------------------------------------------------------------------
-- FUNCTION : fn_validate_news_location()
-----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_news_location
()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
BEGIN

    ---------------------------------------------------------------------
    -- STATE NEWS
    ---------------------------------------------------------------------

    IF NEW.news_scope = 'STATE' THEN

    IF NEW.state_id IS NULL THEN
            RAISE EXCEPTION
            'State news requires state_id.';
END
IF;

    END
IF;

    ---------------------------------------------------------------------
    -- INDIA NEWS
    ---------------------------------------------------------------------

    IF NEW.news_scope = 'INDIA' THEN

IF NEW.country_id IS NULL THEN
            RAISE EXCEPTION
            'India news requires country_id.';
END
IF;

    END
IF;

    ---------------------------------------------------------------------
    -- WORLD NEWS
    ---------------------------------------------------------------------

    IF NEW.news_scope = 'WORLD' THEN

IF NEW.country_id IS NULL THEN
            RAISE EXCEPTION
            'World news requires country_id.';
END
IF;

    END
IF;

    RETURN NEW;

END;
$$;

COMMENT ON FUNCTION fn_validate_news_location
()
IS 'Validates geographical hierarchy before saving news.';

-----------------------------------------------------------------------------------------
-- FUNCTION : fn_validate_related_news()
-----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_related_news
()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
BEGIN

    IF NEW.news_id = NEW.related_news_id THEN

        RAISE EXCEPTION
        'A news article cannot reference itself as related news.';

END
IF;

    RETURN NEW;

END;
$$;

COMMENT ON FUNCTION fn_validate_related_news
()
IS 'Prevents self-reference in related_news table.';

-----------------------------------------------------------------------------------------
-- FUNCTION : fn_generate_slug()
--
-- Reserved for Version 2.
-- Current implementation uses admin-entered slug.
-----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_generate_slug
(
    p_title TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS
$$
BEGIN

    RETURN LOWER(TRIM(p_title));

END;
$$;

COMMENT ON FUNCTION fn_generate_slug
(TEXT)
IS 'Reserved for future automatic slug generation.';

COMMIT;