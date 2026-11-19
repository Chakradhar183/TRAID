import re
from flask import Blueprint, request, jsonify, current_app
from utils.auth import token_required
from routes.documents import serialize_document, can_access_document

search_bp = Blueprint('search', __name__, url_prefix='/api')


@search_bp.route('/search', methods=['GET'])
@token_required
def search_documents():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Search query parameter "q" is required'}), 400
    if len(query) > 120:
        return jsonify({'error': 'Search query is too long'}), 400
    db, user = current_app.config['db'], request.current_user
    pattern = {'$regex': re.escape(query), '$options': 'i'}
    metadata_conditions = []
    for field in db.metadata_fields.find({}, {'field_name': 1}):
        name = field.get('field_name', '')
        if isinstance(name, str) and name and not name.startswith('$') and '.' not in name:
            metadata_conditions.append({f'metadata.{name}': pattern})

    approved = [r['doc_id'] for r in db.access_requests.find(
        {'requested_by': str(user['_id']), 'status': 'approved'}, {'doc_id': 1}
    )]
    approved_ids = [ObjectId(value) for value in approved if ObjectId.is_valid(value)]
    permitted = [{'division': user['division']}]
    if approved_ids:
        permitted.append({'_id': {'$in': approved_ids}})

    # Search OCR and metadata only within documents the user may read.
    readable_search = [{'$or': [{'filename': pattern}, {'ocr_text': pattern}, *metadata_conditions]},
                       {'$or': permitted}]
    readable_docs = list(db.documents.find({'$and': readable_search}).sort('created_at', -1).limit(100))
    readable_ids = {doc['_id'] for doc in readable_docs}
    results = [serialize_document(doc) for doc in readable_docs]

    # For other divisions, expose filename-only matches so users can request access.
    hidden_docs = list(db.documents.find({
        'division': {'$ne': user['division']},
        '_id': {'$nin': list(readable_ids)},
        'filename': pattern,
    }, {'filename': 1, 'division': 1, 'created_at': 1}).sort('created_at', -1).limit(50))
    for doc in hidden_docs:
        results.append({
            '_id': str(doc['_id']), 'filename': doc.get('filename', 'document'),
            'division': doc.get('division'), 'metadata': {}, 'created_at': doc['created_at'].isoformat() if doc.get('created_at') else None,
            'can_access': False,
        })
    return jsonify(results), 200
