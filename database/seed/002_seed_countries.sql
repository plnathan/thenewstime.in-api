/****************************************************************************************
 Project     : thenewstime.in
 File        : 002_seed_countries.sql
 Description : Seed Countries
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- COUNTRIES
    -----------------------------------------------------------------------------------------

    INSERT INTO countries
        (
        code,
        display_name,
        url_name,
        iso_code,
        display_order,
        status
        )
    VALUES

        ('IND', 'India', 'india', 'IN', 1, 'ACTIVE'),
        ('USA', 'United States', 'usa', 'US', 2, 'ACTIVE'),
        ('GBR', 'United Kingdom', 'united-kingdom', 'GB', 3, 'ACTIVE'),
        ('CAN', 'Canada', 'canada', 'CA', 4, 'ACTIVE'),
        ('AUS', 'Australia', 'australia', 'AU', 5, 'ACTIVE'),
        ('CHN', 'China', 'china', 'CN', 6, 'ACTIVE'),
        ('JPN', 'Japan', 'japan', 'JP', 7, 'ACTIVE'),
        ('RUS', 'Russia', 'russia', 'RU', 8, 'ACTIVE'),
        ('DEU', 'Germany', 'germany', 'DE', 9, 'ACTIVE'),
        ('FRA', 'France', 'france', 'FR', 10, 'ACTIVE'),
        ('ITA', 'Italy', 'italy', 'IT', 11, 'ACTIVE'),
        ('SGP', 'Singapore', 'singapore', 'SG', 12, 'ACTIVE'),
        ('MYS', 'Malaysia', 'malaysia', 'MY', 13, 'ACTIVE'),
        ('LKA', 'Sri Lanka', 'sri-lanka', 'LK', 14, 'ACTIVE'),
        ('ARE', 'United Arab Emirates', 'united-arab-emirates', 'AE', 15, 'ACTIVE')

    ON CONFLICT
    (code)
DO
    UPDATE
SET
    display_name  = EXCLUDED.display_name,
    url_name      = EXCLUDED.url_name,
    iso_code      = EXCLUDED.iso_code,
    display_order = EXCLUDED.display_order,
    status        = EXCLUDED.status,
    updated_at    = NOW();

    COMMIT;