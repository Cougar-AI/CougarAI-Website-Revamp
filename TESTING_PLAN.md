# Backend API Testing Implementation Plan

This document outlines the strategy for adding a testing suite to the backend API.

## 1. Introduce Testing Libraries

-   Add `pytest` and `pytest-flask` to `backend/requirements.txt`.

## 2. Create a Flexible Configuration System

-   Create a `backend/config.py` file to manage different environment configurations (`DevelopmentConfig`, `TestingConfig`).
-   The `TestingConfig` will be set up to use a separate PostgreSQL database, with credentials loaded from environment variables (e.g., `TEST_DB_NAME`, `TEST_DB_USER`). This is ideal for CI/CD environments like GitHub Actions.
-   Update the `create_app` function in `backend/app/__init__.py` to accept and apply a configuration class.
-   Modify the `connect` function in `backend/app/db.py` to read database credentials from the Flask `app.config` object.

## 3. Set Up the Test Structure

-   Create a new `backend/tests/` directory.
-   Inside `backend/tests/`, create a `conftest.py` file to define shared testing fixtures:
    -   `app` fixture: Initializes the Flask app with `TestingConfig`.
    -   `client` fixture: Provides a test client for making API requests.

## 4. Write an Initial Test

-   Create a sample test file, `backend/tests/test_auth.py`, with a basic test to validate the setup.

## 5. CI/CD Integration (Future Step)

-   Configure the GitHub Actions workflow to:
    -   Spin up a PostgreSQL container for the test database.
    -   Set the required database credentials as environment variables for the tests to use.
    -   Run the `pytest` suite.

## Proposed File Structure Changes

```mermaid
graph TD
    subgraph backend
        direction LR
        A(app/)
        B(tests/)
        C(config.py)
        D(requirements.txt)
    end

    subgraph tests
        direction LR
        E(conftest.py)
        F(test_auth.py)
    end

    B --> E
    B --> F