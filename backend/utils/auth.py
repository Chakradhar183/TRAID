import datetime
from functools import wraps

import jwt
from bson import ObjectId
from flask import current_app, jsonify, request


def generate_token(user_id, secret_key):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode(
        {'user_id': str(user_id), 'iat': now, 'exp': now + datetime.timedelta(hours=24)},
        secret_key,
        algorithm='HS256',
    )


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        scheme, _, token = header.partition(' ')
        if scheme.lower() != 'bearer' or not token.strip():
            return jsonify({'error': 'Bearer token is required'}), 401
        try:
            payload = jwt.decode(token.strip(), current_app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload.get('user_id')
            if not user_id or not ObjectId.is_valid(user_id):
                return jsonify({'error': 'Invalid token'}), 401
            user = current_app.config['db'].users.find_one({'_id': ObjectId(user_id)})
            if user is None:
                return jsonify({'error': 'User account not found'}), 401
            request.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if request.current_user.get('role') != 'admin':
            return jsonify({'error': 'Administrator access required'}), 403
        return f(*args, **kwargs)
    return decorated
