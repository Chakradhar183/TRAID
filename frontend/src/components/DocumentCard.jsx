import React from 'react';
import { Link } from 'react-router-dom';

export default function DocumentCard({ doc }) {
  const displayId = doc._id || doc.id;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  return (
    <Link to={`/documents/${displayId}`} className="document-card">
      <div className="doc-card-header">
        <span className="doc-icon">📄</span>
        <h3 className="doc-filename">{doc.filename}</h3>
      </div>
      <div className="doc-card-body">
        <span className="doc-division-badge">{doc.division}</span>
        {doc.metadata && Object.entries(doc.metadata).map(([key, value]) => (
          <div className="doc-meta-item" key={key}>
            <span className="meta-label">{key}:</span>
            <span className="meta-value">{String(value)}</span>
          </div>
        ))}
      </div>
      <div className="doc-card-footer">
        <span className="doc-date">Uploaded: {formatDate(doc.created_at)}</span>
      </div>
    </Link>
  );
}
