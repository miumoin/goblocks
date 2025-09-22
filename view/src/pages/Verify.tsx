// Import React and ReactDOM
import React, {useState, useEffect} from 'react';
import { Link, useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface dataState {
    code: string;
    isSubmitted: boolean;
    isValid: boolean;
}

const Verify: React.FC = () => {
    const [data, setData] = useState<dataState>({
        code: '',
        isSubmitted: false,
        isValid: true
    });

    const verifyCode = async (e: React.FormEvent): Promise<any> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true }));

        if( data.code.length != 6 ) {
            setData((prevData) => ({ ...prevData, isValid: false }));
        } else {
            try {
                const response = await fetch(App.api_base + '/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Vuedoo-Domain': App.domain,
                        'X-Vuedoo-Access-Key': ''
                    },
                    body: JSON.stringify({ code: data.code })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const res = await response.json();

                if (res.status === 'success') {
                    setData((prevData) => ({ ...prevData, isValid: true }));
                    Cookies.set('access_key_typewriting', res.access_key, { expires: 7 });
                    window.location.href = App.base;
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
                                <h1 className="mb-3">Check your email for a code</h1>
                                <p className="alert alert-secondary">We've sent a code to your email. Please, enter <br/> the code to continue signing in.</p>
                                
                                <form onSubmit={verifyCode}>
                                    <div className="mb-3">
                                        <input type="text" className="form-control" placeholder="Enter verification code" onChange={(e) => setData((prevData) => ({ ...prevData, code: e.target.value }))} required />
                                        <div className="invalid-feedback" style={{ display: data.isSubmitted && !data.isValid ? 'block' : 'none' }}>Invalid code.</div>
                                    </div>
                                    <button type="submit" className="btn btn-outline-primary w-100">Verify</button>
                                </form>

                                <br/>
                                <hr className="my-3" />
                                <br/>

                                {/* Link to Signup Page */}
                                <p className="mt-3">
                                    Can’t find your code? Check your spam folder!
                                    <br/>
                                    Wrong URL? Go back to <Link to="/login">login</Link>
                                </p>

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

export default Verify;