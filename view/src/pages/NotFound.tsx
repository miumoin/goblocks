import React from "react";
import ErrorText from "../components/ErrorText";
import Header from '../components/Header';
import Footer from '../components/Footer';

const NotFound: React.FC = () => {
    return (
        <>
            <Header />
            <ErrorText />
            <Footer />
        </>
    );
};

export default NotFound;