// Import React and ReactDOM
import React, {useState, useEffect} from 'react';
import Cookies from 'js-cookie';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageLoader from '../components/PageLoader';
import {getInitials} from '../components/utils';

interface dataState {
    accessKey: string;
    workspaces: any[];
    page: number;
    deletingShow: boolean;
    deletingWorkspaceId: string;
    deletingWorkspaceTitle: string;
    isDeleting: boolean;
    isLoaded: boolean;
}

const Home: React.FC = () => {
    const [data, setData] = useState<dataState>({
        accessKey: '',
        workspaces: [],
        page: 1,
        deletingShow: false,
        deletingWorkspaceId: '',
        deletingWorkspaceTitle: '',
        isDeleting: false,
        isLoaded: false
    });

    useEffect(() => {
        const accessKey: string = Cookies.get(`access_key_typewriting`) || '';
        if( accessKey != '' ) {
            setData(( prevData ) => ({ ...prevData, accessKey: accessKey }));
        }
    }, []);

    useEffect(() => {
        if( data.accessKey != '' ) {
            getWorkspaces( data.page );
        }
    }, [data.accessKey]);

    useEffect(() => {
        if( data.isLoaded && data.page < 1 && data.workspaces.length < 1 ) {
            //window.location.href = App.base + '/organization/new';
        }
    }, [data.workspaces]);

    const getWorkspaces = async ( page: number ): Promise<void> => {
        setData((prevData) => ({ ...prevData, page: page, isLoaded: false }));
        
        const response = await fetch(App.api_base + '/workspaces/' + page, {
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
            setData((prevData) => ({ ...prevData, workspaces: res.workspaces, isLoaded: true }));
        }
    };

    const initDeletion = async( id: string, title: string ): Promise<void> => {
        setData((prevData) => ({ ...prevData, deletingShow: true, deletingWorkspaceId: id, deletingWorkspaceTitle: title }));
    };

    const closeDeletion = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, deletingShow: false }));
    };

    const confirmDeletion = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isDeleting: true }));
        const response = await fetch(`${App.api_base}/workspace/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': data.accessKey
            },
            body: JSON.stringify({ id: data.deletingWorkspaceId })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            setData((prevData) => ({ ...prevData, message: '', isDeleting: false }));
            closeDeletion();
            getWorkspaces(data.page);
        }
    };

    function formatDate(date: string): string {
        const utcDate = new Date(date); // Append 'Z' to handle UTC
        
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

    return data.accessKey != '' ? (
        <>
            <Header />
            <main>
                <div className="container mt-4">
                    <div className="my-3 p-3 bg-body rounded shadow-sm" style={{minHeight: '60vh'}}>
                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                            <h6>Your projects</h6>
                            <span className="btn-toolbar mb-2 mb-md-0 d-inline" style={{whiteSpace: 'nowrap'}}>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Make a new workspace to manage a different knowledge base and contacts.</Tooltip>} >
                                    <a className="btn btn-sm btn-outline-primary me-2" href={App.base + '/organization/new' }>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" /><path d="M15 12h-6" /><path d="M12 9v6" /></svg>
                                        <span className="d-none d-sm-inline">
                                            &nbsp;
                                            New project
                                        </span>
                                    </a>
                                </OverlayTrigger>
                            </span>
                        </div>
                        { data.isLoaded ? 
                            <>
                                { data.workspaces.length > 0 ? 
                                    <>
                                        {data.workspaces.map((workspace, index) => (
                                            <div className="d-flex gap-2 text-body-secondary pt-3" key={workspace.id}>
                                                <div className="avatar" style={{ top: '5px', width: '35px', height: '35px', objectFit: 'cover', fontSize: '20px', fontWeight: 'bold', backgroundImage: ( workspace.metas != undefined && workspace.metas.logo != undefined ? 'url(' + workspace.metas.logo + ')' : 'none' ), backgroundSize: 'cover' }}>{ workspace.metas != undefined && workspace.metas.logo != undefined ? '' : getInitials(workspace.title) }</div>
                                                <p className="pt-1 pb-1 mb-0 small lh-sm">
                                                    <strong className="d-block text-gray-dark">
                                                        <a className="text-decoration-none" href={ App.base + '/organization/' + workspace.slug }>{workspace.title}</a>
                                                    </strong>
                                                    <small>
                                                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Manage and create knowledge bases and conversations for your project.</Tooltip>} >
                                                            <a href={ App.base + '/organization/' + workspace.slug }>Manage</a>
                                                        </OverlayTrigger>
                                                        &nbsp;
                                                        -
                                                        &nbsp;
                                                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Permanently delete this project.</Tooltip>} >
                                                            <a href="javascript:void(0)" onClick={() => initDeletion(workspace.id, workspace.title)}>Delete</a>
                                                        </OverlayTrigger>
                                                        <span className="d-none d-sm-inline-block">
                                                            &nbsp;
                                                            -
                                                            &nbsp;
                                                            Added on {formatDate( workspace.created_at,  )}
                                                        </span>
                                                    </small>
                                                </p>
                                            </div>
                                        ))}

                                        <div className="d-flex justify-content-start mt-4">
                                            <Button 
                                                variant="outline-secondary" 
                                                className="me-2" 
                                                onClick={() => getWorkspaces(data.page - 1)}
                                                disabled={( data.page <= 1 ? true : false )}
                                            >
                                                Back
                                            </Button>
                                            <Button 
                                                variant="outline-secondary" 
                                                onClick={() => getWorkspaces(data.page + 1)}
                                                disabled={( data.workspaces.length < 20 ? true : false )}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </>
                                    :
                                    <>
                                        { data.page == 1 &&
                                            <div className="empty-space" style={{height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
                                                <svg style={{width: '80px', height: '80px', fill: '#6c757d'}} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"/>
                                                </svg>
                                                <p className="text-muted mt-3">No project found</p>
                                            </div>
                                        }
                                    </>
                                }
                            </>
                            :
                            <PageLoader />
                        }
                    </div>
                </div>

                <Modal show={data.deletingShow} onHide={closeDeletion}>
                    <Modal.Header>
                        <Modal.Title>Please confirm</Modal.Title>
                        <button className="btn-close" onClick={closeDeletion} disabled={data.isDeleting}></button>
                    </Modal.Header>
                    <Modal.Body>
                        <p>Are you sure to delete <strong>{data.deletingWorkspaceTitle}</strong>?</p>
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
            </main>

            <Footer />
        </>
    ): (
        <>
            <Header />
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-lg-8">
                        
                        <div className="mb-4">
                            <p className="text-success mb-1">// SYSTEM BOOT...</p>
                            <p className="text-success mb-1">// LOADING AI_MODULES... [OK]</p>
                            <p className="text-success mb-0">// MOUNTING WORKSPACE... [OK]</p>
                        </div>
                        
                        <hr className="border-secondary"></hr>

                        <h1 className="text-info display-5 fw-bold mb-4">&gt; WIT WORKS STUDIO</h1>

                        <p className="mb-3">
                            <span className="text-primary">const</span> <span className="text-warning">product</span> = <span className="text-danger">"AI Film Creation Software"</span>;
                        </p>

                        <div className="bg-dark p-3 rounded border border-secondary mb-4">
                            <p className="text-success mb-1">/*</p>
                            <p className="text-success mb-1"> * CORE DIRECTIVE:</p>
                            <p className="text-success mb-1"> * Reinventing the film creation workflow digitally</p>
                            <p className="text-success mb-1"> * from ZERO to FINAL_FILM.</p>
                            <p className="text-success mb-0"> */</p>
                        </div>

                        <div className="mb-4">
                            <p className="mb-2">
                                <span className="text-warning">&gt;</span> <span className="text-primary">INITIATE</span> <span className           ="text-info">creative_workflow</span>(
                            </p>
                            <ul className="list-unstyled ps-4 mb-2">
                                <li className="text-danger">"scratch",</li>
                                <li className="text-danger">"shot_division",</li>
                                <li className="text-danger">"shoot_plan"</li>
                            </ul>
                            <p className="mb-0">);</p>
                        </div>

                        <div className="border-start border-info border-4 bg-dark p-3 rounded-end mb-4">
                            <p className="text-success mb-1">// OUTPUT: All in a <span className="text-danger">single workspace</span>.</p>
                            <p className="text-success mb-0">// STATUS: No context switching. Just pure creation.</p>
                        </div>

                        <hr className="border-secondary"></hr>
                        
                        <p className="mb-0">
                            <span className="text-warning">&gt;</span> AWAITING_USER_INPUT <span className="bg-light text-black px-1">█</span>
                        </p>

                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
    ;
}

export default Home;