/****************************************************************************************
 Project     : thenewstime.in
 File        : seed_all.sql
 Description : Execute All Seed Scripts
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

\echo =====================================================
\echo Running thenewstime.in Seed Scripts
\echo =====================================================

\i 001_seed_roles.sql

\i 002_seed_countries.sql

\i 003_seed_states.sql

\i 004_seed_districts.sql

\i 005_seed_categories.sql

\i 006_seed_admin_user.sql

\echo =====================================================
\echo Seed Completed Successfully
\echo =====================================================