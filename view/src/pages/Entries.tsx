import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Define the shape of the API response block
export interface QuoteRequest {
  id: string;
  title: string;
  content: string; // This holds the email
  status: number;
  created_at: string;
  modified_at: string;
  slug: string;
}

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

export default function QuoteRequestsList() {
  const { page } = useParams<{ page?: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'pending' | 'quoted' | 'distributed' | 'cancelled'>('all');
  const [devisRequests, setDevisRequests] = useState<QuoteRequest[]>([]);

  // Map numeric status from API to readable labels and Bootstrap badge classes
  const getStatusInfo = (status: number) => {
    switch (status) {
      case 1:
        return { label: 'Initiated', badgeClass: 'bg-warning text-dark' };
      case 2:
        return { label: 'Pending', badgeClass: 'bg-info text-dark' };
      case 3:
        return { label: 'Quoted', badgeClass: 'bg-info text-dark' };
      case 4:
        return { label: 'Distributed', badgeClass: 'bg-primary' };
      default:
        return { label: `Status ${status}`, badgeClass: 'bg-light text-dark' };
    }
  };

  // Helper to format GMT date nicely
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    getDevisRequests(page || '1').catch((err) => {
      console.error('Failed to fetch devis requests:', err);
    });
  }, [page]);

  const getDevisRequests = async (page: string) => {
    const response = await fetch(App.api_base + '/devisQueue/' + page, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Vuedoo-Domain': App.domain,
        'X-Vuedoo-Access-Key': ''
      },
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const res = await response.json();

    if (res.status === 'success') {
      // Map the API response to ensure every block has a unique 'id' for React keys
      const mappedData = res.data.map((block: any, index: number) => ({
        id: block.id,
        status: (block.status === 1 ? 1 : block.status === 2 ? 2 : block.status === 3 ? 3 : block.status === 4 ? 4 : 0), // Ensure status is numeric
        title: `Request #${index + 1}` + block.title,
        ...block
      }));
      setDevisRequests(mappedData);
    }
  };

  // Filter logic for the frontend tabs
  const filteredRequests = devisRequests.filter((req) => {
    if (filter === 'all') return true;
    const statusInfo = getStatusInfo((req.status as number) || 0);
    return statusInfo.label.toLowerCase() === filter;
  });

  return (
    <div className="container py-3 pb-5" style={{ maxWidth: '600px' }}>
      
      {/* ================= HEADER ================= */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold text-primary mb-0">Devis Requests</h4>
        <span className="badge bg-primary rounded-pill">{devisRequests.length} Total</span>
      </div>

      {/* ================= FILTER TABS ================= */}
      <div className="d-flex gap-2 overflow-auto pb-3 mb-2" style={{ scrollSnapType: 'x mandatory' }}>
        {(['all', 'pending', 'quoted', 'distributed', 'cancelled'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`btn btn-sm px-3 py-2 rounded-pill flex-shrink-0 fw-semibold ${
              filter === tab ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            style={{ scrollSnapAlign: 'start', textTransform: 'capitalize' }}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      {/* ================= REQUESTS LIST ================= */}
      <div className="d-flex flex-column gap-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center text-muted py-5">
            <p className="mb-0">No requests found for this filter.</p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            console.log( req.status );
            const statusInfo = getStatusInfo((req.status as number) || 0);
            
            return (
              <div 
                key={req.id} 
                className="card shadow-sm border-0"
                style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
                onClick={() => navigate(`/entry/${req.slug}`)} // Update this path to your actual detail route
              >
                <div className="card-body p-3">
                  
                  {/* Top Row: Status Badge */}
                  <div className="d-flex justify-content-end mb-2">
                    <span className={`badge ${statusInfo.badgeClass} px-3 py-2`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Middle Row: Email (from content field) */}
                  <div className="mb-3">
                    <h5 className="fw-bold mb-0 text-break">
                      {req.title}
                    </h5>
                  </div>

                  {/* Bottom Row: Dates */}
                  <div className="d-flex flex-column gap-1 pt-2 border-top text-muted small">
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">Initiated:</span>
                      <span>{formatDate(req.created_at)}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">Last Modified:</span>
                      <span>{formatDate(req.modified_at)}</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}