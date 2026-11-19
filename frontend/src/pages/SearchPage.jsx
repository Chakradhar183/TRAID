import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchDocuments } from '../services/api';
import DocumentCard from '../components/DocumentCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await searchDocuments(query.trim());
      setResults(res.data);
    } catch (err) {
      console.error('Search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Advanced Search</h1>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by title, metadata, or content..."
            className="search-input"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching…' : '🔍 Search'}
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="loading-spinner">Searching...</div>
      ) : searched ? (
        results.length === 0 ? (
          <div className="empty-state">
            <p>No documents found matching "{query}".</p>
            <p>Try different keywords or check your search terms.</p>
          </div>
        ) : (
          <>
            <p className="results-count">
              Found <strong>{results.length}</strong> document{results.length !== 1 ? 's' : ''} matching "{query}"
            </p>
            <div className="documents-grid">
              {results.map((doc) => (
                <DocumentCard key={doc._id} doc={doc} />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="empty-state">
          <p>Enter a search query to find documents.</p>
          <p>Searches across document titles, custom metadata, and OCR-extracted text.</p>
        </div>
      )}
    </div>
  );
}
