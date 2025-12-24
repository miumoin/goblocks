import React, {useState, forwardRef, useEffect, useImperativeHandle, ForwardRefRenderFunction,} from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface workspaceState {
    id: string; 
    slug: string; 
    [key: string]: any
}

interface DataState {
  nodeShow: boolean;
  workspace: workspaceState | null;
  description: string;
}

export interface OpenNodeWindowHandle {
  enableNode: () => void;
}

interface OrganizationNodeProps {
  workspace: workspaceState | null;
  accessKey: string;
  onGetThreads: (page: number) => Promise<void>;
}

const OrganizationNodeInner: ForwardRefRenderFunction<OpenNodeWindowHandle, OrganizationNodeProps> = ( {workspace, accessKey, onGetThreads}, ref ) => {
    const [data, setData] = useState<DataState>({
        nodeShow: false,
        workspace: workspace || { id: '', slug: '', title: '', metas: { collect_information: 'false'} },
        description: '',
    });

    useEffect(() => {
        setData((prevData) => ({ ...prevData, workspace }));
    }, [workspace]);

    useImperativeHandle(ref, () => ({
        enableNode: () => {
            setData((prevData) => ({ ...prevData, nodeShow: true }));
        }
    }));

    const closeNode = async(): Promise<void> => {
        setData((prevData) => ({ ...prevData, nodeShow: false }));
    };

    useEffect(() => {
        console.log( data.workspace );
    }, [data] );

    const addNode = async(): Promise<void> => {
        if (!data.workspace) return;
        const response = await fetch(`${App.api_base}/workspace/${data.workspace.slug}/threads/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Vuedoo-Domain': App.domain,
                'X-Vuedoo-Access-Key': accessKey
            },
            body: JSON.stringify({ description: data.description})
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const res = await response.json();

        if (res.status === 'success') {
            setData((prevData) => ({ ...prevData, message: '', isDeleting: false }));
            window.location.href = `${App.base}/organization/${data.workspace.slug}/thread/${res.block.slug}`;
        }
    };
    
    return (
        <Modal show={data.nodeShow} onHide={closeNode}>
            <Modal.Header>
                <Modal.Title>Create a node</Modal.Title>
                <button className="btn-close" onClick={closeNode}></button>
            </Modal.Header>
            <Modal.Body>
                <p>Describe the node</p>
                <div className="input-group mb-3">
                    <textarea 
                        className="form-control" 
                        rows={3}
                        placeholder="E.g., creates a meeting schedule."
                        value={data.description}
                        onChange={(e) => setData((prevData) => ({ ...prevData, description: e.target.value }))}
                    >
                    </textarea>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={addNode}>
                    Create node
                </Button>
                <Button variant="secondary" onClick={closeNode}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    )
}

const OrganizationNode = forwardRef(OrganizationNodeInner);
export default OrganizationNode;