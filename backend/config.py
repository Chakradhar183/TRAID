import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', '')
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/dms')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 50 * 1024 * 1024))
    UPLOAD_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif'}
    CORS_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost').split(',') if origin.strip()]
    JWT_ALGORITHM = 'HS256'
