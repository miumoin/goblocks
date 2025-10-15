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
        const status = params.get("status") || 'false';

        const response = await fetch(App.api_base + '/invoice/' + data.slug + '/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': ""
            },
            body: JSON.stringify({
                session_id: session_id,
                status: status
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            setData((prevData) => ({ ...prevData, isError: ( status == 'true' ? false : true ), isLoaded: true }));
        }
    };

    return (
        <>
            <Header />

            <main>
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
                    { data.isLoaded ? 
                        <>
                            { !data.isError ? 
                                <>
                                    <p>Payment has been successful ✅</p>
                                </>
                                :
                                <>
                                    <p>Payment has been failed ❌</p>
                                </>
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