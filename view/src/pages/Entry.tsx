import React, { useState, useEffect } from 'react';

interface MaterialRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteData {
  companyName: string;
  companyPhone: string;
  totalM3: number;
  materials: MaterialRow[];
  movePrice: number;
}

// Mock customer photos (replace with actual photos from the previous step)
const MOCK_CUSTOMER_PHOTOS = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
];

export default function MoverQuoteBuilder() {
  const [isSending, setIsSending] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null); // State for photo modal
  
  const [quote, setQuote] = useState<QuoteData>({
    companyName: 'Swift Movers',
    companyPhone: '+33 6 12 34 56 78',
    totalM3: 25.5,
    movePrice: 450,
    materials: [
      { id: '1', name: 'Standard Carton', quantity: 15, unitPrice: 2.50 },
      { id: '2', name: 'Book Carton (Renforcé)', quantity: 5, unitPrice: 3.00 },
      { id: '3', name: 'Penderie (Wardrobe)', quantity: 2, unitPrice: 4.50 },
    ],
  });

  // Calculate totals dynamically
  const materialsTotal = quote.materials.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const grandTotal = materialsTotal + quote.movePrice;

  const handleCompanyChange = (field: keyof QuoteData, value: string) => {
    setQuote((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: keyof QuoteData, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setQuote((prev) => ({ ...prev, [field]: numValue }));
  };

  const updateMaterial = (id: string, field: keyof MaterialRow, value: string | number) => {
    setQuote((prev) => ({
      ...prev,
      materials: prev.materials.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addMaterialRow = () => {
    const newRow: MaterialRow = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      unitPrice: 0,
    };
    setQuote((prev) => ({
      ...prev,
      materials: [...prev.materials, newRow],
    }));
  };

  const removeMaterialRow = (id: string) => {
    setQuote((prev) => ({
      ...prev,
      materials: prev.materials.filter((item) => item.id !== id),
    }));
  };

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      alert(`Quote successfully sent to the customer!\nTotal: €${grandTotal.toFixed(2)}`);
    } catch (error) {
      alert('Failed to send quote. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container py-3 pb-5" style={{ maxWidth: '600px' }}>
      
      {/* ================= PHOTO MODAL (Full Screen) ================= */}
      {modalImage && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-black bg-opacity-90 d-flex align-items-center justify-content-center z-3"
          onClick={() => setModalImage(null)} // Close when clicking background
          style={{ cursor: 'zoom-out' }}
        >
          <button 
            className="position-absolute top-0 end-0 btn btn-link text-white p-3 fs-1 fw-bold"
            onClick={(e) => {
              e.stopPropagation();
              setModalImage(null);
            }}
            style={{ zIndex: 4 }}
          >
            &times;
          </button>
          <img 
            src={modalImage} 
            alt="Zoomed view" 
            className="img-fluid rounded shadow-lg" 
            style={{ maxHeight: '90vh', maxWidth: '95vw', objectFit: 'contain', cursor: 'default' }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
          />
        </div>
      )}

      {/* ================= NORMAL HEADER (No white box, blends with background) ================= */}
      <div className="mb-4 pb-3 border-bottom">
        <h4 className="fw-bold text-primary mb-3">New Quote Request</h4>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small text-muted fw-bold text-uppercase mb-1">Your Company Name</label>
            <input
              type="text"
              className="form-control form-control-lg"
              value={quote.companyName}
              onChange={(e) => handleCompanyChange('companyName', e.target.value)}
            />
          </div>
          <div className="col-12">
            <label className="form-label small text-muted fw-bold text-uppercase mb-1">Your Phone Number</label>
            <input
              type="tel"
              className="form-control form-control-lg"
              value={quote.companyPhone}
              onChange={(e) => handleCompanyChange('companyPhone', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ================= CUSTOMER PHOTOS ================= */}
      <div className="mb-4">
        <h6 className="fw-bold text-muted text-uppercase small mb-2">Customer Photos (Tap to Zoom)</h6>
        <div className="d-flex gap-2 overflow-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
          {MOCK_CUSTOMER_PHOTOS.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`Customer item ${idx + 1}`}
              className="rounded border flex-shrink-0"
              style={{ 
                width: '100px', 
                height: '100px', 
                objectFit: 'cover', 
                scrollSnapAlign: 'start',
                cursor: 'zoom-in',
                transition: 'transform 0.2s'
              }}
              onClick={() => setModalImage(src)}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            />
          ))}
        </div>
      </div>

      {/* ================= QUOTE FORM ================= */}
      <form onSubmit={handleSendQuote}>
        
        {/* Volume */}
        <div className="mb-4">
          <label className="form-label fw-bold mb-1">Total Estimated Volume</label>
          <div className="input-group input-group-lg">
            <input
              type="number"
              step="0.1"
              className="form-control fw-bold text-primary"
              value={quote.totalM3}
              onChange={(e) => handleNumberChange('totalM3', e.target.value)}
            />
            <span className="input-group-text fw-bold bg-light">m³</span>
          </div>
        </div>

        {/* Materials List */}
        <div className="mb-4">
          <label className="form-label fw-bold mb-2">Packing Materials</label>
          
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
                {quote.materials.map((item) => (
                  <tr key={item.id} className="border-top">
                    <td className="ps-3">
                      <input
                        type="text"
                        className="form-control form-control-sm border-0 bg-transparent fw-semibold"
                        value={item.name}
                        onChange={(e) => updateMaterial(item.id, 'name', e.target.value)}
                        placeholder="e.g., Bubble wrap"
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
                      <button
                        type="button"
                        className="btn btn-sm text-danger p-0"
                        onClick={() => removeMaterialRow(item.id)}
                        title="Remove row"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quote.materials.length === 0 && (
              <div className="text-center text-muted p-3 small">
                No materials added yet.
              </div>
            )}
          </div>
          
          {/* Prominent Add Row Button */}
          <button
            type="button"
            className="btn btn-outline-primary w-100 mt-2 fw-semibold py-2"
            onClick={addMaterialRow}
          >
            + Add Material Row
          </button>
        </div>

        {/* Move Price (Labor/Transport) */}
        <div className="mb-4">
          <label className="form-label fw-bold mb-1">Move Price (Labor, Transport, etc.)</label>
          <div className="input-group input-group-lg">
            <span className="input-group-text fw-bold bg-light">€</span>
            <input
              type="number"
              step="1"
              min="0"
              className="form-control fw-bold text-primary"
              value={quote.movePrice}
              onChange={(e) => handleNumberChange('movePrice', e.target.value)}
            />
          </div>
        </div>

        {/* ================= TOTALS & ACTION ================= */}
        <div className="card bg-primary text-white shadow-lg mb-4 border-0">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-2 small opacity-75">
              <span>Materials Total:</span>
              <span>€{materialsTotal.toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between mb-3 small opacity-75">
              <span>Move Price:</span>
              <span>€{quote.movePrice.toFixed(2)}</span>
            </div>
            <hr className="border-white opacity-50" />
            <div className="d-flex justify-content-between align-items-center">
              <span className="h5 mb-0 fw-bold">Total Quote</span>
              <span className="h2 mb-0 fw-bold">€{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="d-grid">
          <button
            type="submit"
            disabled={isSending}
            className="btn btn-success btn-lg fw-bold py-3 shadow"
          >
            {isSending ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Sending Quote...
              </>
            ) : (
              '✓ Send Quote to Customer'
            )}
          </button>
        </div>

      </form>
    </div>
  );
}