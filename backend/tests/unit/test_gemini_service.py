import unittest
from unittest.mock import patch, MagicMock, PropertyMock
import os

# Adjust import to your project structure
from backend.app.services.gemini_service import GeminiService
# Assuming google.generativeai types might be needed for mocking response
import google.generativeai as genai
from google.generativeai.types import generación_types # Using an alias to avoid conflict if any
from google.generativeai.types import HarmCategory, HarmBlockThreshold, seguridad_types # Alias for safety types


# Mock Part object for generate_content response
class MockPart:
    def __init__(self, text):
        self.text = text

# Mock Content object for generate_content response
class MockContent:
    def __init__(self, text):
        self.parts = [MockPart(text)]

# Mock Candidate object for generate_content response
class MockCandidate:
    def __init__(self, text, finish_reason="STOP"):
        self.content = MockContent(text)
        self.finish_reason = finish_reason
        # Mocking safety_ratings if they are accessed, though not essential for basic text extraction
        self.safety_ratings = [
            seguridad_types.SafetyRating(category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, probability=seguridad_types.HarmProbability.NEGLIGIBLE)
        ]


class TestGeminiService(unittest.TestCase):

    DUMMY_API_KEY = "test_gemini_api_key"

    @patch('backend.app.services.gemini_service.genai.configure')
    @patch('backend.app.services.gemini_service.genai.GenerativeModel')
    def test_init_success(self, mock_generative_model, mock_configure):
        mock_model_instance = MagicMock()
        mock_generative_model.return_value = mock_model_instance

        service = GeminiService(api_key=self.DUMMY_API_KEY)

        mock_configure.assert_called_once_with(api_key=self.DUMMY_API_KEY)
        mock_generative_model.assert_called_once_with('gemini-1.5-flash-latest')
        self.assertIsNotNone(service.model)

    def test_init_no_api_key(self):
        with self.assertRaisesRegex(ValueError, "GEMINI_API_KEY is required"):
            GeminiService(api_key=None)
        with self.assertRaisesRegex(ValueError, "GEMINI_API_KEY is required"):
            GeminiService(api_key="")

    @patch('backend.app.services.gemini_service.genai.configure')
    def test_init_configure_fails(self, mock_configure):
        mock_configure.side_effect = Exception("Configuration failed")
        with self.assertRaisesRegex(ConnectionError, "Failed to configure Gemini API: Configuration failed"):
            GeminiService(api_key=self.DUMMY_API_KEY)

    @patch('backend.app.services.gemini_service.genai.GenerativeModel')
    @patch('backend.app.services.gemini_service.genai.configure') # Keep configure mocked
    def test_generate_sql_query_success(self, mock_configure, mock_generative_model_class):
        mock_model_instance = MagicMock()
        # Mock the response structure from Gemini API
        mock_gemini_response = MagicMock(spec=generación_types.GenerateContentResponse) # Use the type for spec
        mock_gemini_response.candidates = [MockCandidate("SELECT * FROM test_table;")]
        # Mock prompt_feedback if accessed in case of empty/blocked response
        mock_gemini_response.prompt_feedback = MagicMock(spec=seguridad_types.PromptFeedback)
        mock_gemini_response.prompt_feedback.block_reason = None

        mock_model_instance.generate_content.return_value = mock_gemini_response
        mock_generative_model_class.return_value = mock_model_instance

        service = GeminiService(api_key=self.DUMMY_API_KEY)
        user_request = "show me all users"
        objects_with_fields = [
            {
                'object_name': 'users.profiles',
                'object_description': 'Table with user profile data.',
                'fields': [
                    {'field_name': 'id', 'field_description': 'User ID'},
                    {'field_name': 'email', 'field_description': 'User email address'}
                ]
            }
        ]

        sql_query = service.generate_sql_query(user_request, objects_with_fields)

        self.assertEqual(sql_query, "SELECT * FROM test_table;")
        mock_model_instance.generate_content.assert_called_once()
        # You can also assert the prompt construction if needed by inspecting call_args
        # args, kwargs = mock_model_instance.generate_content.call_args
        # self.assertIn("Table `users.profiles`", args[0])
        # self.assertIn("User request: \"show me all users\"", args[0])

    @patch('backend.app.services.gemini_service.genai.GenerativeModel')
    @patch('backend.app.services.gemini_service.genai.configure')
    def test_generate_sql_query_api_error(self, mock_configure, mock_generative_model_class):
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.side_effect = Exception("Gemini API error")
        mock_generative_model_class.return_value = mock_model_instance

        service = GeminiService(api_key=self.DUMMY_API_KEY)
        sql_query = service.generate_sql_query("test request", [{'object_name': 't', 'fields': []}])

        self.assertIsNone(sql_query) # Service handles error by returning None

    @patch('backend.app.services.gemini_service.genai.GenerativeModel')
    @patch('backend.app.services.gemini_service.genai.configure')
    def test_generate_sql_query_empty_or_blocked_response(self, mock_configure, mock_generative_model_class):
        mock_model_instance = MagicMock()

        # Simulate empty candidates list
        mock_gemini_response_empty = MagicMock(spec=generación_types.GenerateContentResponse)
        mock_gemini_response_empty.candidates = []
        mock_gemini_response_empty.prompt_feedback = MagicMock(spec=seguridad_types.PromptFeedback)
        mock_gemini_response_empty.prompt_feedback.block_reason = seguridad_types.BlockReason.SAFETY

        mock_model_instance.generate_content.return_value = mock_gemini_response_empty
        mock_generative_model_class.return_value = mock_model_instance

        service = GeminiService(api_key=self.DUMMY_API_KEY)
        sql_query = service.generate_sql_query("test request", [{'object_name': 't', 'fields': []}])

        self.assertIsNone(sql_query)

    def test_generate_sql_query_input_validation(self):
        service = GeminiService(api_key=self.DUMMY_API_KEY) # Assuming init works
        self.assertIsNone(service.generate_sql_query("", [{'object_name': 't'}]))
        self.assertIsNone(service.generate_sql_query("req", []))
        self.assertIsNone(service.generate_sql_query("req", None))


    @patch('backend.app.services.gemini_service.genai.GenerativeModel')
    @patch('backend.app.services.gemini_service.genai.configure')
    def test_generate_sql_query_markdown_cleanup(self, mock_configure, mock_generative_model_class):
        mock_model_instance = MagicMock()

        # Test various markdown formats
        responses = [
            ("```sql\nSELECT 1;\n```", "SELECT 1;"),
            ("```\nSELECT 2;\n```", "SELECT 2;"),
            ("SELECT 3;", "SELECT 3;"),
            ("  ```sql\nSELECT 4;\n```  ", "SELECT 4;")
        ]

        for raw_response_text, expected_sql in responses:
            mock_gemini_response = MagicMock(spec=generación_types.GenerateContentResponse)
            mock_gemini_response.candidates = [MockCandidate(raw_response_text)]
            mock_gemini_response.prompt_feedback = MagicMock(spec=seguridad_types.PromptFeedback)
            mock_gemini_response.prompt_feedback.block_reason = None
            mock_model_instance.generate_content.return_value = mock_gemini_response
            mock_generative_model_class.return_value = mock_model_instance

            service = GeminiService(api_key=self.DUMMY_API_KEY)
            sql_query = service.generate_sql_query("test", [{'object_name': 't', 'fields': []}])
            self.assertEqual(sql_query, expected_sql, f"Failed for raw response: {raw_response_text}")


if __name__ == '__main__':
    unittest.main()
