import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app
from pymongo import ReturnDocument
from utils.auth import token_required

access_bp = Blueprint('access', __name__, url_prefix='/api/access')


def _id(value):
    return ObjectId(value) if isinstance(value, str) and ObjectId.is_valid(value) else None


def _serialize(req, filename='Unknown'):
    return {
        '_id': str(req['_id']), 'doc_id': req['doc_id'],
        'document_filename': filename, 'requested_by': req['requested_by'],
        'requested_by_username': req.get('requested_by_username', ''),
        'document_division': req['document_division'], 'status': req['status'],
        'created_at': req['created_at'].isoformat() if req.get('created_at') else None,
    }


@access_bp.route('/request', methods=['POST'])
@token_required
def request_access():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'A JSON object is required'}), 400
    doc_id = data.get('doc_id')
    oid = _id(doc_id)
    if oid is None:
        return jsonify({'error': 'A valid doc_id is required'}), 400
    db, user = current_app.config['db'], request.current_user
    document = db.documents.find_one({'_id': oid}, {'filename': 1, 'division': 1})
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if document.get('division') == user.get('division'):
        return jsonify({'error': 'You already have access to documents in your division'}), 409
    approved = db.access_requests.find_one({'doc_id': str(oid), 'requested_by': str(user['_id']), 'status': 'approved'})
    if approved:
        return jsonify({'error': 'You already have approved access to this document'}), 409
    existing = db.access_requests.find_one({'doc_id': str(oid), 'requested_by': str(user['_id']), 'status': 'pending'})
    if existing:
        return jsonify({'error': 'You already have a pending request for this document'}), 409
    req = {
        'doc_id': str(oid), 'requested_by': str(user['_id']),
        'requested_by_username': user['username'], 'document_division': document['division'],
        'status': 'pending', 'created_at': datetime.datetime.utcnow(),
    }
    result = db.access_requests.insert_one(req)
    return jsonify({'message': 'Access request submitted', 'request_id': str(result.inserted_id)}), 201


def _change_request_status(action):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'A JSON object is required'}), 400
    request_id = _id(data.get('request_id'))
    if request_id is None:
        return jsonify({'error': 'A valid request_id is required'}), 400
    db, user = current_app.config['db'], request.current_user
    access_req = db.access_requests.find_one({'_id': request_id})
    if not access_req:
        return jsonify({'error': 'Access request not found'}), 404
    if access_req.get('document_division') != user.get('division'):
        return jsonify({'error': f'You can only {action} requests for documents in your division'}), 403
    if access_req.get('status') != 'pending':
        return jsonify({'error': 'Only pending requests can be processed'}), 409
    doc_oid = _id(access_req.get('doc_id'))
    document = db.documents.find_one({'_id': doc_oid}) if doc_oid else None
    if not document or document.get('division') != user.get('division'):
        return jsonify({'error': 'The requested document no longer exists in your division'}), 404
    now = datetime.datetime.utcnow()
    status = 'approved' if action == 'approve' else 'rejected'
    verb = 'approved' if action == 'approve' else 'rejected'
    update = {'status': status, f'{verb}_at': now, f'{verb}_by': str(user['_id'])}
    updated = db.access_requests.find_one_and_update(
        {'_id': request_id, 'status': 'pending', 'document_division': user.get('division')},
        {'$set': update}, return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return jsonify({'error': 'Request was already processed; refresh and try again'}), 409
    return jsonify({'message': f'Access request {status}'}), 200


@access_bp.route('/approve', methods=['POST'])
@token_required
def approve_access():
    return _change_request_status('approve')


@access_bp.route('/reject', methods=['POST'])
@token_required
def reject_access():
    return _change_request_status('reject')


@access_bp.route('/pending', methods=['GET'])
@token_required
def get_pending_requests():
    db, user = current_app.config['db'], request.current_user
    requests_list = list(db.access_requests.find({'document_division': user['division'], 'status': 'pending'}).sort('created_at', -1))
    result = []
    for req in requests_list:
        doc = db.documents.find_one({'_id': _id(req['doc_id'])}, {'filename': 1})
        result.append(_serialize(req, doc.get('filename', 'Unknown') if doc else 'Unknown'))
    return jsonify(result), 200


@access_bp.route('/my-requests', methods=['GET'])
@token_required
def get_my_requests():
    db, user = current_app.config['db'], request.current_user
    requests_list = list(db.access_requests.find({'requested_by': str(user['_id'])}).sort('created_at', -1))
    result = []
    for req in requests_list:
        doc = db.documents.find_one({'_id': _id(req['doc_id'])}, {'filename': 1})
        result.append(_serialize(req, doc.get('filename', 'Unknown') if doc else 'Unknown'))
    return jsonify(result), 200
