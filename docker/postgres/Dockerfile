FROM postgres:16-alpine

# Copy initialization scripts
COPY docker/postgres/create-multiple-databases.sh /docker-entrypoint-initdb.d/00-create-multiple-databases.sh
COPY supabase/migrations/ /docker-entrypoint-initdb.d/migrations/

# Set permissions
RUN chmod +x /docker-entrypoint-initdb.d/00-create-multiple-databases.sh

# Expose PostgreSQL port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD pg_isready -U postgres || exit 1
