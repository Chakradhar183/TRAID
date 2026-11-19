import React, { useState, useEffect } from 'react';
import { getMetadataFields, uploadDocument } from '../services/api';

export default function UploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [metadataFields, setMetadataFields] = useState([]);
  const [metadataValues, setMetadataValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMetadataFields()
      .then((res) => {
        const fields = res.data.fields || res.data || [];
        setMetadataFields(fields);
        const defaults = {};
        fields.forEach((f) => {
          defaults[f.field_name] = f.field_type === 'select' && f.options?.length ? f.options[0] : '';
        });
        setMetadataValues(defaults);
      })
      .catch(() => setMetadataFields([]));
  }, []);

  const handleMetaChange = (fieldName, value) => {
    setMetadataValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file.');
      return;
    }

    // Validate required fields
    for (const f of metadataFields) {
      if (f.required && !metadataValues[f.field_name]) {
        setError(`${f.field_name} is required.`);
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadataValues));
      await uploadDocument(formData);
      onUploaded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Document</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
            />
          </div>

          {metadataFields.map((field) => (
            <div className="form-group" key={field._id || field.field_name}>
              <label>
                {field.field_name}
                {field.required && <span className="required">*</span>}
              </label>
              {field.field_type === 'select' ? (
                <select
                  value={metadataValues[field.field_name] || ''}
                  onChange={(e) => handleMetaChange(field.field_name, e.target.value)}
                >
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                  value={metadataValues[field.field_name] || ''}
                  onChange={(e) => handleMetaChange(field.field_name, e.target.value)}
                  placeholder={`Enter ${field.field_name}`}
                />
              )}
            </div>
          ))}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
