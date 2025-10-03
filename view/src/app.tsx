import './styles/app.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from "@react-oauth/google";
import Home from './pages/Home';
import Chat from './pages/Chat';
import InitInvoice from './pages/InitInvoice';
import Login from './pages/Login';
import Verify from './pages/Verify';
import Profile from './pages/Profile';
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
                    <Route path="/organization/:slug/preference" element={<Preference />} />
                    <Route path="/organization/:slug/profile/:profileSlug" element={<Profile />} />
                    <Route path="/:slug" element={<InitInvoice />} />
                    <Route path="/chat/:slug" element={<Chat />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Router>
        </>
    );
}

export default App;