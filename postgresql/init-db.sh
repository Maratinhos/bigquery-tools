#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Perform all actions as the 'postgres' user
export PGUSER="$POSTGRES_USER"

# Create the 'bigquery_tools_user' user and the 'bigquery_tools_db' database.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER bigquery_tools_user WITH PASSWORD 'bigquery_tools_user';
    CREATE DATABASE bigquery_tools_db;
    GRANT ALL PRIVILEGES ON DATABASE bigquery_tools_db TO bigquery_tools_user;
EOSQL

# Connect to the new database as 'bigquery_tools_user' to grant schema privileges if needed
# For SQLAlchemy, the user needs to be able to create tables in the public schema.
# By default, users can create objects in the public schema if they can connect to the database.
# However, it's good practice to explicitly grant usage on the schema.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "bigquery_tools_db" <<-EOSQL
    GRANT USAGE ON SCHEMA public TO bigquery_tools_user;
    GRANT CREATE ON SCHEMA public TO bigquery_tools_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bigquery_tools_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bigquery_tools_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO bigquery_tools_user;
EOSQL

echo "PostgreSQL user 'bigquery_tools_user' and database 'bigquery_tools_db' created successfully."
