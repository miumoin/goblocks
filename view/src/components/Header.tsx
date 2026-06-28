import React from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const Header: React.FC = () => {
    return (
        <header className="container mt-4">
            <div className="d-flex flex-column flex-md-row align-items-center pb-3 border-bottom">
                <a href="/" className="d-flex align-items-center link-body-emphasis text-decoration-none">
                    {/* Text Logo Mark - "WW" monogram */}
                    <span 
                        className="d-flex align-items-center justify-content-center me-2 fw-bold text-white"
                        style={{ 
                            width: '44px', 
                            height: '44px', 
                            backgroundColor: '#1e3c78',
                            borderRadius: '8px',
                            fontSize: '20px',
                            letterSpacing: '-1px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                    >
                        WW
                    </span>
                    {/* Brand Name */}
                    <div className="d-flex flex-column lh-1">
                        <span className="fs-4 fw-bold" style={{ color: '#fff' }}>
                            Wit Works
                        </span>
                        <span className="small text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                            AI-POWERED MOVING QUOTES
                        </span>
                    </div>
                </a>
            </div>
        </header>
    );
};
export default Header;