# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be needed by psycopg2 or other libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Define environment variables (can be overridden by docker-compose)
ENV FLASK_APP app:create_app()
ENV FLASK_ENV development

# Run entrypoint.sh when the container launches
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command if entrypoint.sh doesn't run gunicorn
# CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:create_app()"]