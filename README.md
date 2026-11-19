# TRAID — AI-Powered Document Management System

TRAID is a full-stack document management system with division-based access, configurable metadata, OCR extraction, document search, and cross-division access requests.

## Features

- User registration and JWT-based login.
- User/admin roles; public registration always creates a normal user.
- Division-scoped document listing and access-controlled download.
- MongoDB GridFS document storage.
- PDF/image validation and OCR using Tesseract and Poppler.
- Admin-managed metadata fields.
- Cross-division access request, approval, and rejection workflow.
- Search across filenames, permitted OCR content, and permitted metadata. For documents outside the user's permissions, discovery is limited to filename matches so the user can request access without receiving private OCR or metadata.

## Technology

- Frontend: React 18, Vite, React Router, Axios.
- Backend: Python 3.11+, Flask, PyMongo, PyJWT, bcrypt.
- Database/storage: MongoDB 7 and GridFS.
- OCR: Tesseract, Pillow, pdf2image, Poppler.
- Deployment: Docker Compose and Nginx.

## Requirements

For local development:

- Python 3.11 or newer.
- Node.js 20 LTS recommended (18+ may work with the existing Vite version).
- MongoDB 7, running on `localhost:27017`.
- Tesseract OCR and Poppler installed and available on `PATH` for PDF/image OCR.

## Local setup — Windows PowerShell

### 1. Configure backend environment

```powershell
cd Traid\backend
Copy-Item .env.example .env
```

Edit `.env` and set `SECRET_KEY` to a long random value. For example, generate one with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set `MONGO_URI=mongodb://localhost:27017/dms` for a local MongoDB instance.

### 2. Install and start backend

```powershell
cd Traid\backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

Backend health endpoint: `http://localhost:5000/api/health`.

### 3. Install and start frontend

Open a second terminal:

```powershell
cd Traid\frontend
npm ci
npm run dev
```

Frontend: `http://localhost:5173`.

### 4. OCR software on Windows

Install Tesseract OCR and Poppler for Windows, then add their executable directories to the Windows `PATH`. Verify Tesseract with `tesseract --version`. The Python package `pytesseract` is only a wrapper; it does not install the Tesseract executable.

If OCR is unavailable, uploads still work, but OCR text extraction will be unavailable. PDF OCR requires Poppler (`pdf2image`).

## Create an administrator

Public registration deliberately ignores any submitted `role` and always creates a `user`. To create the first administrator, start MongoDB and configure `backend/.env`, then run this local operator script:

```powershell
cd Traid\backend
.\.venv\Scripts\Activate.ps1
python create_admin.py
```

The script prompts for username, email, division, and a password (minimum 12 characters). It is not an HTTP endpoint. Keep administrator credentials secure. Normal users can register at `/register`.

## Docker Compose setup

Docker Compose uses MongoDB health checks and a persistent database volume. Set a strong secret before starting the stack.

PowerShell:

```powershell
$env:SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
docker compose up --build -d
```

Open `http://localhost`. The frontend Nginx container proxies `/api/` requests to the backend. MongoDB is not published to the host.

To view logs:

```powershell
docker compose logs -f backend
```

To stop services without deleting database data:

```powershell
docker compose down
```

Do not use `docker compose down -v` unless you intentionally want to delete the MongoDB volume and all stored database data.

To create an administrator in the Docker deployment, run the script inside the backend container:

```powershell
docker compose exec backend python create_admin.py
```

## API endpoints

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a normal user |
| POST | `/api/auth/login` | Authenticate and receive JWT |

### Documents (JWT required)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/documents/upload` | Upload a PDF/image and metadata |
| GET | `/api/documents/` | List documents the user may read |
| GET | `/api/documents/<id>` | Retrieve permitted details or limited discovery details |
| GET | `/api/documents/<id>/download` | Download after access check |
| DELETE | `/api/documents/<id>` | Delete if uploader or administrator |

### Cross-division access (JWT required)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/access/request` | Request access to another division's document |
| POST | `/api/access/approve` | Approve a pending request for the user's division |
| POST | `/api/access/reject` | Reject a pending request for the user's division |
| GET | `/api/access/pending` | List pending requests for the user's division |
| GET | `/api/access/my-requests` | List the current user's requests |

### Search and metadata

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/search?q=<term>` | Search accessible document content and discover other documents by filename |
| GET | `/api/metadata/fields` | List configured metadata fields |
| POST | `/api/metadata/fields` | Create field (admin only) |
| PUT | `/api/metadata/fields/<id>` | Update field (admin only) |
| DELETE | `/api/metadata/fields/<id>` | Delete field (admin only) |
| GET | `/api/health` | Backend and MongoDB health check |

Send JWT-protected requests with `Authorization: Bearer <token>`.

## Security notes

- Set a unique, high-entropy `SECRET_KEY` outside source control.
- Never commit `.env`; use `.env.example` as a template.
- Public registration cannot assign admin roles.
- Create administrators only through the local `create_admin.py` operator script.
- Backend authorization is authoritative; frontend route guards are only a user-experience layer.
- Documents in other divisions are not downloadable until access is approved.
- The upload endpoint accepts PDF and supported raster image formats up to the configured request limit (50 MiB by default).

## Dependency files

- Backend Python packages: `backend/requirements.txt` (pinned versions).
- Frontend JavaScript packages: `frontend/package.json` and `frontend/package-lock.json` (`npm ci` reproduces the lockfile installation).
- External OCR executables: Tesseract and Poppler; these are not Python/npm packages.

## Project layout

```text
Traid/
├── backend/
│   ├── routes/
│   ├── utils/
│   ├── app.py
│   ├── config.py
│   ├── create_admin.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── README.md
```
