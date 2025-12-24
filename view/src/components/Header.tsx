import React from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const Header: React.FC = () => {
    return (
        <header className="container mt-4">
            <div className="d-flex flex-column flex-md-row align-items-center pb-3 border-bottom">
                <a href="/" className="d-flex align-items-center link-body-emphasis text-decoration-none">
                    <img src="https://typewriting.ai/Typewriting-logo.jpg" alt="Logo" className="me-2" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
                    <span className="fs-4">Typewriting</span>
                </a>
                <div className="d-inline-flex mt-2 mt-md-0 ms-md-auto">
                    <WorkspaceSwitcher />
                </div>
            </div>
        </header>
    );
};
export default Header;