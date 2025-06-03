from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from .models import Session, User
from datetime import datetime
from . import db # Ensure db is imported for use in decorator
import uuid # For converting string UUID to UUID object

def token_required_custom(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # verify_jwt_in_request() will raise specific exceptions if the token is
        # missing, invalid, expired, etc. Flask-JWT-Extended's default error
        # handlers should catch these and return appropriate JSON responses (e.g., 401, 422).
        verify_jwt_in_request()

        # If verify_jwt_in_request() passes, then proceed with our custom logic:
        auth_header = request.headers.get('Authorization')
        # Basic check, though verify_jwt_in_request(locations=['headers']) usually covers presence.
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify(message="Authorization header is missing or malformed."), 401

        token_from_header = auth_header.split(" ")[1]

        session_entry = db.session.query(Session).filter_by(token=token_from_header).first()

        if not session_entry:
            # Custom message for token not found in our DB session table
            return jsonify(message="Token not found in active sessions or has been revoked."), 401

        if session_entry.is_expired():
            # Custom message for token expired based on our DB session table
            return jsonify(message="Token has expired according to server session records."), 401

        user_id_from_jwt_str = get_jwt_identity()
        try:
            user_id_uuid = uuid.UUID(user_id_from_jwt_str)
        except ValueError:
            # This means the string from the JWT is not a valid UUID.
            # Log this as it might indicate a problem with token creation or a malformed token.
            # from flask import current_app # Already imported if needed for logging
            # current_app.logger.warning(f"Invalid UUID format for user identity in JWT: {user_id_from_jwt_str}")
            return jsonify(message="Invalid user identifier format in token."), 401
            
        current_user = db.session.get(User, user_id_uuid)
        if not current_user:
             # Custom message for user not found
             return jsonify(message="User associated with this token no longer exists."), 401
        
        # If all checks pass, execute the protected route function
        return fn(*args, **kwargs)
    return wrapper

# Simpler decorator if you only rely on JWT's own expiration and don't need DB session check
# from flask_jwt_extended import jwt_required
# def token_required_simple(fn):
#     @wraps(fn)
#     @jwt_required() # This is the decorator itself
#     def wrapper(*args, **kwargs):
#         # current_user_id = get_jwt_identity()
#         # kwargs['current_user'] = User.query.get(current_user_id) # Example of passing user
#         return fn(*args, **kwargs)
#     return wrapper
# No need to import specific JWT errors if we rely on default handlers