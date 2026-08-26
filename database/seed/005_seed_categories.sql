/****************************************************************************************
 Project     : thenewstime.in
 File        : 005_seed_categories.sql
 Description : Seed News Categories
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    INSERT INTO categories
        (
        code,
        display_name,
        url_name,
        description,
        display_order,
        status
        )
    VALUES

        ('POLITICS', 'Politics', 'politics', 'Political news', 1, 'ACTIVE'),
        ('GOVERNMENT', 'Government', 'government', 'Government announcements', 2, 'ACTIVE'),
        ('EDUCATION', 'Education', 'education', 'Education and examinations', 3, 'ACTIVE'),
        ('COURT', 'Court', 'court', 'Court and legal news', 4, 'ACTIVE'),
        ('HEALTH', 'Health', 'health', 'Health and medical news', 5, 'ACTIVE'),
        ('BUSINESS', 'Business', 'business', 'Business and economy', 6, 'ACTIVE'),
        ('ECONOMY', 'Economy', 'economy', 'Economic updates', 7, 'ACTIVE'),
        ('AGRICULTURE', 'Agriculture', 'agriculture', 'Agriculture and farmers', 8, 'ACTIVE'),
        ('SCIENCE', 'Science', 'science', 'Science and research', 9, 'ACTIVE'),
        ('TECHNOLOGY', 'Technology', 'technology', 'Technology news', 10, 'ACTIVE'),
        ('DEFENCE', 'Defence', 'defence', 'Defence and armed forces', 11, 'ACTIVE'),
        ('SPORTS', 'Sports', 'sports', 'Sports news', 12, 'ACTIVE'),
        ('CINEMA', 'Cinema', 'cinema', 'Cinema and entertainment', 13, 'ACTIVE'),
        ('CRIME', 'Crime', 'crime', 'Crime related news', 14, 'ACTIVE'),
        ('LIFESTYLE', 'Lifestyle', 'lifestyle', 'Lifestyle articles', 15, 'ACTIVE'),
        ('TRAVEL', 'Travel', 'travel', 'Travel news', 16, 'ACTIVE'),
        ('FOOD', 'Food', 'food', 'Food and recipes', 17, 'ACTIVE'),
        ('WEATHER', 'Weather', 'weather', 'Weather updates', 18, 'ACTIVE'),
        ('ENVIRONMENT', 'Environment', 'environment', 'Environment and climate', 19, 'ACTIVE'),
        ('SPIRITUAL', 'Spiritual', 'spiritual', 'Spiritual and religious news', 20, 'ACTIVE'),
        ('AUTOMOBILE', 'Automobile', 'automobile', 'Automobile industry', 21, 'ACTIVE'),
        ('JOBS', 'Jobs', 'jobs', 'Employment and recruitment', 22, 'ACTIVE'),
        ('OBITUARY', 'Obituary', 'obituary', 'Obituary announcements', 23, 'ACTIVE'),
        ('EDITORIAL', 'Editorial', 'editorial', 'Editorial opinions', 24, 'ACTIVE'),
        ('OPINION', 'Opinion', 'opinion', 'Opinion articles', 25, 'ACTIVE')

    ON CONFLICT
    (code)
DO
    UPDATE
SET
    display_name  = EXCLUDED.display_name,
    url_name      = EXCLUDED.url_name,
    description   = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    status        = EXCLUDED.status,
    updated_at    = NOW();

    COMMIT;