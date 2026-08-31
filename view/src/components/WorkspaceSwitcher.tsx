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

    const logout = async (): Promise<any> => {
        Cookies.remove("access_key_typewriting");
        window.location.href = App.base;
    };

    return data.accessKey !== '' ?
        <>
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
            <a href="#" className="d-flex align-items-center text-decoration-none" data-bs-toggle="dropdown" aria-expanded="false">
                <strong>Account settings</strong>
            </a>
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