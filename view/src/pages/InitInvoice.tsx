// Import React and ReactDOM
import React, {useState, useEffect} from 'react';
import { useParams } from 'react-router-dom';
import {formatInferenceResponse, getInitials} from '../components/utils';
import PageLoader from '../components/PageLoader';
import ErrorText from '../components/ErrorText';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Cookies from 'js-cookie';

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    accessKey: string;
    slug: string | undefined;
    workspace: blockState;
    profile: blockState;
    isLoaded: boolean;
    isError: boolean;
}

const getCurrentLocationAndTime = (): Promise<string> => {
    return new Promise((resolve) => {
        // Get current time in 12-hour format with AM/PM
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12; // Convert 24h to 12h format
        const timeString = `${hours12}:${minutes}${ampm}`;

        // Get location from IP using ipapi.co
        fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => {
                resolve(`${timeString} ${data.city}, ${data.country_name}`);
            })
            .catch(() => {
                resolve(`${timeString} Unknown Location`);
            });
    });
};

const InitInvoice: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '', metas: { prompt: '', description: '', logo: '' } },
        profile: { id: '', slug: (Cookies.get(`profileSlug_` + slug) || ''), title: '' },
        isLoaded: false,
        isError: false,
    });

    useEffect(() => {
        //if( data.profile.slug != '') {
            //window.location.href = App.base + '/chat/' + data.profile.slug;
        //} else {
            createInvoice( data.slug );
        //}
    }, [data.profile.slug]);

    const createInvoice = async ( slug: string|undefined ) : Promise<void> => {
        const params = new URLSearchParams(window.location.search);
        const email = params.get("email");
        const shipTo = params.get("ship_to");
        const billTo = params.get("bill_to");

        const items = [];
        let i = 1;
        while (params.has(`item${i}_name`)) {
            const itemName = params.get(`item${i}_name`);
            const itemPrice = parseFloat(params.get(`item${i}_price`) || '0');
            const itemUnits = parseInt(params.get(`item${i}_units`) || '0');

            items.push({
                name: itemName,
                price: itemPrice,
                units: itemUnits,
            });

            i++;
        }

        console.log({ shipTo, billTo, items });
        const timestamp = await getCurrentLocationAndTime();

        const response = await fetch(App.api_base + '/invoice/' + data.slug + '/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': data.accessKey
            },
            body: JSON.stringify({
                title: timestamp,
                email: email,
                ship_to: shipTo,
                bill_to: billTo,
                items: items,
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            Cookies.set(`profileSlug_` + slug, res.profile.slug, { expires: 7 });
            // Redirect to payment link
            //setData((prevData) => ({ ...prevData, workspace: res.workspace, profile: res.profile, isLoaded: true }));
        } else {
            setData((prevData) => ({ ...prevData, isError: true, isLoaded: true }));
        }
    };

    return (
        <>
            { data.isLoaded && !data.isError ? 
                <header className="container mt-4 border-bottom">
                    <div className="d-flex justify-content-center gap-3">
                        <div className="avatar" style={{ width: '100px', height: '100px', objectFit: 'cover', fontSize: '45px', fontWeight: 'bold', backgroundImage: ( data.workspace.metas.logo != undefined ? 'url(' + data.workspace.metas.logo + ')' : 'none' ), backgroundSize: 'cover' }}>{ data.workspace.metas.logo != undefined ? '' : getInitials(data.workspace.title) }</div>
                    </div>
                    <div className="d-flex justify-content-center gap-3 mt-3">
                        <p className="font-weight-bold">{(data.workspace.metas.description != undefined ? data.workspace.metas.description : '')}</p>
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
                                    <p>Preparing a secure chat session for you. One moment...</p>
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

export default InitInvoice;