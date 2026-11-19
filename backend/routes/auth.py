import re
import bcrypt
from flask import Blueprint, request, jsonify, current_app
from pymongo.errors import DuplicateKeyError

from utils.auth import generate_token

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None


@auth_bp.route('/register', methods=['POST'])
def register():
    data = _json_body()
    if data is None:
        return jsonify({'error': 'A valid JSON request body is required'}), 400
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    division = data.get('division')
    if not all(isinstance(v, str) and v.strip() for v in (username, password, email, division)):
        return jsonify({'error': 'username, password, email, and division are required'}), 400
    username, email, division = username.strip(), email.strip().lower(), division.strip()
    if len(username) < 3 or len(username) > 40:
        return jsonify({'error': 'Username must be between 3 and 40 characters'}), 400
    if len(password) < 8 or len(password).encode('utf-8').__len__() > 72:
        return jsonify({'error': 'Password must be at least 8 characters and no more than 72 bytes'}), 400
    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return jsonify({'error': 'A valid email address is required'}), 400
    if len(division) > 80:
        return jsonify({'error': 'Division is too long'}), 400
    db = current_app.config['db']
    if db.users.find_one({'$or': [{'username': username}, {'email': email}]}, {'_id': 1}):
        return jsonify({'error': 'Username or email already exists'}), 409
    user = {
        'username': username,
        'password': bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()),
        'email': email,
        'division': division,
        # Public registration must never grant elevated privileges.
        'role': 'user',
    }
    try:
        result = db.users.insert_one(user)
    except DuplicateKeyError:
        return jsonify({'error': 'Username or email already exists'}), 409
    return jsonify({'message': 'User registered successfully', 'user_id': str(result.inserted_id)}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = _json_body()
    if data is None:
        return jsonify({'error': 'A valid JSON request body is required'}), 400
    username, password = data.get('username'), data.get('password')
    if not isinstance(username, str) or not isinstance(password, str) or not username or not password:
        return jsonify({'error': 'username and password are required'}), 400
    if len(password.encode('utf-8')) > 72:
        return jsonify({'error': 'Invalid credentials'}), 401
    user = current_app.config['db'].users.find_one({'username': username.strip()})
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    token = generate_token(user['_id'], current_app.config['SECRET_KEY'])
    return jsonify({'token': token, 'user': {
        'id': str(user['_id']), 'username': user['username'],
        'division': user['division'], 'role': user.get('role', 'user'),
    }}), 200
