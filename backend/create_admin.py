"""Create an administrator through an interactive, local operator action.

Run from the backend directory: python create_admin.py
This script is intentionally not exposed as an HTTP endpoint.
"""
import getpass
import os
import re
import bcrypt
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from dotenv import load_dotenv

load_dotenv()


def main():
    uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/dms')
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    from pymongo.uri_parser import parse_uri
    db = client[parse_uri(uri).get('database') or 'dms']
    username = input('Admin username: ').strip()
    email = input('Admin email: ').strip().lower()
    division = input('Admin division: ').strip()
    password = getpass.getpass('Admin password (min 12 characters): ')
    if len(username) < 3 or len(username) > 40:
        raise SystemExit('Username must be between 3 and 40 characters.')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise SystemExit('Enter a valid email address.')
    if len(password) < 12 or len(password.encode('utf-8')) > 72:
        raise SystemExit('Password must be at least 12 characters and at most 72 bytes.')
    if not division:
        raise SystemExit('Division is required.')
    if db.users.find_one({'$or': [{'username': username}, {'email': email}]}):
        raise SystemExit('A user with that username or email already exists.')
    try:
        db.users.insert_one({
            'username': username, 'email': email, 'division': division,
            'password': bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()),
            'role': 'admin',
        })
    except DuplicateKeyError:
        raise SystemExit('A user with that username already exists.')
    print('Administrator created successfully.')
    client.close()


if __name__ == '__main__':
    main()
