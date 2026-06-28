// Import React and ReactDOM
import React, {useState, useEffect} from 'react';
import Cookies from 'js-cookie';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageLoader from '../components/PageLoader';
import {getInitials} from '../components/utils';

interface dataState {
    isBlocked: boolean;
    isLoaded: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    email: string;
}

const Home: React.FC = () => {
    const [data, setData] = useState<dataState>({
        isBlocked: false,
        isLoaded: false,
        isSubmitted: false,
        isValid: true,
        email: '',
    });

    useEffect(() => {
        //Cookies.remove('devis_request_id');
        const devisId: string = Cookies.get(`devis_request_id`) || '';
        if( devisId != '' ) {
            setData(( prevData ) => ({ ...prevData, isBlocked: true }));
        }
    }, []);

    const initDevis = async (e: React.FormEvent): Promise<any> => {
        e.preventDefault();

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        let isValid = emailRegex.test(String(data.email).toLowerCase());

        if( data.email.trim() == '' && !isValid ) {
            setData((prevData) => ({ ...prevData, isValid: false }));
        } else {
            try {
                const response = await fetch(App.api_base + '/devis/init', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Vuedoo-Domain': App.domain,
                        'X-Vuedoo-Access-Key': ''
                    },
                    body: JSON.stringify({ email: data.email })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const res = await response.json();

                if (res.status === 'success') {
                    setData((prevData) => ({ ...prevData, isSubmitted: true, isBlocked: true }));
                    Cookies.set('devis_request_id', res.block.id, { expires: 1/12 }); // Expires in 2 hours
                }

                return 0;
            } catch (error) {
                console.error('Error:', error);
                return 0;
            }
        }
    };

    return (
        <>
        <Header />
<div className="cover-container d-flex h-100 p-3 mx-auto flex-column" style={{minHeight: '70vh', maxWidth: '44em', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
    <main role="main" className="inner cover">
        <h1 className="cover-heading">Looking to Move?</h1>
        <p className="lead">Just put your email address and click on Get Started.</p>
        
        {/* Email Form */}
        { !data.isBlocked ? (
            <form 
                className="mt-4 w-100 w-md-75 mx-auto" 
                onSubmit={initDevis}
                style={{ maxWidth: '400px' }}
            >
                <div className="input-group">
                    <input
                        type="email"
                        name="email"
                        className="form-control form-control-lg"
                        placeholder="Enter your email address"
                        aria-label="Email address"
                        required
                        onChange={(e) => setData((prevData) => ({ ...prevData, email: e.target.value }))}
                        disabled={data.isSubmitted || data.isBlocked}
                    />
                    <button 
                        className="btn btn-primary btn-lg px-4" 
                        type="submit"
                        disabled={data.isSubmitted || data.isBlocked}
                    >
                        Get Started
                    </button>
                </div>
                
                {/* Trust badges below form */}
                <div className="mt-3 px-3 py-2 rounded" style={{ 
                    backgroundColor: '#e7f3fe', 
                    border: '1px solid #b6d4fe',
                    color: '#084298',
                    fontSize: '0.9rem'
                }}>
                    { data.email != '' && data.isValid ? (
                        <span>⚠️ Please ensure your email is correct so we can deliver your quote promptly. To maintain a spam-free experience, you can submit one request every 2 hours.</span>
                    ) : data.email.trim() != '' && !data.isValid ? (
                        <span>❌ Oops! That doesn't look like a valid email address. Please double-check and try again.</span>
                    ) : data.isBlocked ? (
                        <span>🔒 You have reached the limit for submitting requests. Please try again later.</span>
                    ) : (
                        <span>🔒 Free, no obligation • No credit card required • Your info stays private</span>
                    ) }
                </div>
                
                <p className="text-muted small mt-2">
                    We'll send a secure link to your phone to snap photos of your items.
                </p>
            </form>
        ) : (
            /* ================= SUCCESS + WAITING STATE ================= */
            <div 
                className="mt-4 w-100 w-md-75 mx-auto text-center p-4 rounded-3"
                style={{ 
                    maxWidth: '400px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)'
                }}
            >
                {/* Success Icon */}
                <div 
                    className="d-inline-flex align-items-center justify-content-center mb-3"
                    style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(40, 167, 69, 0.2)',
                        border: '2px solid rgba(40, 167, 69, 0.4)'
                    }}
                >
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="32" 
                        height="32" 
                        fill="rgba(40, 167, 69, 1)" 
                        viewBox="0 0 16 16"
                    >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                    </svg>
                </div>

                {/* Title */}
                <h5 className="fw-bold text-white mb-2">
                    Request Received!
                </h5>

                {/* Message */}
                <p className="mb-3" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    Thanks for your submission! We're preparing your personalized quote now. 
                    You'll receive it in your inbox shortly — just keep an eye on your email.
                </p>

                {/* Info box */}
                <div 
                    className="px-3 py-2 rounded mx-auto mb-3"
                    style={{ 
                        backgroundColor: 'rgba(13, 202, 240, 0.1)',
                        border: '1px solid rgba(13, 202, 240, 0.3)',
                        color: '#0dcaf0',
                        fontSize: '0.85rem',
                        maxWidth: '320px'
                    }}
                >
                    💡 <strong>What's next?</strong> Check your email for a secure link to upload photos of your items. 
                    Once we have those, our AI will analyze them and connect you with trusted moving companies.
                </div>

                {/* Block explanation */}
                <div 
                    className="px-3 py-2 rounded mx-auto"
                    style={{ 
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        border: '1px solid rgba(255, 193, 7, 0.3)',
                        color: '#ffc107',
                        fontSize: '0.85rem',
                        maxWidth: '320px'
                    }}
                >
                    🔒 <strong>One request per day</strong> — To keep things fair and spam-free, 
                    new submissions are locked until tomorrow. But don't worry, your quote is on its way!
                </div>
            </div>
        )}
    </main> 
</div>

<hr/>

<section className="py-5">
    <div className="container">
        <div className="row justify-content-center">
            <div className="col-12">
                <h2 className="text-center mb-4">How It Works</h2>
                {/* Infographic Placeholder - Replace src with your actual infographic image */}
                <div className="mt-3 px-3 py-2 rounded" style={{ 
                    backgroundColor: '#e7f3fe', 
                    border: '1px solid #b6d4fe',
                    color: '#084298',
                    fontSize: '0.9rem'
                    }}>
                    <img 
                        src="https://wit-works-new-filebucket.s3.us-west-2.amazonaws.com/assets/public-files/move-infographic-1.jpeg" 
                        alt="How our moving quote process works - from email to quote"
                        style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
                    />
                    {/* Fallback text if image doesn't load */}
                    <p className="text-muted mt-3 small"  style={{ 
                    backgroundColor: '#212529', 
                    color: '#084298',
                    fontSize: '0.9rem'
                    }}>
                        1. Enter email → 2. Get mobile link → 3. Snap photos → 4. AI calculates → 5. Receive quotes
                    </p>
                </div>
            </div>
        </div>
    </div>
</section>

<hr/>

<section className="letter-section py-5">
    <div className="container">
        <div className="row justify-content-center">
            <div className="col-lg-10">
                <h2 className="text-center mb-5 fw-bold">How We Work</h2>
                
                <div className="letter-content" style={{ fontSize: '1.15rem', animation: 'fadeIn 1s ease-in' }}>
                    <p className="lead fw-bold mb-4" style={{ fontSize: '1.3rem' }}>
                        Get Your Free Moving Quote in 3 Simple Steps
                    </p>

                    <div className="step-card p-4 mb-4 rounded shadow-sm" style={{ backgroundColor: '#fff', borderLeft: '4px solid #0d6efd' }}>
                        <h5 className="fw-bold mb-2" style={{ color: '#212529' }}>📧 1. Enter Your Email</h5>
                        <p className="mb-0" style={{ color: '#212529' }}>Just provide your email address and click "Get Started." No lengthy forms, no phone calls—just a quick entry to begin.</p>
                    </div>

                    <div className="step-card p-4 mb-4 rounded shadow-sm" style={{ backgroundColor: '#fff', borderLeft: '4px solid #0d6efd' }}>
                        <h5 className="fw-bold mb-2" style={{ color: '#212529' }}>📱 2. Snap Photos on Your Phone</h5>
                        <p className="mb-0" style={{ color: '#212529' }}>We'll send you a secure link to open on your mobile device. Use it to take pictures of the items you're moving—furniture, boxes, appliances, interior rooms, or exterior access points. Our guided prompts make it easy.</p>
                    </div>

                    <div className="step-card p-4 mb-4 rounded shadow-sm" style={{ backgroundColor: '#fff', borderLeft: '4px solid #0d6efd' }}>
                        <h5 className="fw-bold mb-2" style={{ color: '#212529' }}>🤖 3. AI Calculates & Partners Quote</h5>
                        <p className="mb-0" style={{ color: '#212529' }}>Our AI analyzes your photos to estimate volume, weight, and required materials (boxes, padding, truck size). This data—<strong>without your email</strong>—is shared with our vetted partner moving companies. They review the visuals, adjust if needed, and submit competitive quotes back through our platform.</p>
                    </div>

                    <p className="highlight mt-4" style={{ fontSize: '1.2rem', fontWeight: 500, backgroundColor: '#e7f1ff', padding: '1rem', borderRadius: '8px', color: '#084298' }}>
                        🔒 Your Privacy First: Moving partners see your photos and move details—but never your email or personal contact info until <em>you</em> choose to connect directly.
                    </p>
                    
                    <p className="mt-4">
                        Once quotes are ready, you'll receive them in your inbox. Review options, compare prices, and when you're ready, get the partner's contact information to reach out directly—no middleman fees.
                    </p>

                    <p className="signature" style={{ fontSize: '1.2rem', marginTop: '2rem', fontStyle: 'italic' }}>
                        — Simple. Private. Smart Moving.
                    </p>
                </div>

                <style>
                    {`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        .step-card:hover {
                            transform: translateY(-2px);
                            transition: transform 0.2s ease;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                        }
                    `}
                </style>
            </div>
        </div>
    </div>
</section>

<hr/>

<section className="py-5 features-section">
    <div className="container">
        <h2 className="text-center mb-5 fw-bold">Why Move With Us</h2>
        
        <div className="row">
            <div className="col-md-6">
                <div className="feature-card p-4 rounded shadow-sm h-100">
                    <div className="d-flex align-items-center mb-3">
                        <div className="feature-icon me-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-camera" viewBox="0 0 16 16">
                                <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z"/>
                                <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"/>
                            </svg>
                        </div>
                        <h4 className="mb-0">Photo-Powered Estimates</h4>
                    </div>
                    <p className="mb-0">Skip guesswork. Our AI analyzes your photos to calculate accurate volume, weight, and packing needs—so quotes reflect your actual move, not generic averages.</p>
                </div>
            </div>

            <div className="col-md-6">
                <div className="feature-card p-4 rounded shadow-sm h-100">
                    <div className="d-flex align-items-center mb-3">
                        <div className="feature-icon me-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-shield-lock" viewBox="0 0 16 16">
                                <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
                                <path d="M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99A1.5 1.5 0 0 1 6.5 6.5V5a.5.5 0 0 1 1 0v1.5a.5.5 0 0 0 1 0V5a.5.5 0 0 1 1 0v1.5z"/>
                            </svg>
                        </div>
                        <h4 className="mb-0">Private by Design</h4>
                    </div>
                    <p className="mb-0">Your email and contact details stay hidden until you're ready. Partners receive only the photos and move details they need to quote—no spam, no unsolicited calls.</p>
                </div>
            </div>

            <div className="col-md-6">
                <div className="feature-card p-4 rounded shadow-sm h-100">
                    <div className="d-flex align-items-center mb-3">
                        <div className="feature-icon me-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-people" viewBox="0 0 16 16">
                                <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.26.26 0 0 1-.26.26H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816zM4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                            </svg>
                        </div>
                        <h4 className="mb-0">Vetted Partner Network</h4>
                    </div>
                    <p className="mb-0">We connect you with pre-screened, licensed moving companies. Each partner can review your photos and adjust their quote for accuracy—so you get realistic, competitive offers.</p>
                </div>
            </div>

            <div className="col-md-6">
                <div className="feature-card p-4 rounded shadow-sm h-100">
                    <div className="d-flex align-items-center mb-3">
                        <div className="feature-icon me-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-chat-left-quote" viewBox="0 0 16 16">
                                <path d="M2.5 3a1.5 1.5 0 0 0-1.5 1.5V13A1.5 1.5 0 0 0 2.5 14.5h13a1.5 1.5 0 0 0 1.5-1.5V4.5A1.5 1.5 0 0 0 15.5 3h-13zm13 1a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5h13z"/>
                                <path d="M7.086 6.5H5.5a.5.5 0 0 1 0-1h1.586l1.293-1.293a.5.5 0 1 1 .707.707L7.793 6.207l1.293 1.293a.5.5 0 0 1-.707.707L7.086 6.914V6.5zm3 0H8.5a.5.5 0 0 1 0-1h1.586l1.293-1.293a.5.5 0 1 1 .707.707L10.793 6.207l1.293 1.293a.5.5 0 0 1-.707.707L10.086 6.914V6.5z"/>
                            </svg>
                        </div>
                        <h4 className="mb-0">Direct Contact, Zero Fees</h4>
                    </div>
                    <p className="mb-0">When you find a quote you like, get the mover's direct contact info instantly. No platform fees, no markups—just you and the partner, moving forward together.</p>
                </div>
            </div>
        </div>

        <div className="text-center mt-5">
            {/* Scroll-to-top button */}
            <a 
                href="#top" 
                className="btn btn-primary btn-lg px-4"
                onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            >
                Get Your Free Quote
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-up ms-2" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/>
                </svg>
            </a>
            <p className="text-muted small mt-2">↑ Click to return to top and get started</p>
        </div>
    </div>
</section>
<Footer />
        </>
    );
}

export default Home;