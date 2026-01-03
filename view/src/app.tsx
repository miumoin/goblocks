import './styles/app.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from "@react-oauth/google";
import Home from './pages/Home';
import Agent from './pages/Agent';
import Contact from './pages/Contact';
import Knowledge from './pages/Knowledge';
import Login from './pages/Login';
import Verify from './pages/Verify';
import Thread from './pages/Thread';
import Organization from './pages/Organization';
import NewOrganization from './pages/NewOrganization';
import Preference from './pages/Preference';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
    return (
        <>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/verify" element={<Verify />} />
                    <Route path="/organization/new" element={<NewOrganization />} />
                    <Route path="/organization/:slug" element={<Organization />} />
                    <Route path="/organization/:slug/knowledge" element={<Knowledge />} />
                    <Route path="/organization/:slug/preference" element={<Preference />} />
                    <Route path="/organization/:slug/thread/:threadSlug" element={<Thread />} />
                    <Route path="/:slug" element={<Agent />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Router>
        </>
    );
}

export default App;