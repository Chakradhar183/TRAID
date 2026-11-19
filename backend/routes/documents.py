import datetime
import io
import json
import math
import os
import re
import gridfs
from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app, send_file
from PIL import Image
from werkzeug.utils import secure_filename

from utils.auth import token_required

documents_bp = Blueprint('documents', __name__, url_prefix='/api/documents')


def _doc_id(value):
    return ObjectId(value) if isinstance(value, str) and ObjectId.is_valid(value) else None


def can_access_document(db, document, user):
    if document.get('division') == user.get('division'):
        return True
    return db.access_requests.find_one({
        'doc_id': str(document['_id']), 'requested_by': str(user['_id']), 'status': 'approved'
    }, {'_id': 1}) is not None


def serialize_document(doc, include_content=False):
    result = {
        '_id': str(doc['_id']), 'filename': doc.get('filename', 'document'),
        'uploaded_by': doc.get('uploaded_by'),
        'uploaded_by_username': doc.get('uploaded_by_username', ''),
        'division': doc.get('division'), 'metadata': doc.get('metadata', {}),
        'created_at': doc['created_at'].isoformat() if doc.get('created_at') else None,
    }
    if include_content:
        result['ocr_text'] = doc.get('ocr_text', '')
    return result


def perform_ocr(file_bytes, filename):
    """Best-effort OCR; upload remains available if OCR software is unavailable."""
    ext = os.path.splitext(filename)[1].lower()
    try:
        import pytesseract
        if ext == '.pdf':
            from pdf2image import convert_from_bytes, pdfinfo_from_bytes
            info = pdfinfo_from_bytes(file_bytes, timeout=20)
            if int(info.get('Pages', 0)) > 100:
                current_app.logger.warning('OCR skipped: PDF exceeds 100 pages')
                return ''
            pages = convert_from_bytes(file_bytes, dpi=160, timeout=60)
            return '\n'.join(pytesseract.image_to_string(page) for page in pages)
        with Image.open(io.BytesIO(file_bytes)) as image:
            image.verify()
        with Image.open(io.BytesIO(file_bytes)) as image:
            return pytesseract.image_to_string(image)
    except Exception as exc:
        current_app.logger.warning('OCR failed for uploaded document: %s', type(exc).__name__)
        return ''


def _validate_metadata(db, metadata):
    if not isinstance(metadata, dict):
        return 'Metadata must be a JSON object'
    fields = {f['field_name']: f for f in db.metadata_fields.find()}
    unknown = set(metadata) - set(fields)
    if unknown:
        return 'Unknown metadata field(s): ' + ', '.join(sorted(unknown))
    for name, field in fields.items():
        value = metadata.get(name)
        if field.get('required') and (value is None or str(value).strip() == ''):
            return f'{name} is required'
        if value is None or value == '':
            continue
        kind = field.get('field_type')
        if kind == 'select' and value not in field.get('options', []):
            return f'Invalid value for {name}'
        if kind == 'number':
            try:
                numeric_value = float(value)
                if isinstance(value, bool) or not math.isfinite(numeric_value):
                    raise ValueError
            except (TypeError, ValueError):
                return f'{name} must be a finite number'
        if not isinstance(value, (str, int, float, bool)):
            return f'{name} must be a simple value'
    # Prevent arbitrary nested MongoDB structures and operator injection.
    if any(not isinstance(k, str) or not k.strip() or k.startswith('$') or '.' in k for k in metadata):
        return 'Metadata field names are invalid'
    if any(not isinstance(v, (str, int, float, bool)) and v is not None for v in metadata.values()):
        return 'Metadata values must be simple text or numeric values'
    if len(json.dumps(metadata, ensure_ascii=False)) > 20_000:
        return 'Metadata is too large'
    return None


@documents_bp.route('/upload', methods=['POST'])
@token_required
def upload_document():
    file = request.files.get('file')
    if file is None or not file.filename:
        return jsonify({'error': 'A file must be selected'}), 400
    filename = secure_filename(file.filename)
    if not filename:
        return jsonify({'error': 'Invalid filename'}), 400
    ext = os.path.splitext(filename)[1].lower()
    if ext not in current_app.config['UPLOAD_EXTENSIONS']:
        return jsonify({'error': 'Unsupported file type'}), 415
    file_bytes = file.read(current_app.config['MAX_CONTENT_LENGTH'] + 1)
    if not file_bytes:
        return jsonify({'error': 'The selected file is empty'}), 400
    if len(file_bytes) > current_app.config['MAX_CONTENT_LENGTH']:
        return jsonify({'error': 'File exceeds the maximum upload size'}), 413
    # Validate actual file signatures, not only the client-provided extension/MIME type.
    valid = False
    if ext == '.pdf':
        valid = file_bytes.startswith(b'%PDF-')
    else:
        try:
            with Image.open(io.BytesIO(file_bytes)) as image:
                image.verify()
                expected_formats = {'.png': {'PNG'}, '.jpg': {'JPEG'}, '.jpeg': {'JPEG'}, '.tiff': {'TIFF'}, '.bmp': {'BMP'}, '.gif': {'GIF'}}
                valid = image.format in expected_formats.get(ext, set())
        except Exception:
            valid = False
    if not valid:
        return jsonify({'error': 'File content does not match a supported PDF or image format'}), 415
    metadata_raw = request.form.get('metadata', '{}')
    try:
        metadata = json.loads(metadata_raw)
    except (TypeError, json.JSONDecodeError):
        return jsonify({'error': 'Metadata must contain valid JSON'}), 400
    db = current_app.config['db']
    validation_error = _validate_metadata(db, metadata)
    if validation_error:
        return jsonify({'error': validation_error}), 400
    fs = gridfs.GridFS(db)
    file_id = fs.put(file_bytes, filename=filename, content_type=file.mimetype or 'application/octet-stream')
    try:
        ocr_text = perform_ocr(file_bytes, filename)
        document = {
            'filename': filename, 'file_id': file_id,
            'uploaded_by': str(request.current_user['_id']),
            'uploaded_by_username': request.current_user['username'],
            'division': request.current_user['division'], 'metadata': metadata,
            'ocr_text': ocr_text, 'created_at': datetime.datetime.utcnow(),
        }
        result = db.documents.insert_one(document)
    except Exception:
        fs.delete(file_id)
        current_app.logger.exception('Document record creation failed')
        return jsonify({'error': 'Document could not be saved'}), 500
    return jsonify({'message': 'Document uploaded successfully', 'document_id': str(result.inserted_id), 'ocr_status': 'completed' if ocr_text else 'unavailable_or_no_text'}), 201


@documents_bp.route('/', methods=['GET'])
@token_required
def list_documents():
    db, user = current_app.config['db'], request.current_user
    approved = [r['doc_id'] for r in db.access_requests.find({'requested_by': str(user['_id']), 'status': 'approved'}, {'doc_id': 1})]
    approved_ids = [_doc_id(value) for value in approved if _doc_id(value)]
    clauses = [{'division': user['division']}]
    if approved_ids:
        clauses.append({'_id': {'$in': approved_ids}})
    query = {'$or': clauses}
    for key, value in request.args.items():
        if key in {'page', 'limit', 'division'}:
            continue
        if key.startswith('$') or '.' in key:
            return jsonify({'error': 'Invalid filter'}), 400
        query[f'metadata.{key}'] = value
    try:
        page = max(1, int(request.args.get('page', 1)))
        limit = min(100, max(1, int(request.args.get('limit', 50))))
    except ValueError:
        return jsonify({'error': 'page and limit must be integers'}), 400
    docs = list(db.documents.find(query).sort('created_at', -1).skip((page - 1) * limit).limit(limit))
    return jsonify([serialize_document(doc) for doc in docs]), 200


@documents_bp.route('/<doc_id>', methods=['GET'])
@token_required
def get_document(doc_id):
    oid = _doc_id(doc_id)
    if oid is None:
        return jsonify({'error': 'Invalid document ID'}), 400
    db, user = current_app.config['db'], request.current_user
    doc = db.documents.find_one({'_id': oid})
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    allowed = can_access_document(db, doc, user)
    result = serialize_document(doc, include_content=allowed)
    result['can_access'] = allowed
    if not allowed:
        # A limited listing permits a user to request access without exposing OCR contents.
        result.pop('uploaded_by', None)
        result.pop('uploaded_by_username', None)
        result['metadata'] = {}
    return jsonify(result), 200


@documents_bp.route('/<doc_id>/download', methods=['GET'])
@token_required
def download_document(doc_id):
    oid = _doc_id(doc_id)
    if oid is None:
        return jsonify({'error': 'Invalid document ID'}), 400
    db, user = current_app.config['db'], request.current_user
    document = db.documents.find_one({'_id': oid})
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if not can_access_document(db, document, user):
        return jsonify({'error': 'Access denied. Request access first.'}), 403
    try:
        grid_file = gridfs.GridFS(db).get(document['file_id'])
        response = send_file(io.BytesIO(grid_file.read()), download_name=document['filename'], as_attachment=True, mimetype=grid_file.content_type or 'application/octet-stream')
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response
    except gridfs.NoFile:
        return jsonify({'error': 'File not found in storage'}), 404


@documents_bp.route('/<doc_id>', methods=['DELETE'])
@token_required
def delete_document(doc_id):
    oid = _doc_id(doc_id)
    if oid is None:
        return jsonify({'error': 'Invalid document ID'}), 400
    db, user = current_app.config['db'], request.current_user
    document = db.documents.find_one({'_id': oid})
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    if document.get('uploaded_by') != str(user['_id']) and user.get('role') != 'admin':
        return jsonify({'error': 'Only the uploader or an administrator can delete this document'}), 403
    db.documents.delete_one({'_id': oid})
    try:
        gridfs.GridFS(db).delete(document['file_id'])
    except gridfs.NoFile:
        current_app.logger.warning('GridFS file already missing for document %s', doc_id)
    db.access_requests.delete_many({'doc_id': str(oid)})
    return jsonify({'message': 'Document deleted'}), 200
