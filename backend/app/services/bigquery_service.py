import json
from google.oauth2 import service_account
from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPICallError

class BigQueryService:
    def __init__(self, gcp_key_json_str):
        try:
            key_data = json.loads(gcp_key_json_str) if isinstance(gcp_key_json_str, str) else gcp_key_json_str
            self.credentials = service_account.Credentials.from_service_account_info(key_data)
            self.project_id = self.credentials.project_id
            self.client = bigquery.Client(credentials=self.credentials, project=self.project_id)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid GCP JSON key format: {e}")
        except Exception as e:
            raise ValueError(f"Error initializing BigQuery client from key: {e}")

    def test_connection(self):
        try:
            # A simple way to test connection is to list datasets (limited to 1)
            self.client.list_datasets(max_results=1)
            return True, "Connection successful."
        except GoogleAPICallError as e:
            return False, f"BigQuery connection test failed: {e}"
        except Exception as e:
            return False, f"An unexpected error occurred during connection test: {e}"

    def dry_run_query(self, query):
        job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
        try:
            query_job = self.client.query(query, job_config=job_config)
            bytes_processed = query_job.total_bytes_processed
            gb_processed = bytes_processed / (1024 ** 3)
            return True, {"message": f"Query dry run successful. Estimated data to be processed: {gb_processed:.4f} GB.",
                          "bytes_processed": bytes_processed,
                          "gb_processed": gb_processed}
        except GoogleAPICallError as e:
            return False, {"message": f"BigQuery dry run failed: {e}"}
        except Exception as e:
            return False, {"message": f"An unexpected error occurred during dry run: {e}"}


    def execute_query(self, query):
        try:
            query_job = self.client.query(query)
            results = query_job.result()  # Waits for the job to complete.
            
            # Convert rows to list of dicts for JSON serialization
            rows_list = [dict(row) for row in results]
            
            return True, {"message": "Query executed successfully.", "data": rows_list}
        except GoogleAPICallError as e:
            return False, {"message": f"BigQuery query execution failed: {e}"}
        except Exception as e:
            return False, {"message": f"An unexpected error occurred during query execution: {e}"}