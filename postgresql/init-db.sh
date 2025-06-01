#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Perform all actions as the 'postgres' user
export PGUSER="$POSTGRES_USER"

# Create the 'maratinho' user and the 'bigquery_tools' database.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER maratinho WITH PASSWORD 'maratinho';
    CREATE DATABASE bigquery_tools;
    GRANT ALL PRIVILEGES ON DATABASE bigquery_tools TO maratinho;
EOSQL

# Connect to the new database as 'maratinho' to grant schema privileges if needed
# For SQLAlchemy, the user needs to be able to create tables in the public schema.
# By default, users can create objects in the public schema if they can connect to the database.
# However, it's good practice to explicitly grant usage on the schema.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "bigquery_tools" <<-EOSQL
    GRANT USAGE ON SCHEMA public TO maratinho;
    GRANT CREATE ON SCHEMA public TO maratinho;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO maratinho;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO maratinho;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO maratinho;
EOSQL

echo "PostgreSQL user 'maratinho' and database 'bigquery_tools' created successfully."