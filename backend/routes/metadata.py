from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from utils.auth import token_required

metadata_bp = Blueprint('metadata', __name__, url_prefix='/api/metadata')
DEFAULT_FIELDS = [
    {'field_name': 'Division', 'field_type': 'select', 'options': ['Division A', 'Division B', 'Division C'], 'required': False},
    {'field_name': 'Report Type', 'field_type': 'select', 'options': ['Financial', 'Technical', 'HR', 'Legal'], 'required': False},
]
FIELD_TYPES = {'text', 'select', 'date', 'number'}


def seed_default_fields(db):
    if db.metadata_fields.count_documents({}) == 0:
        db.metadata_fields.insert_many(DEFAULT_FIELDS)


def _valid_field(data):
    if not isinstance(data, dict):
        return 'A JSON object is required'
    name, kind = data.get('field_name'), data.get('field_type')
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80 or name.startswith('$') or '.' in name:
        return 'field_name must be a valid string of at most 80 characters'
    if kind not in FIELD_TYPES:
        return 'field_type must be one of: text, select, date, number'
    options = data.get('options', [])
    if kind == 'select' and (not isinstance(options, list) or len(options) > 100 or any(not isinstance(x, str) or len(x) > 100 for x in options)):
        return 'options must be a list of strings'
    if not isinstance(data.get('required', False), bool):
        return 'required must be a boolean'
    return None


@metadata_bp.get('/fields')
def get_fields():
    fields = list(current_app.config['db'].metadata_fields.find().sort('field_name', 1))
    return jsonify([{'_id': str(f['_id']), 'field_name': f['field_name'], 'field_type': f['field_type'], 'options': f.get('options', []), 'required': f.get('required', False)} for f in fields]), 200


@metadata_bp.post('/fields')
@token_required
def create_field():
    if request.current_user.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json(silent=True)
    error = _valid_field(data)
    if error:
        return jsonify({'error': error}), 400
    db = current_app.config['db']
    name = data['field_name'].strip()
    if db.metadata_fields.find_one({'field_name': name}):
        return jsonify({'error': 'A field with this name already exists'}), 409
    field = {'field_name': name, 'field_type': data['field_type'], 'options': data.get('options', []), 'required': data.get('required', False)}
    result = db.metadata_fields.insert_one(field)
    return jsonify({'message': 'Metadata field created', '_id': str(result.inserted_id)}), 201


@metadata_bp.route('/fields/<field_id>', methods=['PUT'])
@token_required
def update_field(field_id):
    if request.current_user.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    if not ObjectId.is_valid(field_id):
        return jsonify({'error': 'Invalid field ID'}), 400
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'A JSON object is required'}), 400
    db, oid = current_app.config['db'], ObjectId(field_id)
    existing = db.metadata_fields.find_one({'_id': oid})
    if not existing:
        return jsonify({'error': 'Field not found'}), 404
    merged = {**existing, **data}
    error = _valid_field(merged)
    if error:
        return jsonify({'error': error}), 400
    name = merged['field_name'].strip()
    if db.metadata_fields.find_one({'field_name': name, '_id': {'$ne': oid}}):
        return jsonify({'error': 'A field with this name already exists'}), 409
    update = {'field_name': name, 'field_type': merged['field_type'], 'options': merged.get('options', []), 'required': merged.get('required', False)}
    db.metadata_fields.update_one({'_id': oid}, {'$set': update})
    return jsonify({'message': 'Metadata field updated'}), 200


@metadata_bp.delete('/fields/<field_id>')
@token_required
def delete_field(field_id):
    if request.current_user.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    if not ObjectId.is_valid(field_id):
        return jsonify({'error': 'Invalid field ID'}), 400
    result = current_app.config['db'].metadata_fields.delete_one({'_id': ObjectId(field_id)})
    if not result.deleted_count:
        return jsonify({'error': 'Field not found'}), 404
    return jsonify({'message': 'Metadata field deleted'}), 200
