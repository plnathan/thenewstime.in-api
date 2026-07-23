/****************************************************************************************
 Project     : thenewstime.in
 File        : 003_seed_states.sql
 Description : Seed Indian States & Union Territories
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    ------------------------------------------------------------------------------------------
    -- INDIAN STATES & UNION TERRITORIES
    ------------------------------------------------------------------------------------------

    INSERT INTO states
        (
        country_id,
        code,
        display_name,
        url_name,
        display_order,
        status
        )
    VALUES

        -- States

        ((SELECT id
            FROM countries
            WHERE code='IND'), 'AP', 'Andhra Pradesh', 'andhra-pradesh', 1, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'AR', 'Arunachal Pradesh', 'arunachal-pradesh', 2, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'AS', 'Assam', 'assam', 3, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'BR', 'Bihar', 'bihar', 4, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'CG', 'Chhattisgarh', 'chhattisgarh', 5, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'GA', 'Goa', 'goa', 6, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'GJ', 'Gujarat', 'gujarat', 7, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'HR', 'Haryana', 'haryana', 8, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'HP', 'Himachal Pradesh', 'himachal-pradesh', 9, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'JH', 'Jharkhand', 'jharkhand', 10, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'KA', 'Karnataka', 'karnataka', 11, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'KL', 'Kerala', 'kerala', 12, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'MP', 'Madhya Pradesh', 'madhya-pradesh', 13, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'MH', 'Maharashtra', 'maharashtra', 14, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'MN', 'Manipur', 'manipur', 15, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'ML', 'Meghalaya', 'meghalaya', 16, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'MZ', 'Mizoram', 'mizoram', 17, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'NL', 'Nagaland', 'nagaland', 18, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'OD', 'Odisha', 'odisha', 19, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'PB', 'Punjab', 'punjab', 20, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'RJ', 'Rajasthan', 'rajasthan', 21, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'SK', 'Sikkim', 'sikkim', 22, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'TN', 'Tamil Nadu', 'tamil-nadu', 23, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'TG', 'Telangana', 'telangana', 24, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'TR', 'Tripura', 'tripura', 25, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'UP', 'Uttar Pradesh', 'uttar-pradesh', 26, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'UK', 'Uttarakhand', 'uttarakhand', 27, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'WB', 'West Bengal', 'west-bengal', 28, 'ACTIVE'),

        -- Union Territories

        ((SELECT id
            FROM countries
            WHERE code='IND'), 'AN', 'Andaman and Nicobar Islands', 'andaman-and-nicobar-islands', 29, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'CH', 'Chandigarh', 'chandigarh', 30, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'DN', 'Dadra and Nagar Haveli and Daman and Diu', 'dadra-and-nagar-haveli-and-daman-and-diu', 31, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'DL', 'Delhi', 'delhi', 32, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'JK', 'Jammu and Kashmir', 'jammu-and-kashmir', 33, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'LA', 'Ladakh', 'ladakh', 34, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'LD', 'Lakshadweep', 'lakshadweep', 35, 'ACTIVE'),
        ((SELECT id
            FROM countries
            WHERE code='IND'), 'PY', 'Puducherry', 'puducherry', 36, 'ACTIVE')

    ON CONFLICT
    (country_id, code)
DO
    UPDATE
SET
    display_name  = EXCLUDED.display_name,
    url_name      = EXCLUDED.url_name,
    display_order = EXCLUDED.display_order,
    status        = EXCLUDED.status,
    updated_at    = NOW();

    COMMIT;