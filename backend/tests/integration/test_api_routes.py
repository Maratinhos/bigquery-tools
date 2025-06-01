import unittest
import json
import uuid
from unittest.mock import patch, MagicMock

# Assuming your Flask app is created by a function `create_app` in `backend.app`
# and `db` is your SQLAlchemy instance from `backend.app`
from backend.app import create_app, db
from backend.app.models import User, BigQueryConfig, Object, Field

# Use a specific configuration for testing
class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:' # Use in-memory SQLite for integration tests
    SECRET_KEY = 'test-secret-key'
    JWT_SECRET_KEY = 'test-jwt-secret-key'
    # Suppress CSRF protection in tests if you use Flask-WTF, etc.
    # WTF_CSRF_ENABLED = False
    GEMINI_API_KEY = "fake_gemini_key_for_testing_config_load" # So app doesn't fail if config expects it


class BaseIntegrationTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(config_class=TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create a test user and obtain a token
        self.user = User(email=f"testuser_{uuid.uuid4()}@example.com")
        self.user.set_password("password")
        db.session.add(self.user)
        db.session.commit()

        # Simulate token generation (actual token generation might involve another endpoint or utility)
        # For simplicity, we'll assume a valid token can be "mocked" or a test utility generates it.
        # Here, we'll mock get_jwt_identity to simplify.
        # A more robust way is to call your /login endpoint to get a real token.
        self.mock_jwt_patch = patch('flask_jwt_extended.get_jwt_identity', return_value=str(self.user.id))
        self.mock_jwt = self.mock_jwt_patch.start()
        self.auth_headers = {"Authorization": "Bearer dummy_token_doesnt_matter_due_to_mock"}


    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
        self.mock_jwt_patch.stop()


class TestApiRoutes(BaseIntegrationTestCase):

    def test_table_schema_success(self):
        # Setup: Create a BigQueryConfig for the user
        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="test_conn", gcp_key_json={"project_id": "test"})
        db.session.add(bq_config)
        db.session.commit()

        with patch('backend.app.services.bigquery_service.BigQueryService.get_table_schema') as mock_get_schema:
            mock_get_schema.return_value = (True, [{"name": "col1", "field_type": "STRING"}])

            response = self.client.post(
                '/api/table_schema',
                headers=self.auth_headers,
                json={"connection_id": str(bq_config.id), "object_name": "dataset.table"}
            )
            data = response.get_json()

            self.assertEqual(response.status_code, 200)
            self.assertIn("schema", data)
            self.assertEqual(data["schema"][0]["name"], "col1")
            mock_get_schema.assert_called_once_with("dataset.table")

    def test_table_schema_missing_params(self):
        response = self.client.post('/api/table_schema', headers=self.auth_headers, json={})
        self.assertEqual(response.status_code, 400)
        self.assertIn("connection_id is required", response.get_json()["message"])

    def test_table_schema_bq_config_not_found(self):
        response = self.client.post(
            '/api/table_schema',
            headers=self.auth_headers,
            json={"connection_id": str(uuid.uuid4()), "object_name": "dataset.table"}
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("BigQuery configuration not found", response.get_json()["message"])

    # --- Tests for POST /api/table_schema_update ---
    def test_table_schema_update_create_new(self):
        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="update_conn", gcp_key_json={"p": "test"})
        db.session.add(bq_config)
        db.session.commit()

        payload = {
            "connection_id": str(bq_config.id),
            "object_name": "new_dataset.new_table",
            "object_description": "Brand new object",
            "fields": [
                {"field_name": "field1", "field_description": "Desc for field1"}
            ]
        }
        response = self.client.post('/api/table_schema_update', headers=self.auth_headers, json=payload)
        data = response.get_json()

        self.assertEqual(response.status_code, 200) # As per current implementation
        self.assertEqual(data["message"], "Description updated successfully.")
        self.assertIsNotNone(data.get("object_id"))

        # Verify in DB
        obj = Object.query.filter_by(id=data["object_id"]).first()
        self.assertIsNotNone(obj)
        self.assertEqual(obj.object_name, "new_dataset.new_table")
        self.assertEqual(obj.object_description, "Brand new object")
        self.assertEqual(len(obj.fields), 1)
        self.assertEqual(obj.fields[0].field_name, "field1")

    def test_table_schema_update_existing_object(self):
        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="update_existing_conn", gcp_key_json={})
        db_object = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="existing.table", object_description="Old desc")
        db_field = Field(object=db_object, field_name="existing_field", field_description="Old field desc")
        db.session.add_all([bq_config, db_object, db_field])
        db.session.commit()

        payload = {
            "connection_id": str(bq_config.id),
            "object_name": "existing.table",
            "object_description": "Updated object desc", # Will update
            "fields": [
                {"field_name": "existing_field", "field_description": "Updated field desc"},
                {"field_name": "new_field_for_existing_object", "field_description": "New field"}
            ]
        }
        response = self.client.post('/api/table_schema_update', headers=self.auth_headers, json=payload)
        self.assertEqual(response.status_code, 200)

        updated_obj = Object.query.get(db_object.id)
        self.assertEqual(updated_obj.object_description, "Updated object desc")
        self.assertEqual(len(updated_obj.fields), 2) # One updated, one new

        field_names = {f.field_name for f in updated_obj.fields}
        self.assertIn("existing_field", field_names)
        self.assertIn("new_field_for_existing_object", field_names)
        for f in updated_obj.fields:
            if f.field_name == "existing_field":
                self.assertEqual(f.field_description, "Updated field desc")


    # --- Tests for POST /api/generate_sql_from_natural_language ---
    @patch('backend.app.services.gemini_service.GeminiService.generate_sql_query')
    def test_generate_sql_success(self, mock_generate_sql):
        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gemini_conn", gcp_key_json={})
        # Create mock object and field in DB to be fetched for context
        db_object = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="schema.table1", object_description="Test table for Gemini")
        db_field = Field(object=db_object, field_name="col_a", field_description="Column A")
        db.session.add_all([bq_config, db_object, db_field])
        db.session.commit()

        mock_generate_sql.return_value = "SELECT col_a FROM schema.table1 WHERE col_a = 'test';"

        payload = {
            "user_request": "show me col_a from table1 where it is test",
            "connection_id": str(bq_config.id),
            "object_names": ["schema.table1"]
        }
        response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["generated_sql"], "SELECT col_a FROM schema.table1 WHERE col_a = 'test';")

        # Check that the mock was called with context from DB
        args, kwargs = mock_generate_sql.call_args
        self.assertEqual(args[0], payload["user_request"]) # user_request_text
        self.assertEqual(len(args[1]), 1) # objects_with_fields_data
        self.assertEqual(args[1][0]['object_name'], "schema.table1")
        self.assertEqual(args[1][0]['fields'][0]['field_name'], "col_a")


    def test_generate_sql_gemini_fails_or_returns_none(self):
         with patch('backend.app.services.gemini_service.GeminiService.generate_sql_query') as mock_generate_sql:
            bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gemini_fail_conn", gcp_key_json={})
            db.session.add(bq_config)
            db.session.commit()

            mock_generate_sql.return_value = None # Simulate Gemini not being able to generate SQL

            payload = {
                "user_request": "a very vague request",
                "connection_id": str(bq_config.id),
                "object_names": ["dataset.anytable"] # Object doesn't need to exist in DB for this mock path
            }
            response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
            data = response.get_json()

            self.assertEqual(response.status_code, 422) # Unprocessable Entity
            self.assertIn("Could not generate SQL query", data["message"])


if __name__ == '__main__':
    unittest.main()
