import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPendingRequests, getMyRequests, approveAccess, rejectAccess } from '../services/api';

export default function AccessRequests() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [inRes, outRes] = await Promise.all([getPendingRequests(), getMyRequests()]);
      setIncoming(inRes.data);
      setOutgoing(outRes.data);
    } catch (err) {
      console.error('Failed to fetch requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (requestId) => {
    try {
      await approveAccess(requestId);
      setMessage('Request approved!');
      fetchRequests();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to approve.');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectAccess(requestId);
      setMessage('Request rejected.');
      fetchRequests();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to reject.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge badge-warning',
      approved: 'badge badge-success',
      rejected: 'badge badge-danger',
    };
    return badges[status] || 'badge';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Access Requests</h1>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'incoming' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming Requests ({incoming.length})
        </button>
        <button
          className={`tab ${activeTab === 'outgoing' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('outgoing')}
        >
          My Requests ({outgoing.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading requests...</div>
      ) : (
        <div className="requests-list">
          {activeTab === 'incoming' && (
            <>
              {incoming.length === 0 ? (
                <div className="empty-state">
                  <p>No pending access requests for your division's documents.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Requested By</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incoming.map((req) => (
                        <tr key={req._id}>
                          <td>{req.document_filename}</td>
                          <td>{req.requested_by_username}</td>
                          <td>{formatDate(req.created_at)}</td>
                          <td>
                            <span className={getStatusBadge(req.status)}>{req.status}</span>
                          </td>
                          <td>
                            {req.status === 'pending' && (
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleApprove(req._id)}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleReject(req._id)}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === 'outgoing' && (
            <>
              {outgoing.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't made any access requests yet.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Division</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outgoing.map((req) => (
                        <tr key={req._id}>
                          <td>{req.document_filename}</td>
                          <td>{req.document_division}</td>
                          <td>{formatDate(req.created_at)}</td>
                          <td>
                            <span className={getStatusBadge(req.status)}>{req.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
