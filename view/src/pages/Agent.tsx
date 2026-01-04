// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import {formatInferenceResponse, getInitials, generateCurl, fakeSleep} from '../components/utils';
import PageLoader from '../components/PageLoader';
import ErrorText from '../components/ErrorText';
import Footer from '../components/Footer';

interface blockState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface nodeState {
    endpoint: string;
    description: string;
    method: string;
    headers: Record<string, string>;
    body: any;
}

interface taskState {
    id: string;
    description: string;
    node: nodeState;
    status: number;
    outputs: any[];
}

interface dataState {
    accessKey: string;
    slug: string | undefined;
    workspace: blockState;
    isLoaded: boolean;
    isError: boolean;
    isMessagesLoaded: boolean;
    message: string;
    isMessageSubmitted: boolean;
    isMessageValid: boolean;
    tasks: taskState[];
}

const Agent: React.FC = () => {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const { slug } = useParams<{ slug?: string }>();
    const [data, setData] = useState<dataState>({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '', metas: { prompt: '', description: '', logo: '' } },
        isLoaded: true,
        isError: false,
        isMessagesLoaded: false,
        message: '',
        isMessageSubmitted: false,
        isMessageValid: false,
        tasks: []
    });
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        prepareAgent( data.slug );
    }, []);

    useEffect(() => {
        if (data.tasks.length > 0) {
            (async () => {
                for ( var i=0; i<data.tasks.length; i++ ) {
                    var tasks = data.tasks;
                    if( data.tasks[i].status === 0 ) {
                        fakeSleep(2000);
                        tasks[i].status = 1; //mark as input ready
                        setData((prevData) => ({ ...prevData, tasks: data.tasks }));
                        break; //execute one node at a time
                    } else if( data.tasks[i].status === 1 ) {
                        await prepareNode(i);
                        break; //execute one node at a time
                    } else if( data.tasks[i].status === 2 ) {
                        await executeNode(i);
                        break; //execute one node at a time
                    }
                }
            })();
        }
    }, [JSON.stringify(data.tasks)]);

    const prepareAgent = async ( slug: string|undefined ) : Promise<void> => {
        const response = await fetch(App.api_base + '/agent/' + data.slug + '/init', {
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
            //let messages = messagesRef.current;
            ///messages = messages.concat(res.messages);
            setData((prevData) => ({ ...prevData, workspace: res.workspace, profile: res.profile, isLoaded: true }));
        } else {
            setData((prevData) => ({ ...prevData, isError: true }));
        }
    };

    /*
    * Send Command to the agent
    * Prepare a list of nodes, input list for first node
    * Call API with inputs, get outputs
    * Make inference calls to identify inputs for next nodes from outputs of previous nodes
    * Continue until all nodes are processed or breaks somewhere
    */
    const commandAgent = async (e: React.FormEvent) : Promise<void> => {
        e.preventDefault();
        if( data.message.trim() == '' ) setData((prevData) => ({ ...prevData, isMessageValid: false }));
        else {
            const response = await fetch(App.api_base + '/agent/' + data.slug + '/gettasks', {
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
                //get task list
                //start inferencing
                    //prepare input for the node
                    //call the node - get output
                    //prepare input for next node
                    //continue until all nodes are processed

                setData((prevData) => ({ ...prevData, tasks: res.tasks }));
            }
        }
    };

    const prepareNode = async (nodeIndex: number): Promise<void> => {
        console.log( 'Preparing node index: ', nodeIndex );
        console.log( data.tasks[nodeIndex] );
        const tasks = data.tasks;
        let intelligenceRequired = false;
        let prompt = '';
        
        if( tasks[nodeIndex].node.headers != undefined && Object.keys(tasks[nodeIndex].node.headers).length > 0 ) {
            Object.entries(tasks[nodeIndex].node.headers).forEach(([key, value]) => {
                if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
                    // Handle dynamic header value
                    intelligenceRequired = true;
                }
            });
        }

        if( intelligenceRequired == false && tasks[nodeIndex].node.body != undefined && Array.isArray(tasks[nodeIndex].node.body) && tasks[nodeIndex].node.method != 'GET' ) {
            Object.entries(tasks[nodeIndex].node.body).forEach(([key, value]) => {
                if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
                    // Handle dynamic header value
                    intelligenceRequired = true;
                }
            });
        }

        tasks[nodeIndex].status = 2; //mark as ready to execute
        await fakeSleep(2000);
        setData((prevData) => ({ ...prevData, tasks: tasks }));

        if (intelligenceRequired) {
            const previousTaskOutput = nodeIndex > 0 ? JSON.stringify(data.tasks[nodeIndex - 1].outputs) : '';
            let previousOutputs = '';
            for (let i = 0; i < nodeIndex; i++) {
                if (tasks[i].status === 3) {
                    previousOutputs += `Task ${i + 1}: ${tasks[i].description}`;
                    previousOutputs += `output: ${JSON.stringify(tasks[i].outputs)}\n`;
                }
            }
            
            const prompt = `User commanded: ${data.message}
            
    Task ${nodeIndex + 1}: ${tasks[nodeIndex].description}
    Previous task outputs:
    ${previousOutputs}

    Now, from the user's command and previous outputs, decide and replace variable body and header inputs for following task. Variable body and header inputs are enclosed in curly braces {}. Return exactly the updated headers and body in JSON format only. For example, if header has "Authorization": "{auth_token}", replace it with actual token value. Do not change any other static values. If no changes are needed, return the original headers and body as is. Respond only with JSON object containing updated headers and body, i.e. { "headers": { ... }, "body": { ... } }.
    
    Node details:
    Endpoint: ${tasks[nodeIndex].node.endpoint}
    Method: ${tasks[nodeIndex].node.method}
    Headers: ${JSON.stringify(tasks[nodeIndex].node.headers)}
    Body: ${JSON.stringify(tasks[nodeIndex].node.body)}
    `;

            // Make inference call to prepare inputs
            const response = await fetch(App.api_base + '/agent/' + data.slug + '/prepare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Vuedoo-Domain': App.domain,
                    'X-Vuedoo-Access-Key': data.accessKey
                },
                body: JSON.stringify({ prompt })
            });

            if (response.ok) {
                const res = await response.json();
                if (res.status === 'success') {
                    //tasks[nodeIndex].node = res.node;
                    //setData((prevData) => ({ ...prevData, tasks: tasks }));
                }
            }
        }
    };

    const executeNode = async (nodeIndex: number): Promise<void> => {
        console.log( 'Executing node index: ', nodeIndex );
        console.log( data.tasks[nodeIndex] );
        const tasks = data.tasks;
        tasks[nodeIndex].status = 3; //mark as ready to execute
        await fakeSleep(2000);
        setData((prevData) => ({ ...prevData, tasks: tasks }));
        

        //Replace
        // User commanded {user command}, following task has been performed:
        //Iteration {n}
            // Task: {task description}
            // Output from previous task: {previous task output}
        // Now, prepare the required inputs (headers/body) for the next task node if any.

        /*const response = await fetch(App.api_base + '/agent/' + data.slug + '/gettasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': ''
            },
            body: JSON.stringify({ message: data.message, nodeIndex })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            // get task list and start inferencing for the specified nodeIndex if needed
            setData((prevData) => ({ ...prevData, tasks: res.tasks }));
        }*/
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
            <header className="container mt-4 border-bottom">
                <div className="d-flex justify-content-center gap-3">
                    <div className="avatar" style={{ objectFit: 'cover', fontSize: '45px', fontWeight: 'bold', backgroundImage: ( data.workspace.metas.logo != undefined ? 'url(' + data.workspace.metas.logo + ')' : 'none' ), backgroundSize: 'cover' }}>{ data.workspace.metas.logo != undefined ? '' : data.workspace.title }</div>
                </div>
                <div className="d-flex justify-content-center gap-3 mt-3">
                    <p className="font-weight-bold">{(data.workspace.metas.description != undefined ? data.workspace.metas.description : "&nbsp;")}</p>
                </div>
            </header>

            <main>
                <div className="container my-3 p-1 p-md-3 bg-body shadow-sm" style={{minHeight: '60vh'}}>
                    { data.isLoaded ? 
                        <>
                            <div style={{ 
                                height: 'auto',
                                display: 'flex',
                                alignItems: 'flex-end'
                            }}>
                                <form onSubmit={commandAgent} id="chatBox" className="w-100">
                                    <div className="position-relative">
                                        {/* Button in the top-right */}
                                        <span className="position-absolute top-0 end-0">
                                            <button className="btn btn-primary btn-sm m-1" disabled={!data.isMessageValid || data.tasks.length > 0}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-send"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                                            </button>
                                        </span>
                                        <textarea
                                            ref={textareaRef}
                                            className="form-control"
                                            rows={2}
                                            value={data.message}
                                            placeholder={'Make a command to ' + data.workspace.title + '...'}
                                            onChange={(e) => { 
                                                setData((prevData) => ({ 
                                                    ...prevData, 
                                                    message: e.target.value, 
                                                    isMessageValid: (e.target.value.trim() == '' ? false : true) 
                                                }))
                                                autoExpand();
                                            }}
                                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (data.isMessageValid && data.tasks.length == 0) {
                                                        // cast keyboard event to form event for sendMessage
                                                        commandAgent(e as unknown as React.FormEvent);
                                                    }
                                                }
                                            }}
                                            style={{ resize: "none", overflow: "hidden" }}
                                            disabled={ data.tasks.length > 0 }
                                        />
                                    </div>
                                </form>
                            </div>
                            <div className="mt-4">
                                <div style={{
                                    backgroundColor: '#1e1e1e',
                                    color: '#00ff00',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    padding: '12px',
                                    fontFamily: 'Courier New, monospace',
                                    fontSize: '13px',
                                    lineHeight: '1.6',
                                    minHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    <div style={{ marginTop: '10px' }}>$ <strong>{data.workspace.title} initialized</strong></div>
                                    { data.tasks.map( (task, index) => (
                                        <div key={index}>
                                            { task.status > 0 && <div style={{ marginTop: '10px' }}>$ <strong>...{task.description}</strong></div> }
                                            { task.status > 1 && <div style={{ marginTop: '10px' }}>$ {generateCurl(task.node)}</div> }
                                            { task.status === 3 && 
                                                <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', marginTop: '10px' }}>
                                                    <span style={{ marginRight: 8, position: 'sticky', top: 0, alignSelf: 'flex-start', zIndex: 2 }}>$</span>
                                                    <pre style={{ flexGrow: 1 }}>{ JSON.stringify(task.outputs) }</pre>
                                                </div>
                                            }
                                        </div>
                                    )) }
                                </div>
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

export default Agent;