import React, {useState, useEffect} from "react";
import Cookies from 'js-cookie';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import {shortenText, getInitials} from './utils';

interface dataState {
    accessKey: string;
    workspaces: any[];
    workspace: string;
    subscription: { expiry_date: string, threads: number, user_id: number };
    stripe_payment_link: string;
}

const WorkspaceSwitcher: React.FC = () => {
    const [data, setData] = useState<dataState>({
        accessKey: '',
        workspaces: [],
        workspace: '',
        subscription: {expiry_date :'', threads: 0, user_id: 0},
        stripe_payment_link: App.stripe_payment_link
    });

    useEffect(() => {
        const accessKey: string = Cookies.get(`access_key_typewriting`) || '';
        if( accessKey != '' ) {
            setData(( prevData ) => ({ ...prevData, accessKey: accessKey }));
        } else {
            //do nothing
        }
    }, []);

    useEffect(() => {
        if( data.accessKey != '' ) {
            getWorkspaces();
        }
    }, [data.accessKey]);

    const getWorkspaces = async (): Promise<void> => {
        const response = await fetch(App.api_base + '/workspaces', {
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
            setData((prevData) => ({ ...prevData, workspaces: res.workspaces, subscription: res.subscription }));
            if( res.workspaces.length < 1 && window.location.href.indexOf('organization/new') < 0 ) {
                window.location.href = App.base + '/organization/new';
            } else if( window.location.href.indexOf('organization') > -1 ) {
                var workspace = '';
                for( var i = 0; i < res.workspaces.length; i++ ) {
                    if( window.location.href.split( App.base + '/organization/' )[1].split('/')[0] == res.workspaces[i]['slug'] ) {
                        workspace = res.workspaces[i].title;
                        break;
                    }
                }
                setData((prevData) => ({ ...prevData, workspace: workspace }));
            }
        }
    };

    const logout = async (): Promise<any> => {
        Cookies.remove("access_key_typewriting");
        window.location.href = App.base;
    };

    return data.accessKey !== '' ?
        <>
            {(!data.subscription?.expiry_date || new Date(data.subscription.expiry_date) <= new Date()) && (
                <OverlayTrigger
                    placement="bottom"
                    overlay={
                        <Tooltip>
                            {(data.subscription.threads > 25 ? 'Bravo! Your account reached its limit. ' : '') +
                            'Please subscribe for unlimited contacts.'}
                        </Tooltip>
                    }
                >
                    <a
                        href={`${data.stripe_payment_link}?client_reference_id=${data.subscription.user_id}`}
                        className="btn btn-danger btn-sm me-2"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Upgrade your account
                    </a>
                </OverlayTrigger>
            )}

            {data.subscription?.expiry_date && new Date(data.subscription.expiry_date) > new Date() &&
                <span className="badge bg-warning text-dark me-2" style={{lineHeight: '2', padding: '0 5px' }}>PRO</span>
            }
            <OverlayTrigger placement="bottom" overlay={<Tooltip>Sign out of your account.</Tooltip>} >
                <a className="d-flex align-items-center text-decoration-none" href="#" role="button"  style={{ marginRight: '5px' }} onClick={(e) => { e.preventDefault(); logout(); }}>
                    <strong>
                        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-logout"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg>
                    </strong>
                </a>
            </OverlayTrigger>
            <a href="#" className="d-flex align-items-center text-decoration-none dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                <strong>{(data.workspace == '' ? 'Projects' : shortenText( data.workspace, 35 ))}</strong>
            </a>
            <ul className="dropdown-menu text-small shadow">
                {data.workspaces.map((workspace, index) => (
                    <li key={index}>
                        <a href={ App.base + '/organization/' + workspace.slug } className="d-flex align-items-center dropdown-item">
                            <div className="avatar" style={{ top: '3px', width: '20px', height: '20px', objectFit: 'cover', fontSize: '12px', fontWeight: 'bold', backgroundImage: ( workspace.metas != undefined && workspace.metas.logo != undefined ? 'url(' + workspace.metas.logo + ')' : 'none' ), backgroundSize: 'cover' }}>{ workspace.metas != undefined && workspace.metas.logo != undefined ? '' : getInitials(workspace.title) }</div>
                            &nbsp;
                            {shortenText( workspace.title, 35 )}
                        </a>
                    </li>
                ))}
                <li>
                    <OverlayTrigger placement="bottom" overlay={<Tooltip>Set up a new project.</Tooltip>} >
                        <a className="dropdown-item d-flex align-items-center" href={App.base + '/organization/new' }>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-building-plus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13.55 17.733a5.806 5.806 0 0 1 -7.356 -4.052a5.81 5.81 0 0 1 1.537 -5.627l2.054 -2.054l7.165 7.165" /><path d="M4 20l3.5 -3.5" /><path d="M15 4l-3.5 3.5" /><path d="M20 9l-3.5 3.5" /><path d="M16 16l4 4" /><path d="M20 16l-4 4" /></svg>
                            &nbsp;
                            New project
                        </a>
                    </OverlayTrigger>
                </li>
            </ul>
        </>
        :
        <>
            { window.location.href.indexOf('/login') < 0 &&
                <a href={App.base + '/login'} className="d-flex align-items-center text-decoration-none btn btn-primary d-none d-sm-inline">
                    <strong>Enter dashboard</strong>
                </a>
            }
        </>
    ;
};

export default WorkspaceSwitcher;