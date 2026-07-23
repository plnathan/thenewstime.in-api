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

\i 001_create_enums.sql
\i 002_create_sequences.sql
\i 003_create_master_tables.sql
\i 004_create_security_tables.sql
\i 005_create_media_tables.sql
\i 006_create_news_tables.sql
\i 007_create_analytics_tables.sql
\i 008_create_indexes.sql
\i 009_create_functions.sql
\i 010_create_triggers.sql
\i 011_create_views.sql

\echo =====================================================
\echo Seed Completed Successfully
\echo =====================================================