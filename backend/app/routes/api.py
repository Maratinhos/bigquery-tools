import json
from flask import request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity
from . import api_bp
from .. import db
from ..models import User, BigQueryConfig, Session
from ..utils import token_required_custom # Using our custom decorator
from ..services.bigquery_service import BigQueryService

# Helper to get current user from JWT (after token_required_custom has run)
def get_current_user_from_jwt():
    user_id_str = get_jwt_identity()
    return User.query.get(user_id_str)


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