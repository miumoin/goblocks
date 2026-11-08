// Import React and ReactDOM
import React, {useState, useEffect, useRef} from 'react';
import { useParams, Link } from 'react-router-dom';
import Cookies from 'js-cookie';
import ErrorText from '../components/ErrorText';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Tooltip from 'react-bootstrap/Tooltip';
import InputGroup from 'react-bootstrap/InputGroup';

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
  image?: string | null;
  video?: string | null;
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

interface PexelsVideoFile {
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string; // The direct .mp4 URL
}

interface PexelsVideo {
    id: number;
    width: number;
    height: number;
    duration: number;
    user: { name: string };
    video_files: PexelsVideoFile[];
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
    const [shotSketch, setShotSketch] = useState('');
    const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);

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

     // --- CAMERA & RECORDING STATE ---
    const [cameraMode, setCameraMode] = useState(false); // Single camera mode (preview + recording)
    const [isRecording, setIsRecording] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownValue, setCountdownValue] = useState<number | string>(3);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- STOCK VIDEO LIBRARY STATE ---
    const [showStockModal, setShowStockModal] = useState(false);
    const [stockQuery, setStockQuery] = useState("");
    const [stockVideos, setStockVideos] = useState<PexelsVideo[]>([]);
    const [isStockLoading, setIsStockLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const PER_PAGE = 12; // Number of results per page

    // --- SKETCH VIEW STATE ---
    const [showSketchView, setShowSketchView] = useState(false);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    //extra state to track if all shots have video
    const [allShotsHaveVideo, setAllShotsHaveVideo] = useState(false);

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

    const handleGenerateShotSketch = async () => {
        if (!selectedShot || isGeneratingSketch) return;

        setIsGeneratingSketch(true);
        try {
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/generateShotSketch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Vuedoo-Domain': App.domain,
                    'X-Vuedoo-Access-Key': data.accessKey,
                },
                body: JSON.stringify({
                    id: selectedShot.id,
                    description: selectedShot.description,
                    summary: selectedShot.summary,
                    scene: selectedShot.scene,
                    shot_type: selectedShot.shot_type,
                    movement: selectedShot.movement,
                }),
            });
            const result = await response.json();
            const image = result.image;

            if (!response.ok || result.status === 'error' || typeof image !== 'string') {
                throw new Error(result.error || 'Could not generate a sketch.');
            }
            setSelectedShot((prev: any) => ({ ...prev, image }));
            setTimeline(prevTimeline => prevTimeline.map(shot => shot.id === selectedShot.id ? { ...shot, image: image } : shot));
        } catch (error) {
            console.error('Error generating shot sketch:', error);
            alert(error instanceof Error ? error.message : 'Could not generate a sketch.');
        } finally {
            setIsGeneratingSketch(false);
        }
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

    // Helper to find the best supported video format for the user's browser
    const getSupportedMimeType = () => {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/mp4',
            'video/webm'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log("Using supported MIME type:", type);
                return type;
            }
        }
        return '';
    };

    // Start camera preview
    const handleStartCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" },
                audio: true 
            });
            
            streamRef.current = stream;
            
            // Set camera mode FIRST, then attach stream after render
            setCameraMode(true);
            setRecordedVideoUrl(null);
            
            // Use setTimeout to ensure video element is mounted before attaching stream
            setTimeout(() => {
                if (videoRef.current && streamRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                }
            }, 100);
            
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please ensure permissions are granted in your browser settings.");
        }
    };

    // Start countdown and recording
    const handleStartRecording = () => {
        setShowCountdown(true);
        setCountdownValue(3);
        
        let count = 3;
        countdownTimerRef.current = setInterval(() => {
            count -= 1;
            if (count > 0) {
                setCountdownValue(count);
            } else if (count === 0) {
                setCountdownValue("ACTION!");
                startRecording();
                setTimeout(() => setShowCountdown(false), 1500);
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            }
        }, 1000);
    };

    const startRecording = () => {
        if (!streamRef.current) return;
        
        const mimeType = getSupportedMimeType();
        const options = mimeType ? { mimeType } : {};
        
        const mediaRecorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blobType = mimeType || 'video/webm';
            const blob = new Blob(chunksRef.current, { type: blobType });
            const url = URL.createObjectURL(blob);
            setRecordedVideoUrl(url);
            setCameraMode(false); // Exit camera mode to show recorded preview
        };

        mediaRecorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const cleanupCamera = () => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (recordedVideoUrl) {
            URL.revokeObjectURL(recordedVideoUrl);
            setRecordedVideoUrl(null);
        }
        setCameraMode(false);
        setIsRecording(false);
        setShowCountdown(false);
    };

    // Cleanup camera when modal closes or component unmounts
    useEffect(() => {
        if (!showModal) {
            cleanupCamera();
        }
        return () => {
            cleanupCamera();
        };
    }, [showModal]);

    const handleSaveShot = async () => {
        if (!recordedVideoUrl || !selectedShot) {
            alert("No video to save or shot not selected.");
            return;
        }

        try {
            // 1. Convert blob URL to Blob object
            const response = await fetch(recordedVideoUrl);
            const blob = await response.blob();
            
            // 2. Create FormData and append the video file
            const formData = new FormData();
            formData.append('video', blob, `shot_${selectedShot.id}_${Date.now()}.webm`);
            formData.append('shotId', selectedShot.id.toString());
            
            // 3. Upload to backend
            const uploadResponse = await fetch(`${App.api_base}/workspace/${data.slug}/uploadShotVideo`, {
                method: "POST",
                headers: {
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error("Network response was not ok");
            }

            const result = await uploadResponse.json();

            if (result.status === 'success') {
                // 4. Update the timeline state with the new video URL
                const videoUrl = result.videoUrl; // Backend should return the S3 URL
                
                setTimeline(prevTimeline => 
                    prevTimeline.map(shot => 
                        shot.id === selectedShot.id 
                            ? { ...shot, video: videoUrl } 
                            : shot
                    )
                );

                // 5. Update selectedShot for consistency
                setSelectedShot((prev: any) => ({ ...prev, video: videoUrl }));

                // 6. Clean up and close modal
                cleanupCamera();
                handleCloseModal();
            } else {
                throw new Error(result.error || "Failed to save video");
            }

        } catch (error) {
            console.error("Error saving shot video:", error);
            alert(error instanceof Error ? error.message : "An error occurred while saving the video.");
        }
    };

    // Ref for the hidden file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Trigger the hidden file input click
    const handleUploadClipClick = () => {
        fileInputRef.current?.click();
    };

    // Handle the file selection and upload
    const handleClipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedShot) return;

        // Optional: Validate file type and size
        if (!file.type.startsWith('video/')) {
            alert("Please select a valid video file.");
            return;
        }
        if (file.size > 500 * 1024 * 1024) { // 500MB limit
            alert("Video file is too large. Maximum size is 500MB.");
            return;
        }

        try {
            const formData = new FormData();
            formData.append('video', file);
            formData.append('shotId', selectedShot.id.toString());

            // We can reuse the same backend endpoint used for saving recorded videos
            const uploadResponse = await fetch(`${App.api_base}/workspace/${data.slug}/uploadShotVideo`, {
                method: "POST",
                headers: {
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error("Network response was not ok");
            }

            const result = await uploadResponse.json();

            if (result.status === 'success') {
                const videoUrl = result.videoUrl;
                
                // Update timeline state
                setTimeline(prevTimeline => 
                    prevTimeline.map(shot => 
                        shot.id === selectedShot.id ? { ...shot, video: videoUrl } : shot
                    )
                );

                // Update selected shot state
                setSelectedShot((prev: any) => ({ ...prev, video: videoUrl }));
                handleCloseModal();
            } else {
                throw new Error(result.error || "Failed to upload clip");
            }
        } catch (error) {
            console.error("Error uploading clip:", error);
            alert(error instanceof Error ? error.message : "An error occurred while uploading the clip.");
        } finally {
            // Reset the input value so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

        // Helper: Extract a concise search query from the shot's description
    const buildSearchQueryFromShot = (shot: any): string => {
        if (!shot) return "";
        
        // Use description as primary source, fallback to summary
        const source = shot.description || shot.summary || "";
        
        // Take first 60 chars and clean up (remove trailing punctuation)
        let query = source.substring(0, 60).trim();
        query = query.replace(/[.,;:!?]+$/, ""); // Remove trailing punctuation
        
        // If the description is very short, append shot type for better results
        if (query.length < 15 && shot.shot_type) {
            query = `${shot.shot_type} shot ${query}`;
        }
        
        return query;
    };

    // Search with pagination support
    const handleSearchStockVideos = async (query: string, page: number = 1) => {
        if (!query.trim()) return;
        setIsStockLoading(true);
        try {
            const apiKey = "563492ad6f91700001000001bfbb942790434d29a695266d20a13a36";
            
            const response = await fetch(
                `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}&size=medium`,
                {
                    headers: { "Authorization": apiKey }
                }
            );
            
            if (!response.ok) {
                throw new Error("Failed to fetch from Pexels. Check your API Key.");
            }
            
            const data = await response.json();
            setStockVideos(data.videos || []);
            setTotalResults(data.total_results || 0);
            setCurrentPage(page);
        } catch (error) {
            console.error("Error fetching from Pexels:", error);
            alert("Failed to load stock videos. Please ensure your Pexels API key is set in .env");
        } finally {
            setIsStockLoading(false);
        }
    };

    // Auto-trigger search when modal opens
    useEffect(() => {
        if (showStockModal && selectedShot) {
            const autoQuery = buildSearchQueryFromShot(selectedShot);
            setStockQuery(autoQuery);
            if (autoQuery.trim()) {
                handleSearchStockVideos(autoQuery, 1);
            }
        } else if (!showStockModal) {
            // Reset state when modal closes
            setStockVideos([]);
            setStockQuery("");
            setCurrentPage(1);
            setTotalResults(0);
        }
    }, [showStockModal]);

    // Manual search (resets to page 1)
    const handleManualSearch = () => {
        if (stockQuery.trim()) {
            handleSearchStockVideos(stockQuery, 1);
        }
    };

    // Pagination handlers
    const handlePrevPage = () => {
        if (currentPage > 1) {
            handleSearchStockVideos(stockQuery, currentPage - 1);
        }
    };

    const handleNextPage = () => {
        const totalPages = Math.ceil(totalResults / PER_PAGE);
        if (currentPage < totalPages) {
            handleSearchStockVideos(stockQuery, currentPage + 1);
        }
    };

    const handleSelectStockVideo = async (video: PexelsVideo) => {
        if (!selectedShot) return;
        
        // Find the best quality MP4 file (prefer 1080p or 720p)
        const bestFile = video.video_files.find(f => f.width === 1920 || f.height === 1080) 
                      || video.video_files.find(f => f.file_type === 'video/mp4')
                      || video.video_files[0];

        if (!bestFile) {
            alert("No valid video file found for this selection.");
            return;
        }

        const videoUrl = bestFile.link;

        try {
            // Send the video URL to the backend API
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/saveShotVideoUrl`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: JSON.stringify({
                    shotId: selectedShot.id,
                    videoUrl: videoUrl,
                }),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            const result = await response.json();

            if (result.status === 'success') {
                // Update the main timeline state
                setTimeline(prevTimeline => 
                    prevTimeline.map(shot => 
                        shot.id === selectedShot.id ? { ...shot, video: videoUrl } : shot
                    )
                );
                
                // Update the currently selected shot state
                setSelectedShot((prev: any) => ({ ...prev, video: videoUrl }));
                
                // Close modal and notify user
                setShowStockModal(false);
            } else {
                throw new Error(result.error || "Failed to save video URL");
            }

        } catch (error) {
            console.error("Error saving stock video:", error);
            alert(error instanceof Error ? error.message : "An error occurred while saving the video.");
        }
    };

    const handleShotClick = (shot: any) => {
        setSelectedShot(shot);
        setShotSketch('');
        setShowSketchView(false); // Reset to video view (default)
        setIsVideoPlaying(false);
        setShowModal(true);
    };

    const toggleVideoPlay = () => {
        if (!previewVideoRef.current) {
            console.warn("Video ref not available");
            return;
        }
        
        const video = previewVideoRef.current;
        
        if (video.paused) {
            // Attempt to play with error handling for browser restrictions
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsVideoPlaying(true);
                    })
                    .catch((error) => {
                        console.error("Play failed:", error);
                        // If autoplay is blocked, try unmuting (some browsers allow this)
                        video.muted = false;
                        video.play().catch(() => {
                            alert("Unable to play video. Please check your browser settings.");
                        });
                    });
            }
        } else {
            video.pause();
            setIsVideoPlaying(false);
        }
    };

    const toggleViewMode = () => {
        setShowSketchView(prev => !prev);
        setIsVideoPlaying(false);
    };

     // Monitor timeline to check if all shots have videos assigned
    useEffect(() => {
        if (timeline.length === 0) {
            setAllShotsHaveVideo(false);
            return;
        }

        // Check if every shot has a non-empty video property
        const allHaveVideo = timeline.every(shot => 
            shot.video && shot.video.trim() !== ''
        );

        setAllShotsHaveVideo(allHaveVideo);
    }, [timeline]);

    const handleExportProject = async () => {
        if (!allShotsHaveVideo) {
            alert("All shots must have videos before exporting.");
            return;
        }

        try {
            const response = await fetch(`${App.api_base}/workspace/${data.slug}/exportDaVinciPackage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Vuedoo-Domain": App.domain,
                    "X-Vuedoo-Access-Key": data.accessKey,
                },
                body: JSON.stringify({
                    projectName: data.workspace.title || "Untitled Project",
                    fps: 24,
                    timeline: timeline.map((shot, index) => ({
                        id: shot.id,
                        name: `Shot_${String(shot.id).padStart(3, '0')}`,
                        video: shot.video,
                        description: shot.description,
                        sequence: index + 1
                    }))
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Network response was not ok");
            }

            // Download the ZIP file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${data.workspace.title || 'project'}_davinci_package.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            alert("DaVinci Resolve package exported! Extract the ZIP and import the XML file into DaVinci Resolve. All videos are included.");

        } catch (error) {
            console.error("Error exporting project:", error);
            alert(error instanceof Error ? error.message : "An error occurred while exporting.");
        }
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

                                                        {/* EXPORT BUTTON - Only enabled when all shots have videos */}
                                                        {isTimelineGenerated && (
                                                            <Button 
                                                                variant="success" 
                                                                size="sm" 
                                                                onClick={handleExportProject}
                                                                disabled={!allShotsHaveVideo}
                                                                className="d-flex align-items-center gap-2 px-3"
                                                                title={allShotsHaveVideo 
                                                                    ? "Export the complete project" 
                                                                    : `Add videos to all shots to enable export (${timeline.filter(s => !s.video || s.video.trim() === '').length} shots missing videos)`}
                                                            >
                                                                <span>📦</span>
                                                                Export Project
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
                                                        className={`border shadow-sm flex-shrink-0 ${shot.video !== "" ? 'border-primary border-2' : ''}`} 
                                                        style={{ width: '280px', cursor: 'pointer' }}
                                                        onClick={() => handleShotClick(shot)}
                                                        >
                                                            <div className={`ratio ratio-16x9 ${shot.color} position-relative rounded-top`}>
                                                                <div className="d-flex align-items-center justify-content-center text-white-50 fs-1">🎬</div>
                                                                {shot.video !== "" ? (
                                                                    <Badge bg="success" className="position-absolute top-0 start-0" style={{ fontSize: '0.75rem' }}>✓ Selected</Badge>
                                                                ) : (
                                                                    <Badge bg="warning" className="position-absolute top-0 start-0" style={{ fontSize: '0.75rem' }}>○ Not Selected</Badge>
                                                                )}
                                                                {shot.image != null ? (
                                                                    <Badge bg="dark" className="position-absolute bottom-0 end-0 opacity-75" pill style={{ backgroundImage: `url(${shot.image})`, backgroundSize: 'cover' }}>{shot.duration}</Badge>
                                                                ) : (
                                                                    <Badge bg="dark" className="position-absolute bottom-0 end-0 opacity-75" pill></Badge>
                                                                )}
                                                                <span className="position-absolute top-0 start-0 m-2 gap-1">
                                                                    <Badge bg="info" text="dark" style={{ height: 'auto', width: 'auto', padding: '7px', marginRight: '7px' }}>⏱️ {shot.duration}</Badge>
                                                                    
                                                                    {shot.video !== "" ? (
                                                                        <Badge bg="success" text="dark" style={{ height: 'auto', width: 'auto', padding: '7px' }}>✓ Selected</Badge>
                                                                    ) : (
                                                                        <Badge bg="danger" text="dark" style={{ height: 'auto', width: 'auto', padding: '7px' }}>○ Not Selected</Badge>
                                                                    )}
                                                                </span>
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
                                                {/* --- SLATE INFO VIEW (No Camera) --- */}
                                                {selectedShot && !cameraMode && !recordedVideoUrl && (
                                                <>
                                                    <div className="position-relative" style={{ ...clapperStripes, height: '60px', borderBottom: '4px solid #000' }}>
                                                        <div className="position-absolute top-50 start-50 translate-middle bg-dark text-white px-4 py-1 fw-bold fs-4" style={{ letterSpacing: '4px' }}>
                                                            WIT WORKS STUDIO
                                                        </div>
                                                        <button className="btn btn-close btn-close-white position-absolute top-50 end-0 translate-middle-y me-3" onClick={handleCloseModal} aria-label="Close"></button>
                                                    </div>

                                                    <Modal.Body className="bg-dark text-white p-0">
                                                        <div className="position-relative bg-black">
                                                            <div className="position-relative bg-black">
                                                                <div className={`ratio ratio-16x9 ${selectedShot.color} position-relative overflow-hidden`}>
                                                                    
                                                                    {/* --- VIDEO (Always mounted, hidden via CSS when showing sketch) --- */}
                                                                    {selectedShot.video && (
                                                                        <video
                                                                            ref={previewVideoRef}
                                                                            src={selectedShot.video}
                                                                            className="w-100 h-100"
                                                                            style={{ 
                                                                                objectFit: 'contain', 
                                                                                backgroundColor: '#000',
                                                                                visibility: showSketchView ? 'hidden' : 'visible',
                                                                                position: 'absolute',
                                                                                top: 0,
                                                                                left: 0,
                                                                                width: '100%',
                                                                                height: '100%'
                                                                            }}
                                                                            loop
                                                                            playsInline
                                                                            muted
                                                                            onPlay={() => setIsVideoPlaying(true)}
                                                                            onPause={() => setIsVideoPlaying(false)}
                                                                        />
                                                                    )}

                                                                    {/* --- SKETCH (Always mounted, hidden via CSS when showing video) --- */}
                                                                    {selectedShot.image && (
                                                                        <img
                                                                            src={selectedShot.image}
                                                                            alt={`AI-generated sketch for shot ${selectedShot.id}`}
                                                                            className="w-100 h-100"
                                                                            style={{ 
                                                                                objectFit: 'contain',
                                                                                visibility: showSketchView ? 'visible' : 'hidden',
                                                                                position: 'absolute',
                                                                                top: 0,
                                                                                left: 0,
                                                                                width: '100%',
                                                                                height: '100%'
                                                                            }}
                                                                        />
                                                                    )}

                                                                    {/* --- EMPTY PLACEHOLDER (Only when neither exists) --- */}
                                                                    {!selectedShot.video && !selectedShot.image && (
                                                                        <div className="d-flex align-items-center justify-content-center text-white-50 fs-1 w-100 h-100">
                                                                            🎬
                                                                        </div>
                                                                    )}

                                                                    {/* --- PLAY/PAUSE BUTTON (Only visible when video is shown) --- */}
                                                                    {selectedShot.video && !showSketchView && (
                                                                        <button
                                                                            className="btn btn-dark position-absolute top-50 start-50 translate-middle rounded-circle d-flex align-items-center justify-content-center shadow"
                                                                            style={{ width: '64px', height: '64px', opacity: 0.85, zIndex: 11 }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleVideoPlay();
                                                                            }}
                                                                            title={isVideoPlaying ? 'Pause' : 'Play'}
                                                                        >
                                                                            {isVideoPlaying ? (
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 16 16">
                                                                                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                                                                                </svg>
                                                                            ) : (
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 16 16" style={{ marginLeft: '4px' }}>
                                                                                    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                                                                                </svg>
                                                                            )}
                                                                        </button>
                                                                    )}

                                                                    {/* --- TOGGLE BUTTON (Only visible when BOTH video AND sketch exist) --- */}
                                                                    {selectedShot.video && selectedShot.image && (
                                                                        <div className="position-absolute top-0 start-0 m-3" style={{ zIndex: 10 }}>
                                                                            <div className="btn-group shadow-sm" role="group">
                                                                                <button
                                                                                    type="button"
                                                                                    className={`btn btn-sm ${!showSketchView ? 'btn-primary' : 'btn-light'}`}
                                                                                    onClick={toggleViewMode}
                                                                                    title="Show video"
                                                                                >
                                                                                    🎬 Video
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className={`btn btn-sm ${showSketchView ? 'btn-primary' : 'btn-light'}`}
                                                                                    onClick={toggleViewMode}
                                                                                    title="Show sketch"
                                                                                >
                                                                                    ✨ Sketch
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* --- OVERLAY BADGES (Always on top) --- */}
                                                                <Badge bg="danger" className="position-absolute top-0 end-0 m-3 fw-bold px-3 py-2" style={{ zIndex: 10 }}>
                                                                    ⏱ {selectedShot.duration}
                                                                </Badge>
                                                                <Button
                                                                    size="sm"
                                                                    className="position-absolute bottom-0 end-0 m-3 fw-bold"
                                                                    onClick={handleGenerateShotSketch}
                                                                    disabled={isGeneratingSketch}
                                                                    style={{ zIndex: 10 }}
                                                                >
                                                                    {isGeneratingSketch ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> : '✨'}
                                                                    {selectedShot.image ? 'Regenerate AI Sketch' : 'Generate AI Sketch'}
                                                                </Button>
                                                            </div>

                                                            {/* --- OVERLAY BADGES (Always on top) --- */}
                                                            <Badge bg="danger" className="position-absolute top-0 end-0 m-3 fw-bold px-3 py-2">
                                                                ⏱ {selectedShot.duration}
                                                            </Badge>
                                                            <Button
                                                                size="sm"
                                                                className="position-absolute bottom-0 end-0 m-3 fw-bold"
                                                                onClick={handleGenerateShotSketch}
                                                                disabled={isGeneratingSketch}
                                                            >
                                                                {isGeneratingSketch ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> : '✨'}
                                                                {selectedShot.image ? 'Regenerate AI Sketch' : 'Generate AI Sketch'}
                                                            </Button>
                                                        </div>

                                                        <div className="p-4 border-top border-secondary">
                                                            <Row className="g-0 text-uppercase fw-bold" style={{ fontSize: '0.85rem' }}>
                                                                <Col xs={6} md={4} className="border border-secondary p-3"><div className="text-secondary small mb-1">SCENE</div><div className="fs-4">{selectedShot.scene}</div></Col>
                                                                <Col xs={6} md={4} className="border border-secondary p-3"><div className="text-secondary small mb-1">TAKE</div><div className="fs-4">{selectedShot.take}</div></Col>
                                                                <Col xs={6} md={4} className="border border-secondary p-3"><div className="text-secondary small mb-1">ROLL</div><div className="fs-4">{selectedShot.roll}</div></Col>
                                                                <Col xs={6} md={4} className="border border-secondary p-3"><div className="text-secondary small mb-1">DIRECTOR</div><div className="fs-5">{selectedShot.director}</div></Col>
                                                                <Col xs={6} md={4} className="border border-secondary p-3"><div className="text-secondary small mb-1">CAMERA</div><div className="fs-5">{selectedShot.camera}</div></Col>
                                                                <Col xs={6} md={4} className="border border-secondary p-3"><div className="text-secondary small mb-1">DATE</div><div className="fs-5">{selectedShot.date}</div></Col>
                                                            </Row>
                                                            <div className="d-flex gap-2 mt-4 flex-wrap">
                                                                <Badge bg="light" text="dark" className="px-3 py-2 fs-6">{getShotIcon(selectedShot.shot_type)} {selectedShot.shot_type}</Badge>
                                                                <Badge bg="light" text="dark" className="px-3 py-2 fs-6">{getMovementIcon(selectedShot.movement)} {selectedShot.movement}</Badge>
                                                                {selectedShot.master_shot && <Badge bg="warning" text="dark" className="px-3 py-2 fs-6">🎬 MASTER SHOT</Badge>}
                                                            </div>
                                                            <div className="mt-4 p-3 bg-black rounded border border-secondary">
                                                                <div className="text-secondary small text-uppercase fw-bold mb-2">SHOT DESCRIPTION</div>
                                                                <p className="mb-0 text-white fs-6"><span className="fw-bold text-warning">Shot {selectedShot.id}:</span> {selectedShot.summary}</p>
                                                            </div>
                                                        </div>

                                                        <div className="p-4 bg-black border-top border-secondary">
                                                            <Row className="g-3">
                                                                <Col md={4}>
                                                                    <Button 
                                                                        variant="outline-light" 
                                                                        className="w-100 py-3 border-2" 
                                                                        onClick={handleUploadClipClick}
                                                                    >
                                                                        <div className="fs-2 mb-1">📤</div>
                                                                        <div className="fw-bold text-uppercase small">Upload Clip</div>
                                                                    </Button>
                                                                    {/* Hidden File Input for Clip Upload */}
                                                                    <input
                                                                        type="file"
                                                                        ref={fileInputRef}
                                                                        accept="video/*"
                                                                        style={{ display: 'none' }}
                                                                        onChange={handleClipFileChange}
                                                                    />
                                                                </Col>
                                                                <Col md={4}>
                                                                    <Button variant="outline-light" className="w-100 py-3 border-2" onClick={() => setShowStockModal(true)}>
                                                                        <div className="fs-2 mb-1">🖼️</div><div className="fw-bold text-uppercase small">Stock Library</div>
                                                                    </Button>
                                                                </Col>
                                                                <Col md={4}>
                                                                    <Button variant="danger" className="w-100 py-3 border-2 fw-bold" onClick={handleStartCamera}>
                                                                        <div className="fs-2 mb-1">🔴</div>
                                                                        <div className="fw-bold text-uppercase small">Start Camera</div>
                                                                    </Button>
                                                                </Col>
                                                            </Row>
                                                        </div>
                                                    </Modal.Body>
                                                </>
                                                )}

                                                {/* --- CAMERA MODE (Preview + Recording - Single Persistent Video Element) --- */}
                                                {cameraMode && (
                                                    <Modal.Body className="bg-black text-white p-0 position-relative">
                                                        {/* Single video element that persists through preview and recording */}
                                                        <video 
                                                            ref={videoRef} 
                                                            autoPlay 
                                                            playsInline 
                                                            muted 
                                                            className="w-100" 
                                                            style={{ maxHeight: '70vh', objectFit: 'cover' }} 
                                                        />
                                                        
                                                        {/* Framing Guide Overlay (Only show during preview, not recording) */}
                                                        {!isRecording && !showCountdown && (
                                                            <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none" style={{ border: '2px dashed rgba(255,255,255,0.3)' }}>
                                                                <div className="position-absolute" style={{ top: '33.33%', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                                                                <div className="position-absolute" style={{ top: '66.66%', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                                                                <div className="position-absolute" style={{ left: '33.33%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                                                                <div className="position-absolute" style={{ left: '66.66%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                                                            </div>
                                                        )}

                                                        {/* Instructions (Only show during preview) */}
                                                        {!isRecording && !showCountdown && (
                                                            <div className="position-absolute top-0 start-50 translate-middle-x m-3 bg-black bg-opacity-75 px-4 py-2 rounded-pill">
                                                                <small className="fw-bold">Frame your shot, then click "Start Recording"</small>
                                                            </div>
                                                        )}

                                                        {/* Cinematic Countdown Overlay */}
                                                        {showCountdown && (
                                                            <div className="position-absolute top-50 start-50 translate-middle text-center">
                                                                <h1 className={`display-1 fw-black ${countdownValue === "ACTION!" ? "text-success" : "text-white"}`} 
                                                                    style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)', fontSize: '8rem', lineHeight: 1 }}>
                                                                    {countdownValue}
                                                                </h1>
                                                            </div>
                                                        )}

                                                        {/* Recording Indicator */}
                                                        {isRecording && !showCountdown && (
                                                            <div className="position-absolute top-0 start-0 m-3 d-flex align-items-center gap-2 bg-danger bg-opacity-75 px-3 py-2 rounded-pill">
                                                                <span className="badge bg-white rounded-circle" style={{ width: '12px', height: '12px', animation: 'pulse 1.5s infinite' }}></span>
                                                                <span className="fw-bold small">REC</span>
                                                            </div>
                                                        )}

                                                        {/* Close & Control Buttons */}
                                                        <div className="position-absolute top-0 end-0 m-3 d-flex gap-2">
                                                            <button className="btn btn-close btn-close-white" onClick={handleCloseModal} aria-label="Close"></button>
                                                            {isRecording && (
                                                                <Button variant="danger" size="lg" className="fw-bold px-4" onClick={stopRecording}>
                                                                    ⏹ Stop Recording
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Start Recording Button (Only show during preview) */}
                                                        {!isRecording && !showCountdown && (
                                                            <div className="position-absolute bottom-0 start-50 translate-middle-x mb-4">
                                                                <Button variant="danger" size="lg" className="fw-bold px-5 py-3 fs-5" onClick={handleStartRecording}>
                                                                    <span className="me-2">🔴</span> Start Recording
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </Modal.Body>
                                                )}

                                                {/* --- RECORDED VIDEO PREVIEW VIEW --- */}
                                                {recordedVideoUrl && !cameraMode && (
                                                    <Modal.Body className="bg-dark text-white p-0 position-relative">
                                                        <div className="position-relative bg-black">
                                                            <video 
                                                                src={recordedVideoUrl} 
                                                                controls 
                                                                autoPlay 
                                                                className="w-100" 
                                                                style={{ maxHeight: '70vh' }} 
                                                            />
                                                            <button className="btn btn-close btn-close-white position-absolute top-0 end-0 m-3" onClick={handleCloseModal} aria-label="Close"></button>
                                                        </div>
                                                        <div className="p-4 bg-black border-top border-secondary">
                                                            <Row className="g-3">
                                                                <Col md={6}>
                                                                    <Button variant="outline-light" className="w-100 py-3 border-2" onClick={() => { cleanupCamera(); handleStartCamera(); }}>
                                                                        <div className="fs-2 mb-1">🔄</div>
                                                                        <div className="fw-bold text-uppercase small">Retake</div>
                                                                    </Button>
                                                                </Col>
                                                                <Col md={6}>
                                                                    <Button 
                                                                        variant="success" 
                                                                        className="w-100 py-3 border-2 fw-bold" 
                                                                        onClick={handleSaveShot}
                                                                        disabled={!recordedVideoUrl}
                                                                    >
                                                                        <div className="fs-2 mb-1">💾</div>
                                                                        <div className="fw-bold text-uppercase small">Save to Shot</div>
                                                                    </Button>
                                                                </Col>
                                                            </Row>
                                                        </div>
                                                    </Modal.Body>
                                                )}
                                            </Modal>

                                            {/* --- STOCK VIDEO LIBRARY MODAL --- */}
                                            <Modal show={showStockModal} onHide={() => setShowStockModal(false)} size="xl" centered>
                                                <Modal.Header closeButton className="border-bottom">
                                                    <Modal.Title className="fw-bold">🎬 Stock Video Library (Pexels)</Modal.Title>
                                                </Modal.Header>
                                                <Modal.Body>
                                                    {/* Search Bar */}
                                                    <Form className="mb-4">
                                                        <InputGroup size="lg">
                                                            <Form.Control 
                                                                placeholder="Search stock videos (e.g., 'cyberpunk city', 'forest drone')" 
                                                                value={stockQuery}
                                                                onChange={(e) => setStockQuery(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                                                            />
                                                            <Button 
                                                                variant="primary" 
                                                                onClick={handleManualSearch} 
                                                                disabled={isStockLoading || !stockQuery.trim()}
                                                                className="px-4"
                                                            >
                                                                {isStockLoading ? (
                                                                    <><span className="spinner-border spinner-border-sm me-2" />Searching...</>
                                                                ) : 'Search'}
                                                            </Button>
                                                        </InputGroup>
                                                    </Form>

                                                    {/* Results Summary */}
                                                    {!isStockLoading && totalResults > 0 && (
                                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                                            <small className="text-muted">
                                                                Showing <strong>{(currentPage - 1) * PER_PAGE + 1}-{Math.min(currentPage * PER_PAGE, totalResults)}</strong> of <strong>{totalResults.toLocaleString()}</strong> results
                                                            </small>
                                                            <small className="text-muted">
                                                                Page <strong>{currentPage}</strong> of <strong>{Math.ceil(totalResults / PER_PAGE)}</strong>
                                                            </small>
                                                        </div>
                                                    )}

                                                    {/* Content Area */}
                                                    {isStockLoading ? (
                                                        <div className="text-center py-5">
                                                            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} />
                                                            <p className="text-muted">Searching high-quality stock videos...</p>
                                                        </div>
                                                    ) : stockVideos.length > 0 ? (
                                                        <>
                                                            <Row xs={1} sm={2} lg={3} xl={4} className="g-3">
                                                                {stockVideos.map((vid) => {
                                                                    const previewFile = vid.video_files.find(f => f.width === 1920 || f.height === 1080) || vid.video_files[0];
                                                                    return (
                                                                        <Col key={vid.id}>
                                                                            <div 
                                                                                className="position-relative rounded overflow-hidden border bg-black shadow-sm" 
                                                                                style={{ cursor: 'pointer', aspectRatio: '16/9', transition: 'transform 0.2s' }}
                                                                                onMouseEnter={(e) => {
                                                                                    e.currentTarget.style.transform = 'scale(1.03)';
                                                                                    const videoEl = e.currentTarget.querySelector('video') as HTMLVideoElement;
                                                                                    if (videoEl) videoEl.play().catch(() => {});
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                                    const videoEl = e.currentTarget.querySelector('video') as HTMLVideoElement;
                                                                                    if (videoEl) {
                                                                                        videoEl.pause();
                                                                                        videoEl.currentTime = 0;
                                                                                    }
                                                                                }}
                                                                                onClick={() => handleSelectStockVideo(vid)}
                                                                                title="Click to use this video for the shot"
                                                                            >
                                                                                <video 
                                                                                    src={previewFile?.link} 
                                                                                    className="w-100 h-100" 
                                                                                    style={{ objectFit: 'cover' }} 
                                                                                    muted 
                                                                                    loop 
                                                                                    playsInline
                                                                                    preload="none"
                                                                                />
                                                                                <div className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-75 text-white p-2 small d-flex justify-content-between align-items-center">
                                                                                    <span className="text-truncate pe-2">🎬 {vid.duration}s</span>
                                                                                    <span className="badge bg-primary">Select</span>
                                                                                </div>
                                                                            </div>
                                                                        </Col>
                                                                    );
                                                                })}
                                                            </Row>

                                                            {/* Pagination Controls */}
                                                            <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
                                                                <Button 
                                                                    variant="secondary" 
                                                                    onClick={handlePrevPage} 
                                                                    disabled={currentPage <= 1 || isStockLoading}
                                                                >
                                                                    ← Previous
                                                                </Button>
                                                                <span className="fw-medium">
                                                                    Page {currentPage} of {Math.ceil(totalResults / PER_PAGE)}
                                                                </span>
                                                                <Button 
                                                                    variant="secondary" 
                                                                    onClick={handleNextPage} 
                                                                    disabled={currentPage >= Math.ceil(totalResults / PER_PAGE) || isStockLoading}
                                                                >
                                                                    Next →
                                                                </Button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-center py-5 rounded border border-dashed">
                                                            <div className="fs-1 mb-3">🎥</div>
                                                            <h5>Find the perfect motion visual</h5>
                                                            <p className="mb-0">
                                                                {selectedShot 
                                                                    ? `Searching for videos matching: "${buildSearchQueryFromShot(selectedShot)}"`
                                                                    : "Search for high-quality, free-to-use stock video clips to attach to this shot."}
                                                            </p>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="mt-4 text-center">
                                                        <small>
                                                            Powered by <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="text-decoration-none">Pexels</a>. 
                                                            Videos are free to use under the Pexels License.
                                                        </small>
                                                    </div>
                                                </Modal.Body>
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