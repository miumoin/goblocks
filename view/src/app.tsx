// @ts-ignore: side-effect import for CSS handled by bundler
import './styles/app.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from "@react-oauth/google";
import Home from './pages/Home';
import UploadPhotos from './pages/UploadPhotos';
import Entry from './pages/Entry';
import Entries from './pages/Entries';
import NotFound from './pages/NotFound';
import Manage from './pages/Manage';

const App: React.FC = () => {
    return (
        <>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/quote/:slug/upload" element={<UploadPhotos />} />
                    <Route path="/quote/:slug" element={<Entry />} />
                    <Route path="/entries/:pageNo" element={<Entries />} />
                    <Route path="/entry/:slug" element={<Manage />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Router>
        </>
    );
}

export default App;