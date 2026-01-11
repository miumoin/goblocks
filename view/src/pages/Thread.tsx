// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import {shortenFileName, shortenText, formatDate, shortFormatDate, formatInferenceResponse, generateCurl} from '../components/utils';
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
    threadSlug: string | undefined;
    workspace: blockState;
    thread: blockState;
    endpoint: string;
    type: string;
    headers: { key: string; value: string }[];
    body: { key: string; value: string }[];
    executions: blockState[];
    isLoaded: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    viewShow: boolean;
}

const Thread: React.FC = () => {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const { slug } = useParams<{ slug?: string }>();
    const { threadSlug } = useParams<{ threadSlug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        threadSlug: threadSlug,
        workspace: { id: '', slug: '', title: '' },
        thread: { id: '', slug: '', title: '', content: { endpoint: '', type: 'GET', body: [], headers: [] } },
        type: 'GET',
        endpoint: '',
        headers: [],
        body: [],
        executions: [],
        isLoaded: false,
        isSubmitted: false,
        isValid: false,
        viewShow: false
    });
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
            getProfile( '' );
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

    const getProfile = async ( after: string ) : Promise<void> => {
        const response = await fetch(App.api_base + '/workspace/' + data.slug + '/thread/' + threadSlug, {
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
            let thread = res.thread;
            if( thread.content != undefined ) {
                thread.content = JSON.parse( thread.content );
            }
            if( thread.content.endpoint == undefined ) {
                thread.content.endpoint = '';
            }
            if( thread.content.type == undefined ) {
                thread.content.type = 'GET';
            }
            if( thread.content.body == undefined ) {
                thread.content.body = [];
            }
            if( thread.content.headers == undefined ) {
                thread.content.headers = [];
            }
            setData((prevData) => ({ ...prevData, thread: res.thread, endpoint: thread.content.endpoint, type: thread.content.type, body: thread.content.body, headers: thread.content.headers }));
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
                            <li className="breadcrumb-item active" aria-current="page">{shortenText( data.thread.title, 30 )}</li>
                        </ol>
                    </nav>

                    { data.isLoaded ? 
                        <>
                            <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-start pt-3 pb-2 mb-3 border-bottom">
                                <h3 className="h2">{data.thread.title}</h3>
                                <div className="btn-toolbar mb-2 mb-md-0 d-inline" style={{whiteSpace: 'nowrap'}}>
                                    <OverlayTrigger placement="top" overlay={<Tooltip>Save node.</Tooltip>} >
                                        <button className="btn btn-sm btn-outline-primary" id="save-thread-btn" onClick={async () => {
                                            let content = {
                                                description: data.thread.content.description,
                                                endpoint: data.endpoint,
                                                type: data.type,
                                                headers: data.headers,
                                                body: data.body
                                            };

                                            document.getElementById('save-thread-btn')?.classList.add('disabled'); 
                                            const response = await fetch(App.api_base + '/workspace/' + data.slug + '/thread/' + data.threadSlug + '/update', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'X-Vuedoo-Domain': App.domain,
                                                    'X-Vuedoo-Access-Key': data.accessKey
                                                },
                                                body: JSON.stringify( content )
                                            });

                                            if (!response.ok) {
                                                throw new Error('Network response was not ok');
                                            }

                                            const res = await response.json();

                                            if (res.status === 'success') {
                                                document.getElementById('save-thread-btn')?.classList.remove('disabled');
                                            }
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-1px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
                                            &nbsp;
                                            Save
                                        </button>
                                    </OverlayTrigger>
                                    &nbsp;
                                    <OverlayTrigger placement="top" overlay={<Tooltip>Test the endpoint.</Tooltip>} >
                                        <button className="btn btn-outline-primary btn-sm me-2" id="test-endpoint-btn" onClick={async () => {
                                            let content = {
                                                description: data.thread.content.description,
                                                endpoint: data.endpoint,
                                                type: data.type,
                                                headers: data.headers,
                                                body: data.body
                                            };

                                            document.getElementById('command-text')!.textContent = generateCurl({endpoint: content.endpoint, method: content.type, headers: content.headers, body: content.body});
                                            document.getElementById('test-endpoint-btn')?.classList.add('disabled'); 
                                            const response = await fetch(App.api_base + '/workspace/' + data.slug + '/thread/' + data.threadSlug + '/execute', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'X-Vuedoo-Domain': App.domain,
                                                    'X-Vuedoo-Access-Key': data.accessKey
                                                },
                                                body: JSON.stringify( content )
                                            });

                                            if (!response.ok) {
                                                throw new Error('Network response was not ok');
                                            }

                                            const res = await response.json();

                                            if (res.status === 'success') {
                                                let newExecutions = [ res.execution ].concat( data.executions );
                                                setData((prevData) => ({ ...prevData, executions: newExecutions }));
                                                document.getElementById('command-result')!.textContent = JSON.stringify( res.data, null, 2 );
                                                document.getElementById('command-result-block')!.style.display = 'flex';
                                                document.getElementById('test-endpoint-btn')?.classList.remove('disabled');
                                            }
                                        }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-square-rounded-plus" style={{position: 'relative', top: '-1px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M19 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M19 8v5a5 5 0 0 1 -5 5h-3l3 -3m0 6l-3 -3" /><path d="M5 16v-5a5 5 0 0 1 5 -5h3l-3 -3m0 6l3 -3" /></svg>
                                            <span className="d-none d-sm-inline">
                                                &nbsp;
                                                Test
                                            </span>
                                        </button>
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="my-3 p-md-3 bg-body rounded shadow-sm">

                                <div className="row justify-content-center">
                                    <div className="col-md-6 border-end mb-3">
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                            <h6>Configuration</h6>
                                        </div>
                                        <div style={{minHeight: '60vh', display: 'flex', justifyContent: 'bottom', flexDirection: 'column', overflowY: 'scroll'}}>
                                            <div className="p-3">
                                                <div className="mb-3">
                                                    <label htmlFor="description" className="form-label">Description</label>
                                                    <textarea
                                                        id="description"
                                                        className="form-control"
                                                        rows={4}
                                                        placeholder="Enter a description for this configuration..."
                                                        defaultValue={data.thread.content?.description || '' }
                                                        onChange={(e) =>
                                                            setData((prevData) => ({
                                                                ...prevData, thread: {
                                                                    ...prevData.thread,
                                                                    content: {
                                                                        ...prevData.thread.content,
                                                                        description: e.target.value
                                                                    }
                                                                }
                                                            }))
                                                        }   
                                                    />
                                                </div>

                                                <div className="mb-3">
                                                    <label htmlFor="type" className="form-label">Type</label>
                                                    <select
                                                        id="type"
                                                        className="form-select"
                                                        value={data.type || 'GET'}
                                                        onChange={(e) =>
                                                            setData((prevData) => ({ ...(prevData as any), type: e.target.value }))
                                                        }
                                                    >
                                                        <option value="GET">GET</option>
                                                        <option value="POST">POST</option>
                                                        <option value="PUT">PUT</option>
                                                        <option value="PATCH">PATCH</option>
                                                        <option value="DELETE">DELETE</option>
                                                        <option value="OPTIONS">OPTIONS</option>
                                                        <option value="HEAD">HEAD</option>
                                                    </select>
                                                </div>

                                                <div className="mb-3">
                                                    <label htmlFor="endpoint" className="form-label">Endpoint</label>
                                                    <input
                                                        id="endpoint"
                                                        type="text"
                                                        className="form-control"
                                                        placeholder="https://api.example.com/v1/..."
                                                        value={data.endpoint || ''}
                                                        onChange={(e) =>
                                                            setData((prevData) => ({ ...(prevData as any), endpoint: e.target.value }))
                                                        }
                                                    />
                                                </div>

                                                <div className="border-top pt-3">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <h6 className="mb-0">Headers</h6>
                                                    </div>

                                                    <div className="gx-3">
                                                        {(data.headers.length === 0 ? [{ key: '', value: '' }] : data.headers.concat([{ key: '', value: '' }])).map((header, index) => (
                                                            <div className="mb-2" key={index}>
                                                                <div className="row mb-2">
                                                                    <div className="col-6">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control"
                                                                            placeholder={`Header ${index + 1} Key (e.g. Authorization)`}
                                                                            value={header.key}
                                                                            onChange={(e) => {
                                                                                const newHeaders = [...data.headers];
                                                                                // If this is the "extra" trailing empty row, ensure object exists
                                                                                if (index >= newHeaders.length) {
                                                                                    newHeaders.push({ key: e.target.value, value: header.value || '' });
                                                                                } else {
                                                                                    newHeaders[index] = { ...newHeaders[index], key: e.target.value };
                                                                                }
                                                                                // Keep one trailing empty row, remove fully empty rows before it
                                                                                const filtered = newHeaders.filter((h, i) => (h.key.trim() !== '' || h.value.trim() !== '') || i !== newHeaders.length - 1);

                                                                                setData((prev) => ({ ...prev, headers: filtered }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="col-6">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control"
                                                                            placeholder="Value"
                                                                            value={header.value}
                                                                            onChange={(e) => {
                                                                                const newHeaders = [...data.headers];
                                                                                if (index >= newHeaders.length) {
                                                                                    newHeaders.push({ key: header.key || '', value: e.target.value });
                                                                                } else {
                                                                                    newHeaders[index] = { ...newHeaders[index], value: e.target.value };
                                                                                }
                                                                                const filtered = newHeaders.filter((h, i) => (h.key.trim() !== '' || h.value.trim() !== '') || i === newHeaders.length - 1);
                                                                                setData((prev) => ({ ...prev, headers: filtered }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="border-top pt-3">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <h6 className="mb-0">Body</h6>
                                                    </div>

                                                    <div className="gx-3">
                                                        {(data.body.length === 0 ? [{ key: '', value: '' }] : data.body.concat([{ key: '', value: '' }])).map((body_data, index) => (
                                                            <div className="mb-2" key={index}>
                                                                <div className="row mb-2">
                                                                    <div className="col-6">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control"
                                                                            placeholder={`Body ${index + 1} Key (e.g. Authorization)`}
                                                                            value={body_data.key}
                                                                            onChange={(e) => {
                                                                                const newBody = [...data.body];
                                                                                // If this is the "extra" trailing empty row, ensure object exists
                                                                                if (index >= newBody.length) {
                                                                                    newBody.push({ key: e.target.value, value: body_data.value || '' });
                                                                                } else {
                                                                                    newBody[index] = { ...newBody[index], key: e.target.value };
                                                                                }
                                                                                // Keep one trailing empty row, remove fully empty rows before it
                                                                                const filtered = newBody.filter((h, i) => (h.key.trim() !== '' || h.value.trim() !== '') || i !== newBody.length - 1);

                                                                                setData((prev) => ({ ...prev, body: filtered }));
                                                                            }}
                                                                            disabled={data.type === 'GET' || data.type === 'HEAD' ? true : false}
                                                                        />
                                                                    </div>
                                                                    <div className="col-6">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control"
                                                                            placeholder="Value"
                                                                            value={body_data.value}
                                                                            onChange={(e) => {
                                                                                const newBody = [...data.body];
                                                                                if (index >= newBody.length) {
                                                                                    newBody.push({ key: body_data.key || '', value: e.target.value });
                                                                                } else {
                                                                                    newBody[index] = { ...newBody[index], value: e.target.value };
                                                                                }
                                                                                const filtered = newBody.filter((h, i) => (h.key.trim() !== '' || h.value.trim() !== '') || i === newBody.length - 1);
                                                                                setData((prev) => ({ ...prev, body: filtered }));
                                                                            }}
                                                                            disabled={data.type === 'GET' || data.type === 'HEAD' ? true : false}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6 mb-3" style={{display: 'flex', flexDirection: 'column'}}>
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-1 mb-0">
                                            <h6>Result</h6>
                                        </div>
                                        
                                        &nbsp;

                                        <div style={{backgroundColor: '#1e1e1e', color: '#00ff00', border: '1px solid #444', borderRadius: '4px', padding: '12px', fontFamily: 'Courier New, monospace', fontSize: '13px', lineHeight: '1.6', minHeight: '50px', overflowY: 'auto'}}>
                                            <div>$ <span id="command-text" style={{ flexGrow: 1 }}></span></div>
                                            <div id="command-result-block" style={{ display: 'none', alignItems: 'center', overflowX: 'auto', marginTop: '10px' }}>
                                                <span style={{ marginRight: 8, position: 'sticky', top: 0, alignSelf: 'flex-start', zIndex: 2 }}>$</span>
                                                <pre id="command-result" style={{ flexGrow: 1 }}></pre>
                                            </div>
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

export default Thread;