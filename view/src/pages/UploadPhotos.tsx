import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface PhotoItem {
  file: File;
  preview: string;
}

interface FormData {
  address: string;
  notes: string;
  moveDate: string;
  isFlexible: boolean;
  flexibleDuration: string;
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

export default function MobilePhotoCapture() {
  const { slug } = useParams<{ slug?: string }>();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [data, setData] = useState<dataState>({
        slug: slug,
        file: null,
        block: { id: '', slug: '', title: '', metas: { prompt: '', description: '', logo: '' }, status: 1, created_at: '', modified_at: '' },
    });
  
  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [formData, setFormData] = useState<FormData>({
    address: '',
    notes: '',
    moveDate: '',
    isFlexible: false,
    flexibleDuration: '1_week',
  });

  // Get today's date in YYYY-MM-DD format for the min attribute
  const today = new Date().toISOString().split('T')[0];

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
          setData((prevData) => ({ ...prevData, block: res.devis }));
          setIsUploaded(res.devis.status === 2); // If status is 2, mark as uploaded
      } else {
          window.location.href = '/NotFound';
      }
  };

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      stopCamera();
    };
  }, [photos]);

  // Handle Camera Stream Lifecycle
  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCamera]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Forces rear camera on mobile
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied or not supported:', err);
      setCameraError('Unable to access camera. Please ensure you have granted camera permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const preview = URL.createObjectURL(file);
            
            setPhotos((prev) => [...prev, { file, preview }]);
            setShowCamera(false);
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => {
      const newPhotos = [...prev];
      const removed = newPhotos.splice(indexToRemove, 1);
      if (removed[0]) {
        URL.revokeObjectURL(removed[0].preview);
      }
      return newPhotos;
    });
  };

  const handleFinish = () => {
    if (photos.length === 0) {
      alert('Please take at least one photo before finishing.');
      return;
    }
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (photos.length === 0) {
      alert('Please add at least one photo before submitting.');
      return;
    }

    if (!formData.moveDate) {
      alert('Please select your preferred move date before submitting.');
      return;
    }

    setIsUploading(true);

    const payload = new FormData();
    payload.append('address', formData.address);
    payload.append('moveDate', formData.moveDate);
    payload.append('isFlexible', formData.isFlexible.toString());
    payload.append('flexibleDuration', formData.isFlexible ? formData.flexibleDuration : 'none');
    payload.append('notes', formData.notes);
    payload.append('slug', data.slug || '');
    
    photos.forEach((photo) => {
      payload.append('photos[]', photo.file);
    });

    try {
      const response = await fetch(App.api_base + '/devis/' + data.slug + '/upload', {
        method: 'POST',
        headers: {
              'X-Vuedoo-Domain': App.domain,
              'X-Vuedoo-Access-Key': ''
          },
        body: payload,
      });

      if (!response.ok) {
        throw new Error('Upload request failed');
      }

      const result = await response.json();
      if (result.status && result.status !== 'success') {
        throw new Error(result.message || 'Upload failed');
      }

      setIsUploaded(true); // Mark as uploaded to prevent further edits
      
      // Reset state
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setShowForm(false);
      setFormData({ address: '', moveDate: '', isFlexible: false, flexibleDuration: '1_week', notes: '' });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '500px' }}>
    { isUploaded &&
      (
      <div className="alert alert-warning text-center" role="alert">
        <strong>We've received your request!</strong> Our team will review your submission and <strong>email</strong> you with a quote very soon. Just a heads-up: you won't be able to upload more photos or make edits at this point. Thanks for trusting us with your project!
      </div>
      )
    }

    { !isUploaded && (
      <>
        {/* ================= CAMERA VIEWFINDER ================= */}
        {showCamera ? (
          <div className="position-fixed top-0 start-0 w-100 h-100 bg-black d-flex flex-column z-3">
            {cameraError ? (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-white p-4 text-center">
                <p className="mb-3">{cameraError}</p>
                <button className="btn btn-primary" onClick={() => setShowCamera(false)}>
                  Go Back
                </button>
              </div>
            ) : (
              <>
                <canvas ref={canvasRef} className="d-none" />
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-100 h-100 object-fit-cover"
                  style={{ maxHeight: '70vh' }}
                />
                <div className="d-flex justify-content-between align-items-center p-4 bg-black">
                  <button 
                    className="btn btn-outline-light rounded-circle" 
                    style={{ width: '50px', height: '50px' }}
                    onClick={() => setShowCamera(false)}
                  >
                    ✕
                  </button>
                  <button 
                    className="btn btn-light rounded-circle border border-4 border-secondary" 
                    style={{ width: '70px', height: '70px' }}
                    onClick={capturePhoto}
                  >
                    <div className="bg-dark rounded-circle" style={{ width: '55px', height: '55px' }}></div>
                  </button>
                  <div style={{ width: '50px' }}></div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ================= MAIN GALLERY & FORM VIEW ================= */
          <>
            <h4 className="text-center mb-4 fw-bold text-primary">
              {showForm ? 'Finalize Your Quote' : 'Capture Your Items'}
            </h4>

            {!showForm ? (
              <>
                <div className="alert alert-primary d-flex align-items-start mb-4" role="alert">
                  <span className="fs-4 me-2">📸</span>
                  <div>
                    <strong>Photo Instructions:</strong>
                    <p className="mb-0 small">
                      Please capture your furniture ensuring that a <strong>little bit of the ceiling and floor is visible</strong> in the frame. This helps us analyze dimensions for an accurate quote.
                    </p>
                  </div>
                </div>
                
                <div className="row row-cols-3 g-2 mb-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="col position-relative">
                      <img
                        src={photo.preview}
                        alt={`Capture ${index + 1}`}
                        className="img-thumbnail w-100 object-fit-cover"
                        style={{ height: '100px', aspectRatio: '1/1' }}
                      />
                      <span className="position-absolute bottom-0 start-0 bg-dark bg-opacity-75 text-white px-2 py-1 rounded-end" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                        {index + 1}
                      </span>
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="position-absolute top-0 end-0 btn btn-sm btn-danger rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: '24px', height: '24px', padding: 0, margin: '4px' }}
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <div className="col">
                    <button
                      onClick={() => setShowCamera(true)}
                      className="btn btn-outline-primary w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                      style={{ height: '100px', aspectRatio: '1/1', borderStyle: 'dashed', borderWidth: '2px' }}
                    >
                      <span style={{ fontSize: '28px' }}>📷</span>
                      <span className="small fw-bold mt-1">Open Camera</span>
                    </button>
                  </div>
                </div>

                {photos.length === 0 && (
                  <p className="text-center text-muted small mb-4">
                    Tap "Open Camera" to start capturing your items directly.
                  </p>
                )}

                <div className="d-grid gap-2 mt-auto">
                  {photos.length > 0 && (
                    <div className="row g-2">
                      <div className="col-6">
                        <button
                          onClick={() => {
                            handleRemovePhoto(photos.length - 1);
                            setShowCamera(true);
                          }}
                          className="btn btn-secondary w-100"
                        >
                          ↺ Retake Last
                        </button>
                      </div>
                      <div className="col-6">
                        <button
                          onClick={() => setShowCamera(true)}
                          className="btn btn-primary w-100"
                        >
                          + Take Another
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleFinish}
                    disabled={photos.length === 0}
                    className="btn btn-success btn-lg mt-2 fw-bold"
                  >
                    ✓ Finish & Get Quote
                  </button>
                </div>
              </>
            ) : (
              /* ================= FINAL FORM STATE ================= */
              <form onSubmit={handleSave}>
                <div className="mb-4">
                  <label className="form-label text-muted small text-uppercase fw-bold">
                    Captured Photos ({photos.length})
                  </label>
                  <div className="d-flex gap-2 overflow-auto pb-2">
                    {photos.map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo.preview}
                        alt={`Preview ${idx + 1}`}
                        className="img-thumbnail flex-shrink-0"
                        style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Address Field */}
                <div className="mb-3">
                  <label htmlFor="address" className="form-label fw-semibold">Moving Address</label>
                  <input
                    type="text"
                    id="address"
                    className="form-control"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City, State, ZIP"
                  />
                </div>

                {/* Date Picker Field */}
                <div className="mb-3">
                  <label htmlFor="moveDate" className="form-label fw-semibold">Preferred Move Date</label>
                  <input
                    type="date"
                    id="moveDate"
                    className="form-control"
                    required
                    min={today}
                    value={formData.moveDate}
                    onChange={(e) => setFormData({ ...formData, moveDate: e.target.value })}
                  />
                </div>

                {/* Flexible Date Checkbox */}
                <div className="mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="isFlexible"
                      checked={formData.isFlexible}
                      onChange={(e) => setFormData({ ...formData, isFlexible: e.target.checked })}
                    />
                    <label className="form-check-label fw-semibold" htmlFor="isFlexible">
                      My move date is flexible
                    </label>
                  </div>
                </div>

                {/* Flexible Duration Dropdown */}
                <div className="mb-4">
                  <label htmlFor="flexibleDuration" className={`form-label fw-semibold ${!formData.isFlexible ? 'text-muted' : ''}`}>
                    Flexibility Window
                  </label>
                  <select
                    id="flexibleDuration"
                    className="form-select"
                    disabled={!formData.isFlexible}
                    value={formData.flexibleDuration}
                    onChange={(e) => setFormData({ ...formData, flexibleDuration: e.target.value })}
                  >
                    <option value="1_day">1 day</option>
                    <option value="2_days">2 days</option>
                    <option value="1_week">1 week</option>
                    <option value="2_weeks">2 weeks</option>
                    <option value="1_month">1 month</option>
                  </select>
                  {!formData.isFlexible && (
                    <div className="form-text text-muted">Check the box above to specify a flexibility window.</div>
                  )}
                </div>

                {/* Notes Field */}
                <div className="mb-3">
                  <label htmlFor="notes" className="form-label fw-semibold">Notes</label>
                  <input
                    type="text"
                    id="notes"
                    className="form-control"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes about your move, i.e. parking restrictions, narrow stairs, etc."
                  />
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn btn-outline-secondary"
                  >
                    ← Back to Photos
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn btn-primary btn-lg fw-bold"
                  >
                    {isUploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Submitting...
                      </>
                    ) : (
                      'Save & Submit Quote'
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </>
    )}
    </div>
  );
}