import os
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from .config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Import and register blueprints here
    from .routes.auth import auth_bp
    from .routes.api import api_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(api_bp, url_prefix='/api')

    # Import models to ensure they are known to Flask-Migrate
    from . import models

    # Custom CLI command to create initial user
    @app.cli.command("create-initial-user")
    def create_initial_user_command():
        """Creates the initial admin user."""
        from .models import User
        from werkzeug.security import generate_password_hash

        email = app.config['INITIAL_ADMIN_EMAIL']
        password = app.config['INITIAL_ADMIN_PASSWORD']

        if User.query.filter_by(email=email).first():
            print(f"User {email} already exists.")
            return

        hashed_password = generate_password_hash(password)
        new_user = User(email=email, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()
        print(f"User {email} created successfully.")

    @app.route('/health')
    def health_check():
        # Basic health check
        try:
            # Try a simple DB query
            db.session.execute(db.text('SELECT 1'))
            return jsonify(status="UP", database="OK"), 200
        except Exception as e:
            return jsonify(status="DOWN", database="Error", error=str(e)), 500
        
    return app
