import React, {useState, useEffect} from 'react';
import { Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import Header from '../components/Header';
import Footer from '../components/Footer';
import QuestionnaireFields from '../components/questionnaireFields';

interface dataState {
    accessKey: string;
    workspaces: any[];
    newWorkspaceTitle: string;
    newWorkspaceMetas: any,
    isSubmitted: boolean;
    isValid: boolean;
}

const NewOrganization: React.FC = () => {
    const [data, setData] = useState<dataState>({
        accessKey: '',
        workspaces: [],
        newWorkspaceTitle: '',
        newWorkspaceMetas: { questionnaire: [''] },
        isSubmitted: false,
        isValid: true
    });

    useEffect(() => {
        const accessKey: string = Cookies.get(`access_key_typewriting`) || '';
        if( accessKey != '' ) {
            setData(( prevData ) => ({ ...prevData, accessKey: accessKey }));
        }
    }, []);
    
    const createNewWorkspace = async (e: React.FormEvent): Promise<any> => {
        e.preventDefault();
        setData((prevData) => ({ ...prevData, isSubmitted: true }));

        if( data.newWorkspaceTitle.trim() == '' ) {
            setData((prevData) => ({ ...prevData, isValid: false }));
        } else {
            try {
                const response = await fetch(App.api_base + '/workspaces/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Vuedoo-Domain': App.domain,
                        'X-Vuedoo-Access-Key': data.accessKey
                    },
                    body: JSON.stringify({ title: data.newWorkspaceTitle, metas: data.newWorkspaceMetas })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const res = await response.json();

                if (res.status === 'success') {
                    window.location.href = App.base + '/organization/' + res.block.slug;
                }

                return 0;
            } catch (error) {
                console.error('Error:', error);
                return 0;
            }
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
                            <li className="breadcrumb-item active" aria-current="page">New</li>
                        </ol>
                    </nav>

                    <div className="my-3 p-3 bg-body rounded shadow-sm">
                        <div style={{minHeight: '60vh', display: 'flex', flexDirection: 'column'}}>
                            <form onSubmit={createNewWorkspace}>
                                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                    <h6>Create a new project</h6>
                                </div>
                                <div className="mb-3 mt-3">
                                    <input type="text" className="form-control" placeholder="i.e. Acme Corporation" onChange={(e) => setData((prevData) => ({ ...prevData, newWorkspaceTitle: e.target.value }))} required />
                                    <div className="invalid-feedback" style={{ display: data.isSubmitted && !data.isValid ? 'block' : 'none' }}>Invalid name.</div>
                                </div>
                                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                    <h6>Information you are collecting (optional)</h6>
                                </div>
                                <div className={`mb-3 mt-3`}>
                                    <div className="mb-3 mt-3">
                                        <QuestionnaireFields 
                                            questions={data.newWorkspaceMetas.questionnaire || ['']}
                                            onChange={(newQuestions: any) => setData((prevData) => ({ 
                                                ...prevData,
                                                newWorkspaceMetas: { 
                                                    ...prevData.newWorkspaceMetas, 
                                                    questionnaire: newQuestions 
                                                }
                                            }))}
                                            disabled={false}
                                        />
                                    </div>
                                </div>
                                
                                <button type="submit" className="btn btn-primary">Create</button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
            
            <Footer />
        </>
    );
}

export default NewOrganization;