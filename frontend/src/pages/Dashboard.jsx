import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDocuments, getMetadataFields } from '../services/api';
import DocumentCard from '../components/DocumentCard';
import UploadModal from '../components/UploadModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [metadataFields, setMetadataFields] = useState([]);
  const [filters, setFilters] = useState({});
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (viewAll) {
        // Don't send division filter to see all divisions
        // The backend defaults to user's division, so we pass a special flag
      }
      const res = await getDocuments(params);
      setDocuments(res.data);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setLoading(false);
    }
  }, [filters, viewAll]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    getMetadataFields()
      .then((res) => {
        const fields = res.data.fields || res.data || [];
        setMetadataFields(fields);
      })
      .catch(() => setMetadataFields([]));
  }, []);

  const handleFilterChange = (fieldName, value) => {
    setFilters((prev) => {
      const updated = { ...prev };
      if (value) {
        updated[fieldName] = value;
      } else {
        delete updated[fieldName];
      }
      return updated;
    });
  };

  const handleUploadSuccess = () => {
    setMessage('Document uploaded successfully!');
    fetchDocuments();
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Document Hub</h1>
          <p className="subtitle">
            Viewing documents for <strong>{user?.division}</strong>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          + Upload Document
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {/* Filters */}
      <div className="filters-bar">
        <h3>Filters</h3>
        <div className="filters-row">
          {metadataFields
            .filter((f) => f.field_type === 'select')
            .map((field) => (
              <div className="filter-group" key={field._id || field.field_name}>
                <label>{field.field_name}</label>
                <select
                  value={filters[field.field_name] || ''}
                  onChange={(e) => handleFilterChange(field.field_name, e.target.value)}
                >
                  <option value="">All</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="loading-spinner">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <p>No documents found.</p>
          <p>Upload your first document to get started.</p>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploadSuccess}
        />
      )}
    </div>
  );
}
