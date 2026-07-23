/****************************************************************************************
 Project     : thenewstime.in
 File        : 004_seed_districts.sql
 Description : Seed Tamil Nadu Districts
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    INSERT INTO districts
        (
        state_id,
        code,
        display_name,
        url_name,
        display_order,
        status
        )
    VALUES

        ((SELECT id
            FROM states
            WHERE code='TN'), 'ARI', 'Ariyalur', 'ariyalur', 1, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'CHE', 'Chennai', 'chennai', 2, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'CBE', 'Coimbatore', 'coimbatore', 3, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'CUD', 'Cuddalore', 'cuddalore', 4, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'DHA', 'Dharmapuri', 'dharmapuri', 5, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'DIN', 'Dindigul', 'dindigul', 6, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'ERO', 'Erode', 'erode', 7, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'KAL', 'Kallakurichi', 'kallakurichi', 8, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'KAN', 'Kancheepuram', 'kancheepuram', 9, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'KAR', 'Karur', 'karur', 10, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'KRI', 'Krishnagiri', 'krishnagiri', 11, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'MDU', 'Madurai', 'madurai', 12, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'MAY', 'Mayiladuthurai', 'mayiladuthurai', 13, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'NAG', 'Nagapattinam', 'nagapattinam', 14, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'NAM', 'Namakkal', 'namakkal', 15, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'NIL', 'Nilgiris', 'the-nilgiris', 16, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'PER', 'Perambalur', 'perambalur', 17, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'PUD', 'Pudukkottai', 'pudukkottai', 18, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'RAM', 'Ramanathapuram', 'ramanathapuram', 19, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'RAN', 'Ranipet', 'ranipet', 20, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'SAL', 'Salem', 'salem', 21, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'SIV', 'Sivaganga', 'sivaganga', 22, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TEN', 'Tenkasi', 'tenkasi', 23, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'THA', 'Thanjavur', 'thanjavur', 24, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'THE', 'Theni', 'theni', 25, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'THO', 'Thoothukudi', 'thoothukudi', 26, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TPR', 'Tiruppur', 'tiruppur', 27, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TIC', 'Tiruchirappalli', 'tiruchirappalli', 28, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TIR', 'Tirunelveli', 'tirunelveli', 29, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TIV', 'Tirupathur', 'tirupathur', 30, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TVL', 'Tiruvallur', 'tiruvallur', 31, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TVM', 'Tiruvannamalai', 'tiruvannamalai', 32, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'TVR', 'Tiruvarur', 'tiruvarur', 33, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'VEL', 'Vellore', 'vellore', 34, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'VIL', 'Viluppuram', 'viluppuram', 35, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'VIR', 'Virudhunagar', 'virudhunagar', 36, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'CHEG', 'Chengalpattu', 'chengalpattu', 37, 'ACTIVE'),
        ((SELECT id
            FROM states
            WHERE code='TN'), 'KANI', 'Kanniyakumari', 'kanniyakumari', 38, 'ACTIVE')

    ON CONFLICT
    (state_id, code)
DO
    UPDATE
SET
    display_name  = EXCLUDED.display_name,
    url_name      = EXCLUDED.url_name,
    display_order = EXCLUDED.display_order,
    status        = EXCLUDED.status,
    updated_at    = NOW();

    COMMIT;