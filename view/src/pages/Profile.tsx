// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import {shortenFileName, shortenText, formatDate, shortFormatDate, formatInferenceResponse} from '../components/utils';
import PageLoader from '../components/PageLoader';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    accessKey: string;
    slug: string | undefined;
    profileSlug: string | undefined;
    workspace: blockState;
    profile: blockState;
    isLoaded: boolean;
    show: boolean;
}

const Profile: React.FC = () => {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const { slug } = useParams<{ slug?: string }>();
    const { profileSlug } = useParams<{ profileSlug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        profileSlug: profileSlug,
        workspace: { id: '', slug: '', title: '' },
        profile: { id: '', slug: '', title: '', content: {} },
        isLoaded: false,
        show: false
    });

    useEffect(() => {
        const accessKey: string = Cookies.get(`access_key_typewriting`) || '';
        if( accessKey != '' ) {
            setData(( prevData ) => ({ ...prevData, accessKey: accessKey }));
        }
    }, []);

    useEffect(() => {
        getProfile();
    }, [data.accessKey]);

    const getProfile = async () : Promise<void> => {
        const response = await fetch(App.api_base + '/workspace/' + data.slug + '/profile/' + profileSlug, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': data.accessKey
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            res.profile.content = ( res.profile.content != undefined ? JSON.parse( res.profile.content ) : {} );
            setData((prevData) => ({ ...prevData, profile: res.profile, workspace: res.workspace, isLoaded: true }) );
        }
    };

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            setCopySuccess(false);
        }
    };

    return (
        <>
            <Header />
            <main>
                <div className="container mt-4">

                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb p-3 bg-body-tertiary rounded-3">
                            <li className="breadcrumb-item"><Link to={'/'}>Projects</Link></li>
                            <li className="breadcrumb-item"><Link to={'/organization/' + data.workspace.slug}>{shortenText( data.workspace.title, 30 )}</Link></li>
                            <li className="breadcrumb-item active" aria-current="page">{shortenText( data.profile.title, 30 )}</li>
                        </ol>
                    </nav>

                    { data.isLoaded ? 
                        <>
                            <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-start pt-3 pb-2 mb-3 border-bottom">
                                <h3 className="h2">
                                    {data.profile.title}
                                    &nbsp;
                                    {data.profile.content && data.profile.content['status'] && data.profile.content['status'] == 'true' ? 
                                        <span className="badge bg-success">Completed</span>
                                        : 
                                        <span className="badge bg-warning">Draft</span> 
                                    }
                                </h3>
                            </div>

                            <div className="my-3 p-md-3 bg-body rounded shadow-sm">

                                <div className="row justify-content-center">
                                    <div className="col-md-6 border-end mb-3">
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                            <h6>Products</h6>
                                        </div>
                                        <div style={{height: '60vh', display: 'flex', justifyContent: 'bottom', flexDirection: 'column', overflowY: 'scroll'}}>
                                            { data.profile.content && data.profile.content.items && data.profile.content.items.length > 0 ?
                                                <table className="table table-striped">
                                                    <tbody>
                                                        {data.profile.content.items.map( ( product: any, index: number ) => (
                                                            <tr key={index}>
                                                                <td>{product.name}</td>
                                                                <td>{parseFloat(product.price).toFixed(2) + " " + ( !data.workspace.metas.stripe_currency || data.workspace.metas.stripe_currency == '' ? 'USD' : data.workspace.metas.stripe_currency.toUpperCase() )}</td>
                                                                <td>{product.units} units</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                :
                                                <div className="text-body-secondary pt-3">
                                                    No products found.   
                                                </div>
                                            }       
                                        </div>
                                    </div>
                                    <div className="col-md-6 mb-3" style={{display: 'flex', flexDirection: 'column'}}>
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-1 mb-0">
                                            <h6>Details</h6>
                                        </div>

                                        <div>
                                            {data.profile.content.email && (
                                                <p>Email: {data.profile.content.email}</p>
                                            )}
                                            {data.profile.content.ship_address && (
                                                <>
                                                    <p>Address: {data.profile.content.ship_address}, {data.profile.content.ship_postcode} {data.profile.content.ship_city}, {data.profile.content.ship_state ? data.profile.content.ship_state + ', ' : ''} {data.profile.content.ship_state ? data.profile.content.ship_state + ', ' : ''} { data.profile.content.ship_country ? data.profile.content.ship_country : '' }</p>
                                                </>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </div>
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

export default Profile;