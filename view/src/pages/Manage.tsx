import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface MaterialRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface AdminQuoteData {
  totalM3: number;
  materials: MaterialRow[];
  estimatedMovePrice: number;
}

interface RequestDetails {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  moveDate: string;
  isFlexible: boolean;
  flexibleDuration: string;
  notes: string;
  photos: string[];
}

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    slug: string | undefined;
    file: any | null;
    block: blockState;
}

// Mock incoming customer rexquest
const MOCK_REQUEST: RequestDetails = {
  id: 'REQ-1042',
  customerName: 'Jean Dupont',
  customerEmail: 'jean.dupont@email.com',
  customerPhone: '+33 6 98 76 54 32',
  address: '123 Rue de Rivoli, 75001 Paris',
  moveDate: '2024-08-15',
  isFlexible: true,
  flexibleDuration: '1_week',
  notes: '3rd floor, no elevator. Heavy antique desk requires special care.',
  photos: [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
  ],
};

export default function AdminQuoteDetailPage() {
  const { slug } = useParams<{ slug?: string }>();
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [data, setData] = useState<dataState>({
        slug: slug,
        file: null,
        block: { id: '', slug: '', title: '', metas: { address: '', email: '', moveDate: '', Photos: [] } },
    });
  
  // Admin editable quote data
  const [quoteData, setQuoteData] = useState<AdminQuoteData>({
    totalM3: 25.0,
    estimatedMovePrice: 0,
    materials: [],
  });

  const [moverEmails, setMoverEmails] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [bedrockError, setBedrockError] = useState<string | null>(null);

  // Calculate totals
  const materialsTotal = quoteData.materials.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const grandTotal = materialsTotal + quoteData.estimatedMovePrice;

  const requestBedrockEstimate = async (): Promise<AdminQuoteData> => {
    const response = await fetch(App.api_base + '/generate/' + slug, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vuedoo-Domain': App.domain,
        'X-Vuedoo-Access-Key': '',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error('Bedrock estimate request failed');
    }

    const json = await response.json();

    
    console.log( json );
    
    const materialsUpdated = json.quoteJson.materials.map((item: any, index: number) => {
      const name = Object.keys(item)[0];
      const quantity = item[name];

      return {
        id: index + 1, // 1-based ID
        name: name,
        quantity: quantity,
        unitPrice: 0, // Default to 0, can be edited by admin
      };
    });

    return {
      totalM3: Number(json.quoteJson.totalM3 ?? 0),
      estimatedMovePrice: Number(json.quoteJson.estimatedMovePrice ?? 0),
      materials: materialsUpdated,
    };
  };

  const handleGenerateList = async () => {
    setIsEstimating(true);
    setBedrockError(null);

    const fallbackEstimate: AdminQuoteData = {
      totalM3: 28.5,
      estimatedMovePrice: 450,
      materials: [
        { id: '1', name: 'Standard Carton', quantity: 20, unitPrice: 2.50 },
        { id: '2', name: 'Book Carton (Renforcé)', quantity: 8, unitPrice: 3.00 },
        { id: '3', name: 'Penderie (Wardrobe)', quantity: 3, unitPrice: 4.50 },
        { id: '4', name: 'Bubble Wrap Roll', quantity: 2, unitPrice: 15.00 },
        { id: '5', name: 'Packing Paper', quantity: 5, unitPrice: 2.00 },
        { id: '6', name: 'Packing Tape', quantity: 2, unitPrice: 3.50 },
      ],
    };

    try {
      const estimate = await requestBedrockEstimate();
      const normalizedMaterials = estimate.materials.length
        ? estimate.materials
        : fallbackEstimate.materials;

      console.log('Bedrock estimate received:', estimate);

      setQuoteData({
        totalM3: estimate.totalM3 || fallbackEstimate.totalM3,
        estimatedMovePrice: estimate.estimatedMovePrice || fallbackEstimate.estimatedMovePrice,
        materials: normalizedMaterials,
      });
    } catch (error) {
      console.error(error);
      setBedrockError('Unable to fetch a Bedrock estimate. Using default admin estimate.');
      setQuoteData(fallbackEstimate);
    } finally {
      setIsEstimating(false);
      setIsGenerated(true);
    }
  };

  const handleNumberChange = (field: keyof AdminQuoteData, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setQuoteData((prev) => ({ ...prev, [field]: numValue }));
  };

  const updateMaterial = (id: string, field: keyof MaterialRow, value: string | number) => {
    setQuoteData((prev) => ({
      ...prev,
      materials: prev.materials.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  useEffect(() => {
    prepareUpload( data.slug );
  }, []);

  const prepareUpload = async (slug: string | undefined) => {
    const response = await fetch(App.api_base + '/devis/' + data.slug, {
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
          if( res.devis.metas && res.devis.metas.Photos ) {
              const photos = JSON.parse(res.devis.metas.Photos);
              res.devis.metas.Photos = photos;
              if( res.devis.metas.Quote != undefined) {
                var quoteJson = res.devis.metas.Quote = JSON.parse(res.devis.metas.Quote);
                const materialsUpdated = quoteJson.materials.map((item: any, index: number) => {
                  const name = Object.keys(item)[0];
                  const quantity = item[name];

                  return {
                    id: index + 1, // 1-based ID
                    name: name,
                    quantity: quantity,
                    unitPrice: 0, // Default to 0, can be edited by admin
                  };
                });
                setQuoteData({
                  totalM3: Number(quoteJson.totalM3 ?? 0),
                  estimatedMovePrice: Number(quoteJson.estimatedMovePrice ?? 0),
                  materials: materialsUpdated,
                });

                setIsGenerated(true); // Mark as generated since we have existing quote data
              }
          }

          setData((prevData) => ({ ...prevData, block: res.devis }));
      } else {
          //window.location.href = '/NotFound';
      }
  };

  const addMaterialRow = () => {
    const newRow: MaterialRow = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      unitPrice: 0,
    };
    setQuoteData((prev) => ({
      ...prev,
      materials: [...prev.materials, newRow],
    }));
  };

  const removeMaterialRow = (id: string) => {
    setQuoteData((prev) => ({
      ...prev,
      materials: prev.materials.filter((item) => item.id !== id),
    }));
  };

  const handleDispatchToMovers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moverEmails.trim()) {
      alert('Please enter at least one moving company email address.');
      return;
    }
    
    setIsDispatching(true);
    try {
      const response = await fetch(App.api_base + '/dispatch/' + data.slug, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vuedoo-Domain': App.domain,
          'X-Vuedoo-Access-Key': '',
        },
        body: JSON.stringify({
          emails: moverEmails.split(/[\s,]+/).filter(email => email.trim() !== ''),
        }),
      });

      if (!response.ok) {
        throw new Error('Dispatch request failed');
      }

      const json = await response.json();
      if (json.status === 'success') {
        alert('Quote request successfully dispatched to movers!');
      } else {
        throw new Error(json.error || 'Dispatch failed');
      }
    } catch (error) {
      alert('Failed to dispatch. Please try again.');
    } finally {
      setIsDispatching(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="container py-3 pb-5" style={{ maxWidth: '700px' }}>
      
      {/* ================= PHOTO MODAL ================= */}
      {modalImage && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-90 d-flex align-items-center justify-content-center z-3"
          onClick={() => setModalImage(null)}
          style={{ cursor: 'zoom-out' }}
        >
          <button 
            className="position-absolute top-0 end-0 btn btn-link text-white p-3 fs-1 fw-bold"
            onClick={(e) => { e.stopPropagation(); setModalImage(null); }}
          >
            &times;
          </button>
          <img 
            src={modalImage} 
            alt="Zoomed view" 
            className="img-fluid rounded shadow-lg" 
            style={{ maxHeight: '90vh', maxWidth: '95vw', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ================= HEADER ================= */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div>
          <h4 className="fw-bold text-primary mb-1">Request Details</h4>
          <span className="badge bg-secondary">{data.block.id}</span>
        </div>
        <span className="badge bg-warning text-dark fs-6 px-3 py-2">Pending Review</span>
      </div>

      {/* ================= CUSTOMER INFO (Read-Only, Normal Background) ================= */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h6 className="fw-bold text-uppercase text-muted small mb-3">Customer Information</h6>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="small text-muted">Name</div>
              <div className="fw-semibold">Confidential</div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted">Contact</div>
              <div className="small text-muted">{data.block.title}</div>
            </div>
            <div className="col-12">
              <div className="small text-muted">Moving Address</div>
              <div className="fw-semibold">{data.block.metas.Address}</div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted">Preferred Date</div>
              <div className="fw-semibold">{formatDate(data.block.metas.MoveDate)}</div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted">Flexibility</div>
              <div className="fw-semibold">
                {data.block.metas.isFlexible == 'true' ? `Yes (± ${data.block.metas.FlexibleDuration.replace('_', ' ')})` : 'No'}
              </div>
            </div>
            {data.block.metas.Notes && (
              <div className="col-12">
                <div className="small text-muted">Customer Notes</div>
                <div className="fw-semibold p-2 rounded border">
                  "{data.block.metas.Notes}"
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= CUSTOMER PHOTOS ================= */}
      <div className="mb-4">
        <h6 className="fw-bold text-uppercase text-muted small mb-2">Customer Photos (Tap to Zoom)</h6>
        <div className="d-flex gap-2 overflow-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
          {data.block.metas.Photos.map((src: string, idx: number) => (
            <img
              key={idx}
              src={'https://typewriting-ai-new.s3.us-west-2.amazonaws.com/' + src}
              alt={`Customer item ${idx + 1}`}
              className="rounded border flex-shrink-0"
              style={{ 
                width: '100px', height: '100px', objectFit: 'cover', 
                scrollSnapAlign: 'start', cursor: 'zoom-in' 
              }}
              onClick={() => setModalImage('https://typewriting-ai-new.s3.us-west-2.amazonaws.com/' + src)}
            />
          ))}
        </div>
      </div>

      {/* ================= STEP 1: GENERATE LIST ================= */}
      {!isGenerated ? (
        <div className="text-center py-4">
          <p className="text-muted mb-3">
            Please review the customer details and photos above. <br/>
            Once verified, generate the material list and estimate to proceed.
          </p>
          <button 
            className="btn btn-primary btn-lg px-5 fw-bold shadow"
            onClick={handleGenerateList}
          >
            ✓ Verify & Generate Material List
          </button>
        </div>
      ) : (
        /* ================= STEP 2: EDITABLE FORM & DISPATCH ================= */
        <form onSubmit={handleDispatchToMovers}>
          
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="badge bg-success fs-6">Generated</span>
            <h5 className="fw-bold mb-0">Admin Quote Estimate</h5>
          </div>

          {/* Editable Volume */}
          <div className="mb-4">
            <label className="form-label fw-bold mb-1">Admin Estimated Volume</label>
            <div className="input-group input-group-lg">
              <input
                type="number"
                step="0.1"
                className="form-control fw-bold text-primary"
                value={quoteData.totalM3}
                onChange={(e) => handleNumberChange('totalM3', e.target.value)}
              />
              <span className="input-group-text fw-bold">m³</span>
            </div>
          </div>

          {/* Editable Materials List */}
          <div className="mb-4">
            <label className="form-label fw-bold mb-2">Packing Materials Estimate</label>
            <div className="table-responsive bg-white rounded border">
              <table className="table table-borderless mb-0 align-middle">
                <thead className="table-light small text-muted">
                  <tr>
                    <th style={{ width: '45%' }} className="ps-3">Item</th>
                    <th style={{ width: '20%' }} className="text-center">Qty</th>
                    <th style={{ width: '25%' }} className="text-end">Unit (€)</th>
                    <th style={{ width: '10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteData.materials.map((item) => (
                    <tr key={item.id} className="border-top">
                      <td className="ps-3">
                        <input
                          type="text"
                          className="form-control form-control-sm border-0 bg-transparent fw-semibold"
                          value={item.name}
                          onChange={(e) => updateMaterial(item.id, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm text-center"
                          value={item.quantity}
                          onChange={(e) => updateMaterial(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control form-control-sm text-end"
                          value={item.unitPrice}
                          onChange={(e) => updateMaterial(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="text-center pe-2">
                        <button type="button" className="btn btn-sm text-danger p-0" onClick={() => removeMaterialRow(item.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-outline-primary w-100 mt-2 fw-semibold py-2" onClick={addMaterialRow}>
              + Add Material Row
            </button>
          </div>

          {/* Editable Move Price */}
          <div className="mb-4">
            <label className="form-label fw-bold mb-1">Estimated Move Price (Labor, Transport)</label>
            <div className="input-group input-group-lg">
              <span className="input-group-text fw-bold bg-light">€</span>
              <input
                type="number"
                step="1"
                min="0"
                className="form-control fw-bold text-primary"
                value={quoteData.estimatedMovePrice}
                onChange={(e) => handleNumberChange('estimatedMovePrice', e.target.value)}
              />
            </div>
          </div>

          {/* Live Total */}
          <div className="card bg-dark text-white shadow mb-4 border-0">
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2 small opacity-75">
                <span>Materials Total:</span>
                <span>€{materialsTotal.toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between mb-3 small opacity-75">
                <span>Move Price:</span>
                <span>€{quoteData.estimatedMovePrice.toFixed(2)}</span>
              </div>
              <hr className="border-white opacity-50" />
              <div className="d-flex justify-content-between align-items-center">
                <span className="h5 mb-0 fw-bold">Admin Estimate Total</span>
                <span className="h2 mb-0 fw-bold text-warning">€{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ================= DISPATCH TO MOVERS ================= */}
          <div className="card shadow-sm border-primary mb-4">
            <div className="card-header bg-primary text-white fw-bold">
              Dispatch to Moving Companies
            </div>
            <div className="card-body">
              <label htmlFor="moverEmails" className="form-label fw-semibold">
                Moving Company Emails
              </label>
              <textarea
                id="moverEmails"
                className="form-control mb-2"
                rows={4}
                placeholder="Enter emails separated by commas or new lines...&#10;e.g.,&#10;contact@mover1.com&#10;devis@mover2.fr"
                value={moverEmails}
                onChange={(e) => setMoverEmails(e.target.value)}
              />
              <div className="form-text text-muted mb-3">
                This will send the customer's photos, address, date, and your generated material list to these companies to request their best rates.
              </div>

              <div className="d-grid gap-2">
                <button
                  type="submit"
                  disabled={isDispatching}
                  className="btn btn-success btn-lg fw-bold py-3 shadow"
                >
                  {isDispatching ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Dispatching Requests...
                    </>
                  ) : (
                    '📤 Send Quote Request to Movers'
                  )}
                </button>
              </div>
            </div>
          </div>

        </form>
      )}
    </div>
  );
}