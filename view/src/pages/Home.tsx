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
            window.location.href = App.base + '/organization/new';
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
                                                            Added on {formatDate( workspace.created_at )}
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
            <div className="cover-container d-flex h-100 p-3 mx-auto flex-column" style={{minHeight: '70vh', maxWidth: '44em', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
                <main role="main" className="inner cover">
                    <h1 className="cover-heading">Feedback, Made Human.</h1>
                    <p className="lead">An intelligent feedback tool that listens, asks follow-up questions, identifies key information, and explains to help customers better understand your service or product.</p>
                    <p className="lead mt-3">
                        <a href={App.base + '/login'} className="btn btn-lg btn-primary">Get started</a>
                    </p>
                </main> 
            </div>

            <hr/>

            <section className="py-5">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-12">
                            <h2 className="text-center mb-4">See it in action</h2>
                            <div style={{ 
                                position: 'relative', 
                                paddingTop: '56.25%', 
                                width: '100%',
                                borderRadius: '4px',
                                backgroundColor: '#f8f9fa',
                                boxShadow: '0 0 20px rgba(255,255,255,0.2)'
                            }}>
                                <iframe
                                    src="https://www.youtube.com/embed/8LBxvMnRkNA?si=cPodDgBanYw0QmUL"
                                    title="Typewriting AI Demo"
                                    allowFullScreen
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                ></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <hr/>
            
            <section className="letter-section py-5">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8">
                            <h2 className="text-center mb-5 fw-bold">Real Conversations. Real Insights.</h2>
                            
                            <div className="letter-content" style={{ fontSize: '1.2rem', animation: 'fadeIn 1s ease-in' }}>
                                <p className="lead fw-bold mb-4" style={{ fontSize: '1.4rem' }}>
                                    Hi,
                                </p>

                                <p>In the real world, when a customer has something to say, they talk to you. Like a human.</p>
    
                                <p>They don't just click stars or fill out rigid forms. They speak. They vent. They ask. And sometimes, they don’t even know exactly what they want — they’re looking for clarity, not just a survey.</p>

                                <p className="highlight" style={{ fontSize: '1.3rem', fontWeight: 500, textDecoration: 'underline' }}>They want to have a conversation — not fill in boxes.</p>
                                
                                <p>But most digital feedback systems don’t allow that. You send a form, they tick a few options, and maybe drop a quick comment. That’s it. Then they leave, often unheard.</p>

                                <p>Even if you're great at solving problems, the tools don't give you the chance to ask the right questions or explain your service properly. There's no real connection, no chance to adapt in real time.</p>

                                <p className="highlight" style={{ fontSize: '1.3rem', fontWeight: 500, textDecoration: 'underline' }}>Now, with AI and large language models, that changes.</p>
                                
                                <p>We're building a new kind of feedback tool — one that listens like a human, asks intelligent follow-ups, explains your product or service clearly, and turns feedback into a two-way conversation.</p>
                                
                                <p>It helps users feel heard, understood, and informed — so they don't leave out of frustration or confusion.</p>

                                <p className="highlight" style={{ fontSize: '1.3rem', fontWeight: 500, textDecoration: 'underline' }}>This isn't just smarter feedback. It's human-centered communication — powered by AI.</p>

                                <p className="signature" style={{ fontSize: '1.25rem', marginTop: '2rem' }}>– The Team at Typewriting AI</p>
                            </div>

                            <style>
                                {`
                                    @keyframes fadeIn {
                                        from { opacity: 0; transform: translateY(20px); }
                                        to { opacity: 1; transform: translateY(0); }
                                    }
                                `}
                            </style>
                        </div>
                    </div>
                    </div>
                </section>

                <hr/>

                <section className="py-5 features-section">
                    <div className="container">
                        <h2 className="text-center mb-5 fw-bold">What makes it different</h2>
                        
                        <div className="row">
                            <div className="col-md-6">
                                <div className="feature-card p-4 rounded shadow-sm h-100">
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="feature-icon me-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-chat-dots" viewBox="0 0 16 16">
                                                <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                                                <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9.06 9.06 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.437 10.437 0 0 1-.524 2.318l-.003.011a10.722 10.722 0 0 1-.244.637c-.079.186.074.394.273.362a21.673 21.673 0 0 0 .693-.125zm.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6c0 3.193-3.004 6-7 6a8.06 8.06 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a10.97 10.97 0 0 0 .398-2z"/>
                                            </svg>
                                        </div>
                                        <h4 className="mb-0">Natural Conversations</h4>
                                    </div>
                                    <p className="mb-0">Users can express thoughts freely in a flowing conversation, ensuring all relevant topics are naturally explored — without limiting them to predefined questions.</p>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="feature-card p-4 rounded shadow-sm h-100">
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="feature-icon me-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-arrows-angle-expand" viewBox="0 0 16 16">
                                                <path fillRule="evenodd" d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707z"/>
                                            </svg>
                                        </div>
                                        <h4 className="mb-0">Adaptive System</h4>
                                    </div>
                                    <p className="mb-0">Whether someone wants to say it all at once or prefers guided prompts, our system adapts to both — ensuring you always get the full story.</p>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="feature-card p-4 rounded shadow-sm h-100">
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="feature-icon me-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-clock-history" viewBox="0 0 16 16">
                                                <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.37.71a7.01 7.01 0 0 0-.439-.27l.493-.87a8.025 8.025 0 0 1 .979.654l-.615.789a6.996 6.996 0 0 0-.418-.302zm1.834 1.79a6.99 6.99 0 0 0-.653-.796l.724-.69c.27.285.52.59.747.91l-.818.576zm.744 1.352a7.08 7.08 0 0 0-.214-.468l.893-.45a7.976 7.976 0 0 1 .45 1.088l-.95.313a7.023 7.023 0 0 0-.179-.483zm.53 2.507a6.991 6.991 0 0 0-.1-1.025l.985-.17c.067.386.106.778.116 1.17l-1 .025zm-.131 1.538c.033-.17.06-.339.081-.51l.993.123a7.957 7.957 0 0 1-.23 1.155l-.964-.267c.046-.165.086-.332.12-.501zm-.952 2.379c.184-.29.346-.594.486-.908l.914.405c-.16.36-.345.706-.555 1.038l-.845-.535zm-.964 1.205c.122-.122.239-.248.35-.378l.758.653a8.073 8.073 0 0 1-.401.432l-.707-.707z"/>
                                                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
                                            </svg>
                                        </div>
                                        <h4 className="mb-0">Real-time Insights</h4>
                                    </div>
                                    <p className="mb-0">Responses are saved in real time. If a user leaves halfway through, you still retain valuable insights — without relying on full submission.</p>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="feature-card p-4 rounded shadow-sm h-100">
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="feature-icon me-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-lightbulb" viewBox="0 0 16 16">
                                                <path d="M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13a.5.5 0 0 1 0 1 .5.5 0 0 1 0 1l-.224.447a1 1 0 0 1-.894.553H6.618a1 1 0 0 1-.894-.553L5.5 15a.5.5 0 0 1 0-1 .5.5 0 0 1 0-1 .5.5 0 0 1-.46-.302l-.761-1.77a1.964 1.964 0 0 0-.453-.618A5.984 5.984 0 0 1 2 6zm6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1z"/>
                                            </svg>
                                        </div>
                                        <h4 className="mb-0">Smart Assistant</h4>
                                    </div>
                                    <p className="mb-0">Our AI assistant answers questions in real time from your knowledge base, offering clarity and supporting retention — even during feedback.</p>
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-5">
                            <a href={App.base + '/login'} className="btn btn-primary btn-lg px-4">
                                Start Listening Smarter
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-right ms-2" viewBox="0 0 16 16">
                                    <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                </section>

                <hr/>

                <section className="py-5 pricing-section">
                    <div className="container">
                        <h2 className="text-center mb-3 fw-bold">Free to start</h2>
                        <p className="text-center mb-5">No credit card or payment information required</p>
                        <div className="row justify-content-center">
                        <div className="col-md-6">
                                <div className="card shadow-sm">
                                    <div className="card-body text-center p-5">
                                        <h3 className="card-title mb-4">Free forever</h3>
                                        <div className="price-tag mb-4">
                                            <span className="display-4 fw-bold">$0</span>
                                            <span className="text-muted">/month</span>
                                        </div>
                                        <ul className="list-unstyled mb-4">
                                            <li className="mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-circle-fill text-success me-2" viewBox="0 0 16 16">
                                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                                </svg>
                                                Unlimited Projects
                                            </li>
                                            <li className="mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-circle-fill text-success me-2" viewBox="0 0 16 16">
                                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                                </svg>
                                                Full Feature Access
                                            </li>
                                            <li className="mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-circle-fill text-success me-2" viewBox="0 0 16 16">
                                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                                </svg>
                                                Unlimited Knowledge Bases
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-info-circle-fill text-info me-2" viewBox="0 0 16 16">
                                                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                                                </svg>
                                                Upto 30 contacts
                                            </li>
                                        </ul>
                                        <a href={App.base + '/login'} className="btn btn-primary btn-lg">
                                            Get Started Now
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="card shadow-sm">
                                    <div className="card-body text-center p-5">
                                        <h3 className="card-title mb-4">Pro</h3>
                                        <div className="price-tag mb-4">
                                            <span className="display-4 fw-bold">$20</span>
                                            <span className="text-muted">/month</span>
                                        </div>
                                        <ul className="list-unstyled mb-4">
                                            <li className="mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-circle-fill text-success me-2" viewBox="0 0 16 16">
                                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                                </svg>
                                                Unlimited Projects
                                            </li>
                                            <li className="mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-circle-fill text-success me-2" viewBox="0 0 16 16">
                                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                                </svg>
                                                Full Feature Access
                                            </li>
                                            <li className="mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-circle-fill text-success me-2" viewBox="0 0 16 16">
                                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                                </svg>
                                                Unlimited Knowledge Bases
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-info-circle-fill text-info me-2" viewBox="0 0 16 16">
                                                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                                                </svg>
                                                Unlimited contacts
                                            </li>
                                        </ul>
                                        <a href={App.base + '/login'} className="btn btn-primary btn-lg">
                                            Get Started Now
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            <Footer />
        </>
    )
    ;
}

export default Home;