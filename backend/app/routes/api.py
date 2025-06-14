import json
import uuid # Added for UUID conversion
from flask import request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.exc import SQLAlchemyError
from . import api_bp
from .. import db
from ..models import User, BigQueryConfig, Session, Object, Field, GeminiAPIKey
from ..utils import token_required_custom
from ..services.bigquery_service import BigQueryService
from ..services.gemini_service import GeminiService # Import GeminiService

# Helper to get current user from JWT (after token_required_custom has run)
def get_current_user_from_jwt():
    user_id_str = get_jwt_identity()
    if not user_id_str:
        return None # Or raise an error, depending on expected behavior
    try:
        user_id_uuid = uuid.UUID(user_id_str)
    except ValueError:
        # Log error: user_id_str from JWT is not a valid UUID
        current_app.logger.warning(f"Invalid UUID format for user_id from JWT: {user_id_str}")
        return None # Or raise an error
    return db.session.get(User, user_id_uuid)


@api_bp.route('/data', methods=['GET'])
@token_required_custom
def get_data():
    # Example protected data
    current_user = get_current_user_from_jwt()
    return jsonify(message=f"Hello, {current_user.email}! This is protected data.",
                   user_id=current_user.id), 200


@api_bp.route('/data', methods=['POST'])
@token_required_custom
def post_data():
    current_user = get_current_user_from_jwt()
    data = request.get_json()
    if not data:
        return jsonify(message="No JSON data received"), 400

    # Process data (example)
    processed_data = {key: str(value).upper() for key, value in data.items()}
    
    return jsonify(message="Data processed successfully.",
                   original_data=data,
                   processed_data=processed_data,
                   user_id=current_user.id), 200


@api_bp.route('/config', methods=['GET'])
@token_required_custom
def get_configs():
    current_user = get_current_user_from_jwt()
    configs = BigQueryConfig.query.filter_by(user_id=current_user.id).all()

    configs_list = []
    for config_item in configs:
        configs_list.append({
            "id": str(config_item.id),  # Ensure id is string
            "connection_name": config_item.connection_name
            # Add other fields if necessary, but problem asks for at least these two
        })

    return jsonify(configs_list), 200


@api_bp.route('/config', methods=['POST'])
@token_required_custom
def upload_config():
    current_user = get_current_user_from_jwt()
    
    # Check if it's a multipart/form-data request for a file
    if 'gcp_key_file' in request.files:
        file = request.files['gcp_key_file']
        if file.filename == '':
            return jsonify(message="No selected file for GCP key"), 400
        try:
            gcp_key_json_str = file.read().decode('utf-8')
            gcp_key_json_data = json.loads(gcp_key_json_str) # Validate JSON structure
        except json.JSONDecodeError:
            return jsonify(message="Invalid JSON format in GCP key file"), 400
        except Exception as e:
            return jsonify(message=f"Error reading GCP key file: {str(e)}"), 400
        
        connection_name = request.form.get('connection_name')

    # Check if it's a JSON payload
    elif request.is_json:
        data = request.get_json()
        gcp_key_json_data = data.get('gcp_key_json')
        connection_name = data.get('connection_name')
        if not isinstance(gcp_key_json_data, dict): # Or check for specific keys if needed
            return jsonify(message="gcp_key_json must be a JSON object"), 400
    else:
        return jsonify(message="Unsupported content type. Use multipart/form-data with 'gcp_key_file' and 'connection_name' or application/json with 'gcp_key_json' and 'connection_name'."), 415


    if not connection_name:
        return jsonify(message="connection_name is required"), 400
    if not gcp_key_json_data:
        return jsonify(message="gcp_key_json (or gcp_key_file) is required"), 400

    # Check for existing connection with the same name for this user
    existing_config = BigQueryConfig.query.filter_by(user_id=current_user.id, connection_name=connection_name).first()
    if existing_config:
        return jsonify(message=f"A connection named '{connection_name}' already exists."), 409 # 409 Conflict

    try:
        new_config = BigQueryConfig(
            user_id=current_user.id,
            gcp_key_json=gcp_key_json_data, # Store the parsed JSON object
            connection_name=connection_name
        )
        db.session.add(new_config)
        db.session.commit()
        return jsonify(message="BigQuery configuration saved successfully.", id=str(new_config.id)), 201
    except Exception as e:
        db.session.rollback()
        # Consider more specific error handling (e.g., unique constraint violation if not caught above)
        return jsonify(message=f"Failed to save configuration: {str(e)}"), 500


@api_bp.route('/config_test', methods=['POST'])
@token_required_custom
def test_config():
    current_user = get_current_user_from_jwt()
    data = request.get_json()
    if not data or not data.get('id'):
        return jsonify(message="Connection ID ('id') is required."), 400

    config_id = data.get('id')
    config = BigQueryConfig.query.filter_by(id=config_id, user_id=current_user.id).first()

    if not config:
        return jsonify(message="Configuration not found or access denied."), 404

    try:
        # The gcp_key_json is stored as a dict/JSONB, pass it directly
        bq_service = BigQueryService(config.gcp_key_json)
        success, message = bq_service.test_connection()
        if success:
            return jsonify(message=message), 200
        else:
            return jsonify(message=message), 400
    except ValueError as e: # From BigQueryService init
        return jsonify(message=str(e)), 400
    except Exception as e:
        return jsonify(message=f"An unexpected error occurred: {str(e)}"), 500


@api_bp.route('/settings/gemini-api-key', methods=['POST'])
@jwt_required()
def set_gemini_api_key():
    # The task implies this might be an admin-only action in the future.
    # For now, any authenticated user can set it as per problem description.
    # If admin check is needed, it would be:
    # current_user_obj = get_current_user_from_jwt()
    # if not current_user_obj or not current_user_obj.is_admin: # Assuming an is_admin flag
    #     return jsonify(message="Admin access required."), 403

    data = request.get_json()
    if not data or not data.get('api_key'):
        return jsonify(message="api_key is required in JSON payload."), 400

    api_key_value = data.get('api_key')
    if not isinstance(api_key_value, str) or len(api_key_value.strip()) == 0:
        return jsonify(message="api_key must be a non-empty string."), 400

    # The GeminiAPIKey model does not associate keys with users,
    # implying a single, system-wide key.
    try:
        gemini_api_key_entry = GeminiAPIKey.query.first()

        if gemini_api_key_entry:
            gemini_api_key_entry.api_key = api_key_value
            current_app.logger.info("Updated existing Gemini API Key.")
        else:
            gemini_api_key_entry = GeminiAPIKey(api_key=api_key_value)
            db.session.add(gemini_api_key_entry)
            current_app.logger.info("Created new Gemini API Key entry.")

        db.session.commit()
        return jsonify(message="Gemini API Key saved successfully."), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.error(f"Database error saving Gemini API Key: {str(e)}")
        return jsonify(message=f"Failed to save Gemini API Key due to a database error: {str(e)}"), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Unexpected error saving Gemini API Key: {str(e)}")
        return jsonify(message=f"An unexpected error occurred: {str(e)}"), 500


@api_bp.route('/settings/gemini-api-key', methods=['GET'])
@jwt_required()
def get_gemini_api_key():
    # Future: Add admin check if roles are implemented
    # current_user_obj = get_current_user_from_jwt()
    # if not current_user_obj or not current_user_obj.is_admin:
    #     return jsonify(message="Admin access required."), 403

    try:
        gemini_api_key_entry = GeminiAPIKey.query.first()

        if gemini_api_key_entry:
            return jsonify(api_key=gemini_api_key_entry.api_key), 200
        else:
            return jsonify(message="Gemini API Key not set."), 404

    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error retrieving Gemini API Key: {str(e)}")
        return jsonify(message=f"Failed to retrieve Gemini API Key due to a database error: {str(e)}"), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error retrieving Gemini API Key: {str(e)}")
        return jsonify(message=f"An unexpected error occurred: {str(e)}"), 500


@api_bp.route('/table_schema', methods=['POST'])
@token_required_custom
def get_table_schema_endpoint():
    current_user = get_current_user_from_jwt()
    data = request.get_json()

    if not data:
        return jsonify(message="Request body must be JSON."), 400

    connection_id = data.get('connection_id')
    object_name = data.get('object_name') # Expected format: dataset_id.table_id

    if not connection_id:
        return jsonify(message="connection_id is required."), 400
    if not object_name:
        return jsonify(message="object_name is required (e.g., 'dataset_id.table_id')."), 400

    # Basic validation for object_name format
    if '.' not in object_name or len(object_name.split('.')) != 2:
        return jsonify(message="Invalid object_name format. Expected 'dataset_id.table_id'."), 400

    # Fetch BigQueryConfig
    config = BigQueryConfig.query.filter_by(id=connection_id, user_id=current_user.id).first()
    if not config:
        return jsonify(message="BigQuery configuration not found or access denied."), 404

    try:
        bq_service = BigQueryService(config.gcp_key_json)
        success, result = bq_service.get_table_schema(object_name)

        if success:
            return jsonify(schema=result), 200
        else:
            # result already contains a 'message' key from the service
            # Determine appropriate status code based on error if possible,
            # otherwise default to 500 or 400 if it's a known client-side issue.
            # The service method tries to give specific error for 404s from BQ.
            if "not found" in result.get("message", "").lower():
                 return jsonify(result), 404 # Pass BQ's 404 message through
            return jsonify(result), 500 # For other BQ errors or unexpected errors in service

    except ValueError as e: # From BigQueryService init (e.g. bad key)
        return jsonify(message=str(e)), 400
    except Exception as e:
        current_app.logger.error(f"Unexpected error in /table_schema: {str(e)}")
        return jsonify(message=f"An unexpected server error occurred: {str(e)}"), 500


@api_bp.route('/table_schema_update', methods=['POST'])
@token_required_custom
def update_table_schema_description():
    current_user = get_current_user_from_jwt()
    data = request.get_json()

    if not data:
        return jsonify(message="Request body must be JSON."), 400

    connection_id = data.get('connection_id')
    object_name = data.get('object_name')
    object_description = data.get('object_description') # Optional
    fields_data = data.get('fields') # Optional, list of dicts

    if not connection_id:
        return jsonify(message="connection_id is required."), 400
    if not object_name:
        return jsonify(message="object_name is required."), 400

    if fields_data is not None and not isinstance(fields_data, list):
        return jsonify(message="fields must be a list of objects."), 400

    # Fetch BigQueryConfig to ensure connection_id is valid for the user
    config = BigQueryConfig.query.filter_by(id=connection_id, user_id=current_user.id).first()
    if not config:
        return jsonify(message="BigQuery configuration not found or access denied."), 404

    try:
        # Find existing Object or create a new one
        db_object = Object.query.filter_by(
            user_id=current_user.id,
            connection_id=config.id, # Use validated config.id
            object_name=object_name
        ).first()

        if not db_object:
            db_object = Object(
                user_id=current_user.id,
                connection_id=config.id,
                object_name=object_name,
                object_description=object_description
            )
            db.session.add(db_object)
            # We need to flush to get db_object.id if it's new, for fields.
            # Or commit here and start a new transaction if issues arise with partial commits.
            # For simplicity, let's try adding all and committing once. If new, its ID will be available after flush.
            db.session.flush() # Ensure db_object.id is populated if new
        elif 'object_description' in data: # Only update if key is present
            db_object.object_description = object_description

        if fields_data:
            for field_info in fields_data:
                field_name = field_info.get('field_name')
                field_description = field_info.get('field_description')

                if not field_name:
                    # Or handle more gracefully, e.g. skip this field
                    db.session.rollback()
                    return jsonify(message="field_name is required for each field in fields list."), 400

                db_field = Field.query.filter_by(
                    object_id=db_object.id, # Requires db_object to have an ID (flush if new)
                    field_name=field_name
                ).first()

                if not db_field:
                    new_field = Field(
                        object_id=db_object.id,
                        field_name=field_name,
                        field_description=field_description
                    )
                    db.session.add(new_field)
                elif 'field_description' in field_info: # Only update if key is present
                    db_field.field_description = field_description

        db.session.commit()
        return jsonify(message="Description updated successfully.", object_id=str(db_object.id)), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.error(f"Database error in /table_schema_update: {str(e)}")
        return jsonify(message=f"A database error occurred: {str(e)}"), 500
    except Exception as e:
        db.session.rollback() # Rollback on any other errors too
        current_app.logger.error(f"Unexpected error in /table_schema_update: {str(e)}")
        return jsonify(message=f"An unexpected server error occurred: {str(e)}"), 500


@api_bp.route('/objects_with_fields', methods=['GET'])
@token_required_custom
def get_objects_with_fields():
    current_user = get_current_user_from_jwt()
    try:
        user_objects = Object.query.filter_by(user_id=current_user.id).all()
        result = []
        for obj in user_objects:
            fields_list = []
            for field in obj.fields: # Accessing the related Field objects
                fields_list.append({
                    "id": str(field.id),
                    "field_name": field.field_name,
                    "field_description": field.field_description if field.field_description is not None else ""
                })

            result.append({
                "id": str(obj.id),
                "connection_id": str(obj.connection_id),
                "object_name": obj.object_name,
                "object_description": obj.object_description if obj.object_description is not None else "",
                "fields": fields_list
            })
        return jsonify(result), 200
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in /objects_with_fields: {str(e)}")
        return jsonify(message=f"A database error occurred: {str(e)}"), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error in /objects_with_fields: {str(e)}")
        return jsonify(message=f"An unexpected server error occurred: {str(e)}"), 500


@api_bp.route('/generate_sql_from_natural_language', methods=['POST'])
@token_required_custom
def generate_sql_from_natural_language():
    current_user = get_current_user_from_jwt()
    data = request.get_json()

    if not data:
        return jsonify(message="Request body must be JSON."), 400

    user_request_text = data.get('user_request')
    connection_id = data.get('connection_id')
    object_names = data.get('object_names') # List of strings like "dataset.table"

    if not user_request_text:
        return jsonify(message="user_request is required."), 400
    if not connection_id:
        return jsonify(message="connection_id is required."), 400

    # Validate object_names if provided
    if object_names is not None: # Allows object_names to be explicitly null or an empty list
        if not isinstance(object_names, list) or not all(isinstance(name, str) for name in object_names):
            return jsonify(message="If provided, object_names must be a list of strings."), 400

    # Fetch the BigQueryConfig to ensure the connection_id is valid for the user
    config = BigQueryConfig.query.filter_by(id=connection_id, user_id=current_user.id).first()
    if not config:
        return jsonify(message="BigQuery configuration not found or access denied."), 404

    objects_with_fields_data = []
    # If object_names is provided and not empty, use them
    if object_names and len(object_names) > 0:
        current_app.logger.info(f"Processing request for specific object_names: {object_names} for user {current_user.id} and connection {config.id}")
        for obj_name_full in object_names:
            db_object = Object.query.filter_by(
                user_id=current_user.id,
                connection_id=config.id,
                object_name=obj_name_full
            ).first()

            obj_data = {'object_name': obj_name_full, 'object_description': None, 'fields': []}
            if db_object:
                obj_data['object_description'] = db_object.object_description
                for db_field in db_object.fields:
                    obj_data['fields'].append({
                        'field_name': db_field.field_name,
                        'field_description': db_field.field_description
                    })
            else:
                current_app.logger.warn(f"Object '{obj_name_full}' not found in local metadata for user {current_user.id} and connection {config.id} when specific list provided.")
            objects_with_fields_data.append(obj_data)

        if not objects_with_fields_data: # Should not happen if object_names was not empty, but as a safeguard
             current_app.logger.warn(f"No schema data could be prepared for the given object_names: {object_names} (user {current_user.id}, conn {config.id})")
             # Return 400 or let Gemini handle empty list? For now, let Gemini handle it.
    else:
        # If object_names is missing, null, or an empty list, fetch all objects for the connection
        current_app.logger.info(f"Processing request for all objects for user {current_user.id} and connection {config.id}")
        all_db_objects = Object.query.filter_by(user_id=current_user.id, connection_id=config.id).all()

        if not all_db_objects:
            current_app.logger.warn(f"No objects found in local metadata for user {current_user.id} and connection {config.id} when fetching all.")
            # objects_with_fields_data will remain empty, Gemini will handle it.
        else:
            for db_object in all_db_objects:
                obj_data = {
                    'object_name': db_object.object_name,
                    'object_description': db_object.object_description,
                    'fields': []
                }
                for db_field in db_object.fields:
                    obj_data['fields'].append({
                        'field_name': db_field.field_name,
                        'field_description': db_field.field_description
                    })
                objects_with_fields_data.append(obj_data)

    # It's possible objects_with_fields_data is empty here if no specific objects found,
    # or no objects at all for the connection. This is acceptable for Gemini.
    # A more user-friendly approach might be to return a 404 or specific message if it's empty.
    # For now, we proceed as per current design.
    if not objects_with_fields_data:
        current_app.logger.info(f"No schema information (objects_with_fields_data is empty) being sent to Gemini for user {current_user.id}, connection {config.id}.")
        # Consider if a more explicit error/message should be returned to the user here.
        # For example: return jsonify(message="No schema information available for the selected connection or objects."), 404
        # However, the current spec is to let Gemini handle it.

    # Initialize GeminiService
    # IMPORTANT: Using a hardcoded key for this task as requested.
    # In a real application, this should come from current_app.config['GEMINI_API_KEY']
    # and proper error handling if the key is missing from config.
    temp_gemini_api_key = "AIzaSyD5b0iMYgXVCgTOX4y-1YQNXmjwnHGPZ1o" # TEMPORARY

    # Proper way:
    # gemini_api_key = current_app.config.get('GEMINI_API_KEY')
    # if not gemini_api_key:
    #     current_app.logger.error("GEMINI_API_KEY is not configured on the server.")
    #     return jsonify(message="AI service is not configured."), 500

    try:
        # gemini_service = GeminiService() # Proper way
        gemini_service = GeminiService() # Using temporary key
    except ValueError as ve: # If API key is missing in GeminiService init
        current_app.logger.error(f"GeminiService initialization error: {ve}")
        return jsonify(message=f"AI service initialization error: {ve}"), 500
    except ConnectionError as ce: # If genai.configure fails
        current_app.logger.error(f"GeminiService connection error: {ce}")
        return jsonify(message=f"AI service connection error: {ce}"), 500

    try:
        result = gemini_service.generate_sql_query(user_request_text, objects_with_fields_data)

        if result and result.get('sql'):
            return jsonify(generated_sql=result['sql'], full_prompt_string=result['full_prompt']), 200
        elif result and result.get('full_prompt'):
            # SQL generation failed, but we have the prompt
            current_app.logger.warning(f"GeminiService returned None for SQL, but prompt was generated for user request: {user_request_text}")
            return jsonify(message="Could not generate SQL query. The AI service might have failed or found the request unclear.", full_prompt_string=result['full_prompt']), 422
        else:
            # This 'else' means result is None (e.g. invalid input to service) or prompt itself is missing
            current_app.logger.warning(f"GeminiService returned None or invalid result for user request: {user_request_text}")
            return jsonify(message="Could not generate SQL query due to an internal error or invalid input before AI processing."), 422

    except Exception as e:
        # This would catch errors not handled within GeminiService.generate_sql_query
        current_app.logger.error(f"Error during Gemini SQL generation: {str(e)}")
        return jsonify(message=f"An error occurred while generating the SQL query: {str(e)}"), 500


@api_bp.route('/dry-run', methods=['POST'])
@token_required_custom
def dry_run_query():
    current_user = get_current_user_from_jwt()
    data = request.get_json()
    if not data or not data.get('id') or not data.get('query'):
        return jsonify(message="Connection ID ('id') and SQL query ('query') are required."), 400

    config_id = data.get('id')
    sql_query = data.get('query')
    config = BigQueryConfig.query.filter_by(id=config_id, user_id=current_user.id).first()

    if not config:
        return jsonify(message="Configuration not found or access denied."), 404

    try:
        bq_service = BigQueryService(config.gcp_key_json)
        success, result = bq_service.dry_run_query(sql_query)
        if success:
            # result already contains the message and data
            return jsonify(result), 200
        else:
            # result contains the error message
            return jsonify(result), 400
    except ValueError as e: # From BigQueryService init
        return jsonify(message=str(e)), 400
    except Exception as e:
        return jsonify(message=f"An unexpected error occurred: {str(e)}"), 500


@api_bp.route('/config/<uuid:config_id>', methods=['DELETE'])
@token_required_custom
def delete_config(config_id):
    current_user = get_current_user_from_jwt()

    # config_id is already a UUID object from the path converter
    # current_user.id is also a UUID object
    config_to_delete = BigQueryConfig.query.filter_by(id=config_id, user_id=current_user.id).first()

    if not config_to_delete:
        return jsonify(message="Configuration not found or access denied."), 404

    try:
        # Associated objects and fields should be handled by cascade delete if set up in models.
        # If not, they would need to be manually deleted here or handled by a DB trigger.
        # For now, assuming cascade is in place or will be handled separately if errors arise.
        db.session.delete(config_to_delete)
        db.session.commit()
        # 204 No Content is often used for successful DELETE requests with no body
        # However, the task asks for a success message, so 200 is also fine. Let's use 200.
        return jsonify(message="Configuration deleted successfully."), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        current_app.logger.error(f"Database error deleting configuration {config_id}: {str(e)}")
        return jsonify(message=f"Failed to delete configuration due to a database error: {str(e)}"), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Unexpected error deleting configuration {config_id}: {str(e)}")
        return jsonify(message=f"An unexpected error occurred: {str(e)}"), 500


@api_bp.route('/query', methods=['POST'])
@token_required_custom
def execute_bq_query():
    current_user = get_current_user_from_jwt()
    data = request.get_json()
    if not data or not data.get('id') or not data.get('query'):
        return jsonify(message="Connection ID ('id') and SQL query ('query') are required."), 400

    config_id = data.get('id')
    sql_query = data.get('query')
    config = BigQueryConfig.query.filter_by(id=config_id, user_id=current_user.id).first()

    if not config:
        return jsonify(message="Configuration not found or access denied."), 404

    try:
        bq_service = BigQueryService(config.gcp_key_json)
        success, result = bq_service.execute_query(sql_query)
        if success:
            # result contains message and data
            return jsonify(result), 200
        else:
            # result contains error message
            return jsonify(result), 400
    except ValueError as e: # From BigQueryService init
        return jsonify(message=str(e)), 400
    except Exception as e:
        return jsonify(message=f"An unexpected error occurred: {str(e)}"), 500