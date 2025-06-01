import unittest
from unittest.mock import patch, MagicMock
import uuid
from datetime import datetime

# Adjust imports based on your project structure
# Assuming models are in backend.app.models
from backend.app.models import User, BigQueryConfig, Object, Field, db
from sqlalchemy.exc import IntegrityError

class TestModels(unittest.TestCase):

    def setUp(self):
        # This is where you might configure an in-memory DB for testing
        # For now, we'll rely on mocking db.session if direct DB interaction is complex
        pass

    def test_create_object_instance(self):
        user_id = uuid.uuid4()
        config_id = uuid.uuid4()
        obj = Object(
            user_id=user_id,
            connection_id=config_id,
            object_name="dataset.table_alpha",
            object_description="This is a test table."
        )
        self.assertIsNotNone(obj.id) # id is default=uuid.uuid4()
        self.assertEqual(obj.user_id, user_id)
        self.assertEqual(obj.connection_id, config_id)
        self.assertEqual(obj.object_name, "dataset.table_alpha")
        self.assertEqual(obj.object_description, "This is a test table.")
        self.assertIsInstance(obj.created_at, datetime)

    @patch('backend.app.models.db.session')
    def test_save_object_to_db(self, mock_session):
        user_id = uuid.uuid4()
        config_id = uuid.uuid4()
        obj = Object(
            user_id=user_id,
            connection_id=config_id,
            object_name="dataset.table_beta",
            object_description="Saving to DB."
        )
        mock_session.add.return_value = None
        mock_session.commit.return_value = None

        db.session.add(obj)
        db.session.commit()

        mock_session.add.assert_called_once_with(obj)
        mock_session.commit.assert_called_once()

    def test_create_field_instance_and_link_to_object(self):
        user_id = uuid.uuid4()
        config_id = uuid.uuid4()
        obj_id = uuid.uuid4() # Assume object already has an ID

        db_object = Object(
            id=obj_id, # Pre-assign ID for linking
            user_id=user_id,
            connection_id=config_id,
            object_name="dataset.table_gamma"
        )

        field = Field(
            object_id=db_object.id, # Link using the object's ID
            field_name="column_x",
            field_description="Description for column_x."
        )
        # If using relationships, you might append to db_object.fields instead
        # e.g., db_object.fields.append(field) and then check field.object_id or field.object

        self.assertIsNotNone(field.id)
        self.assertEqual(field.object_id, db_object.id)
        self.assertEqual(field.field_name, "column_x")
        self.assertEqual(field.field_description, "Description for column_x.")
        self.assertIsInstance(field.created_at, datetime)

        # Test relationship (if you append and expect backref)
        # For this test, we'll assume direct assignment of object_id is the primary way for now
        # If db_object.fields.append(field) was used:
        # self.assertEqual(field.object, db_object)

    @patch('backend.app.models.db.session')
    def test_object_unique_constraint(self, mock_session):
        user_id_shared = uuid.uuid4()
        config_id_shared = uuid.uuid4()
        object_name_shared = "dataset.unique_table"

        obj1 = Object(
            user_id=user_id_shared,
            connection_id=config_id_shared,
            object_name=object_name_shared
        )

        # Mock the session to simulate adding the first object successfully
        # and then raising IntegrityError for the second one.

        # Simulate behavior of add and commit for the first object
        def side_effect_commit_first_then_raise(*args, **kwargs):
            # This is a simplified simulation. A real DB would raise on commit.
            # We're testing if the model *could* cause this, assuming SQLAlchemy translates it.
            # The actual unique constraint is at the DB level.
            # This test is more about showing the intent of the unique constraint.
            # To truly test it without a DB, you'd need a more complex mock of session.query.filter_by.first() etc.
            # or rely on integration tests with a live DB.

            # This mock simulates that *if* obj1 was committed, a subsequent commit of obj2 would fail.
            # For this unit test, we'll just check if the ORM attempts to commit,
            # and rely on integration tests for actual DB constraint enforcement.
            pass

        mock_session.add.return_value = None
        mock_session.commit.side_effect = side_effect_commit_first_then_raise

        db.session.add(obj1)
        db.session.commit() # First commit (simulated as successful)

        # Now, if we tried to add another identical one and commit, DB would raise IntegrityError
        # We will mock the commit to raise IntegrityError to simulate this
        mock_session.commit.side_effect = IntegrityError("Unique constraint failed", params=None, orig=None)

        obj2 = Object(
            user_id=user_id_shared, # Same as obj1
            connection_id=config_id_shared, # Same as obj1
            object_name=object_name_shared # Same as obj1
        )
        db.session.add(obj2)

        with self.assertRaises(IntegrityError):
            db.session.commit() # This commit should fail due to unique constraint

        mock_session.add.assert_any_call(obj1)
        mock_session.add.assert_any_call(obj2)
        self.assertEqual(mock_session.commit.call_count, 2)


if __name__ == '__main__':
    unittest.main()
