// Import React and ReactDOM
import React, {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import {formatInferenceResponse, getInitials} from '../components/utils';
import PageLoader from '../components/PageLoader';
import ErrorText from '../components/ErrorText';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Cookies from 'js-cookie';

interface dataState {
    accessKey: string;
    slug: string | undefined;
    isLoaded: boolean;
    isError: boolean;
}

const InvoiceSuccess: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        isLoaded: false,
        isError: false,
    });

    useEffect(() => {
        updateInvoice( data.slug );
    }, []);

    const updateInvoice = async ( slug: string|undefined ) : Promise<void> => {
        const params = new URLSearchParams(window.location.search);
        const session_id = params.get("session_id") || '';

        const response = await fetch(App.api_base + '/invoice/' + data.slug + '/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': ""
            },
            body: JSON.stringify({
                session_id: session_id
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            Cookies.set(`profileSlug_` + slug, res.profile.slug, { expires: 7 });
            window.location.href = res.payment_link;
        } else {
            setData((prevData) => ({ ...prevData, isError: true, isLoaded: true }));
        }
    };

    return (
        <>
            { data.isLoaded && !data.isError ? 
                <header className="container mt-4 border-bottom">
                    <div className="d-flex justify-content-center gap-3">
                        <h1 className="h4">Success!</h1>
                    </div>
                    <div className="d-flex justify-content-center gap-3 mt-3">
                        <p className="font-weight-bold"></p>
                    </div>
                </header>
                :
                <Header />
            }

            <main>
                <div className="container my-3 p-1 p-md-3 bg-body shadow-sm">
                    { data.isLoaded ? 
                        <>
                            { !data.isError ? 
                                <>
                                    <p>Preparing a secure checkout session. One moment...</p>
                                </>
                                :
                                <ErrorText />
                            }
                        </>
                        :
                        <PageLoader />
                    }  
                </div>
            </main>

            <Footer />
        </>
    );
}

export default InvoiceSuccess;