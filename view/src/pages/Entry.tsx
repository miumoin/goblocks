import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface MaterialRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface PartnerQuoteData {
  totalM3: number;
  materials: MaterialRow[];
  movePrice: number;
}

interface CompanyInfo {
  companyName: string;
  companySiret: string;
  companyPhone: string;
  companyEmail: string;
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

// Cookie helpers
const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const COMPANY_COOKIE_KEY = 'witworks_partner_info';

const loadCompanyFromCookie = (): CompanyInfo => {
  try {
    const raw = getCookie(COMPANY_COOKIE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse company cookie', e);
  }
  return { companyName: '', companySiret: '', companyPhone: '', companyEmail: '' };
};

const saveCompanyToCookie = (info: CompanyInfo) => {
  setCookie(COMPANY_COOKIE_KEY, JSON.stringify(info));
};

export default function PartnerQuoteBuilder() {
  const { slug } = useParams<{ slug?: string }>();
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [data, setData] = useState<dataState>({
    slug: slug,
    file: null,
    block: { id: '', slug: '', title: '', metas: { Address: '', MoveDate: '', isFlexible: 'false', FlexibleDuration: '', Notes: '', Photos: [], Quote: '' } },
  });

  // Partner's company info (pre-filled from cookie)
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => loadCompanyFromCookie());

  // Quote data (pre-filled from admin's AI estimate)
  const [quoteData, setQuoteData] = useState<PartnerQuoteData>({
    totalM3: 0,
    movePrice: 0,
    materials: [],
  });

  const [siretError, setSiretError] = useState<string | null>(null);

  // Calculate totals
  const materialsTotal = quoteData.materials.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const grandTotal = materialsTotal + quoteData.movePrice;

  // ================= FETCH QUOTE DETAILS =================
  useEffect(() => {
    prepareQuote(slug);
  }, []);

  const prepareQuote = async (slug: string | undefined) => {
    if (!slug) {
      setLoadError('Aucun identifiant de demande fourni dans l\'URL.');
      setIsLoading(false);
      return;
    }

    const isSubmitted = ( getCookie(`quote_submitted_${slug}`) !== null ? true : false );
    console.log( isSubmitted + ' - ' + getCookie(`quote_submitted_${slug}`) )
    if( isSubmitted ) {
      setIsLoading(false);
      setIsSubmitted(isSubmitted);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(App.api_base + '/partnerDevis/' + slug, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Vuedoo-Domain': App.domain,
          'X-Vuedoo-Access-Key': '',
        },
      });

      if (!response.ok) {
        throw new Error('La réponse du réseau n\'est pas valide');
      }

      const res = await response.json();

      if (res.status === 'success' && res.devis) {
        // Parse photos
        if (res.devis.metas && res.devis.metas.Photos) {
          const photos =
            typeof res.devis.metas.Photos === 'string'
              ? JSON.parse(res.devis.metas.Photos)
              : res.devis.metas.Photos;
          res.devis.metas.Photos = photos;
        }

        // Parse AI-generated quote from admin
        if (res.devis.metas && res.devis.metas.Quote) {
          const quoteJson =
            typeof res.devis.metas.Quote === 'string'
              ? JSON.parse(res.devis.metas.Quote)
              : res.devis.metas.Quote;

          const materialsUpdated = (quoteJson.materials || []).map((item: any, index: number) => {
            // Handle both formats: {name: qty} or {id, name, quantity, unitPrice}
            if (typeof item === 'object' && item.name !== undefined && item.quantity !== undefined) {
              return {
                id: item.id || String(index + 1),
                name: item.name,
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
              };
            }
            // Legacy format: {"material name": quantity}
            const name = Object.keys(item)[0];
            const quantity = item[name];
            return {
              id: String(index + 1),
              name: name,
              quantity: Number(quantity) || 0,
              unitPrice: 0,
            };
          });

          setQuoteData({
            totalM3: Number(quoteJson.totalM3 ?? 0),
            movePrice: Number(quoteJson.estimatedMovePrice ?? 0),
            materials: materialsUpdated,
          });
        }

        setData((prevData) => ({ ...prevData, block: res.devis }));
      } else {
        setLoadError('Demande introuvable ou non disponible.');
      }
    } catch (error) {
      console.error(error);
      setLoadError('Impossible de charger cette demande de devis. Veuillez vérifier le lien ou réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // ================= COMPANY INFO HANDLERS =================
  const handleCompanyChange = (field: keyof CompanyInfo, value: string) => {
    const updated = { ...companyInfo, [field]: value };
    setCompanyInfo(updated);

    // Persist to cookie on every change
    saveCompanyToCookie(updated);

    // Validate SIRET in real-time
    if (field === 'companySiret') {
      const cleaned = value.replace(/\s/g, '');
      if (cleaned === '') {
        setSiretError(null);
      } else if (!/^\d{0,14}$/.test(cleaned)) {
        setSiretError('Le SIRET ne doit contenir que des chiffres');
      } else if (cleaned.length === 14) {
        setSiretError(null);
      } else {
        setSiretError(`Le SIRET doit contenir 14 chiffres (${cleaned.length}/14)`);
      }
    }
  };

  // ================= QUOTE EDIT HANDLERS =================
  const handleNumberChange = (field: keyof PartnerQuoteData, value: string) => {
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

  // ================= SUBMIT QUOTE =================
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate company info
    if (!companyInfo.companyName.trim()) {
      alert('Veuillez saisir le nom de votre entreprise.');
      return;
    }
    const siretClean = companyInfo.companySiret.replace(/\s/g, '');
    if (!/^\d{14}$/.test(siretClean)) {
      alert('Veuillez saisir un numéro SIRET valide à 14 chiffres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(App.api_base + '/submitDevis/' + slug, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vuedoo-Domain': App.domain,
          'X-Vuedoo-Access-Key': '',
        },
        body: JSON.stringify({
          companyName: companyInfo.companyName,
          companySiret: siretClean,
          companyPhone: companyInfo.companyPhone,
          companyEmail: companyInfo.companyEmail,
          totalM3: quoteData.totalM3,
          movePrice: quoteData.movePrice,
          materialsTotal,
          grandTotal,
          materials: quoteData.materials,
        }),
      });

      if (!response.ok) {
        throw new Error('La demande d\'envoi a échoué');
      }

      const json = await response.json();
      if (json.status === 'success') {
        setIsSubmitted(true)
        setCookie(`quote_submitted_${slug}`, "Devis Number: " + json.devisNumber);
        alert(`Devis envoyé avec succès au client !\nTotal : ${grandTotal.toFixed(2)} €`);
      } else {
        throw new Error(json.error || 'L\'envoi a échoué');
      }
    } catch (error) {
      console.error(error);
      alert('Échec de l\'envoi du devis. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // ================= LOADING STATE =================
  if (isLoading) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: '700px' }}>
        <div
          className="spinner-border text-primary"
          role="status"
          style={{ width: '3rem', height: '3rem' }}
        >
          <span className="visually-hidden">Chargement...</span>
        </div>
        <p className="mt-3 text-muted">Chargement de la demande de devis...</p>
      </div>
    );
  }

  // ================= ERROR STATE =================
  if (loadError) {
    return (
      <div className="container py-5" style={{ maxWidth: '700px' }}>
        <div className="alert alert-danger" role="alert">
          <h5 className="alert-heading">Impossible de charger la demande</h5>
          <p className="mb-0">{loadError}</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="container py-5" style={{ maxWidth: '700px' }}>
        <div className="alert alert-success" role="alert">
          <h5 className="alert-heading">Demande soumise</h5>
          <p className="mb-0">Votre demande de devis a été soumise avec succès.</p>
        </div>
      </div>
    );
  }

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
            onClick={(e) => {
              e.stopPropagation();
              setModalImage(null);
            }}
          >
            &times;
          </button>
          <img
            src={modalImage}
            alt="Vue agrandie"
            className="img-fluid rounded shadow-lg"
            style={{ maxHeight: '90vh', maxWidth: '95vw', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ================= HEADER ================= */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div>
          <h4 className="fw-bold text-primary mb-1">Nouvelle demande de devis</h4>
          <span className="badge bg-secondary">Réf : {data.block.id || slug}</span>
        </div>
        <span className="badge bg-warning text-dark fs-6 px-3 py-2">En attente de votre offre</span>
      </div>

      <form onSubmit={handleSubmitQuote}>
        {/* ================= YOUR COMPANY INFO ================= */}
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <h6 className="fw-bold text-uppercase text-muted small mb-3">
              Informations de votre entreprise
            </h6>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label small text-muted fw-bold text-uppercase mb-1">
                  Nom de l'entreprise *
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  value={companyInfo.companyName}
                  onChange={(e) => handleCompanyChange('companyName', e.target.value)}
                  placeholder="ex : Déménagements Express SAS"
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label small text-muted fw-bold text-uppercase mb-1">
                  Numéro SIRET *
                </label>
                <input
                  type="text"
                  className={`form-control form-control-lg ${siretError ? 'is-invalid' : ''}`}
                  value={companyInfo.companySiret}
                  onChange={(e) => handleCompanyChange('companySiret', e.target.value)}
                  placeholder="123 456 789 00012"
                  maxLength={17}
                  required
                />
                <div className="form-text">Votre numéro d'inscription au registre du commerce (14 chiffres)</div>
                {siretError && <div className="invalid-feedback d-block">{siretError}</div>}
              </div>
              <div className="col-12">
                <label className="form-label small text-muted fw-bold text-uppercase mb-1">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  className="form-control form-control-lg"
                  value={companyInfo.companyEmail}
                  onChange={(e) => handleCompanyChange('companyEmail', e.target.value)}
                  placeholder="example@company.com"
                />
              </div>
              <div className="col-12">
                <label className="form-label small text-muted fw-bold text-uppercase mb-1">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  className="form-control form-control-lg"
                  value={companyInfo.companyPhone}
                  onChange={(e) => handleCompanyChange('companyPhone', e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </div>
            <div className="form-text mt-2">
              💾 Les informations de votre entreprise sont sauvegardées localement pour vos prochaines demandes.
            </div>
          </div>
        </div>

        {/* ================= CUSTOMER INFO (Read-Only) ================= */}
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <h6 className="fw-bold text-uppercase text-muted small mb-3">
              Informations du client
            </h6>
            <div className="row g-3">
              <div className="col-md-6">
                <div className="small text-muted">Contact</div>
                <div className="fw-semibold">{data.block.title || '—'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Date souhaitée</div>
                <div className="fw-semibold">{formatDate(data.block.metas.MoveDate)}</div>
              </div>
              <div className="col-12">
                <div className="small text-muted">Adresse de déménagement</div>
                <div className="fw-semibold">{data.block.metas.Address || '—'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Flexibilité</div>
                <div className="fw-semibold">
                  {data.block.metas.isFlexible === 'true'
                    ? `Oui (± ${String(data.block.metas.FlexibleDuration || '').replace('_', ' ')})`
                    : 'Non'}
                </div>
              </div>
              {data.block.metas.Notes && (
                <div className="col-12">
                  <div className="small text-muted">Notes du client</div>
                  <div className="fw-semibold p-2 rounded border">
                    « {data.block.metas.Notes} »
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= CUSTOMER PHOTOS ================= */}
        {data.block.metas.Photos && data.block.metas.Photos.length > 0 && (
          <div className="mb-4">
            <h6 className="fw-bold text-uppercase text-muted small mb-2">
              Photos du client ({data.block.metas.Photos.length}) — Cliquez pour agrandir
            </h6>
            <div
              className="d-flex gap-2 overflow-auto pb-2"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {data.block.metas.Photos.map((src: string, idx: number) => {
                const fullUrl =
                  src.startsWith('http')
                    ? src
                    : 'https://typewriting-ai-new.s3.us-west-2.amazonaws.com/' + src;
                return (
                  <img
                    key={idx}
                    src={fullUrl}
                    alt={`Article du client ${idx + 1}`}
                    className="rounded border flex-shrink-0"
                    style={{
                      width: '100px',
                      height: '100px',
                      objectFit: 'cover',
                      scrollSnapAlign: 'start',
                      cursor: 'zoom-in',
                    }}
                    onClick={() => setModalImage(fullUrl)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ================= ADMIN'S ESTIMATE (Editable by Partner) ================= */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="badge bg-info text-dark fs-6">Estimation pré-remplie</span>
          <h5 className="fw-bold mb-0">Votre devis</h5>
        </div>

        <div className="alert alert-light border small mb-3">
          💡 Le volume et les matériaux ci-dessous sont pré-remplis sur la base de l'analyse IA des photos du client par l'administrateur. Ajustez-les selon votre évaluation professionnelle.
        </div>

        {/* Editable Volume */}
        <div className="mb-4">
          <label className="form-label fw-bold mb-1">Volume total estimé</label>
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
          <label className="form-label fw-bold mb-2">Matériaux d'emballage</label>
          <div className="table-responsive bg-white rounded border">
            <table className="table table-borderless mb-0 align-middle">
              <thead className="table-light small text-muted">
                <tr>
                  <th style={{ width: '40%' }} className="ps-3">
                    Article
                  </th>
                  <th style={{ width: '15%' }} className="text-center">
                    Qté
                  </th>
                  <th style={{ width: '20%' }} className="text-end">
                    Unité (€)
                  </th>
                  <th style={{ width: '15%' }} className="text-end">
                    Total
                  </th>
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
                        placeholder="ex : Papier bulle"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm text-center"
                        value={item.quantity}
                        onChange={(e) =>
                          updateMaterial(item.id, 'quantity', parseInt(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control form-control-sm text-end"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateMaterial(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="text-end fw-semibold pe-2">
                      {(item.quantity * item.unitPrice).toFixed(2)} €
                    </td>
                    <td className="text-center pe-2">
                      <button
                        type="button"
                        className="btn btn-sm text-danger p-0"
                        onClick={() => removeMaterialRow(item.id)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quoteData.materials.length === 0 && (
              <div className="text-center text-muted p-3 small">Aucun matériau ajouté.</div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-outline-primary w-100 mt-2 fw-semibold py-2"
            onClick={addMaterialRow}
          >
            + Ajouter une ligne de matériau
          </button>
        </div>

        {/* Editable Move Price */}
        <div className="mb-4">
          <label className="form-label fw-bold mb-1">Prix du déménagement (Main-d'œuvre, transport, etc.)</label>
          <div className="input-group input-group-lg">
            <span className="input-group-text fw-bold">€</span>
            <input
              type="number"
              step="1"
              min="0"
              className="form-control fw-bold text-primary"
              value={quoteData.movePrice}
              onChange={(e) => handleNumberChange('movePrice', e.target.value)}
            />
          </div>
        </div>

        {/* ================= TOTALS ================= */}
        <div className="card bg-primary text-white shadow mb-4 border-0">
          <div className="card-body">
            <div className="d-flex justify-content-between mb-2 small opacity-75">
              <span>Total matériaux :</span>
              <span>{materialsTotal.toFixed(2)} €</span>
            </div>
            <div className="d-flex justify-content-between mb-3 small opacity-75">
              <span>Prix du déménagement :</span>
              <span>{quoteData.movePrice.toFixed(2)} €</span>
            </div>
            <hr className="border-white opacity-50" />
            <div className="d-flex justify-content-between align-items-center">
              <span className="h5 mb-0 fw-bold">Total de votre devis</span>
              <span className="h2 mb-0 fw-bold text-warning">{grandTotal.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* ================= SUBMIT ================= */}
        <div className="d-grid gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !!siretError}
            className="btn btn-success btn-lg fw-bold py-3 shadow"
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Envoi du devis en cours...
              </>
            ) : (
              '✓ Envoyer le devis au client'
            )}
          </button>
        </div>

        <p className="text-center text-muted small mt-3">
          En envoyant ce devis, votre offre sera transmise directement au client.
        </p>
      </form>
    </div>
  );
}