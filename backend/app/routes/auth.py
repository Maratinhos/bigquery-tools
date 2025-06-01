from flask import request, jsonify, current_app
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token, get_jwt_identity
from datetime import datetime, timedelta
from . import auth_bp
from .. import db
from ..models import User, Session

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify(message="Email and password are required"), 400

    email = data.get('email')
    password_candidate = data.get('password') # Client should send plain password, backend hashes for comparison

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify(message="Invalid credentials"), 401

    # The problem states "получается email и password (хеш)"
    # This is unusual. Typically, the client sends the raw password, and the server hashes it for comparison.
    # If the client IS sending a pre-hashed password, then the server needs to know the exact hashing algorithm
    # and salt used by the client, which is complex and less secure.
    # Assuming the client sends plain password and the server hashes it (standard practice):
    # if not user.check_password(password_candidate):
    #     return jsonify(message="Invalid credentials"), 401

    # If the client is indeed sending a hash, and you want to compare hash to hash:
    # This implies the client uses the SAME hashing as the server.
    # Let's assume for now the client sends plain password as it's more standard.
    # If client sends hash, then this line should be:
    # if user.password != password_candidate: # Assuming client sends already werkzeug-hashed pass
    # For now, let's stick to standard: client sends plain text.
    
    if not user.check_password(password_candidate):
         return jsonify(message="Invalid credentials"), 401

    # Create JWT token
    # The identity of the token will be the user's ID (UUID)
    access_token = create_access_token(identity=str(user.id)) # Ensure UUID is string for JWT
    
    # Calculate expiration based on Flask-JWT-Extended config
    expires_delta = current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
    expires_at = datetime.utcnow() + expires_delta

    # Store session in DB
    new_session = Session(user_id=user.id, token=access_token, expires_at=expires_at)
    db.session.add(new_session)
    db.session.commit()

    return jsonify(token=access_token, expires_at=expires_at.isoformat()), 200