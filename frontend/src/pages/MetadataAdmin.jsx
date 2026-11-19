import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getMetadataFields,
  createMetadataField,
  updateMetadataField,
  deleteMetadataField,
} from '../services/api';

export default function MetadataAdmin() {
  const { user } = useAuth();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // New field form
  const [newField, setNewField] = useState({
    field_name: '',
    field_type: 'text',
    options: '',
    required: false,
  });

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editField, setEditField] = useState({});

  const fetchFields = async () => {
    setLoading(true);
    try {
      const res = await getMetadataFields();
      setFields(res.data.fields || res.data || []);
    } catch (err) {
      setError('Failed to load metadata fields.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!newField.field_name || !newField.field_type) {
      setError('Field name and type are required.');
      return;
    }

    const payload = {
      field_name: newField.field_name,
      field_type: newField.field_type,
      required: newField.required,
      options:
        newField.field_type === 'select'
          ? newField.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
    };

    try {
      await createMetadataField(payload);
      setMessage('Field created successfully!');
      setNewField({ field_name: '', field_type: 'text', options: '', required: false });
      fetchFields();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create field.');
    }
  };

  const startEdit = (field) => {
    setEditingId(field._id);
    setEditField({
      field_name: field.field_name,
      field_type: field.field_type,
      options: (field.options || []).join(', '),
      required: field.required || false,
    });
  };

  const handleUpdate = async (fieldId) => {
    const payload = {
      field_name: editField.field_name,
      field_type: editField.field_type,
      required: editField.required,
      options:
        editField.field_type === 'select'
          ? editField.options
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
    };

    try {
      await updateMetadataField(fieldId, payload);
      setMessage('Field updated successfully!');
      setEditingId(null);
      fetchFields();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update field.');
    }
  };

  const handleDelete = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this field?')) return;
    try {
      await deleteMetadataField(fieldId);
      setMessage('Field deleted.');
      fetchFields();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete field.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Metadata Settings</h1>
        <p className="subtitle">Manage dynamic metadata fields for documents</p>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Add New Field */}
      <div className="admin-section">
        <h2>Add New Field</h2>
        <form onSubmit={handleCreate} className="admin-form">
          <div className="form-row">
            <div className="form-group">
              <label>Field Name</label>
              <input
                type="text"
                value={newField.field_name}
                onChange={(e) => setNewField({ ...newField, field_name: e.target.value })}
                placeholder="e.g., Department"
              />
            </div>
            <div className="form-group">
              <label>Field Type</label>
              <select
                value={newField.field_type}
                onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
              >
                <option value="text">Text</option>
                <option value="select">Select (Dropdown)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
            </div>
            {newField.field_type === 'select' && (
              <div className="form-group">
                <label>Options (comma-separated)</label>
                <input
                  type="text"
                  value={newField.options}
                  onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                  placeholder="Option A, Option B, Option C"
                />
              </div>
            )}
            <div className="form-group form-check-group">
              <label>
                <input
                  type="checkbox"
                  checked={newField.required}
                  onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                />
                Required
              </label>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            + Add Field
          </button>
        </form>
      </div>

      {/* Existing Fields */}
      <div className="admin-section">
        <h2>Existing Fields</h2>
        {loading ? (
          <div className="loading-spinner">Loading fields...</div>
        ) : fields.length === 0 ? (
          <div className="empty-state">
            <p>No metadata fields configured yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Options</th>
                  <th>Required</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field._id}>
                    {editingId === field._id ? (
                      <>
                        <td>
                          <input
                            type="text"
                            value={editField.field_name}
                            onChange={(e) =>
                              setEditField({ ...editField, field_name: e.target.value })
                            }
                            className="inline-edit"
                          />
                        </td>
                        <td>
                          <select
                            value={editField.field_type}
                            onChange={(e) =>
                              setEditField({ ...editField, field_type: e.target.value })
                            }
                            className="inline-edit"
                          >
                            <option value="text">Text</option>
                            <option value="select">Select</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={editField.options}
                            onChange={(e) =>
                              setEditField({ ...editField, options: e.target.value })
                            }
                            className="inline-edit"
                            placeholder="Comma-separated"
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editField.required}
                            onChange={(e) =>
                              setEditField({ ...editField, required: e.target.checked })
                            }
                          />
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleUpdate(field._id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{field.field_name}</td>
                        <td>
                          <span className="badge">{field.field_type}</span>
                        </td>
                        <td>{(field.options || []).join(', ') || '—'}</td>
                        <td>{field.required ? '✓' : '—'}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => startEdit(field)}
                            >
                              ✎ Edit
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(field._id)}
                            >
                              ✕ Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
