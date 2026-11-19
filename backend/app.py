"""Flask application entry point for TRAID."""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from config import Config


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    if not app.config.get('SECRET_KEY'):
        raise RuntimeError('SECRET_KEY must be set. Copy .env.example to .env and configure a unique secret.')

    CORS(app, resources={r'/api/*': {'origins': app.config['CORS_ORIGINS']}}, supports_credentials=False)
    client = app.config.get('MONGO_CLIENT') or MongoClient(
        app.config['MONGO_URI'], serverSelectionTimeoutMS=5000, connectTimeoutMS=5000,
    )
    if 'MONGO_CLIENT' not in app.config:
        app.extensions['mongo_client'] = client
    db_name = app.config.get('MONGO_DB_NAME')
    if not db_name:
        from pymongo.uri_parser import parse_uri
        db_name = parse_uri(app.config['MONGO_URI']).get('database') or 'dms'
    db = client[db_name]
    app.config['db'] = db

    # Fail early on an unavailable database instead of serving a misleading healthy API.
    try:
        db.command('ping')
    except PyMongoError as exc:
        app.logger.error('MongoDB connection failed: %s', type(exc).__name__)
        raise RuntimeError('Unable to connect to MongoDB. Check MONGO_URI and database availability.') from exc

    db.users.create_index('username', unique=True)
    db.documents.create_index([('filename', 'text'), ('ocr_text', 'text')])
    db.documents.create_index('division')
    db.access_requests.create_index([('doc_id', 1), ('requested_by', 1), ('status', 1)])
    db.access_requests.create_index([('document_division', 1), ('status', 1)])

    from routes.auth import auth_bp
    from routes.documents import documents_bp
    from routes.access import access_bp
    from routes.search import search_bp
    from routes.metadata import metadata_bp, seed_default_fields
    app.register_blueprint(auth_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(access_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(metadata_bp)
    seed_default_fields(db)

    @app.get('/api/health')
    def health():
        try:
            db.command('ping')
            return jsonify({'status': 'ok', 'database': 'connected'}), 200
        except PyMongoError:
            return jsonify({'status': 'error', 'database': 'unavailable'}), 503

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify({'error': 'Uploaded request exceeds the maximum allowed size'}), 413

    @app.errorhandler(500)
    def internal_error(_error):
        app.logger.exception('Unhandled application error')
        return jsonify({'error': 'An unexpected server error occurred'}), 500

    return app


if __name__ == '__main__':
    application = create_app()
    application.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=False)
