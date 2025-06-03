import unittest
import json
import uuid
from unittest.mock import patch, MagicMock

# Assuming your Flask app is created by a function `create_app` in `backend.app`
import datetime # Added for session expiry
from flask_jwt_extended import create_access_token # Added for token creation

# Assuming your Flask app is created by a function `create_app` in `backend.app`
# and `db` is your SQLAlchemy instance from `backend.app`
from backend.app import create_app, db
from backend.app.models import User, BigQueryConfig, Object, Field, Session # Added Session

# Use a specific configuration for testing
class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:' # Use in-memory SQLite for integration tests
    SECRET_KEY = 'test-secret-key'
    JWT_SECRET_KEY = 'test-jwt-secret-key'
    JWT_ACCESS_TOKEN_EXPIRES = datetime.timedelta(hours=1) # Added for session creation
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

        # Create a real token and session for the user
        self.access_token = create_access_token(identity=str(self.user.id))

        expires_delta = self.app.config.get('JWT_ACCESS_TOKEN_EXPIRES', datetime.timedelta(hours=1))
        # Ensure current_app is available if Session model relies on it for default expiry
        with self.app.app_context():
            session_entry = Session(
                user_id=self.user.id,
                token=self.access_token,
                expires_at=datetime.datetime.utcnow() + expires_delta
            )
            db.session.add(session_entry)
            db.session.commit()

        self.auth_headers = {"Authorization": f"Bearer {self.access_token}"}

        # No longer mocking get_jwt_identity directly as we use a real token.
        # self.mock_jwt_patch = patch('flask_jwt_extended.get_jwt_identity', return_value=str(self.user.id))
        # self.mock_jwt = self.mock_jwt_patch.start()


    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
        # if hasattr(self, 'mock_jwt_patch'): # Stop patch if it was started
        #    self.mock_jwt_patch.stop()


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

    # --- Tests for GET /api/config ---
    def test_get_configs_success_and_isolation(self):
        # Create configs for the primary test user
        config1_user1 = BigQueryConfig(user_id=self.user.id, connection_name="user1_conn1", gcp_key_json={"project_id": "test1"})
        config2_user1 = BigQueryConfig(user_id=self.user.id, connection_name="user1_conn2", gcp_key_json={"project_id": "test2"})
        db.session.add_all([config1_user1, config2_user1])

        # Create another user and their config
        other_user = User(email=f"otheruser_{uuid.uuid4()}@example.com")
        other_user.set_password("password")
        db.session.add(other_user)
        db.session.commit() # Commit to get other_user.id
        config_other_user = BigQueryConfig(user_id=other_user.id, connection_name="other_user_conn", gcp_key_json={"project_id": "test_other"})
        db.session.add(config_other_user)
        db.session.commit()

        response = self.client.get('/api/config', headers=self.auth_headers)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2) # Should only get configs for self.user

        # Verify the content of the returned configs
        returned_conn_names = {item['connection_name'] for item in data}
        expected_conn_names = {"user1_conn1", "user1_conn2"}
        self.assertEqual(returned_conn_names, expected_conn_names)

        for item in data:
            self.assertIn('id', item)
            self.assertIsInstance(item['id'], str) # ID should be stringified
            if item['connection_name'] == "user1_conn1":
                self.assertEqual(item['id'], str(config1_user1.id))
            elif item['connection_name'] == "user1_conn2":
                self.assertEqual(item['id'], str(config2_user1.id))

    def test_get_configs_no_configs_for_user(self):
        # No configs created for self.user
        response = self.client.get('/api/config', headers=self.auth_headers)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    # --- Tests for GET /api/objects_with_fields ---
    def test_get_objects_with_fields_success(self):
        # Create a BigQueryConfig for the user
        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="obj_field_conn", gcp_key_json={"p_id": "proj1"})
        db.session.add(bq_config)
        db.session.commit()

        # Objects and Fields for the current user
        obj1_user1 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="dataset1.table1", object_description="Desc for obj1")
        f1_obj1 = Field(object=obj1_user1, field_name="colA", field_description="Desc for colA")
        f2_obj1 = Field(object=obj1_user1, field_name="colB", field_description="Desc for colB")

        obj2_user1 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="dataset1.table2", object_description=None) # Null description
        f1_obj2 = Field(object=obj2_user1, field_name="colX", field_description=None) # Null description

        db.session.add_all([obj1_user1, f1_obj1, f2_obj1, obj2_user1, f1_obj2])

        # Object for another user to ensure filtering
        other_user = User(email=f"otheruser_obj_{uuid.uuid4()}@example.com", password="password")
        db.session.add(other_user)
        db.session.commit()
        other_bq_config = BigQueryConfig(user_id=other_user.id, connection_name="other_conn", gcp_key_json={})
        db.session.add(other_bq_config)
        db.session.commit()
        obj_other_user = Object(user_id=other_user.id, connection_id=other_bq_config.id, object_name="otherdata.othertable")
        db.session.add(obj_other_user)
        db.session.commit()

        response = self.client.get('/api/objects_with_fields', headers=self.auth_headers)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2) # obj1_user1 and obj2_user1

        # Sort by object_name for consistent checking
        data.sort(key=lambda x: x['object_name'])

        # Check obj1_user1
        self.assertEqual(data[0]['object_name'], "dataset1.table1")
        self.assertEqual(data[0]['object_description'], "Desc for obj1")
        self.assertEqual(data[0]['connection_id'], str(bq_config.id))
        self.assertEqual(len(data[0]['fields']), 2)
        data[0]['fields'].sort(key=lambda x: x['field_name'])
        self.assertEqual(data[0]['fields'][0]['field_name'], "colA")
        self.assertEqual(data[0]['fields'][0]['field_description'], "Desc for colA")

        # Check obj2_user1 (with null descriptions)
        self.assertEqual(data[1]['object_name'], "dataset1.table2")
        self.assertEqual(data[1]['object_description'], "") # Null description becomes empty string
        self.assertEqual(len(data[1]['fields']), 1)
        self.assertEqual(data[1]['fields'][0]['field_name'], "colX")
        self.assertEqual(data[1]['fields'][0]['field_description'], "") # Null description becomes empty string

    def test_get_objects_with_fields_no_objects(self):
        response = self.client.get('/api/objects_with_fields', headers=self.auth_headers)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 0)

    def test_get_objects_with_fields_unauthenticated(self):
        # Override auth_headers for this test
        response = self.client.get('/api/objects_with_fields', headers={}) # No auth
        self.assertEqual(response.status_code, 401) # Expecting 401 due to @token_required_custom

    # --- Tests for modified POST /api/generate_sql_from_natural_language ---

    @patch('backend.app.routes.api.GeminiService') # Patching GeminiService where it's used
    def test_generate_sql_with_specific_object_names(self, MockGeminiService):
        mock_gemini_instance = MockGeminiService.return_value
        mock_gemini_instance.generate_sql_query.return_value = "SELECT * FROM specific.table;"

        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gen_sql_specific_conn", gcp_key_json={})
        obj1 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="specific.table", object_description="Specific table desc")
        f1_obj1 = Field(object=obj1, field_name="col1", field_description="Specific col1 desc")
        obj2 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="another.table", object_description="Another table desc")
        f1_obj2 = Field(object=obj2, field_name="colA", field_description="Another colA desc")
        db.session.add_all([bq_config, obj1, f1_obj1, obj2, f1_obj2])
        db.session.commit()

        payload = {
            "user_request": "query for specific table",
            "connection_id": str(bq_config.id),
            "object_names": ["specific.table"]
        }
        response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["generated_sql"], "SELECT * FROM specific.table;")

        mock_gemini_instance.generate_sql_query.assert_called_once()
        call_args = mock_gemini_instance.generate_sql_query.call_args[0]
        objects_data = call_args[1] # objects_with_fields_data

        self.assertEqual(len(objects_data), 1)
        self.assertEqual(objects_data[0]['object_name'], "specific.table")
        self.assertEqual(objects_data[0]['object_description'], "Specific table desc")
        self.assertEqual(len(objects_data[0]['fields']), 1)
        self.assertEqual(objects_data[0]['fields'][0]['field_name'], "col1")

    @patch('backend.app.routes.api.GeminiService')
    def test_generate_sql_with_empty_object_names_uses_all_objects(self, MockGeminiService):
        mock_gemini_instance = MockGeminiService.return_value
        mock_gemini_instance.generate_sql_query.return_value = "SELECT * FROM all_tables;"

        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gen_sql_empty_conn", gcp_key_json={})
        obj1 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="table_one", object_description="First table")
        f1_obj1 = Field(object=obj1, field_name="f1_col1")
        obj2 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="table_two", object_description="Second table")
        f1_obj2 = Field(object=obj2, field_name="f2_col1")
        # Object for another connection (should not be included)
        other_bq_config = BigQueryConfig(user_id=self.user.id, connection_name="other_conn_for_sql_gen", gcp_key_json={})
        obj_other_conn = Object(user_id=self.user.id, connection_id=other_bq_config.id, object_name="other_conn.table")

        db.session.add_all([bq_config, obj1, f1_obj1, obj2, f1_obj2, other_bq_config, obj_other_conn])
        db.session.commit()

        payload = {
            "user_request": "query for all tables in connection",
            "connection_id": str(bq_config.id),
            "object_names": [] # Empty list
        }
        response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
        data = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["generated_sql"], "SELECT * FROM all_tables;")

        mock_gemini_instance.generate_sql_query.assert_called_once()
        call_args = mock_gemini_instance.generate_sql_query.call_args[0]
        objects_data = call_args[1]

        self.assertEqual(len(objects_data), 2)
        object_names_sent = {o['object_name'] for o in objects_data}
        self.assertIn("table_one", object_names_sent)
        self.assertIn("table_two", object_names_sent)
        self.assertNotIn("other_conn.table", object_names_sent)

    @patch('backend.app.routes.api.GeminiService')
    def test_generate_sql_with_missing_object_names_uses_all_objects(self, MockGeminiService):
        mock_gemini_instance = MockGeminiService.return_value
        mock_gemini_instance.generate_sql_query.return_value = "SELECT * FROM all_tables_missing_key;"

        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gen_sql_missing_key_conn", gcp_key_json={})
        obj1 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="key_table_one")
        obj2 = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="key_table_two")
        db.session.add_all([bq_config, obj1, obj2])
        db.session.commit()

        payload = {
            "user_request": "query for all tables, object_names key missing",
            "connection_id": str(bq_config.id)
            # object_names key is omitted
        }
        response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
        data = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["generated_sql"], "SELECT * FROM all_tables_missing_key;")

        mock_gemini_instance.generate_sql_query.assert_called_once()
        call_args = mock_gemini_instance.generate_sql_query.call_args[0]
        objects_data = call_args[1]

        self.assertEqual(len(objects_data), 2)
        object_names_sent = {o['object_name'] for o in objects_data}
        self.assertIn("key_table_one", object_names_sent)
        self.assertIn("key_table_two", object_names_sent)

    @patch('backend.app.routes.api.GeminiService')
    def test_generate_sql_no_objects_for_connection_empty_schema_to_gemini(self, MockGeminiService):
        mock_gemini_instance = MockGeminiService.return_value
        mock_gemini_instance.generate_sql_query.return_value = "SELECT 1;" # Gemini might do this

        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gen_sql_no_objects_conn", gcp_key_json={})
        db.session.add(bq_config)
        db.session.commit()
        # No objects created for this bq_config

        payload = {
            "user_request": "query with no context",
            "connection_id": str(bq_config.id),
            "object_names": []
        }
        response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
        data = response.get_json()
        self.assertEqual(response.status_code, 200)

        mock_gemini_instance.generate_sql_query.assert_called_once()
        call_args = mock_gemini_instance.generate_sql_query.call_args[0]
        objects_data = call_args[1]
        self.assertEqual(len(objects_data), 0) # Empty list passed to Gemini

    @patch('backend.app.routes.api.GeminiService')
    def test_generate_sql_object_name_not_found(self, MockGeminiService):
        mock_gemini_instance = MockGeminiService.return_value
        mock_gemini_instance.generate_sql_query.return_value = "SELECT 'not found';"

        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="gen_sql_not_found_conn", gcp_key_json={})
        db.session.add(bq_config)
        db.session.commit()

        payload = {
            "user_request": "query for non-existent table",
            "connection_id": str(bq_config.id),
            "object_names": ["nonexistent.table"]
        }
        response = self.client.post('/api/generate_sql_from_natural_language', headers=self.auth_headers, json=payload)
        data = response.get_json()
        self.assertEqual(response.status_code, 200)

        mock_gemini_instance.generate_sql_query.assert_called_once()
        call_args = mock_gemini_instance.generate_sql_query.call_args[0]
        objects_data = call_args[1]

        self.assertEqual(len(objects_data), 1)
        self.assertEqual(objects_data[0]['object_name'], "nonexistent.table")
        self.assertIsNone(objects_data[0]['object_description'])
        self.assertEqual(len(objects_data[0]['fields']), 0)


class TestConfigDelete(BaseIntegrationTestCase):

    def test_delete_bigquery_config_success(self):
        # 1. Setup: Create a BigQueryConfig for the user
        bq_config = BigQueryConfig(
            user_id=self.user.id,
            connection_name="test_delete_conn",
            gcp_key_json={"project_id": "delete_test"}
        )
        db.session.add(bq_config)
        db.session.commit()
        config_id = str(bq_config.id)

        # Optional: Create related Object and Field to test cascade
        obj = Object(user_id=self.user.id, connection_id=bq_config.id, object_name="dataset.table_to_delete")
        db.session.add(obj)
        db.session.commit()
        obj_id = str(obj.id)
        field = Field(object_id=obj.id, field_name="field_to_delete")
        db.session.add(field)
        db.session.commit()
        field_id = str(field.id)

        # 2. Send DELETE request
        response = self.client.delete(f'/api/config/{config_id}', headers=self.auth_headers)

        # 3. Assert response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "Configuration deleted successfully.")

        # 4. Assert config is removed from DB
        deleted_config = db.session.get(BigQueryConfig, bq_config.id) # Use UUID object
        self.assertIsNone(deleted_config)

        # 5. Assert related Object and Field are removed (optional cascade check)
        # Note: This depends on cascade settings in models.py or DB schema.
        # BigQueryConfig.objects relationship does not currently have cascade="all, delete-orphan"
        # So, direct children Objects might not be deleted by SQLAlchemy unless DB enforces ON DELETE CASCADE.
        # However, if the DB (like Postgres with FKs) enforces it, they would be.
        # For SQLite in tests, PRAGMA foreign_keys=ON would be needed for DB-level cascade.
        # Let's check and report.
        deleted_object = db.session.get(Object, obj.id) # Use UUID object
        deleted_field = db.session.get(Field, field.id) # Use UUID object

        # If cascade from BigQueryConfig to Object is not working, deleted_object will exist.
        # If it exists, then deleted_field should also exist (as Field cascades from Object).
        # If cascade from BigQueryConfig to Object IS working, deleted_object will be None.
        # And consequently, deleted_field should also be None (as Object deletion cascades to Field).

        # We expect the Object and Field to be deleted if the foreign key constraint from Object to BigQueryConfig
        # is set with ON DELETE CASCADE at the DB level, or if SQLAlchemy was configured to do it.
        # Given models.py, BigQueryConfig.objects does not have this.
        # Let's assume for now that the DB or models *should* eventually support this.
        # The route itself doesn't manually delete them.
        # If this fails, it's an issue with model definition or DB setup for cascading, not the route logic itself.

        # Check if PRAGMA foreign_keys=ON is active for SQLite:
        # cur = db.session.execute("PRAGMA foreign_keys;")
        # fk_on = cur.fetchone()[0]
        # print(f"SQLite foreign_keys PRAGMA: {fk_on}") # Would require running this in test setup

        # For now, let's assert they are deleted, and if tests fail, it highlights the cascade issue.
        self.assertIsNone(deleted_object, "Related Object should be deleted by cascade.")
        self.assertIsNone(deleted_field, "Related Field should be deleted due to Object being deleted by cascade.")


    def test_delete_bigquery_config_unauthorized_wrong_user(self):
        # 1. Setup: Create config for the main user
        bq_config_user1 = BigQueryConfig(user_id=self.user.id, connection_name="user1_conn", gcp_key_json={})
        db.session.add(bq_config_user1)
        db.session.commit()
        # config_id_user1 = str(bq_config_user1.id) # Not used for deletion attempt

        # 2. Create a second user and a config for them
        user2 = User(email=f"testuser2_{uuid.uuid4()}@example.com")
        user2.set_password("password2")
        db.session.add(user2)
        db.session.commit()
        bq_config_user2 = BigQueryConfig(user_id=user2.id, connection_name="user2_conn", gcp_key_json={})
        db.session.add(bq_config_user2)
        db.session.commit()
        config_id_user2 = str(bq_config_user2.id)

        # 3. Current logged-in user (self.user) tries to delete user2's config
        response = self.client.delete(f'/api/config/{config_id_user2}', headers=self.auth_headers)

        # 4. Assert 404 (or 403)
        self.assertEqual(response.status_code, 404) # Route returns 404 if config_id and user_id don't match
        self.assertEqual(response.get_json()["message"], "Configuration not found or access denied.")

        # 5. Assert config for user2 still exists
        still_exists_config = db.session.get(BigQueryConfig, bq_config_user2.id) # Use UUID object
        self.assertIsNotNone(still_exists_config)


    def test_delete_non_existent_config(self):
        non_existent_uuid = str(uuid.uuid4())
        response = self.client.delete(f'/api/config/{non_existent_uuid}', headers=self.auth_headers)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["message"], "Configuration not found or access denied.")

    def test_delete_config_without_token(self):
        # 1. Setup: Create a config
        bq_config = BigQueryConfig(user_id=self.user.id, connection_name="no_token_conn", gcp_key_json={})
        db.session.add(bq_config)
        db.session.commit()
        config_id = str(bq_config.id)

        # 2. Send DELETE request without auth headers
        response = self.client.delete(f'/api/config/{config_id}') # No headers=self.auth_headers

        # 3. Assert 401
        # This depends on how @token_required_custom is implemented and how flask_jwt_extended handles missing tokens
        # Typically, it should be 401.
        self.assertEqual(response.status_code, 401)
        # The actual message might vary depending on flask_jwt_extended default error handlers
        # Example: {"msg": "Missing Authorization Header"} or similar
        # For now, just checking status code is fine.
        # self.assertIn("Missing Authorization Header", response.get_json().get("msg", ""))

        # 4. Assert config still exists
        still_exists_config = db.session.get(BigQueryConfig, bq_config.id) # Use UUID object
        self.assertIsNotNone(still_exists_config)


if __name__ == '__main__':
    unittest.main()
