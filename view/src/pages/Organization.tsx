// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import ErrorText from '../components/ErrorText';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Tooltip from 'react-bootstrap/Tooltip';

import { 
  Card, ButtonGroup, Form, Badge, Row, Col, Container 
} from 'react-bootstrap';

import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import {shortenText} from '../components/utils';
import PageLoader from '../components/PageLoader';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OrganizationShare, { OpenShareWindowHandle } from '../components/OrganizationShare';
import OrganizationNode, { OpenNodeWindowHandle } from '../components/OrganizationNode';

interface threadState {
    id: string; 
    slug: string; 
    [key: string]: any;
}

interface dataState {
    accessKey: string;
    slug: string;
    workspace: { id: string; slug: string; [key: string]: any } | null;
    threads: threadState[];
    page: number;
    isLoaded: boolean;
    isSubmitted: boolean;
    isValid: boolean;
    title: string;
    deletingShow: boolean;
    deletingThreadId: string;
    deletingThreadTitle: string;
    isDeleting: boolean;
    sharingShow: boolean;
}

interface Shot {
  id: number;
  slug?: string;
  duration: string;
  shot_type: string;
  shot_icon: string;
  movement: string;
  movement_icon: string;
  master_shot: boolean;
  selected: boolean;
  description: string;
  color: string;
  summary: string;
  scene: string;
  take: string;
  roll: string;
  director: string;
  camera: string;
  date: string;
}

interface Character {
  id: number;
  slug: string;
  name: string;
  color: string;
  gender: string;
  height: string;
  bodyType: string;
  description: string;
  image: string | File | null;
}

const Organization: React.FC = () => {
    const [show, setShow] = useState(false);
    const { slug } = useParams();
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [data, setData] = useState({
        accessKey: '',
        slug: slug,
        workspace: { id: '', slug: '', title: '', metas: { plotText: ''}, characters: [] } as any,
        threads: [],
        page: 1,
        isLoaded: false,
        isSubmitted: false,
        isValid: false,
        title: '',
        deletingShow: false,
        deletingThreadId: '',
        deletingThreadTitle: '',
        isDeleting: false,
        sharingShow: false
    });
    const [selectedShot, setSelectedShot] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);

    const [isDeleting, setIsDeleting] = useState(false);
    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isEditingPlot, setIsEditingPlot] = useState(false);

    // Timeline State
    const [isTimelineGenerated, setIsTimelineGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Shot type and movement mappings
    const SHOT_TYPES = [
        { value: 'Wide', label: 'Wide', icon: '' },
        { value: 'Medium', label: 'Medium', icon: '👤' },
        { value: 'Close-up', label: 'Close-up', icon: '👁️' },
        { value: 'Extreme Close-up', label: 'Extreme Close-up', icon: '🔍' },
        { value: 'Over-the-shoulder', label: 'Over-the-shoulder', icon: '👥' },
        { value: 'Point-of-view', label: 'Point-of-view', icon: '👁️‍️' },
        { value: 'Low angle', label: 'Low angle', icon: '' },
        { value: 'High angle', label: 'High angle', icon: '' },
        { value: 'Bird\'s eye', label: 'Bird\'s eye', icon: '🦅' },
        { value: 'Tracking', label: 'Tracking', icon: '🏃' },
        { value: 'Two-shot', label: 'Two-shot', icon: '👥👥' },
        { value: 'Group shot', label: 'Group shot', icon: '👥👥' },
        { value: 'Insert', label: 'Insert', icon: '📦' },
        { value: 'Cutaway', label: 'Cutaway', icon: '✂️' },
        { value: 'Reaction', label: 'Reaction', icon: '' },
    ];

    const MOVEMENT_TYPES = [
        { value: 'Static', label: 'Static', icon: '⏸️' },
        { value: 'Pan', label: 'Pan', icon: '↔️' },
        { value: 'Tilt', label: 'Tilt', icon: '↕️' },
        { value: 'Dolly', label: 'Dolly', icon: '🎥' },
        { value: 'Zoom', label: 'Zoom', icon: '🔎' },
        { value: 'Tracking', label: 'Tracking', icon: '🛤️' },
        { value: 'Crane', label: 'Crane', icon: '🏗️' },
        { value: 'Handheld', label: 'Handheld', icon: '📹' },
        { value: 'Steadicam', label: 'Steadicam', icon: '🎬' },
        { value: 'Push in', label: 'Push in', icon: '⬆️' },
        { value: 'Pull out', label: 'Pull out', icon: '⬇️' },
        { value: 'Arc', label: 'Arc', icon: '🔄' },
        { value: 'Whip pan', label: 'Whip pan', icon: '⚡' },
        { value: 'Roll', label: 'Roll', icon: '🌀' },
        { value: 'Pedestal', label: 'Pedestal', icon: '📊' },
    ];

    // Helper function to get icon by shot type
    const getShotIcon = (shotType: string): string => {
    const shot = SHOT_TYPES.find(s => s.value === shotType);
    return shot?.icon || '🎬';
    };

    // Helper function to get icon by movement type
    const getMovementIcon = (movement: string): string => {
    const movementType = MOVEMENT_TYPES.find(m => m.value === movement);
    return movementType?.icon || '⏸️';
    };

    // --- TIMELINE HANDLERS ---
    const handleGenerateTimeline = async(e: React.FormEvent) => {
        setIsGenerating(true);
        
        /*
        // Simulate AI generation delay
        setTimeout(() => {
        const initialShots: Shot[] = [
            { 
            id: 1, slug: 'shot-1', duration: '20s', shot_type: 'Wide', shot_icon: '🌄', movement: 'Pan', movement_icon: '↔️', master_shot: true, selected: false,
            description: 'Neon cityscape, raining. Establishing mood.', color: 'bg-dark',
            summary: 'This is a master shot establishing the dystopian cityscape. Requires a tilt down movement for 4s to reveal the protagonist in the foreground.',
            scene: '01', take: '01', roll: 'A001', director: 'A. Director', camera: 'ARRI Alexa', date: '06.08.2026'
            },
            { 
            id: 2, duration: '12s', shot_type: 'Medium', shot_icon: '👤', movement: 'Static', movement_icon: '⏸️', master_shot: false, selected: false,
            description: 'Elara looking out the window, reflection visible.', color: 'bg-secondary',
            summary: 'Medium shot focusing on Elara\'s contemplative moment. Static camera with emphasis on the window reflection showing the city.',
            scene: '02', take: '01', roll: 'A001', director: 'A. Director', camera: 'ARRI Alexa', date: '06.08.2026'
            },
            { 
            id: 3, duration: '8s', shot_type: 'Close-up', shot_icon: '👁️', movement: 'Dolly', movement_icon: '🎥', master_shot: false, selected: false,
            description: 'Elara\'s eye, reflecting a glowing data drive.', color: 'bg-dark',
            summary: 'Extreme close-up of Elara\'s eye. Slow dolly in movement to emphasize the reflection of the data drive.',
            scene: '03', take: '01', roll: 'A002', director: 'A. Director', camera: 'RED Komodo', date: '06.08.2026'
            }
        ];
        
        setTimeline(initialShots);
        setIsTimelineGenerated(true);
        setIsGenerating(false);
        }, 1500);
        */

        try {
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/generateTimeline`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: JSON.stringify({}),
            });

            const res = await response.json();

            if (res.status === 'success') {
                // Remove the deleted character from the local state
                setTimeline(res.timeline || []);
                setIsTimelineGenerated(true);
                setIsGenerating(false);
            } else {
                alert("Failed to delete character: " + (res.error || "Unknown error"));
                setIsDeleting(false); // Reset state on failure
            }
        } catch (error) {
            console.error("Error deleting character:", error);
            alert("An error occurred while deleting the character.");
            setIsDeleting(false); // Reset state on error
        }
    };

    // Character Modal State
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    const [editingCharacterId, setEditingCharacterId] = useState<number | null>(null);
    const [newCharacter, setNewCharacter] = useState<Omit<Character, 'color'>>({
        id: 0,
        slug: '',
        name: '',
        gender: '',
        height: '',
        bodyType: '',
        description: '',
        image: null
    });

    // Expanded Dummy Data with all required fields
    const [characters, setCharacters] = useState<Character[]>([]);

    // --- CHARACTER MODAL HANDLERS ---
    const handleOpenCharacterModal = () => {
        setEditingCharacterId(null);
        setNewCharacter({ id: 0, slug: '', name: '', gender: '', height: '', bodyType: '', description: '', image: null });
        setShowCharacterModal(true);
    };

    const handleEditCharacter = (char: Character) => {
        setEditingCharacterId(char.id);
        setNewCharacter({
            id: char.id,
            slug: char.slug || '',
            name: char.name,
            gender: char.gender,
            height: char.height,
            bodyType: char.bodyType,
            description: char.description,
            image: char.image
        });
        setShowCharacterModal(true);
    };

    /*const handleCloseCharacterModal = () => {
        setShowCharacterModal(false);
        setEditingCharacterId(null);
        setNewCharacter({ id: 0, slug: '', name: '', gender: '', height: '', bodyType: '', description: '', image: null });
    };*/

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setNewCharacter({ ...newCharacter, image: e.target.files[0] });
        }
    };

    useEffect(() => {
        // Clean up object URL when component unmounts or when image changes
        return () => {
            if (newCharacter.image && typeof newCharacter.image !== 'string') {
            URL.revokeObjectURL(URL.createObjectURL(newCharacter.image));
            }
        };
    }, [newCharacter.image]);

    const handleSaveCharacter = async(e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
    
        // Append character fields
        formData.append('id', newCharacter.id.toString());
        formData.append('slug', newCharacter.slug);
        formData.append('name', newCharacter.name);
        formData.append('gender', newCharacter.gender);
        formData.append('height', newCharacter.height);
        formData.append('bodyType', newCharacter.bodyType);
        formData.append('description', newCharacter.description);
        
        // Append image based on its type
        if (newCharacter.image) {
            if (typeof newCharacter.image === 'string') {
                // Existing image URL - send as string
                formData.append('image_url', newCharacter.image);
            } else {
                // New file upload - append the File object
                formData.append('image', newCharacter.image);
            }
        }
        
        // Optional: If editing existing character, include the ID
        if (editingCharacterId !== null) {
            formData.append('character_id', String(editingCharacterId));
        }

        try {
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/saveCharacter`, {
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

            if (res.status === 'success') {
                // When updating the state after your API call:
                setData((prevData) => ({ 
                    ...prevData, 
                    workspace: { 
                        ...prevData.workspace, 
                        // Force a new array reference to guarantee React detects the change
                        characters: res.workspace && res.workspace.characters ? [...res.workspace.characters] : [] 
                    } 
                }));
                
                handleCloseCharacterModal();
            }
        } catch (error) {
            console.error("Error uploading file:", error);
        }
        
        handleCloseCharacterModal();
    };

    const [timeline, setTimeline] = useState<Shot[]>([]);

    const handleShotClick = (shot: any) => {
        setSelectedShot(shot);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedShot(null);
    };

    const handleAddScene = () => {
        const newId = Math.max(...timeline.map(s => s.id), 0) + 1;
        const newSceneNum = String(timeline.length + 1).padStart(2, '0');
        
        const newShot: Shot = {
        id: newId,
        duration: '0s',
        shot_type: 'Wide',
        shot_icon: '🌄',
        movement: 'Static',
        movement_icon: '⏸️',
        master_shot: false,
        selected: false,
        description: 'New scene - click to edit details.',
        color: newId % 2 === 0 ? 'bg-secondary' : 'bg-dark',
        summary: 'This is a new scene. Click to configure shot details, movement, and duration.',
        scene: newSceneNum,
        take: '01',
        roll: 'A001',
        director: 'A. Director',
        camera: 'ARRI Alexa',
        date: '06.08.2026'
        };
        
        setTimeline(prev => [...prev, newShot]);
    };

    // Explicitly typed to prevent TypeScript errors with WebkitBoxOrient
    const twoLineClamp: React.CSSProperties = {
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    };

    // Diagonal stripes pattern for the clapperboard top
    const clapperStripes: React.CSSProperties = {
        backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 20px, #fff 20px, #fff 40px)',
    };


    const threadsRef = useRef(data.threads);

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
            console.log(res.workspace);
            setData((prevData) => ({ ...prevData, workspace: res.workspace, isLoaded: true }));
        }
    };

    useEffect(() => {
        // 1. DEBUG: See exactly what React is seeing
        console.log("useEffect triggered. characters data:", data?.workspace?.characters);

        if (data?.workspace?.characters) {
            let rawCharacters = data.workspace.characters;

            // 2. Handle the case where the entire characters array is a JSON string
            if (typeof rawCharacters === 'string') {
                try {
                    rawCharacters = JSON.parse(rawCharacters);
                } catch (e) {
                    console.error("Failed to parse characters array string:", e);
                    return; // Exit if parsing fails
                }
            }

            // 3. Verify it's actually an array before mapping
            if (Array.isArray(rawCharacters)) {
                const parsedCharacters = rawCharacters.map((char: any) => {
                    // The backend might send it as 'content' or 'metas'
                    const rawData = char.content || char.metas || {};
                    let parsedData: any = {};
                    
                    // 4. Safely parse if the inner data is still a JSON string
                    if (typeof rawData === 'string') {
                        try {
                            parsedData = JSON.parse(rawData);
                        } catch (error) {
                            console.error("Failed to parse character metas/content:", error, char);
                        }
                    } else {
                        parsedData = rawData;
                    }

                    // 5. Merge base data with parsed data
                    return {
                        id: char.id,
                        slug: char.slug || '',
                        type: char.type,
                        parent: char.parent,
                        ...parsedData, // Spreads name, gender, height, body_type, description, image
                    };
                });

                console.log("Successfully parsed characters:", parsedCharacters);
                setCharacters(parsedCharacters);
            } else {
                console.warn("data.workspace.characters is NOT an array. Type:", typeof rawCharacters, rawCharacters);
            }
        } else {
            console.log("No characters data found in workspace.");
        }
    }, [data?.workspace?.characters]);

    useEffect(() => {
        // 1. DEBUG: See exactly what React is seeing
        console.log("useEffect triggered. timeline data:", data?.workspace?.timelines);

        if (data?.workspace?.timelines) {
            let rawTimeline = data.workspace.timelines;

            // 2. Handle the case where the entire timeline array is a JSON string
            if (typeof rawTimeline === 'string') {
                try {
                    rawTimeline = JSON.parse(rawTimeline);
                } catch (e) {
                    console.error("Failed to parse timeline array string:", e);
                    return; // Exit if parsing fails
                }
            }

            // 3. Verify it's actually an array before mapping
            if (Array.isArray(rawTimeline)) {
                const parsedTimeline = rawTimeline.map((item: any) => {
                    // The backend might send it as 'content' or 'metas'
                    const rawData = item.content || item.metas || {};
                    let parsedData: any = {};
                    
                    // 4. Safely parse if the inner data is still a JSON string
                    if (typeof rawData === 'string') {
                        try {
                            parsedData = JSON.parse(rawData);
                        } catch (error) {
                            console.error("Failed to parse timeline metas/content:", error, item);
                        }
                    } else {
                        parsedData = rawData;
                    }

                    // 5. Merge base data with parsed data
                    return {
                        id: item.id,
                        slug: item.slug || '',
                        type: item.type,
                        parent: item.parent,
                        ...parsedData, // Spreads name, gender, height, body_type, description, image
                    };
                });

                console.log("Successfully parsed timeline:", parsedTimeline);

                /*
                const initialShots: Shot[] = [
                    { 
                        id: 1, slug: 'shot-1', duration: '20s', shot_type: 'Wide', shot_icon: '🌄', movement: 'Pan', movement_icon: '↔️', master_shot: true, selected: false,
                        description: 'Neon cityscape, raining. Establishing mood.', color: 'bg-dark',
                        summary: 'This is a master shot establishing the dystopian cityscape. Requires a tilt down movement for 4s to reveal the protagonist in the foreground.',
                        scene: '01', take: '01', roll: 'A001', director: 'A. Director', camera: 'ARRI Alexa', date: '06.08.2026'
                    },
                    { 
                        id: 2, duration: '12s', shot_type: 'Medium', shot_icon: '👤', movement: 'Static', movement_icon: '⏸️', master_shot: false, selected: false,
                        description: 'Elara looking out the window, reflection visible.', color: 'bg-secondary',
                        summary: 'Medium shot focusing on Elara\'s contemplative moment. Static camera with emphasis on the window reflection showing the city.',
                        scene: '02', take: '01', roll: 'A001', director: 'A. Director', camera: 'ARRI Alexa', date: '06.08.2026'
                    },
                    { 
                        id: 3, duration: '8s', shot_type: 'Close-up', shot_icon: '👁️', movement: 'Dolly', movement_icon: '🎥', master_shot: false, selected: false,
                        description: 'Elara\'s eye, reflecting a glowing data drive.', color: 'bg-dark',
                        summary: 'Extreme close-up of Elara\'s eye. Slow dolly in movement to emphasize the reflection of the data drive.',
                        scene: '03', take: '01', roll: 'A002', director: 'A. Director', camera: 'RED Komodo', date: '06.08.2026'
                    }
                ];
                */
                
                setTimeline(parsedTimeline);
                setIsTimelineGenerated(true);
                setIsGenerating(false);
            } else {
                console.warn("data.workspace.timeline is NOT an array. Type:", typeof rawTimeline, rawTimeline);
            }
        } else {
            console.log("No timeline data found in workspace.");
        }
    }, [data?.workspace?.timelines]);

    // Helper function to assign a random Bootstrap color if none exists
    const getRandomColor = () => {
        const colors = ['bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-secondary'];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const handleInitiateDelete = () => {
        if (!editingCharacterId) return;
        
        setIsDeleting(true);
        
        // Wait 5 seconds before executing
        deleteTimerRef.current = setTimeout(() => {
            executeDeleteApi();
        }, 5000);
    };

    const handleCancelDelete = () => {
        if (deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;
        }
        setIsDeleting(false);
    };

    const executeDeleteApi = async () => {
        if (!editingCharacterId) return;

        try {
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/deleteCharacter`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: JSON.stringify({ id: editingCharacterId }),
            });

            const res = await response.json();

            if (res.status === 'success') {
                // Remove the deleted character from the local state
                setCharacters(prev => prev.filter(c => c.id !== editingCharacterId));
                handleCloseCharacterModal(); // Close modal on success
            } else {
                alert("Failed to delete character: " + (res.error || "Unknown error"));
                setIsDeleting(false); // Reset state on failure
            }
        } catch (error) {
            console.error("Error deleting character:", error);
            alert("An error occurred while deleting the character.");
            setIsDeleting(false); // Reset state on error
        }
    };

    // Update your existing handleCloseCharacterModal to clear the timer
    const handleCloseCharacterModal = () => {
        if (deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;
        }
        setIsDeleting(false);
        setShowCharacterModal(false);
        setEditingCharacterId(null);
        setNewCharacter({ id: 0, slug: '', name: '', gender: '', height: '', bodyType: '', description: '', image: null });
    };

    // Cleanup timer if component unmounts
    useEffect(() => {
        return () => {
            if (deleteTimerRef.current) {
                clearTimeout(deleteTimerRef.current);
            }
        };
    }, []);


    const savePlotChanges = async(e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        try {
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/savePlot`, {
                method: "POST",
                headers: {
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: JSON.stringify({ plotText: data.workspace.metas.plotText }),
            });
        
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
        
            const res = await response.json();

            if (res.status === 'success') {
                setIsEditingPlot(false);
            }
        } catch (error) {
            console.error("Error uploading file:", error);
        }
    };

    function formatDate(json: { date: string; timezone: string }): string {
        const utcDate = new Date(json.date); // Append 'Z' to handle UTC
        
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

    const shareWindowref = useRef<OpenShareWindowHandle>(null);
    const triggerShare = () => {
        shareWindowref.current?.enableShare();
    };
    const nodeWindowref = useRef<OpenNodeWindowHandle>(null);
    const triggerNode = () => {
        nodeWindowref.current?.enableNode();
    };
    
    return (
        <>
            <Header/>
            <main>
                <div className="container mt-4">

                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb p-3 bg-body-tertiary rounded-3">
                            <li className="breadcrumb-item"><Link to={'/'}>Projects</Link></li>
                            <li className="breadcrumb-item">{shortenText(data.workspace.title, 35)}</li>
                        </ol>
                    </nav>

                    { data.isLoaded ?
                        <>
                            { data.workspace !== null && data.workspace.id !== '' ?
                                <div className="my-3 p-3 bg-body rounded shadow-sm" style={{minHeight: '60vh'}}>
                                    <>
                                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-0">
                                            <h6>
                                                {data.workspace.title}
                                            </h6>
                                            <span className="btn-toolbar mb-2 mb-md-0 d-inline" style={{whiteSpace: 'nowrap'}}>
                                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top">Personalise contact page & fine tune the bot's behavior.</Tooltip>} >
                                                    <Link className="btn btn-sm btn-outline-primary me-2" to={'/organization/' + data.workspace.slug + '/preference'}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-book" style={{position: 'relative', top: '-2px'}}><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
                                                        <span className="d-none d-sm-inline">
                                                            &nbsp;
                                                            Preferences
                                                        </span>
                                                    </Link>
                                                </OverlayTrigger>
                                            </span>
                                        </div>

                                        
                                        <Container fluid className="p-4 bg-body-tertiary min-vh-100">
                                            <Card className="shadow-sm border-0">
                                                <Card.Body className="p-4">
                                                
                                                {/* 1. CHARACTERS SECTION */}
                                                <h5 className="fw-bold text-dark mb-3">Characters</h5>
                                                <div className="d-flex flex-wrap gap-4 mb-5">
                                                    {characters.map((char) => (
                                                    
                                                        <div 
                                                            key={char.id} 
                                                            className="text-center" 
                                                            style={{ width: '90px', cursor: 'pointer' }}
                                                            onClick={() => handleEditCharacter(char)}
                                                            title="Click to edit character"
                                                        >
                                                            <div 
                                                                className={`ratio ratio-1x1 ${char.color} rounded-3 mb-2 d-flex align-items-center justify-content-center text-white fw-bold fs-4 shadow-sm position-relative overflow-hidden`}
                                                            >
                                                                {typeof char.image === 'string' && char.image.startsWith('http') ? (
                                                                <img src={char.image} alt={char.name} className="w-100 h-100 object-fit-cover" />
                                                                ) : (
                                                                    char.name.charAt(0)
                                                                )}
                                                                {/* Edit indicator - top right, no background */}
                                                                <div className="position-absolute top-0 end-0 p-1">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))', position: 'absolute', top: '3px', right: '25px' }}>
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                            <small className="fw-semibold text-truncate d-block">{char.name}</small>
                                                        </div>
                                                    ))}
                                                    
                                                    {/* Add New Character Button */}
                                                    <div className="text-center" style={{ width: '90px' }}>
                                                    <div 
                                                        className="ratio ratio-1x1 bg-light rounded-3 mb-2 d-flex align-items-center justify-content-center border border-dashed border-secondary"
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={handleOpenCharacterModal}
                                                    >
                                                        <span className="fs-2 text-secondary">+</span>
                                                    </div>
                                                    <small className="fw-semibold text-secondary text-truncate d-block">Add New</small>
                                                    </div>
                                                </div>

                                                <hr className="mb-4" />

                                                {/* 2. PLOT SECTION */}
                                                <h5 className="fw-bold text-dark mb-3">Plot Summary</h5>
                                                <div className="mb-5">
                                                    {!isEditingPlot ? (
                                                    <>
                                                        <p className="text-secondary mb-3" style={twoLineClamp}>
                                                        {data.workspace.metas.plotText || "No plot summary available. Click 'Edit Plot' to add one."}
                                                        </p>
                                                        <Button 
                                                        variant="outline-secondary" 
                                                        size="sm" 
                                                        onClick={() => setIsEditingPlot(true)}
                                                        >
                                                        ✏️ Edit Plot
                                                        </Button>
                                                    </>
                                                    ) : (
                                                    <div>
                                                        {/* Rich Text Toolbar Mockup */}
                                                        <ButtonGroup className="mb-2" size="sm">
                                                        <Button variant="outline-secondary"><strong>B</strong></Button>
                                                        <Button variant="outline-secondary"><em>I</em></Button>
                                                        <Button variant="outline-secondary"><u>U</u></Button>
                                                        <Button variant="outline-secondary">¶</Button>
                                                        <Button variant="outline-secondary">H1</Button>
                                                        <Button variant="outline-secondary">H2</Button>
                                                        </ButtonGroup>
                                                        
                                                        <Form.Control 
                                                        as="textarea" 
                                                        rows={4} 
                                                        value={data.workspace.metas.plotText}
                                                        onChange={(e) => setData((prevData) => ({ ...prevData, workspace: { ...prevData.workspace, metas: { ...prevData.workspace.metas, plotText: e.target.value } } }))}
                                                        className="mb-3"
                                                        placeholder="Write your plot summary here..."
                                                        />
                                                        
                                                        <div className="d-flex gap-2">
                                                        <Button variant="primary" size="sm" onClick={(e) => savePlotChanges(e)}>
                                                            Save Changes
                                                        </Button>
                                                        <Button variant="secondary" size="sm" onClick={() => setIsEditingPlot(false)}>
                                                            Cancel
                                                        </Button>
                                                        </div>
                                                    </div>
                                                    )}
                                                </div>

                                                <hr className="mb-4" />

                                                {/* 3. TIMELINE SECTION */}
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <h5 className="fw-bold text-dark mb-0">Timeline & Storyboard</h5>
                                                    <div className="d-flex gap-2">
                                                    {/* Generate Timeline Button - Always visible */}
                                                    <Button 
                                                        variant="dark" 
                                                        size="sm" 
                                                        onClick={handleGenerateTimeline}
                                                        disabled={isGenerating || isTimelineGenerated}
                                                        className="d-flex align-items-center gap-2 px-3"
                                                    >
                                                        {isGenerating ? (
                                                        <>
                                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                            Generating...
                                                        </>
                                                        ) : (
                                                        <>
                                                            <span>✨</span>
                                                            {isTimelineGenerated ? 'Timeline Generated' : 'Generate Timeline'}
                                                        </>
                                                        )}
                                                    </Button>

                                                    {/* Add Scene Button - Only visible after timeline is generated */}
                                                    {isTimelineGenerated && (
                                                        <Button 
                                                        variant="outline-primary" 
                                                        size="sm" 
                                                        onClick={handleAddScene}
                                                        className="d-flex align-items-center gap-2 px-3"
                                                        >
                                                        <span>🎬</span>
                                                        Add Scene
                                                        </Button>
                                                    )}
                                                    </div>
                                                </div>

                                                {/* Timeline Content - Only visible after generation */}
                                                {isTimelineGenerated ? (
                                                    <div className="d-flex flex-nowrap overflow-auto pb-3 gap-3" style={{ scrollbarWidth: 'thin' }}>
                                                    {timeline.map((shot) => (
                                                        <Card 
                                                        key={shot.id} 
                                                        className={`border shadow-sm flex-shrink-0 ${shot.selected ? 'border-primary border-2' : ''}`} 
                                                        style={{ width: '280px', cursor: 'pointer' }}
                                                        onClick={() => handleShotClick(shot)}
                                                        >
                                                            <div className={`ratio ratio-16x9 ${shot.color} position-relative rounded-top`}>
                                                                <div className="d-flex align-items-center justify-content-center text-white-50 fs-1">🎬</div>
                                                                {shot.selected ? (
                                                                    <Badge bg="success" className="position-absolute top-0 start-0 m-2" style={{ fontSize: '0.75rem' }}>✓ Selected</Badge>
                                                                ) : (
                                                                    <Badge bg="warning" className="position-absolute top-0 start-0 m-2" style={{ fontSize: '0.75rem' }}>○ Not Selected</Badge>
                                                                )}
                                                                <Badge bg="dark" className="position-absolute bottom-0 end-0 m-2 opacity-75" pill>{shot.duration}</Badge>
                                                            </div>
                                                            <Card.Body className="p-3">
                                                                <div className="d-flex gap-2 mb-2 flex-wrap">
                                                                    <Badge bg="light" text="dark" className="fw-normal">{getShotIcon(shot.shot_type)} {shot.shot_type}</Badge>
                                                                    <Badge bg="light" text="dark" className="fw-normal">{getMovementIcon(shot.movement)} {shot.movement}</Badge>
                                                                {shot.master_shot && <Badge bg="info" text="dark" className="fw-normal">🎬 Master</Badge>}
                                                                </div>
                                                                <Card.Text className="small mb-0 fw-medium">Shot {shot.id}: {shot.description}</Card.Text>
                                                            </Card.Body>
                                                        </Card>
                                                    ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-5 rounded-3 border border-dashed border-secondary">
                                                    <div className="fs-1 mb-3">🎬</div>
                                                    <p className="text-muted mb-0">
                                                        {isGenerating ? 'AI is generating your timeline...' : 'Click "Generate Timeline" to create your shot breakdown from the plot.'}
                                                    </p>
                                                    </div>
                                                )}

                                                </Card.Body>
                                            </Card>

                                            {/* --- CHARACTER CREATION / EDIT MODAL --- */}
                                            <Modal show={showCharacterModal} onHide={handleCloseCharacterModal} centered size="lg">
                                                <Modal.Header closeButton className="border-bottom">
                                                <Modal.Title className="fw-bold">
                                                    {editingCharacterId !== null ? 'Edit Character' : 'Create New Character'}
                                                </Modal.Title>
                                                </Modal.Header>
                                                <Modal.Body className="p-4">
                                                <Form onSubmit={handleSaveCharacter}>
                                                    <Row className="mb-3">
                                                    <Col md={12}>
                                                        <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold small text-uppercase text-muted">Character Name</Form.Label>
                                                        <Form.Control 
                                                            type="text" 
                                                            placeholder="e.g., Elara Vance"
                                                            value={newCharacter.name}
                                                            onChange={(e) => setNewCharacter({...newCharacter, name: e.target.value})}
                                                            required
                                                        />
                                                        </Form.Group>
                                                    </Col>
                                                    </Row>

                                                    <Row className="mb-3">
                                                    <Col md={6}>
                                                        <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold small text-uppercase text-muted">Gender</Form.Label>
                                                        <Form.Select 
                                                            value={newCharacter.gender}
                                                            onChange={(e) => setNewCharacter({...newCharacter, gender: e.target.value})}
                                                            required
                                                        >
                                                            <option value="">Select gender...</option>
                                                            <option value="Male">Male</option>
                                                            <option value="Female">Female</option>
                                                            <option value="Non-binary">Non-binary</option>
                                                            <option value="Other">Other / Custom</option>
                                                        </Form.Select>
                                                        </Form.Group>
                                                    </Col>
                                                    <Col md={6}>
                                                        <Form.Group className="mb-3">
                                                        <Form.Label className="fw-semibold small text-uppercase text-muted">Height</Form.Label>
                                                        <Form.Control 
                                                            type="text" 
                                                            placeholder="e.g., 5'9&quot; or 175 cm"
                                                            value={newCharacter.height}
                                                            onChange={(e) => setNewCharacter({...newCharacter, height: e.target.value})}
                                                            required
                                                        />
                                                        </Form.Group>
                                                    </Col>
                                                    </Row>

                                                    <Form.Group className="mb-3">
                                                    <Form.Label className="fw-semibold small text-uppercase text-muted">Body Type</Form.Label>
                                                    <Form.Select 
                                                        value={newCharacter.bodyType}
                                                        onChange={(e) => setNewCharacter({...newCharacter, bodyType: e.target.value})}
                                                        required
                                                    >
                                                        <option value="">Select body type...</option>
                                                        <option value="Slender">Slender</option>
                                                        <option value="Athletic">Athletic</option>
                                                        <option value="Muscular">Muscular</option>
                                                        <option value="Average">Average</option>
                                                        <option value="Heavy">Heavy</option>
                                                    </Form.Select>
                                                    </Form.Group>

                                                    <Form.Group className="mb-3">
                                                    <Form.Label className="fw-semibold small text-uppercase text-muted">Description</Form.Label>
                                                    <Form.Control 
                                                        as="textarea" 
                                                        rows={3} 
                                                        placeholder="Describe facial features, hair color, clothing style, scars, or unique traits..."
                                                        value={newCharacter.description}
                                                        onChange={(e) => setNewCharacter({...newCharacter, description: e.target.value})}
                                                        required
                                                    />
                                                    </Form.Group>

                                                    <Form.Group className="mb-4">
                                                        <Form.Label className="fw-semibold small text-uppercase text-muted">Reference Image</Form.Label>
                                                        <Form.Control 
                                                            type="file" 
                                                            accept="image/*"
                                                            onChange={handleImageChange}
                                                        />
                                                        {newCharacter.image && (
                                                            <div className="mt-2 p-2 rounded border">
                                                            {typeof newCharacter.image === 'string' ? (
                                                                <img src={newCharacter.image} alt="Character Preview" className="img-fluid rounded" style={{ maxHeight: '150px' }} />
                                                            ) : (
                                                                <img 
                                                                src={URL.createObjectURL(newCharacter.image)} 
                                                                alt="Character Preview" 
                                                                className="img-fluid rounded" 
                                                                style={{ maxHeight: '150px' }} 
                                                                />
                                                            )}
                                                            </div>
                                                        )}
                                                        </Form.Group>

                                                    
                                                        <div className="d-flex gap-2 mt-4">
                                                            {/* Primary Action: Save or Add (Takes up remaining space) */}
                                                            <Button variant="primary" type="submit" size="lg" className="fw-bold flex-grow-1">
                                                                {editingCharacterId !== null ? '💾 Save Character' : '➕ Add Character'}
                                                            </Button>

                                                            {/* Secondary Action: Delete (Only visible when editing an existing character) */}
                                                            {editingCharacterId !== null && (
                                                                !isDeleting ? (
                                                                    <Button 
                                                                        variant="outline-danger" 
                                                                        onClick={(e) => {
                                                                            e.preventDefault(); // Prevent form submission
                                                                            handleInitiateDelete();
                                                                        }} 
                                                                        className="fw-bold"
                                                                        title="Delete this character"
                                                                    >
                                                                        🗑️ Delete
                                                                    </Button>
                                                                    ) : (
                                                                    /* Deleting State: Replaces the delete button with a countdown and cancel option */
                                                                    <div className="d-flex align-items-center justify-content-between bg-danger bg-opacity-10 border border-danger rounded flex-grow-1 px-2">
                                                                        <span className="text-danger fw-bold d-flex align-items-center">
                                                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                            <small>Deleting in 5s...</small>
                                                                        </span>
                                                                        <Button 
                                                                            variant="danger" 
                                                                            size="sm" 
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                handleCancelDelete();
                                                                            }}
                                                                            className="d-flex align-items-center justify-content-center rounded-circle ms-2"
                                                                            style={{ width: '32px', height: '32px', padding: 0, lineHeight: 1 }}
                                                                            title="Cancel deletion"
                                                                        >
                                                                            ✕
                                                                        </Button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </Form>
                                                </Modal.Body>
                                            </Modal>

                                            {/* Clapperboard / Slate Modal */}
                                            <Modal 
                                                show={showModal} 
                                                onHide={handleCloseModal} 
                                                size="xl" 
                                                centered
                                                contentClassName="bg-dark text-white border-0 overflow-hidden"
                                            >
                                                {selectedShot && (
                                                <>
                                                    {/* Clapper Top - Diagonal Stripes */}
                                                    <div 
                                                    className="position-relative"
                                                    style={{ 
                                                        ...clapperStripes, 
                                                        height: '60px',
                                                        borderBottom: '4px solid #000'
                                                    }}
                                                    >
                                                    <div className="position-absolute top-50 start-50 translate-middle bg-dark text-white px-4 py-1 fw-bold fs-4" style={{ letterSpacing: '4px' }}>
                                                        WIT WORKS STUDIO
                                                    </div>
                                                    <button 
                                                        className="btn btn-close btn-close-white position-absolute top-50 end-0 translate-middle-y me-3"
                                                        onClick={handleCloseModal}
                                                        aria-label="Close"
                                                    ></button>
                                                    </div>

                                                    {/* Slate Body - Info Grid */}
                                                    <Modal.Body className="bg-dark text-white p-0">
                                                    
                                                    {/* Shot Preview Area */}
                                                    <div className="position-relative bg-black">
                                                        <div className={`ratio ratio-16x9 ${selectedShot.color}`}>
                                                        <div className="d-flex align-items-center justify-content-center text-white-50 fs-1">
                                                            🎬
                                                        </div>
                                                        </div>
                                                        <Badge 
                                                        bg="danger" 
                                                        className="position-absolute top-0 end-0 m-3 fw-bold px-3 py-2"
                                                        >
                                                        ⏱ {selectedShot.duration}
                                                        </Badge>
                                                    </div>

                                                    {/* Slate Info Grid */}
                                                    <div className="p-4 border-top border-secondary">
                                                        <Row className="g-0 text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>
                                                        <Col xs={6} md={4} className="border border-secondary p-3">
                                                            <div className="text-secondary small mb-1">SCENE</div>
                                                            <div className="fs-4">{selectedShot.scene}</div>
                                                        </Col>
                                                        <Col xs={6} md={4} className="border border-secondary p-3">
                                                            <div className="text-secondary small mb-1">TAKE</div>
                                                            <div className="fs-4">{selectedShot.take}</div>
                                                        </Col>
                                                        <Col xs={6} md={4} className="border border-secondary p-3">
                                                            <div className="text-secondary small mb-1">ROLL</div>
                                                            <div className="fs-4">{selectedShot.roll}</div>
                                                        </Col>
                                                        <Col xs={6} md={4} className="border border-secondary p-3">
                                                            <div className="text-secondary small mb-1">DIRECTOR</div>
                                                            <div className="fs-5">{selectedShot.director}</div>
                                                        </Col>
                                                        <Col xs={6} md={4} className="border border-secondary p-3">
                                                            <div className="text-secondary small mb-1">CAMERA</div>
                                                            <div className="fs-5">{selectedShot.camera}</div>
                                                        </Col>
                                                        <Col xs={6} md={4} className="border border-secondary p-3">
                                                            <div className="text-secondary small mb-1">DATE</div>
                                                            <div className="fs-5">{selectedShot.date}</div>
                                                        </Col>
                                                        </Row>

                                                        {/* Shot Type & Movement Badges */}
                                                        <div className="d-flex gap-2 mt-4 flex-wrap">
                                                        <Badge bg="light" text="dark" className="px-3 py-2 fs-6">
                                                            {selectedShot.shotIcon} {selectedShot.shotType}
                                                        </Badge>
                                                        <Badge bg="light" text="dark" className="px-3 py-2 fs-6">
                                                            {selectedShot.movementIcon} {selectedShot.movement}
                                                        </Badge>
                                                        {selectedShot.masterShot && (
                                                            <Badge bg="warning" text="dark" className="px-3 py-2 fs-6">
                                                            🎬 MASTER SHOT
                                                            </Badge>
                                                        )}
                                                        </div>

                                                        {/* Shot Summary */}
                                                        <div className="mt-4 p-3 bg-black rounded border border-secondary">
                                                        <div className="text-secondary small text-uppercase fw-bold mb-2">SHOT DESCRIPTION</div>
                                                        <p className="mb-0 text-white fs-6">
                                                            <span className="fw-bold text-warning">Shot {selectedShot.id}:</span> {selectedShot.summary}
                                                        </p>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="p-4 bg-black border-top border-secondary">
                                                        <Row className="g-3">
                                                        <Col md={4}>
                                                            <Button 
                                                            variant="outline-light" 
                                                            className="w-100 py-3 border-2"
                                                            onClick={() => console.log('Upload clip')}
                                                            >
                                                            <div className="fs-2 mb-1">📤</div>
                                                            <div className="fw-bold text-uppercase small">Upload Clip</div>
                                                            </Button>
                                                        </Col>
                                                        <Col md={4}>
                                                            <Button 
                                                            variant="outline-light" 
                                                            className="w-100 py-3 border-2"
                                                            onClick={() => console.log('Select from stock')}
                                                            >
                                                            <div className="fs-2 mb-1">🖼️</div>
                                                            <div className="fw-bold text-uppercase small">Stock Library</div>
                                                            </Button>
                                                        </Col>
                                                        <Col md={4}>
                                                            <Button 
                                                            variant="danger" 
                                                            className="w-100 py-3 border-2 fw-bold"
                                                            onClick={() => console.log('Start camera')}
                                                            >
                                                            <div className="fs-2 mb-1">🔴</div>
                                                            <div className="fw-bold text-uppercase small">Start Camera</div>
                                                            </Button>
                                                        </Col>
                                                        </Row>
                                                    </div>
                                                    </Modal.Body>
                                                </>
                                                )}
                                            </Modal>
                                        </Container>
                                    </>
                                </div>
                                :
                                <ErrorText/>
                            }
                        </>
                        :
                        <PageLoader />
                    }
                </div>  

                <OrganizationShare ref={shareWindowref} workspace={data.workspace} />
            </main>

            <Footer />
        </>
    );
}

export default Organization;