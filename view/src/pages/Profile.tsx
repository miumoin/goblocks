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
    knowledges: blockState[];
    knowledge: blockState;
    messages: blockState[];
    isLoaded: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    shared: string;
    isMessagesLoaded: boolean;
    message: string;
    isMessageSubmitted: boolean;
    isMessageValid: boolean;
    file: any | null;
    note: string;
    show: boolean;
    deletingShow: boolean;
    deletingKnowledgeId: string;
    deletingKnowledgeTitle: string;
    isDeleting: boolean;
    viewShow: boolean;
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
        profile: { id: '', slug: '', title: '' },
        knowledges: [],
        knowledge: { id: '', slug: '', title: '' },
        messages: [],
        isLoaded: false,
        isSubmitted: false,
        isValid: false,
        shared: 'false',
        isMessagesLoaded: false,
        message: '',
        isMessageSubmitted: false,
        isMessageValid: false,
        file: null,
        note: '',
        show: false,
        deletingShow: false,
        deletingKnowledgeId: '',
        deletingKnowledgeTitle: '',
        isDeleting: false,
        viewShow: false
    });
    const messagesRef = useRef(data.messages);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
            getProfileKnowledges();
            getProfileMessages( '' );

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
    
            intervalRef.current = setInterval(() => {
                let messages = messagesRef.current;
                if( messages.length > 0 ) {
                    getProfileMessages( messages[ messages.length - 1]['id'] );
                }
            }, 30000);
        }
    }, [data.workspace]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        messagesRef.current = data.messages;
    }, [data.messages.length]);

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

    const getProfileMessages = async ( after: string ) : Promise<void> => {
        const response = await fetch(App.api_base + '/workspace/' + data.slug + '/profile/' + profileSlug + '/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': data.accessKey
            },
            body: JSON.stringify({ after: after })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            let messages = messagesRef.current;
            messages = messages.concat(res.messages);
            let profile = res.profile;
            setData((prevData) => ({ ...prevData, messages: messages, profile: res.profile }));
        }
    };

    const getProfileKnowledges = async () : Promise<void> => {
        const response = await fetch(App.api_base + '/workspace/' + data.slug + '/profile/' + profileSlug + '/knowledge', {
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
            setData((prevData) => ({ ...prevData, knowledges: res.knowledges, profile: res.profile }));
        }
    };

    const initKnowledgeUpload = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isSubmitted: false, isValid: false, file: null, note: '', shared: 'false', show: true }));
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
            formData.append("shared", data.shared);
            try {
                const response = await fetch(`${App.api_base}/workspace/${data.slug}/profile/${data.profileSlug}/knowledge/save`, {
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
                    getProfileKnowledges();
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
        const response = await fetch(`${App.api_base}/workspace/${data.slug}/${data.profile.id}/knowledge/delete`, {
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
            getProfileKnowledges();
        }
    };

    const displayKnowledge = async( id: string ): Promise<void> => {
        if (data.knowledges.length > 0) {
            var knowledge:blockState = data.knowledges.find((k) => k.id === id) || {id: '', title: '', slug: ''};
        }
        
        setData((prevData) => ({ ...prevData, knowledge: knowledge, viewShow: true }));

        const response = await fetch(`${App.api_base}/workspace/${data.slug}/knowledge/get/${data.profile.id}/${id}`, {
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

    const sendMessage = async (e: React.FormEvent) : Promise<void> => {
        e.preventDefault();
        if( data.message.trim() == '' ) setData((prevData) => ({ ...prevData, isMessageValid: false }));
        else {
            const response = await fetch(App.api_base + '/workspace/' + data.slug + '/profile/' + profileSlug + '/messages/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Vuedoo-Domain': App.domain,
                    'X-Vuedoo-Access-Key': data.accessKey
                },
                body: JSON.stringify({ message: data.message })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const res = await response.json();

            if (res.status === 'success') {
                var messages = data.messages;
                if( res.message ) messages.push(res.message);
                setData((prevData) => ({ ...prevData, message: '', isMessageValid: false, messages: messages }));
            }
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

    // Auto-expand function
    const autoExpand = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto"; // Reset height
            textarea.style.height = `${textarea.scrollHeight}px`; // Expand dynamically
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
                                <h3 className="h2">{data.profile.title}</h3>
                                <div className="btn-toolbar mb-2 mb-md-0 d-inline" style={{whiteSpace: 'nowrap'}}>
                                    <OverlayTrigger placement="top" overlay={<Tooltip>View the conversation from your contact’s perspective.</Tooltip>} >
                                        <a href={App.base + '/chat/' + data.profileSlug} target="_blank" className="btn btn-sm btn-outline-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-link"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>
                                        </a>
                                    </OverlayTrigger>
                                    &nbsp;
                                    <OverlayTrigger placement="top" overlay={<Tooltip>Copy the conversation link to share with the contact person.</Tooltip>} >
                                        <a href="javascript:void(0)" onClick={() => copyText( App.base + '/chat/' + data.profileSlug )} style={{ pointerEvents: ( copySuccess ? "none" : "auto" ), color: ( copySuccess ? "gray" : "" )}} className="btn btn-sm btn-outline-primary">
                                            { !copySuccess ?
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-copy"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
                                                :
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-copy"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></svg>
                                            }
                                        </a>
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="my-3 p-md-3 bg-body rounded shadow-sm">

                                <div className="row justify-content-center">
                                    <div className="col-md-6 border-end mb-3">
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                            <h6>Conversation</h6>
                                        </div>
                                        <div style={{height: '60vh', display: 'flex', justifyContent: 'bottom', flexDirection: 'column', overflowY: 'scroll'}}>
                                            { data.messages.length > 0 ? 
                                                <>
                                                    {data.messages.map((message:blockState, index) => (
                                                        <div className="message-container" key={message.id}>
                                                            <div className={`d-flex justify-content-${message.author > 0 ? 'end' : 'start'} my-2`}>
                                                                <div className={`border ${message.author < 0 ? 'bg-secondary' : 'bg-primary'} rounded p-2`} style={{maxWidth: message.author != 0 ? '80%' : '100%'}}>
                                                                    <p className="pt-1 pb-0 mb-0 small" style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: formatInferenceResponse(message.content) }}></p>
                                                                </div>
                                                            </div>
                                                            { message.author < 0 && message.generated_response != undefined && 
                                                                <div className={`text-light bg-dark border rounded p-2 my-2`}>
                                                                    <p className="pt-1 pb-0 mb-0 small" dangerouslySetInnerHTML={{ __html: formatInferenceResponse(message.generated_response) }}></p>
                                                                </div>
                                                            }
                                                            <p className="pt-0 pb-1 mb-0 small" style={{fontSize: '70%', textAlign: (message.author > 0 ? 'right' : 'left')}}>{shortFormatDate(message.created_at)}</p>
                                                        </div>
                                                    ))}
                                                </>
                                                :
                                                <div className="empty-space" style={{height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
                                                    <svg style={{width: '80px', height: '80px', fill: '#6c757d'}} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"/>
                                                    </svg>
                                                    <p className="text-muted mt-3">Send a message to start the conversation and assist the person directly.</p>
                                                </div>
                                            }
                                            <div ref={messagesEndRef} />
                                        </div>
                                        <div>
                                            <form onSubmit={sendMessage} id="chatBox">
                                                <div className="position-relative">
                                                    {/* Button in the top-right */}
                                                    <button className="btn btn-primary btn-sm position-absolute top-0 end-0 m-2" disabled={!data.isMessageValid}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-send"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                                                    </button>
                                                    <textarea
                                                        ref={textareaRef}
                                                        className="form-control"
                                                        rows={2}
                                                        value={data.message}
                                                        placeholder="Type a message..."
                                                        onChange={(e) => { 
                                                            setData((prevData) => ({ 
                                                                ...prevData, 
                                                                message: e.target.value, 
                                                                isMessageValid: (e.target.value.trim() == '' ? false : true) 
                                                            }))
                                                            autoExpand();
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                if (data.isMessageValid) {
                                                                    sendMessage(e);
                                                                }
                                                            }
                                                        }}
                                                        style={{ resize: "none", overflow: "hidden" }}
                                                    />
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                    <div className="col-md-6 mb-3" style={{display: 'flex', flexDirection: 'column'}}>
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-1 mb-0">
                                            <h6>Files & notes</h6>
                                            <span>
                                                <OverlayTrigger placement="top" overlay={<Tooltip>Upload documents relevant to this conversation only.</Tooltip>} >
                                                    <button className="btn btn-outline-primary btn-sm me-2" data-toggle="modal" data-target="#knowledge" onClick={initKnowledgeUpload}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-1px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" /><path d="M15 12h-6" /><path d="M12 9v6" /></svg>
                                                        <span className="d-none d-sm-inline">
                                                            &nbsp;
                                                            New content
                                                        </span>
                                                    </button>
                                                </OverlayTrigger>
                                            </span>
                                        </div>

                                        { data.profile.collected_information && Object.keys(data.profile.collected_information).length > 0 && 
                                            <div className="text-body-secondary pt-3">
                                                <p className="pt-1 pb-1 mb-0 small">
                                                    <strong className="d-block text-gray-dark">Summary</strong>
                                                </p>

                                                <table border={1} cellPadding="8" style={{ borderCollapse: 'collapse' , width: '100%' }}>
                                                    <tbody>
                                                        {Object.entries(data.profile.collected_information).map(
                                                            ([key, value], index) => (
                                                                <tr key={index}>
                                                                    <th>{key}</th>
                                                                    <td>
                                                                        {(() => {
                                                                            const formatValue = (val: any): string => {
                                                                                if (Array.isArray(val)) {
                                                                                    return val.map(formatValue).join(', ');
                                                                                } else if (typeof val === 'object' && val !== null) {
                                                                                    return Object.values(val).map(formatValue).join(', ');
                                                                                }
                                                                                return String(val);
                                                                            };
                                                                            
                                                                            return formatValue(data.profile.collected_information[key]);
                                                                        })()}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        }

                                        { data.knowledges.length > 0 ? 
                                            <>
                                                {data.knowledges.map((knowledge:blockState, index) => (
                                                    <div className="d-flex text-body-secondary pt-3" key={knowledge.id}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-file-text me-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></svg>
                                                        <p className="pt-1 pb-1 mb-0 small">
                                                            <strong className="d-block text-gray-dark">{shortenFileName( knowledge.title, 35 )}</strong>
                                                            <small>
                                                                <OverlayTrigger placement="top" overlay={<Tooltip>View and download your content.</Tooltip>} >
                                                                    <a href="javascript:void(0)" onClick={() => displayKnowledge(knowledge.id)}>View</a>
                                                                </OverlayTrigger>
                                                                &nbsp;
                                                                -
                                                                &nbsp;
                                                                <OverlayTrigger placement="top" overlay={<Tooltip>Permanently delete this document.</Tooltip>} >
                                                                    <a href="javascript:void(0)" onClick={() => initDeletion(knowledge.id, knowledge.title)}>Delete</a>
                                                                </OverlayTrigger>
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
                                                <p className="text-muted mt-3">Upload files to this conversation to combine with the project's common files, creating tailored responses for this contact.</p>
                                            </div>
                                        }
                                    </div>
                                </div>
                            </div>
                        </>
                        :
                        <PageLoader />
                    }
                </div>

                <Modal show={data.show} onHide={closeKnowledgeUpload} backdrop="static">
                    <Modal.Header>
                        <Modal.Title>Add file to conversation</Modal.Title>
                        <button className="btn-close" disabled={data.isSubmitted && data.isValid} onClick={closeKnowledgeUpload}></button>
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
                            <div className="form-group mb-3" style={{ display: ( data.file ? 'block' : 'none' ) }}>
                                <label className="mb-3">
                                    <input type="checkbox" id="knowledgeShared" onChange={(e) => setData((prevData) => ({ ...prevData, shared: (e.target.checked ? 'true' : 'false' )}))} />
                                    &nbsp;
                                    Shared with everyone
                                </label>
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
                                <a href={data.knowledge.file} target="_blank">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', 'top' : '-4px' }} className="icon icon-tabler icons-tabler-outline icon-tabler-download"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
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
            </main>
            
            <Footer />
        </>
    );
}

export default Profile;