import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDocument, downloadDocument, requestAccess, getMyRequests } from '../services/api';

export default function DocumentDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchDocument = async () => {
      setLoading(true);
      setDoc(null);
      setAccessStatus(null);
      setError('');
      try {
        const res = await getDocument(id);
        if (active) setDoc(res.data);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Failed to load document.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDocument();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    // Check if user has an access request for this document
    const checkAccess = async () => {
      try {
        const res = await getMyRequests();
        const req = res.data.find((r) => r.doc_id === id);
        if (active) setAccessStatus(req ? req.status : null);
      } catch (err) {
        // The document endpoint remains the source of truth for access.
      }
    };
    checkAccess();
    return () => { active = false; };
  }, [id]);

  const isSameDivision = doc && user && doc.division === user.division;
  const hasAccess = Boolean(doc?.can_access) || isSameDivision || accessStatus === 'approved';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadDocument(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRequestAccess = async () => {
    try {
      await requestAccess(id);
      setAccessStatus('pending');
      setMessage('Access request sent successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request access.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading document details...</div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <button className="btn btn-link back-link" onClick={() => navigate('/')}>
        ← Back to Dashboard
      </button>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-card">
        <div className="detail-header">
          <div className="detail-title-row">
            <span className="doc-icon-lg">📄</span>
            <div>
              <h1>{doc.filename}</h1>
              <span className="doc-division-badge">{doc.division}</span>
            </div>
          </div>
          <div className="detail-actions">
            {hasAccess ? (
              <button
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? 'Downloading…' : '⬇ Download'}
              </button>
            ) : accessStatus === 'pending' ? (
              <button className="btn btn-secondary" disabled>
                ⏳ Access Pending
              </button>
            ) : accessStatus === 'rejected' ? (
              <button className="btn btn-danger" disabled>
                ✕ Access Rejected
              </button>
            ) : (
              <button className="btn btn-warning" onClick={handleRequestAccess}>
                🔑 Request Access
              </button>
            )}
          </div>
        </div>

        {/* Metadata Section */}
        <div className="detail-section">
          <h2>Metadata</h2>
          <div className="metadata-grid">
            <div className="meta-row">
              <span className="meta-label">Division:</span>
              <span className="meta-value">{doc.division}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Uploaded By:</span>
              <span className="meta-value">{doc.uploaded_by_username || doc.uploaded_by}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Upload Date:</span>
              <span className="meta-value">{formatDate(doc.created_at)}</span>
            </div>
            {doc.metadata &&
              Object.entries(doc.metadata).map(([key, value]) => (
                <div className="meta-row" key={key}>
                  <span className="meta-label">{key}:</span>
                  <span className="meta-value">{String(value)}</span>
                </div>
              ))}
          </div>
        </div>

        {/* OCR Text Section */}
        {doc.ocr_text && (
          <div className="detail-section">
            <h2>Extracted Text (OCR)</h2>
            <div className="ocr-text-preview">
              <pre>{doc.ocr_text}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
