import React from "react";

const PageLoader: React.FC = () => {
    return (
        <div style={{ 
            minHeight: "45vh", 
            display: "flex", 
            flexDirection: "column", 
            justifyContent: "center", 
            alignItems: "center", 
            textAlign: "center"
        }}>
            <div className="spinner"></div>
        </div>
    );
};

export default PageLoader;