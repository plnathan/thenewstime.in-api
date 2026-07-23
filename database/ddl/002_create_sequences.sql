/****************************************************************************************
 Project     : thenewstime.in
 File        : 002_create_sequences.sql
 Description : Database sequences.

 Execution   : 002
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- Remove Existing Sequence (Development Only)
    -----------------------------------------------------------------------------------------

    DROP SEQUENCE IF EXISTS news_number_seq;

    -----------------------------------------------------------------------------------------
    -- News Number
    -----------------------------------------------------------------------------------------

    CREATE SEQUENCE news_number_seq
START WITH 4264000
INCREMENT BY 1
MINVALUE 1000
NO MAXVALUE
CACHE 10;

    COMMENT ON SEQUENCE news_number_seq IS
'Public News Number used in URLs.';

    COMMIT;