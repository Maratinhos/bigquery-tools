from flask import Blueprint

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Import routes to register them with the blueprint
from . import auth, api