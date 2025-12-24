// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import {formatInferenceResponse, getInitials} from '../components/utils';
import PageLoader from '../components/PageLoader';
import ErrorText from '../components/ErrorText';
import Footer from '../components/Footer';

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
    messages: blockState[];
    file: any | null;
    isFileUploading: boolean;
    isLoaded: boolean;
    isError: boolean;
    isKnowledgeReady: boolean;
    isMessagesLoaded: boolean;
    message: string;
    isMessageSubmitted: boolean;
    isMessageValid: boolean;
}

const Chat: React.FC = () => {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const { slug } = useParams<{ slug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '', metas: { prompt: '', description: '', logo: '' } },
        profile: { id: '', slug: '', title: '' },
        messages: [],
        file: null,
        isFileUploading: false,
        isLoaded: false,
        isError: false,
        isKnowledgeReady: false,
        isMessagesLoaded: false,
        message: '',
        isMessageSubmitted: false,
        isMessageValid: false,
    });
    const messagesRef = useRef(data.messages);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        prepareKnowledge( data.slug );
        getMessages( data.slug, '' );
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        dispatchInference();
        messagesRef.current = data.messages;
    }, [data.messages.length]);

    useEffect(() => {
        dispatchInference();

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            let messages = messagesRef.current;
            if( messages.length > 0 ) {
                getMessages( data.slug, messages[ messages.length - 1]['id'] );
            }
        }, 60000);
    }, [data.isKnowledgeReady]);

    //send file message if file is selected
    useEffect(() => {
        if (data.file) {
            sendFile();
        }
    }, [data.file]);

    const dispatchInference = async (): Promise<void> => {
        if(data.isKnowledgeReady && ( data.messages.length > 0 && parseInt( data.messages[ data.messages.length - 1 ]['author'] ) < 0 && data.messages[ data.messages.length - 1 ]['generated_response'] == undefined )) {
            requestInference( data.messages[ data.messages.length - 1 ]['id'] );
        }
    };

    const getMessages = async ( slug: string|undefined, after: string ) : Promise<void> => {
        const response = await fetch(App.api_base + '/chat/' + data.slug + '/messages', {
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
            setData((prevData) => ({ ...prevData, messages: messages, workspace: res.workspace, profile: res.profile, isLoaded: true }));
        } else {
            setData((prevData) => ({ ...prevData, isError: true }));
        }
    };

    /*
        ** keep the message sending button disabled untile knowledge is prepared
        **
    */
    const prepareKnowledge = async ( slug: string|undefined ) : Promise<void> => {
        const response = await fetch(App.api_base + '/chat/' + data.slug + '/prepare', {
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
            setData((prevData) => ({ ...prevData, isKnowledgeReady: true }));
        }
    };

    const sendMessage = async (e: React.FormEvent) : Promise<void> => {
        e.preventDefault();
        if( data.message.trim() == '' ) setData((prevData) => ({ ...prevData, isMessageValid: false }));
        else {
            const response = await fetch(App.api_base + '/chat/' + data.slug + '/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Vuedoo-Domain': App.domain,
                    'X-Vuedoo-Access-Key': ''
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

    const requestInference = async ( id:string ) : Promise<void> => {
        setData((prevData) => ({ ...prevData, isKnowledgeReady: false }));
        const response = await fetch(App.api_base + '/chat/' + data.slug + '/inference/' + id, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': ''
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            var messages = data.messages;
            messages = messages.map(msg =>
                msg.id === id
                  ? { ...msg, generated_response: res.response }
                  : msg
              );

            setData((prevData) => ({ ...prevData, isKnowledgeReady: true }));
            setData(prevData => ({
                ...prevData,
                messages: messages
            }));
            messagesRef.current = messages;
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    const sendFile = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, isKnowledgeReady: false, isFileUploading: true }));
        if( data.file != null ) {
            const formData = new FormData();
            if (data.file) {
                formData.append("file", data.file);
            }
            try {
                const response = await fetch(`${App.api_base}/chat/${data.slug}/files/send`, {
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
                    prepareKnowledge(data.slug);

                    var messages = data.messages;
                    if( res.message ) messages.push(res.message);
                    setData((prevData) => ({ ...prevData, message: '', isMessageValid: false, isFileUploading: false, messages: messages }));
                } else {
                    setData((prevData) => ({ ...prevData, isSubmitted: false, isFileUploading: false }));
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        }
    };

    const viewKnowledge = async( id: string ): Promise<void> => {
        const response = await fetch(`${App.api_base}/chat/${data.workspace.slug}/file/${data.profile.id}/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': ''
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            if( res.knowledge != undefined && res.knowledge.file != undefined ) {
                window.open( res.knowledge.file, '_blank' );
            }
        }
    };

    function shortFormatDate(json: { date: string; timezone: string }): string {
        const utcDate = new Date(json.date + 'Z'); // Append 'Z' to handle UTC
        const now = new Date();
    
        const hours = utcDate.getUTCHours().toString().padStart(2, '0');
        const minutes = utcDate.getUTCMinutes().toString().padStart(2, '0');
        const day = utcDate.getUTCDate();
        const month = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = utcDate.getUTCFullYear().toString().slice(-2);
    
        const isToday = utcDate.toDateString() === now.toDateString();
    
        return isToday ? `${hours}:${minutes}` : `${hours}:${minutes} ${day}/${month}/${year}`;
    }

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
            <header className="container mt-4 border-bottom">
                <div className="d-flex justify-content-center gap-3">
                    <div className="avatar" style={{ width: '100px', height: '100px', objectFit: 'cover', fontSize: '45px', fontWeight: 'bold', backgroundImage: ( data.workspace.metas.logo != undefined ? 'url(' + data.workspace.metas.logo + ')' : 'none' ), backgroundSize: 'cover' }}>{ data.workspace.metas.logo != undefined ? '' : getInitials(data.workspace.title) }</div>
                </div>
                <div className="d-flex justify-content-center gap-3 mt-3">
                    <p className="font-weight-bold">{(data.workspace.metas.description != undefined ? data.workspace.metas.description : data.workspace.title)}</p>
                </div>
            </header>

            <main>
                <div className="container my-3 p-1 p-md-3 bg-body shadow-sm" style={{minHeight: '60vh'}}>
                    { data.isLoaded ? 
                        <>
                            
                            { data.messages.length > 0 && 
                                <div style={{height: '50vh', display: 'flex', justifyContent: 'bottom', flexDirection: 'column', overflowY: 'scroll'}}>
                                    {data.messages.map((message:blockState, index) => (
                                        <div className="message-container mb-3" key={message.slug}>
                                            {(() => {
                                                if (message.type === 'message') {
                                                    return (
                                                        <div className={`d-flex justify-content-${message.author > 0 ? 'start' : 'end'} my-2`}>
                                                            <div className={`border ${message.author > -1 ? 'bg-secondary' : 'bg-primary'} rounded p-2`} style={{maxWidth: message.author != 0 ? '80%' : '100%'}}>
                                                                <p className="pt-1 pb-0 mb-0 small" style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: formatInferenceResponse(message.content) }}></p>
                                                            </div>
                                                        </div>
                                                    );
                                                } else if (message.type === 'knowledge') {
                                                    return (
                                                        <div className={`d-flex justify-content-${message.author > 0 ? 'start' : 'end'} my-2`}>
                                                            <div className={`border rounded p-2`} style={{maxWidth: message.author != 0 ? '80%' : '100%'}}>
                                                                <p className="pt-1 pb-0 mb-0 small">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-file-check" style={{top: '-2px', position: 'relative'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 15l2 2l4 -4" /></svg>
                                                                    {message.author < 1 || (message.metas != undefined && message.metas.shared == 'true') 
                                                                        ? <a href="javascript:void(0)" onClick={() => viewKnowledge(message.id)}>{message.title}</a>
                                                                    : 'New information added'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            <p className="pt-0 pb-1 mb-0 small" style={{fontSize: '70%', textAlign: (message.author > 0 ? 'left' : 'right')}}>
                                                {shortFormatDate(message.created_at)}
                                            </p>

                                            { message.author < 0 && 
                                                <>
                                                { message.generated_response != undefined ?
                                                    <div className={`text-light bg-dark border rounded p-2 mt-3`}>
                                                        <p className="pt-1 pb-0 mb-0 small" dangerouslySetInnerHTML={{ __html: formatInferenceResponse(message.generated_response) }}></p>
                                                    </div>
                                                    :
                                                    <Loader/>
                                                }
                                                </>
                                            }
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            }
                            <div style={{ 
                                height: data.messages.length === 0 ? '50vh' : 'auto',
                                display: 'flex',
                                alignItems: data.messages.length === 0 ? 'center' : 'flex-end'
                            }}>
                                <form onSubmit={sendMessage} id="chatBox" className="w-100">
                                    <div className="position-relative">
                                        {/* Button in the top-right */}
                                        <span className="position-absolute top-0 end-0">
                                            { !data.isMessageValid && (
                                                <>
                                                    <input 
                                                        type="file" 
                                                        className="d-none" 
                                                        id="sendFile" 
                                                        accept=".pdf" 
                                                        onChange={(e) => { 
                                                            const file = e.target.files?.[0]; 
                                                            if (file) { 
                                                                setData((prevData) => ({ ...prevData, file: file }));
                                                            }
                                                        }} 
                                                    />
                                                    <button className="btn btn-primary btn-sm m-1" onClick={(e) => ( document.getElementById('sendFile')?.click() )} disabled={data.isFileUploading}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-send"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" /></svg>
                                                    </button>
                                                </>
                                            )}
                                            <button className="btn btn-primary btn-sm m-1" disabled={!data.isMessageValid || !data.isKnowledgeReady}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-send"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                                            </button>
                                        </span>
                                        <textarea
                                            ref={textareaRef}
                                            className="form-control"
                                            rows={2}
                                            value={data.message}
                                            placeholder={'Say anything to ' + data.workspace.title + '...'}
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
                                                    if (data.isMessageValid && data.isKnowledgeReady) {
                                                        sendMessage(e);
                                                    }
                                                }
                                            }}
                                            style={{ resize: "none", overflow: "hidden" }}
                                            disabled={data.isFileUploading}
                                        />
                                    </div>
                                </form>
                            </div>
                        </>
                        :
                        ( !data.isError ? 
                            <PageLoader />
                            :
                            <ErrorText />
                        )
                    }  
                </div>
            </main>

            <Footer />
        </>
    );
}

export default Chat;