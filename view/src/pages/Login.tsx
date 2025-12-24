import React, {useState, useEffect} from 'react';
import { useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';
import { jwtDecode } from "jwt-decode";
import Header from '../components/Header';
import Footer from '../components/Footer';

declare global {
    interface Window {
        google: any;
    }
}

interface dataState {
    accessKey: string;
    email: string;
    status: boolean;
    isSubmitted: boolean;
    isValid: boolean;
}

const Login: React.FC = () => {
    const [data, setData] = useState<dataState>({
        accessKey: '',
        email: '',
        status: false,
        isSubmitted: false,
        isValid: true
    });

    const navigate = useNavigate();

    useEffect(() => {
        // Retrieve accessKey from localStorage or similar storage
        const accessKey: string = Cookies.get(`access_key_typewriting`) || '';
        setData(( prevData ) => ({ ...prevData, accessKey: accessKey }));
    }, []);

    // Load Google API Script
    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
    });

    useEffect(() => {
        if( data.accessKey != '' ) {
            navigate("/");
        }
    }, [data.accessKey]);

    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const signinByEmail = async (e: React.FormEvent): Promise<any> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true }));

        if( !isValidEmail( data.email ) ) {
            setData((prevData) =>({ ...prevData, isValid: false }));
        } else {
            try {
                const response = await fetch(App.api_base + '/login', {
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
                    setData((prevData) => ({ ...prevData, isValid: true }));
                    navigate("/verify");
                } else {
                    setData((prevData) => ({ ...prevData, isValid: false }));
                }

                return 0;
            } catch (error) {
                console.error('Error:', error);
                return 0;
            }
        }
    };

    const handleGoogleLogin = async (): Promise<void> => {
        if (!window.google) {
            console.error("Google API not loaded yet");
            return;
        }

        window.google.accounts.id.initialize({
            client_id: App.google_client_id,
            callback: (response: any) => {
                const credential = response.credential;
                if (credential) {
                    const decoded = jwtDecode<{ name: string; email: string; picture: string }>(credential);
                    console.log("user", JSON.stringify(decoded));

                    fetch(App.api_base + '/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Vuedoo-Domain': App.domain,
                            'X-Vuedoo-Access-Key': ''
                        },
                        body: JSON.stringify(decoded)
                    })
                    .then(response => {
                        if (!response.ok) {
                            return Promise.reject('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(res => {
                        if (res.status === 'success') {
                            setData(prevData => ({ ...prevData, isValid: true }));
                            if( res.access_key != '' ) {
                                Cookies.set('access_key_typewriting', res.access_key, { expires: 7 });
                                window.location.href = App.base;
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                    
                }
            },
        });

        window.google.accounts.id.prompt(); // Triggers the login popup
    };

    return (
        <>
            <Header />
            <main>
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-12 col-md-6">
                            <div className="login-container text-center m-3">
                                <br/>
                                <br/>
                                <h1 className="mb-3">Sign in</h1>
                                <p className="alert alert-secondary">We'll send a code to your email <br/> to continue signing in.</p>
                                
                                <form onSubmit={signinByEmail}>
                                    <div className="mb-3">
                                        <input type="email" className="form-control" placeholder="Enter your email" onChange={(e) => setData((prevData) => ({ ...prevData, email: e.target.value }))} required />
                                        <div className="invalid-feedback" style={{ display: data.isSubmitted && !data.isValid ? 'block' : 'none' }}>Invalid email address.</div>
                                    </div>
                                    <button type="submit" className="btn btn-outline-primary w-100">Sign in with email</button>
                                </form>

                                <br/>
                                <hr className="my-3" />
                                <br/>

                                <button className="btn btn-outline-danger w-100 mb-3" onClick={handleGoogleLogin}>
                                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" style={{ position: 'relative', top: '-2px' }}><g><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></g></svg>
                                    &nbsp;
                                    Sign in with Google
                                </button>
                                <p>No payment, no registration required</p>
                                <br/>
                                <br/>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}

export default Login;