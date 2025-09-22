import React, {useState, forwardRef, useEffect, useImperativeHandle, ForwardRefRenderFunction,} from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface workspaceState {
    id: string; 
    slug: string; 
    [key: string]: any
}

interface DataState {
  sharingShow: boolean;
  workspace: workspaceState | null;
}

export interface OpenShareWindowHandle {
  enableShare: () => void;
}

interface OrganizationShareProps {
  workspace: workspaceState | null;
}

const OrganizationShareInner: ForwardRefRenderFunction<OpenShareWindowHandle, OrganizationShareProps> = ( {workspace}, ref ) => {
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

    const [data, setData] = useState<DataState>({
        sharingShow: false,
        workspace: workspace || { id: '', slug: '', title: '', metas: { collect_information: 'false'} }
    });

    useEffect(() => {
        setData((prevData) => ({ ...prevData, workspace }));
    }, [workspace]);

    useImperativeHandle(ref, () => ({
        enableShare: () => {
            setData((prevData) => ({ ...prevData, sharingShow: true }));
        }
    }));

    const copyWorkspace = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            setCopySuccess(false);
        }
    };

    const closeSharing = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, sharingShow: false }));
    };

    useEffect(() => {
        console.log( data.workspace );
    }, [data] );
    
    return (
        <Modal show={data.sharingShow} onHide={closeSharing}>
            <Modal.Header>
                <Modal.Title>Share your contact link</Modal.Title>
                <button className="btn-close" onClick={closeSharing}></button>
            </Modal.Header>
            <Modal.Body>
                <p>Copy the unique URL below and share it with others. Anyone who visits the link will be added as a contact automatically.</p>
                <div className="input-group mb-3">
                    <input type="text" className="form-control" value={App.base + '/' + ( data.workspace != null ? data.workspace.slug : '' )} readOnly />
                    <button className="btn btn-outline-secondary" type="button" id="copy_button" onClick={() => copyWorkspace(App.base + '/' + ( data.workspace != null ? data.workspace.slug : '' ))} style={{ pointerEvents: ( copySuccess ? "none" : "auto" ), color: ( copySuccess ? "gray" : "" )}}>{ !copySuccess ? 'Copy' : 'Copied' }</button>
                </div>
                <div className="text-center">
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(App.base + '/' + ( data.workspace != null ? data.workspace.slug : ''))}`}
                        alt="QR Code"
                        style={{ maxWidth: '150px' }}
                    />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={closeSharing}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    )
}

const OrganizationShare = forwardRef(OrganizationShareInner);
export default OrganizationShare;