// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import ErrorText from '../components/ErrorText';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import {shortenText} from '../components/utils';
import PageLoader from '../components/PageLoader';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OrganizationShare, { OpenShareWindowHandle } from '../components/OrganizationShare';

interface threadState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    accessKey: string;
    slug: string;
    workspace: { id: string; slug: string; [key: string]: any } | null;
    threads: threadState[];
    page: number;
    isLoaded: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    title: string;
    deletingShow: boolean;
    deletingThreadId: string;
    deletingThreadTitle: string;
    isDeleting: boolean;
    sharingShow: boolean;
}

const Organization: React.FC = () => {
    const [show, setShow] = useState(false);
    const { slug } = useParams();
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [data, setData] = useState({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '', metas: { collect_information: 'false'} },
        threads: [],
        page: 1,
        isLoaded: false,
        isSubmitted: false,
        isValid: false,
        title: '',
        deletingShow: false,
        deletingThreadId: '',
        deletingThreadTitle: '',
        isDeleting: false,
        sharingShow: false
    });

    const threadsRef = useRef(data.threads);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
            getThreads( data.page );

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            intervalRef.current = setInterval(() => {
                getThreads( data.page );
            }, 30000);
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

    const getThreads = async ( page: number ) : Promise<void> => {
        setData((prevData) => ({ ...prevData, page: page, isLoaded: false }));
        
        const response = await fetch(App.api_base + '/workspace/' + data.slug + '/threads/' + page, {
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
            if( threadsRef.current != res.threads ) {
                setData((prevData) => ({ ...prevData, threads: res.threads, isLoaded: true }));
            }        
        }
    };

    const initNewThread = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isSubmitted: false, isValid: false, title: '' }));
        setShow(true);
    };

    const closeNewThread = async(): Promise<void> => {
        setShow(false)
    };

    const addThread = async(e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true }));
        if( data.isSubmitted && data.title.trim() == '' ) {
            setData((prevData) => ({ ...prevData, isValid: false}));
        } else {
            setData((prevData) => ({ ...prevData, isValid: true }));
            try {
                const response = await fetch(`${App.api_base}/workspace/${data.slug}/thread/add`, {
                    method: "POST",
                    headers: {
                        "X-Vuedoo-Domain": App.domain,
                        "X-Vuedoo-Access-Key": data.accessKey,
                    },
                    body: JSON.stringify({ title: data.title })
                });
            
                if (!response.ok) {
                    throw new Error("Network response was not ok");
                }
            
                const res = await response.json();
            
                if (res.status === "success") {
                    closeNewThread();
                    getThreads( 1 );
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        }
    };

    const initDeletion = async( id: string, title: string ): Promise<void> => {
        setData((prevData) => ({ ...prevData, deletingShow: true, deletingThreadId: id, deletingThreadTitle: title }));
    };

    const closeDeletion = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, deletingShow: false }));
    };

    const closeSharing = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, sharingShow: false }));
    };

    const confirmDeletion = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isDeleting: true }));
        const response = await fetch(`${App.api_base}/workspace/${data.slug}/thread/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': data.accessKey
            },
            body: JSON.stringify({ id: data.deletingThreadId })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            setData((prevData) => ({ ...prevData, message: '', isDeleting: false }));
            closeDeletion();
            getThreads(1);
        }
    };

    function formatDate(json: { date: string; timezone: string }): string {
        const utcDate = new Date(json.date + 'Z'); // Append 'Z' to handle UTC
        
        const day = utcDate.getUTCDate();
        const suffix = (day % 10 === 1 && day !== 11) ? 'st' 
                      : (day % 10 === 2 && day !== 12) ? 'nd' 
                      : (day % 10 === 3 && day !== 13) ? 'rd' 
                      : 'th';
      
        return utcDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).replace(/\d+/, `${day}${suffix}`);
    }

    const copyText = async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            const button = document.getElementById('copy_button_' + id);
            const buttonText = ( button ? button.innerHTML : '' );
            if (button) {
                button.innerHTML = 'Copied';
                setTimeout(() => { button.innerHTML = buttonText }, 2000); // Restore text after 2s
            }
        } catch (err) {
            const button = document.getElementById('copy_button_' + id);
            if (button) button.innerHTML = 'Copy';
        }
    };

    const copyWorkspace = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            setCopySuccess(false);
        }
    };

    const downloadEntries = async (): Promise<void> => {
        const response = await fetch(`${App.base}/api/workspace/${data.slug}/download`, {
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
            // Convert JSON to CSV
            const entries:any[] = [];
            const csvRows:string[] = [];
            const headers:string[] = [];

            for( const row of res.data ) {
                const entry:any[] = JSON.parse( row['meta_value'] );
                entries.push( entry );
                for( const key in entry ) {
                    if( !headers.includes(key) ) {
                        headers.push(key);
                    }
                }
            }

            csvRows.push(headers.join(','));

            for (const row of entries) {
                const values = headers.map(header => {
                    const val = typeof row[header] === 'object' && row[header] !== null 
                        ? JSON.stringify(row[header]).replace(/[{}\[\]"]/g, '').replace(/:/g, ': ').replace(/,/g, ', ')
                        : row[header] || '';
                    // Handle values that contain commas or quotes
                    return `"${String(val).replace(/"/g, '""')}"`;
                });

                //only add row if it has at least one non-empty value
                if (values.some(v => v !== '""')) {
                    csvRows.push(values.join(','));
                }
            }

            const csvString = csvRows.join('\n');
            
            // Create and download the file
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'export.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    };

    const shareWindowref = useRef<OpenShareWindowHandle>(null);
    const triggerShare = () => {
        shareWindowref.current?.enableShare();
    };
    
    return (
        <>
            <Header/>
            <main>
                <div className="container mt-4">

                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb p-3 bg-body-tertiary rounded-3">
                            <li className="breadcrumb-item"><Link to={'/'}>Projects</Link></li>
                            <li className="breadcrumb-item">{shortenText(data.workspace.title, 35)}</li>
                        </ol>
                    </nav>

                    { data.isLoaded ?
                        <>
                            { data.workspace !== null && data.workspace.id !== '' ?
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
                                                { data.workspace.metas?.collect_information === 'true' &&
                                                    <OverlayTrigger placement="top" overlay={<Tooltip>Download collected information from the chats.</Tooltip>}>
                                                        <a href="javascript:void(0)" onClick={() => downloadEntries()} className="btn btn-sm btn-link me-0" style={{paddingLeft: '3px'}}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-copy" style={{position: 'relative', 'top': '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                                                        </a>
                                                    </OverlayTrigger>
                                                }
                                            </h6>
                                            <span className="btn-toolbar mb-2 mb-md-0 d-inline" style={{whiteSpace: 'nowrap'}}>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Personalise contact page & fine tune the bot's behavior.</Tooltip>} >
                                                    <Link className="btn btn-sm btn-outline-primary me-2" to={'/organization/' + data.workspace.slug + '/preference'}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-book" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
                                                        <span className="d-none d-sm-inline">
                                                            &nbsp;
                                                            Preferences
                                                        </span>
                                                    </Link>
                                                </OverlayTrigger>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Upload your project’s common files to the Knowledge Hub to power AI-driven responses and text generation.</Tooltip>} >
                                                    <Link className="btn btn-sm btn-outline-primary me-2" to={'/organization/' + data.workspace.slug + '/knowledge'}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-book" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg>
                                                        <span className="d-none d-sm-inline">
                                                            &nbsp;
                                                            Knowledge hub
                                                        </span>
                                                    </Link>
                                                </OverlayTrigger>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Start a new conversation with a unique URL and custom knowledge tailored for the contact.</Tooltip>} >
                                                    <button className="btn btn-sm btn-outline-primary me-2" data-toggle="modal" data-target="#knowledge" onClick={() => triggerShare()}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /></svg>
                                                        <span className="d-none d-sm-inline">
                                                            &nbsp;
                                                            Publish
                                                        </span>
                                                    </button>
                                                </OverlayTrigger>
                                            </span>
                                        </div>
                                        { data.threads.length > 0 ? 
                                            <>
                                                {data.threads.map((thread:threadState, index) => (
                                                    <div className={`d-flex pt-3 ${
                                                        thread.metas?.last_seen_from_admin && 
                                                        thread.metas?.last_seen_from_client && 
                                                        new Date(thread.metas.last_seen_from_admin) > new Date(thread.metas.last_seen_from_client) 
                                                            ? 'text-body-dim' 
                                                            : 'text-body-secondary'
                                                    }`} key={thread.id}>
                                                        <svg  xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-brand-hipchat me-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 9h8" /><path d="M8 13h6" /><path d="M9 18h-3a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-3l-3 3l-3 -3z" /></svg>
                                                        <p className="pt-1 pb-1 mb-0 small lh-sm">
                                                            <strong className="d-block text-gray-dark">
                                                                <a className="text-decoration-none" href={ App.base + '/organization/' + data.workspace.slug + '/profile/' + thread.slug }>{thread.title}</a>
                                                            </strong>
                                                            <small>
                                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Manage conversation-specific knowledge base and send direct messages.</Tooltip>} >
                                                                    <a href={ App.base + '/organization/' + data.workspace.slug + '/profile/' + thread.slug }>Manage</a>
                                                                </OverlayTrigger>
                                                                &nbsp;
                                                                -
                                                                &nbsp;
                                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Permanently delete this conversation.</Tooltip>} >
                                                                    <a href="javascript:void(0)" onClick={() => initDeletion(thread.id, thread.title)}>Delete</a>
                                                                </OverlayTrigger>
                                                                &nbsp;
                                                                -
                                                                &nbsp;
                                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Copy the conversation link to share with the contact person.</Tooltip>} >
                                                                    <a href="javascript:void(0)" id={'copy_button_' + thread.id} onClick={() => copyText(thread.id, App.base + '/chat/' + thread.slug)}>Copy URL</a>
                                                                </OverlayTrigger>
                                                                <span className="d-none d-sm-inline-block">
                                                                    &nbsp;
                                                                    -
                                                                    &nbsp;
                                                                    Added on {formatDate( thread.created_at )}
                                                                </span>
                                                            </small>
                                                        </p>
                                                    </div>
                                                ))}

                                                <div className="d-flex justify-content-start mt-4">
                                                    <Button 
                                                        variant="outline-secondary" 
                                                        className="me-2" 
                                                        onClick={() => getThreads(data.page - 1)}
                                                        disabled={( data.page <= 1 ? true : false )}
                                                    >
                                                        Back
                                                    </Button>
                                                    <Button 
                                                        variant="outline-secondary" 
                                                        onClick={() => getThreads(data.page + 1)}
                                                        disabled={( data.threads.length < 20 ? true : false )}
                                                    >
                                                        Next
                                                    </Button>
                                                </div>
                                            </>
                                            :
                                            <div className="empty-space" style={{height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
                                                <svg style={{width: '80px', height: '80px', cursor: 'pointer'}} viewBox="0 0 24 24" fill="none" stroke="#6c757d" strokeWidth="2"  strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" data-toggle="modal" data-target="#knowledge" onClick={() => setData((prevData) => ({ ...prevData, sharingShow: true }))}>
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" />
                                                </svg>
                                                <p className="text-muted mt-3" style={{maxWidth: '600px'}}>Share the common project URL with your audience to let them contact you, or create manually to share a specific chat.</p>
                                            </div>
                                        }
                                    </>
                                </div>
                                :
                                <ErrorText/>
                            }
                        </>
                        :
                        <PageLoader />
                    }
                </div>

                <Modal show={show} onHide={closeNewThread}>
                    <Modal.Header closeButton>
                        <Modal.Title>New conversation</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <form onSubmit={addThread}>
                            <div className="form-group mb-3">
                                <label className="mb-3">Give this conversation a name</label>
                                <input type="text" className="form-control" onChange={(e) => setData((prevData) => ({ ...prevData, title: e.target.value }))} />
                            </div>
                            <div className="invalid-feedback" style={{ display: data.isSubmitted && !data.isValid ? 'block' : 'none' }}>Invalid intput! Please, input a file or note to save knowledge.</div>
                        </form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={addThread}>
                            Create
                        </Button>
                    </Modal.Footer>
                </Modal>  

                <Modal show={data.deletingShow} onHide={closeDeletion}>
                    <Modal.Header>
                        <Modal.Title>Please confirm</Modal.Title>
                        <button className="btn-close" onClick={closeDeletion} disabled={data.isDeleting}></button>
                    </Modal.Header>
                    <Modal.Body>
                        <p>Are you sure to delete <strong>{data.deletingThreadTitle}</strong>?</p>
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

                <OrganizationShare ref={shareWindowref} workspace={data.workspace} />
            </main>

            <Footer />
        </>
    );
}

export default Organization;