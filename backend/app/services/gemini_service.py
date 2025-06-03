import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
import logging

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self, api_key):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required to initialize GeminiService.")
        try:
            genai.configure(api_key=api_key)
            # TODO: Consider making model name configurable
            self.model = genai.GenerativeModel('gemini-1.5-flash-latest') # Using gemini-1.5-flash for speed and cost
            logger.info("GeminiService initialized successfully.")
        except Exception as e:
            logger.error(f"Error initializing Gemini API: {e}")
            raise ConnectionError(f"Failed to configure Gemini API: {e}")

    def generate_sql_query(self, user_request: str, objects_with_fields: list):
        """
        Generates a BigQuery SQL query based on user request and table structures.

        Args:
            user_request (str): The natural language request from the user.
            objects_with_fields (list): A list of dictionaries, where each dict describes an object (table/view).
                Expected format for each dict:
                {
                    'object_name': 'dataset.table',
                    'object_description': 'Description of the table/view.',
                    'fields': [
                        {'field_name': 'column1', 'field_description': 'Description of column1.'},
                        {'field_name': 'column2', 'field_description': 'Description of column2.'},
                        ...
                    ]
                }

        Returns:
            dict: A dictionary with 'sql' (str, the generated query or None) and
                  'full_prompt' (str, the prompt sent to Gemini), or None if
                  critical input like user_request or objects_with_fields is missing.
        """
        if not user_request:
            return None # Or raise ValueError("User request cannot be empty.")
        if not objects_with_fields:
            return None # Or raise ValueError("Table/view information must be provided.")

        prompt_parts = [
            "Based on the following table structures and user request, generate a BigQuery SQL query.",
            "Return ONLY the SQL query and nothing else. Do not include any introductory text, explanations, or markdown formatting like ```sql ... ```.",
            "Ensure the query is valid BigQuery SQL syntax."
        ]

        for obj_info in objects_with_fields:
            table_prompt = f"\nTable `{obj_info.get('object_name', 'N/A')}`"
            if obj_info.get('object_description'):
                table_prompt += f" (Description: {obj_info['object_description']}):"
            else:
                table_prompt += ":"

            fields_prompt_parts = []
            if obj_info.get('fields'):
                for field in obj_info['fields']:
                    field_str = f"- `{field.get('field_name', 'N/A')}`"
                    if field.get('field_description'):
                        field_str += f" (Description: {field['field_description']})"
                    fields_prompt_parts.append(field_str)

            if fields_prompt_parts:
                table_prompt += "\n" + "\n".join(fields_prompt_parts)
            else:
                table_prompt += "\n- (No field information available for this table)"
            prompt_parts.append(table_prompt)

        prompt_parts.append(f"\nUser request: \"{user_request}\"")
        prompt_parts.append("\nGenerated BigQuery SQL Query:")

        final_prompt = "\n".join(prompt_parts)
        logger.debug(f"Gemini Prompt: \n{final_prompt}")

        try:
            # Safety settings to try and avoid refusals for benign SQL
            # (Though for SQL generation, harmful content is less likely an issue than refusal)
            # It's important to test these settings.
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }

            response = self.model.generate_content(
                final_prompt,
                safety_settings=safety_settings,
                generation_config=genai.types.GenerationConfig(
                    # Only one candidate for now
                    candidate_count=1,
                    # Stop sequences - might not be needed if prompt is clear
                    # stop_sequences=[';'], # Example: if it tends to add comments after semicolon
                    # Max output tokens - adjust as needed for query complexity
                    max_output_tokens=1024,
                    temperature=0.1 # Lower temperature for more deterministic SQL
                )
            )

            if response.candidates:
                generated_sql = response.candidates[0].content.parts[0].text.strip()
                # Clean up potential markdown
                if generated_sql.lower().startswith("```sql"):
                    generated_sql = generated_sql[5:]
                if generated_sql.lower().startswith("```"): # Catch if only ``` is used
                    generated_sql = generated_sql[3:]
                if generated_sql.endswith("```"):
                    generated_sql = generated_sql[:-3]

                logger.info(f"Successfully generated SQL query: {generated_sql}")
                return {'sql': generated_sql.strip(), 'full_prompt': final_prompt}
            else:
                # Handle cases where response might be blocked or has no candidates
                # This can happen if safety settings block the response despite BLOCK_NONE (unlikely for SQL)
                # or other generation issues.
                block_reason = response.prompt_feedback.block_reason if response.prompt_feedback else "Unknown"
                logger.warning(f"Gemini response was empty or blocked. Block reason: {block_reason}. Prompt feedback: {response.prompt_feedback}")

                # Attempt to get more info if parts are empty but candidate exists
                if response.candidates and not response.candidates[0].content.parts:
                     logger.warning(f"Candidate exists but content parts are empty. Candidate finish reason: {response.candidates[0].finish_reason}")

                return {'sql': None, 'full_prompt': final_prompt}

        except Exception as e:
            logger.error(f"Error generating SQL query with Gemini: {e}")
            # Depending on how you want to signal this error to the caller:
            # raise  # Re-raise the exception to be caught by the endpoint
            return {'sql': None, 'full_prompt': final_prompt}
