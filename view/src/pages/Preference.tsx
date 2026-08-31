// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import ErrorText from '../components/ErrorText';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import {shortenText, getInitials} from '../components/utils';
import Header from '../components/Header';
import Footer from '../components/Footer';
import QuestionnaireFields from '../components/questionnaireFields';
import OrganizationShare, { OpenShareWindowHandle } from '../components/OrganizationShare';

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    accessKey: string;
    slug: string | undefined;
    workspace: { 
        id: string; 
        slug: string; 
        [key: string]: any;
    };
    file: any | null;
    isLoaded: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    isLogoValid: boolean;
}

const Preference: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '', metas: { description: '', dimension: '1920x1080', showTime: 60, genre: 'action', visualStyle: 'cinematic', tone: 'happy', cinematography: 'hollywood' } },
        file: null,
        isLoaded: false,
        isSubmitted: false,
        isValid: false,
        isLogoValid: true
    });

    useEffect(() => {
        const accessKey: string = Cookies.get(`access_key_typewriting`) || '';
        if( accessKey != '' ) {
            setData(( prevData ) => ({ ...prevData, accessKey: accessKey }));
        }
    }, []);

    useEffect(() => {
        if( data.accessKey != '' ) {
            getWorkspace();
        }
    }, [data.accessKey]);

    const getWorkspace = async () : Promise<void> => {
        const response = await fetch(App.api_base + '/workspace/' + data.slug, {
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
            if( res.workspace.metas != undefined && res.workspace.metas.questionnaire != undefined ) {
                res.workspace.metas.questionnaire = JSON.parse( res.workspace.metas.questionnaire );
            }

            setData((prevData) => ({ ...prevData, workspace: res.workspace, isLoaded: true }));
        }
    };

    const saveWorkspace = async (e: React.FormEvent): Promise<any> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true, isValid: true }));

        if( data.workspace.title.trim() == '' ) {
            setData((prevData) => ({ ...prevData, isValid: false }));
        } else {
            try {
                const response = await fetch(App.api_base + '/workspace/' + data.workspace.slug + '/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Vuedoo-Domain': App.domain,
                        'X-Vuedoo-Access-Key': data.accessKey
                    },
                    body: JSON.stringify({ title: data.workspace.title, description: data.workspace.metas.description })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const res = await response.json();

                if (res.status === 'success') {
                    window.location.reload();
                }

                return 0;
            } catch (error) {
                console.error('Error:', error);
                return 0;
            }
        }
    };

    useEffect(() => {
        if( data.file != null ) {
            saveLogo(new Event('submit') as unknown as React.FormEvent);
        }
    }, [data.file]);

    const saveLogo = async(e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true, isValid: true }));
        if( data.isSubmitted && data.file == null ) {
            setData((prevData) => ({ ...prevData, isValid: false}));
        } else {
            const formData = new FormData();
            if (data.file) {
                formData.append("file", data.file);
            }
            try {
                const response = await fetch(`${App.api_base}/workspace/${data.slug}/logo`, {
                    method: "POST",
                    headers: {
                        "X-Vuedoo-Domain": App.domain,
                        "X-Vuedoo-Access-Key": data.accessKey,
                    },
                    body: formData,
                });
            
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
            
                const res = await response.json();
            
                if (res.status === "success") {
                    setData((prevData) => ({ ...prevData, isSubmitted: false, isLogoValid: true, workspace: { ...prevData.workspace, metas: { ...prevData.workspace.metas, logo: res.logo } } }));
                } else {
                    setData((prevData) => ({ ...prevData, isSubmitted: true, isLogoValid: false }));
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        }
    };

    const handleCollectInformationChange = (checked: boolean) => {
        setData((prevData) => ({ 
            ...prevData, 
            workspace: { 
                ...prevData.workspace, 
                metas: { 
                    ...prevData.workspace.metas, 
                    collect_information: checked ? 'true' : 'false',
                    questionnaire: checked 
                        ? (prevData.workspace.metas.questionnaire !== undefined 
                            ? prevData.workspace.metas.questionnaire 
                            : [])
                        : []
                }
            }
        }));
    };

    const shareWindowref = useRef<OpenShareWindowHandle>(null);
    const triggerShare = () => {
        shareWindowref.current?.enableShare();
    };

    return (
        <>
            <Header />
            <main>
                <div className="container mt-4">

                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb p-3 bg-body-tertiary rounded-3">
                            <li className="breadcrumb-item"><Link to={'/'}>Projects</Link></li>
                            <li className="breadcrumb-item"><Link to={'/organization/' + data.workspace.slug}>{shortenText( data.workspace.title, 25 )}</Link></li>
                            <li className="breadcrumb-item active" aria-current="page">Knowledge</li>
                        </ol>
                    </nav>

                    { data.isLoaded && (
                        data.workspace !== null && data.workspace.id !== '' ?
                        <div className="my-3 p-3 bg-body rounded shadow-sm" style={{minHeight: '60vh'}}>
                            <>
                                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                    <h6>
                                        {data.workspace.title}
                                        <OverlayTrigger placement="top" overlay={<Tooltip>Share your contact link.</Tooltip>} >
                                            <a href="javascript:void(0)" data-toggle="modal" data-target="#knowledge" onClick={() => triggerShare()} className="btn btn-sm btn-link">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-copy" style={{position: 'relative', 'top': '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /></svg>
                                            </a>
                                        </OverlayTrigger>
                                    </h6>
                                    <span>
                                        <OverlayTrigger placement="top" overlay={<Tooltip>Return to the list of all conversations.</Tooltip>} >
                                            <Link className="btn btn-sm btn-outline-primary me-2" to={'/organization/' + data.workspace.slug}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M4 13h3l3 3h4l3 -3h3" /></svg>
                                                <span className="d-none d-sm-inline">
                                                    &nbsp;
                                                    Invoices
                                                </span>
                                            </Link>
                                        </OverlayTrigger>
                                    </span>
                                </div>
                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Project name</label>
                                    </div>

                                    <div className="col-md-8">
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder="Name your project" 
                                            value={data.workspace.title} 
                                            maxLength={40}
                                            onChange={(e) => setData((prevData) => ({ 
                                                ...prevData, 
                                                workspace: { 
                                                    ...prevData.workspace, 
                                                    title: e.target.value 
                                                } 
                                            }))} 
                                            required
                                        />
                                        <div className="d-flex justify-content-between">
                                            <span className="invalid-feedback" style={{ 
                                                display: data.isSubmitted && data.workspace.title.trim() == '' ? 'block' : 'none' 
                                            }}>
                                                Name cannot be empty
                                            </span>
                                        </div>
                                        <div className="d-flex justify-content-end">
                                            <small className="text-muted">
                                                {data.workspace.title.length}/40 characters
                                            </small>
                                        </div>
                                    </div>
                                </div>
                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Description</label>
                                    </div>

                                    <div className="col-md-8">
                                        <textarea
                                            className="form-control" 
                                            value={(data.workspace.metas.description != undefined ? data.workspace.metas.description : '')} 
                                            placeholder="Describe your project" 
                                            maxLength={140}
                                            onChange={(e) => setData((prevData) => ({ 
                                                ...prevData, 
                                                workspace: { 
                                                    ...prevData.workspace, 
                                                    metas: { 
                                                        ...prevData.workspace.metas, 
                                                        description: e.target.value 
                                                    }
                                                }
                                            }))}
                                        >
                                        </textarea>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Dimension</label>
                                    </div>
                                    <div className="col-md-8">
                                        <select 
                                            className="form-select"
                                            value={(data.workspace.metas.dimension != undefined ? data.workspace.metas.dimension : '1920x1080')}
                                            onChange={(e) => setData((prevData) => ({
                                                ...prevData,
                                                workspace: {
                                                    ...prevData.workspace,
                                                    metas: {
                                                        ...prevData.workspace.metas,
                                                        dimension: e.target.value
                                                    }
                                                }
                                            }))}
                                        >
                                            <option value="">Select dimension</option>
                                            <option value="1920x1080">1920x1080</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Total show time</label>
                                    </div>
                                    <div className="col-md-8">
                                        <select 
                                            className="form-select"
                                            value={(data.workspace.metas.showTime != undefined ? data.workspace.metas.showTime : '60')}
                                            onChange={(e) => setData((prevData) => ({
                                                ...prevData,
                                                workspace: {
                                                    ...prevData.workspace,
                                                    metas: {
                                                        ...prevData.workspace.metas,
                                                        showTime: e.target.value
                                                    }
                                                }
                                            }))}
                                        >
                                            <option value="">Select duration</option>
                                            <option value="60">1 minute</option>
                                            <option value="180">3 minutes</option>
                                            <option value="300">5 minutes</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Genre</label>
                                    </div>
                                    <div className="col-md-8">
                                        <select 
                                            className="form-select"
                                            value={(data.workspace.metas.genre != undefined ? data.workspace.metas.genre : 'action')}
                                            onChange={(e) => setData((prevData) => ({
                                                ...prevData,
                                                workspace: {
                                                    ...prevData.workspace,
                                                    metas: {
                                                        ...prevData.workspace.metas,
                                                        genre: e.target.value
                                                    }
                                                }
                                            }))}
                                        >
                                            <option value="">Select genre</option>
                                            <option value="action">Action</option>
                                            <option value="thriller">Thriller</option>
                                            <option value="drama">Drama</option>
                                            <option value="comedy">Comedy</option>
                                            <option value="romance">Romance</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Visual style</label>
                                    </div>
                                    <div className="col-md-8">
                                        <select 
                                            className="form-select"
                                            value={(data.workspace.metas.visualStyle != undefined ? data.workspace.metas.visualStyle : 'cinematic')}
                                            onChange={(e) => setData((prevData) => ({
                                                ...prevData,
                                                workspace: {
                                                    ...prevData.workspace,
                                                    metas: {
                                                        ...prevData.workspace.metas,
                                                        visualStyle: e.target.value
                                                    }
                                                }
                                            }))}
                                        >
                                            <option value="">Select visual style</option>
                                            <option value="cinematic">Cinematic</option>
                                            <option value="documentary">Documentary</option>
                                            <option value="animated">Animated</option>
                                            <option value="minimalist">Minimalist</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Tone</label>
                                    </div>
                                    <div className="col-md-8">
                                        <select 
                                            className="form-select"
                                            value={(data.workspace.metas.tone != undefined ? data.workspace.metas.tone : 'happy')}
                                            onChange={(e) => setData((prevData) => ({
                                                ...prevData,
                                                workspace: {
                                                    ...prevData.workspace,
                                                    metas: {
                                                        ...prevData.workspace.metas,
                                                        tone: e.target.value
                                                    }
                                                }
                                            }))}
                                        >
                                            <option value="">Select tone</option>
                                            <option value="happy">Happy</option>
                                            <option value="sad">Sad</option>
                                            <option value="neutral">Neutral</option>
                                            <option value="intense">Intense</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-4">
                                        <label className="mb-0">Cinematography style</label>
                                    </div>
                                    <div className="col-md-8">
                                        <select 
                                            className="form-select"
                                            value={(data.workspace.metas.cinematography != undefined ? data.workspace.metas.cinematography : 'hollywood')}
                                            onChange={(e) => setData((prevData) => ({
                                                ...prevData,
                                                workspace: {
                                                    ...prevData.workspace,
                                                    metas: {
                                                        ...prevData.workspace.metas,
                                                        cinematography: e.target.value
                                                    }
                                                }
                                            }))}
                                        >
                                            <option value="">Select cinematography style</option>
                                            <option value="hollywood">Hollywood</option>
                                            <option value="european">European Arthouse</option>
                                            <option value="indie">Indie</option>
                                            <option value="naturalistic">Naturalistic</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="row my-3">
                                    <div className="col-md-12" style={{ textAlign: 'right' }}>
                                        <button className="btn btn-primary" onClick={saveWorkspace} disabled={data.isSubmitted && data.isValid}>Save</button>
                                    </div>
                                </div>
                            </>
                        </div>
                        :
                        <ErrorText/>
                    )}
                </div>
                <OrganizationShare ref={shareWindowref} workspace={data.workspace} />
            </main>
            <Footer />
        </>
    );
}

export default Preference;