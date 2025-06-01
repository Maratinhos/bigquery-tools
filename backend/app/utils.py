from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from .models import Session, User
from datetime import datetime

def token_required_custom(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request() # Verifies JWT signature and basic claims like 'exp'
            
            # Additionally, check if token exists in our DB session table and is not expired there
            # This allows for server-side "revocation" by deleting the session or custom expiry logic
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify(message="Authorization header is missing or malformed"), 401
            
            token_from_header = auth_header.split(" ")[1]
            
            session_entry = Session.query.filter_by(token=token_from_header).first()
            
            if not session_entry:
                return jsonify(message="Token not found in active sessions or revoked."), 401
            
            if session_entry.is_expired():
                # Optionally, clean up expired sessions
                # from . import db
                # db.session.delete(session_entry)
                # db.session.commit()
                return jsonify(message="Token has expired (DB)."), 401

            user_id_from_jwt = get_jwt_identity() # This is the user.id (UUID)
            current_user = User.query.get(user_id_from_jwt)
            if not current_user:
                 return jsonify(message="User associated with token not found."), 401
            
            # Pass current_user or user_id to the protected route if needed
            # For simplicity, just proceed if valid
        except Exception as e: # Catches JWT errors too (e.g., ExpiredSignatureError, InvalidTokenError)
            return jsonify(message=f"Invalid token: {str(e)}"), 401
        
        return fn(*args, **kwargs)
    return wrapper

# Simpler decorator if you only rely on JWT's own expiration and don't need DB session check
# from flask_jwt_extended import jwt_required
# def token_required_simple(fn):
#     @wraps(fn)
#     @jwt_required()
#     def wrapper(*args, **kwargs):
#         return fn(*args, **kwargs)
#     return wrapper