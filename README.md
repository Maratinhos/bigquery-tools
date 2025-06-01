# BigQuery Tools Web Application

## Overview

**bigquery-tools** is a web application designed to simplify user interaction with Google BigQuery. It provides a user-friendly interface for executing queries, managing datasets, and visualizing results, all without needing to write complex code or directly use the BigQuery console.

## Purpose

The primary purpose of this application is to empower users of all technical backgrounds to:

*   **Easily query data:** Execute SQL queries against BigQuery datasets through a web interface.
*   **Manage BigQuery resources:** View and manage datasets, tables, and jobs.
*   **Visualize results:** Generate charts and dashboards from query results for better data understanding.
*   **Streamline workflows:** Automate common BigQuery tasks and improve overall efficiency.

This application aims to be a central hub for users to harness the power of BigQuery for their data analysis and business intelligence needs.

## Backend

The backend of **bigquery-tools** is built using Python and the Flask web framework. It serves as the core engine that powers the application's functionalities.

Key features of the backend include:

*   **BigQuery Configuration Management:** Securely storing and managing users' Google Cloud Platform (GCP) service account keys and BigQuery connection details.
*   **Connection Testing:** Allowing users to test their BigQuery connection setup to ensure validity before executing queries.
*   **Query Dry-Runs:** Providing a mechanism to estimate the cost and data to be processed by a query without actually running it against BigQuery. This helps in optimizing queries and managing costs.
*   **Query Execution:** Handling the execution of SQL queries against BigQuery, fetching results, and returning them to the user.

The backend utilizes a **PostgreSQL** database to store user-specific information, such as user accounts (with hashed passwords for security) and their saved BigQuery configurations.

Authentication is handled via **token-based authentication (JWT)**, ensuring that user data and operations are secure and accessible only to authorized users.

## Deployment

The **bigquery-tools** application is designed for containerized deployment using Docker. This approach ensures consistency across different environments and simplifies the setup process.

**Docker Compose** is used to manage the multi-service application, which currently includes:

*   **Backend Service:** The Python/Flask application, containerized as defined in its `Dockerfile`.
*   **Database Service:** A PostgreSQL database instance to store application data.

The `docker-compose.yml` file also includes a **placeholder for a frontend service**. This indicates a potential future development path where a dedicated frontend application (e.g., a JavaScript framework like React, Vue, or Angular) could be integrated into the project and managed alongside the backend and database services.

## Technology Stack

The **bigquery-tools** application leverages the following core technologies:

*   **Python:** The primary programming language for the backend logic.
*   **Flask:** A lightweight web framework used to build the backend API.
*   **SQLAlchemy:** An ORM (Object Relational Mapper) used for interacting with the PostgreSQL database.
*   **PostgreSQL:** A robust open-source relational database used for storing user data and application configurations.
*   **Docker & Docker Compose:** For containerizing the application and managing its services, ensuring consistent deployment and development environments.
*   **Google BigQuery:** The cloud data warehouse service that this application helps users interact with. The `google-cloud-bigquery` Python library is used for this integration.
*   **Flask-JWT-Extended:** For handling JWT-based authentication.
