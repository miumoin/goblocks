// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import ErrorText from '../components/ErrorText';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import {shortenFileName, shortenText, formatDate} from '../components/utils';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OrganizationShare, { OpenShareWindowHandle } from '../components/OrganizationShare';

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    accessKey: string;
    slug: string | undefined;
    workspace: { id: string; slug: string; [key: string]: any };
    knowledges: blockState[];
    knowledge: blockState;
    isLoaded: boolean;
    show: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    file: any | null;
    note: string;
    deletingShow: boolean;
    deletingKnowledgeId: string;
    deletingKnowledgeTitle: string;
    isDeleting: boolean;
    viewShow: boolean;
}

const Knowledge: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '' },
        knowledges: [],
        knowledge: { id: '', slug: '', title: ''},
        show: false,
        isLoaded: false,
        isSubmitted: false,
        isValid: false,
        file: null,
        note: '',
        deletingShow: false,
        deletingKnowledgeId: '',
        deletingKnowledgeTitle: '',
        isDeleting: false,
        viewShow: false
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

    useEffect(() => {
        if( data.workspace.id != '' ) {
           getKnowledges();
        }
    }, [data.workspace]);

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
            setData((prevData) => ({ ...prevData, workspace: res.workspace, isLoaded: true }));
        }
    };

    const getKnowledges = async () : Promise<void> => {
        const response = await fetch(App.api_base + '/workspace/' + data.slug + '/knowledge', {
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
            setData((prevData) => ({ ...prevData, knowledges: res.knowledges }));
        }
    };

    const initKnowledgeUpload = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isSubmitted: false, isValid: false, file: null, note: '', show: true }));
    };

    const closeKnowledgeUpload = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isSubmitted: false, isValid: false, show: false }));
    };

    const saveKnowledge = async(e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true }));
        if( data.isSubmitted && data.file == null && data.note.trim() == '' ) {
            setData((prevData) => ({ ...prevData, isValid: false}));
        } else {
            setData((prevData) => ({ ...prevData, isValid: true }));
            const formData = new FormData();
            if (data.file) {
                formData.append("file", data.file);
            }
            formData.append("note", data.note);
            try {
                const response = await fetch(`${App.api_base}/workspace/${data.slug}/knowledge/save`, {
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
                    closeKnowledgeUpload();
                    getKnowledges();
                } else {
                    setData((prevData) => ({ ...prevData, isSubmitted: false }));
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        }
    };

    const initDeletion = async( id: string, title: string ): Promise<void> => {
        setData((prevData) => ({ ...prevData, deletingShow: true, deletingKnowledgeId: id, deletingKnowledgeTitle: title }));
    };

    const closeDeletion = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, deletingShow: false }));
    };

    const confirmDeletion = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isDeleting: true }));
        const response = await fetch(`${App.api_base}/workspace/${data.slug}/knowledge/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': data.accessKey
            },
            body: JSON.stringify({ id: data.deletingKnowledgeId })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            setData((prevData) => ({ ...prevData, message: '', isDeleting: false }));
            closeDeletion();
            getKnowledges();
        }
    };

    const displayKnowledge = async( id: string ): Promise<void> => {
        if (data.knowledges.length > 0) {
            var knowledge:blockState = data.knowledges.find((k) => k.id === id) || {id: '', title: '', slug: ''};
        }
        
        setData((prevData) => ({ ...prevData, knowledge: knowledge, viewShow: true }));

        const response = await fetch(`${App.api_base}/workspace/${data.slug}/knowledge/get/${id}`, {
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
            setData((prevData) => ({ ...prevData, knowledge: { ...prevData.knowledge, note: res.knowledge.note, file: res.knowledge.file }}));
        }
    };

    const closeView = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, viewShow: false }));
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
                                                    Conversations
                                                </span>
                                            </Link>
                                        </OverlayTrigger>
                                        <OverlayTrigger placement="top" overlay={<Tooltip>Upload new files to the project. These files serve as global knowledge for all contacts.</Tooltip>} >
                                            <button className="btn btn-sm btn-outline-primary me-2" data-toggle="modal" data-target="#knowledge" onClick={initKnowledgeUpload}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" /><path d="M15 12h-6" /><path d="M12 9v6" /></svg>
                                                <span className="d-none d-sm-inline">
                                                    &nbsp;
                                                    New content
                                                </span>
                                            </button>
                                        </OverlayTrigger>
                                    </span>
                                </div>
                                { data.knowledges.length > 0 ? 
                                    <>
                                        {data.knowledges.map((knowledge:blockState, index) => (
                                            <div className="d-flex text-body-secondary pt-3" key={knowledge.id}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-file-text me-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></svg>
                                                <p className="pt-1 pb-1 mb-0 small lh-sm">
                                                    <strong className="d-block text-gray-dark">{shortenFileName( knowledge.title, 35 )}</strong>
                                                    <small>
                                                        <a href="javascript:void(0)" onClick={() => displayKnowledge(knowledge.id)}>View</a>
                                                        &nbsp;
                                                        -
                                                        &nbsp;
                                                        <a href="javascript:void(0)" onClick={() => initDeletion(knowledge.id, knowledge.title)}>Delete</a>
                                                        <span className="d-none d-sm-inline-block">
                                                            &nbsp;
                                                            -
                                                            &nbsp;
                                                            Added on {formatDate( knowledge.created_at )}
                                                        </span>
                                                    </small>
                                                </p>
                                            </div>
                                        ))}
                                    </>
                                    :
                                    <div className="empty-space" style={{height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
                                        <svg style={{width: '80px', height: '80px', fill: '#6c757d'}} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"/>
                                        </svg>
                                        <p className="text-muted mt-3" style={{maxWidth: '600px'}}>Upload common files to the Knowledge Hub to generate automated responses for your contacts.</p>
                                    </div>
                                }
                            </>
                        </div>
                        :
                        <ErrorText/>
                    )}
                </div>

                <Modal show={data.show} onHide={closeKnowledgeUpload}>
                    <Modal.Header>
                        <Modal.Title>Add file to knowledge hub</Modal.Title>
                        <button className="btn-close" onClick={closeKnowledgeUpload} disabled={data.isSubmitted && data.isValid}></button>
                    </Modal.Header>
                    <Modal.Body>
                        <form onSubmit={saveKnowledge}>
                            <div className="form-group mb-3">
                                <label className="mb-3">Upload document</label>
                                <input type="file" className="form-control" id="knowledgeFile" accept=".pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setData((prevData) => ({ ...prevData, file: file })); }} } />
                            </div>
                            <div className="form-group mb-3">
                                <label className="mb-3">Note</label>
                                <textarea className="form-control" id="knowledgeNote" rows={3} onChange={(e) => setData((prevData) => ({ ...prevData, note: e.target.value }))}></textarea>
                            </div>
                            <div className="invalid-feedback" style={{ display: data.isSubmitted && !data.isValid ? 'block' : 'none' }}>Invalid intput! Please, input a file or note to save knowledge.</div>
                        </form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={saveKnowledge} disabled={data.isSubmitted && data.isValid}>
                            Save
                        </Button>
                    </Modal.Footer>
                </Modal>  

                <Modal show={data.deletingShow} onHide={closeDeletion}>
                    <Modal.Header>
                        <Modal.Title>Please confirm</Modal.Title>
                        <button className="btn-close" onClick={closeDeletion} disabled={data.isDeleting}></button>
                    </Modal.Header>
                    <Modal.Body>
                        <p>Are you sure to delete <strong>{data.deletingKnowledgeTitle}</strong>?</p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={closeDeletion} disabled={data.isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={confirmDeletion} disabled={data.isDeleting}>
                            Delete
                        </Button>
                    </Modal.Footer>
                </Modal>  

                <Modal show={data.viewShow} onHide={closeView}>
                    <Modal.Header>
                        <Modal.Title>{shortenFileName(data.knowledge.title, 35)}</Modal.Title>
                        <button className="btn-close" onClick={closeView}></button>
                    </Modal.Header>
                    <Modal.Body>
                        <p className="mb-3" style={{ whiteSpace: 'pre-line' }}>{data.knowledge.note}</p>
                        { data.knowledge.file != '' &&
                            <p className="mb-3">
                                <a className="text-decoration-none" href={data.knowledge.file} target="_blank">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-Width="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', 'top' : '-4px' }} className="icon icon-tabler icons-tabler-outline icon-tabler-download"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                                    &nbsp;
                                    {data.knowledge.title}
                                </a>
                            </p>
                        }
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={closeView}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal> 
                <OrganizationShare ref={shareWindowref} workspace={data.workspace} /> 
            </main>

            <Footer />
        </>
    );
}

export default Knowledge;