#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
# Simple wait, ideally use a tool like wait-for-it.sh or rely on docker-compose health checks
# For now, a simple sleep, but this is not robust.
# Better: use docker-compose depends_on with service_healthy condition.
# Let's assume docker-compose handles this for now with `depends_on` and `condition: service_healthy`.

echo "Running database migrations..."
flask db upgrade

echo "Creating initial admin user (if not exists)..."
flask create-initial-user

echo "Starting Gunicorn server..."
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --log-level info "app:create_app()"