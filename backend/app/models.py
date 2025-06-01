import uuid
from datetime import datetime, timedelta
from sqlalchemy.dialects.postgresql import UUID, JSONB
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False) # Store hashed password

    sessions = db.relationship('Session', backref='user', lazy=True, cascade="all, delete-orphan")
    bigquery_configs = db.relationship('BigQueryConfig', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password_text):
        self.password = generate_password_hash(password_text)

    def check_password(self, password_text):
        return check_password_hash(self.password, password_text)

    def __repr__(self):
        return f'<User {self.email}>'

class Session(db.Model):
    __tablename__ = 'sessions'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.Text, nullable=False, unique=True) # JWT tokens can be long
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    def __init__(self, **kwargs):
        super(Session, self).__init__(**kwargs)
        if not self.expires_at:
            # Get expiration from JWT_ACCESS_TOKEN_EXPIRES (Flask-JWT-Extended config)
            from flask import current_app
            self.expires_at = datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']

    def is_expired(self):
        return datetime.utcnow() > self.expires_at

    def __repr__(self):
        return f'<Session {self.id} for User {self.user_id}>'

class BigQueryConfig(db.Model):
    __tablename__ = 'bigquery_configs'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    gcp_key_json = db.Column(JSONB, nullable=False) # Use JSONB for PostgreSQL
    connection_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'connection_name', name='uq_user_connection_name'),)


    def __repr__(self):
        return f'<BigQueryConfig {self.connection_name} for User {self.user_id}>'


class Object(db.Model):
    __tablename__ = 'objects'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    connection_id = db.Column(UUID(as_uuid=True), db.ForeignKey('bigquery_configs.id'), nullable=False)
    object_name = db.Column(db.String(255), nullable=False) # e.g., dataset_name.table_name or dataset_name.view_name
    object_description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    fields = db.relationship('Field', backref='object', lazy=True, cascade="all, delete-orphan")
    user = db.relationship('User', backref=db.backref('objects', lazy=True))
    connection = db.relationship('BigQueryConfig', backref=db.backref('objects', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'connection_id', 'object_name', name='uq_user_connection_object_name'),
    )

    def __repr__(self):
        return f'<Object {self.object_name} User {self.user_id} Connection {self.connection_id}>'


class Field(db.Model):
    __tablename__ = 'fields'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id = db.Column(UUID(as_uuid=True), db.ForeignKey('objects.id'), nullable=False)
    field_name = db.Column(db.String(255), nullable=False)
    field_description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # No explicit backref needed here for object, as it's already defined in Object model.

    def __repr__(self):
        return f'<Field {self.field_name} for Object {self.object_id}>'