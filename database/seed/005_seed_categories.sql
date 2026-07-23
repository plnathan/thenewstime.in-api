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

        ('BREAKING', 'Breaking News', 'breaking-news', 'Breaking news and alerts', 1, 'ACTIVE'),
        ('TOP', 'Top News', 'top-news', 'Top headlines', 2, 'ACTIVE'),
        ('POLITICS', 'Politics', 'politics', 'Political news', 3, 'ACTIVE'),
        ('GOVERNMENT', 'Government', 'government', 'Government announcements', 4, 'ACTIVE'),
        ('CRIME', 'Crime', 'crime', 'Crime related news', 5, 'ACTIVE'),
        ('COURT', 'Court', 'court', 'Court and legal news', 6, 'ACTIVE'),
        ('EDUCATION', 'Education', 'education', 'Education and examinations', 7, 'ACTIVE'),
        ('HEALTH', 'Health', 'health', 'Health and medical news', 8, 'ACTIVE'),
        ('BUSINESS', 'Business', 'business', 'Business and economy', 9, 'ACTIVE'),
        ('ECONOMY', 'Economy', 'economy', 'Economic updates', 10, 'ACTIVE'),
        ('AGRICULTURE', 'Agriculture', 'agriculture', 'Agriculture and farmers', 11, 'ACTIVE'),
        ('SCIENCE', 'Science', 'science', 'Science and research', 12, 'ACTIVE'),
        ('TECHNOLOGY', 'Technology', 'technology', 'Technology news', 13, 'ACTIVE'),
        ('DEFENCE', 'Defence', 'defence', 'Defence and armed forces', 14, 'ACTIVE'),
        ('SPORTS', 'Sports', 'sports', 'Sports news', 15, 'ACTIVE'),
        ('CINEMA', 'Cinema', 'cinema', 'Cinema and entertainment', 16, 'ACTIVE'),
        ('ENTERTAINMENT', 'Entertainment', 'entertainment', 'Entertainment industry', 17, 'ACTIVE'),
        ('LIFESTYLE', 'Lifestyle', 'lifestyle', 'Lifestyle articles', 18, 'ACTIVE'),
        ('TRAVEL', 'Travel', 'travel', 'Travel news', 19, 'ACTIVE'),
        ('FOOD', 'Food', 'food', 'Food and recipes', 20, 'ACTIVE'),
        ('WEATHER', 'Weather', 'weather', 'Weather updates', 21, 'ACTIVE'),
        ('ENVIRONMENT', 'Environment', 'environment', 'Environment and climate', 22, 'ACTIVE'),
        ('SPIRITUAL', 'Spiritual', 'spiritual', 'Spiritual and religious news', 23, 'ACTIVE'),
        ('ASTROLOGY', 'Astrology', 'astrology', 'Astrology and horoscope', 24, 'ACTIVE'),
        ('AUTOMOBILE', 'Automobile', 'automobile', 'Automobile industry', 25, 'ACTIVE'),
        ('JOBS', 'Jobs', 'jobs', 'Employment and recruitment', 26, 'ACTIVE'),
        ('OBITUARY', 'Obituary', 'obituary', 'Obituary announcements', 27, 'ACTIVE'),
        ('EDITORIAL', 'Editorial', 'editorial', 'Editorial opinions', 28, 'ACTIVE'),
        ('OPINION', 'Opinion', 'opinion', 'Opinion articles', 29, 'ACTIVE'),
        ('FACTCHECK', 'Fact Check', 'fact-check', 'Fact checking articles', 30, 'ACTIVE')

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