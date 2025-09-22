import React from "react";
import { Link } from "react-router-dom";

const ErrorText: React.FC = () => {
    return (
        <div style={{ 
            minHeight: "60vh", 
            display: "flex", 
            flexDirection: "column", 
            justifyContent: "center", 
            alignItems: "center", 
            textAlign: "center"
        }}>
            <h1>404 - Page Not Found</h1>
            <p>The page you are looking for does not exist.</p>
            <Link to="/" style={{ 
                textDecoration: "none", 
                color: "#3498db", 
                fontSize: "18px", 
                fontWeight: "bold", 
                marginTop: "10px" 
            }}>
                Go back to Home
            </Link>
        </div>
    );
};

export default ErrorText;