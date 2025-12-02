import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sensor, Household, Pipeline as PipelineType, Alert, User, Role, WaterPump } from '@/types';
import { 
    fetchSensors, fetchHouseholds, fetchPipelines, fetchAllAlerts, 
    updateSensorPosition, updateHouseholdPosition, fetchPumps, updatePumpPosition, 
    addLog, addPipeline, removePipeline, updatePipelineJoints,
    saveMapSettings, fetchMapSettings 
} from '@/services/apiService';
import { useTranslation } from '@/i18n';
import ErrorDisplay from '@/components/ErrorDisplay';
import { TrashIcon, LinkIcon, XMarkIcon, PhotoIcon, MagnifyingGlassIcon } from '@/components/icons/IconComponents';
import Echo from '@/lib/echo'; 

// LEAFLET IMPORTS
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface PipelineMapProps { user: User; }

type DraggableElement = (Sensor & { type: 'sensor' }) | (Household & { type: 'household' }) | (WaterPump & { type: 'pump' });
type SelectableElement = DraggableElement | (PipelineType & { type: 'pipeline' });
type DraggableJoint = { pipelineId: string; jointIndex: number; isNew?: boolean };

const InfoDetail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="mb-2 border-b border-gray-100 pb-1 last:border-0">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-sm text-brand-dark font-medium break-words">{value}</p>
    </div>
);

// ✅ HELPER: Controller to move map programmatically
const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        if (!center) return;
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        
        // Only fly to if significantly different (prevents loops)
        const dist = Math.sqrt(Math.pow(currentCenter.lat - center[0], 2) + Math.pow(currentCenter.lng - center[1], 2));
        if (dist > 0.0001 || currentZoom !== zoom) {
            map.setView(center, zoom, { animate: true }); 
        }
    }, [center, zoom, map]); 
    return null;
};

// ✅ HELPER: Capture map movements (Only when Editing Background)
const EventComponent = ({ setConfig, active }: { setConfig: any, active: boolean }) => {
    const map = useMap();
    
    // Toggle interaction based on 'active' prop
    useEffect(() => {
        if (active) {
            map.dragging.enable();
            map.scrollWheelZoom.enable();
            map.doubleClickZoom.enable();
        } else {
            map.dragging.disable();
            map.scrollWheelZoom.disable();
            map.doubleClickZoom.disable();
        }
    }, [active, map]);

    useEffect(() => {
        if (!active) return;
        const onMoveEnd = () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            setConfig((prev: any) => ({ ...prev, lat: center.lat, lng: center.lng, zoom: zoom }));
        };
        map.on('moveend', onMoveEnd);
        return () => { map.off('moveend', onMoveEnd); };
    }, [map, setConfig, active]);
    
    return null;
};

const PipelineMap: React.FC<PipelineMapProps> = ({ user }) => {
    const { t } = useTranslation();
    
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [pumps, setPumps] = useState<WaterPump[]>([]);
    const [pipelines, setPipelines] = useState<PipelineType[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    
    const sensorsRef = useRef<Sensor[]>([]);
    const householdsRef = useRef<Household[]>([]);
    const pumpsRef = useRef<WaterPump[]>([]);
    const pipelinesRef = useRef<PipelineType[]>([]);

    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [draggingElement, setDraggingElement] = useState<{ id: string; type: 'sensor' | 'household' | 'pump', offsetX: number, offsetY: number } | null>(null);
    const [draggingJoint, setDraggingJoint] = useState<DraggableJoint | null>(null);
    const [selectedElement, setSelectedElement] = useState<SelectableElement | null>(null);
    const [pipelineStartNode, setPipelineStartNode] = useState<string | null>(null);
    const [cursorPosition, setCursorPosition] = useState<{x: number, y: number} | null>(null);
    const [activeAlertPipelineIds, setActiveAlertPipelineIds] = useState<Set<string>>(new Set());

    // Map State
    const [bgConfig, setBgConfig] = useState({
        mode: 'none', 
        lat: 14.5995,
        lng: 120.9842,
        zoom: 13,
        imageUrl: ''
    });
    const [showBgSettings, setShowBgSettings] = useState(false);
    const [tempImage, setTempImage] = useState<File | null>(null);
    
    // ✅ Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { sensorsRef.current = sensors; }, [sensors]);
    useEffect(() => { householdsRef.current = households; }, [households]);
    useEffect(() => { pumpsRef.current = pumps; }, [pumps]);
    useEffect(() => { pipelinesRef.current = pipelines; }, [pipelines]);

    const loadMapData = useCallback(async (showLoading = true) => {
        if(showLoading) setLoading(true);
        setError(null);
        try {
            const [sensorData, householdData, pumpData, pipelineData, alertData, mapSettings] = await Promise.all([
                fetchSensors(), fetchHouseholds(), fetchPumps(), fetchPipelines(), fetchAllAlerts(), fetchMapSettings()
            ]);
            setSensors(sensorData); setHouseholds(householdData); setPumps(pumpData); setPipelines(pipelineData); setAlerts(alertData);
            if(mapSettings) setBgConfig(prev => ({ ...prev, ...mapSettings }));

            const affectedIds = new Set<string>();
            alertData.forEach((a: any) => {
                if (!a.resolved_at && !a.resolvedAt) {
                    const pId = a.pipelineId || a.pipeline_id;
                    if (pId) affectedIds.add(String(pId));
                }
            });
            setActiveAlertPipelineIds(affectedIds);
        } catch (error) { setError(t('errors.loadData')); } finally { if(showLoading) setLoading(false); }
    }, [t]);

    useEffect(() => { loadMapData(); }, [loadMapData]);

    const handleSaveBgSettings = async () => {
        const formData = new FormData();
        formData.append('mode', bgConfig.mode);
        formData.append('lat', String(bgConfig.lat));
        formData.append('lng', String(bgConfig.lng));
        formData.append('zoom', String(bgConfig.zoom));
        if(bgConfig.imageUrl) formData.append('imageUrl', bgConfig.imageUrl);
        if(tempImage) formData.append('image', tempImage);

        try {
            const newConfig = await saveMapSettings(formData);
            setBgConfig(prev => ({ ...prev, ...newConfig }));
            setShowBgSettings(false);
            setTempImage(null);
            alert("Background saved! Map is now fixed.");
        } catch (e) { alert("Failed to save settings"); }
    };

    // ✅ HANDLE SEARCH
    const handleSearchLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            // Use OpenStreetMap Nominatim API (Free)
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setBgConfig(prev => ({
                    ...prev,
                    lat: parseFloat(lat),
                    lng: parseFloat(lon),
                    zoom: 15 // Auto zoom in on result
                }));
            } else {
                alert("Location not found.");
            }
        } catch (err) {
            alert("Error searching location.");
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const channel = Echo.channel('alerts-channel');
        channel.listen('.leak.detected', (event: any) => {
            if (event.alert) {
                setAlerts(prev => [event.alert, ...prev]);
                const pId = event.alert.pipelineId || event.alert.pipeline_id;
                if (pId) setActiveAlertPipelineIds(prev => new Set(prev).add(String(pId)));
            }
        });
        return () => { channel.stopListening('.leak.detected'); Echo.leaveChannel('alerts-channel'); };
    }, []);

    // ... Standard Helpers ...
    const getPointForId = (id: string) => {
        const s = sensors.find(x => x.id === id); if(s) return {x:+s.x, y:+s.y};
        const h = households.find(x => x.id === id); if(h) return {x:+h.x, y:+h.y};
        const p = pumps.find(x => x.id === id); if(p) return {x:+p.x, y:+p.y};
        return null;
    };
    
    const getSVGCoordinates = (e: React.MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const ctm = svgRef.current.getScreenCTM();
        if(!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    };

    // ... Interactions ...
    const handleNodeClick = async (e: React.MouseEvent, node: DraggableElement) => {
        e.stopPropagation(); 
        if (isEditMode && pipelineStartNode) {
            if (pipelineStartNode !== node.id) {
                try {
                    await addPipeline(pipelineStartNode, node.id);
                    addLog('Create Pipeline', `Created pipeline: ${pipelineStartNode} -> ${node.id}`);
                    setPipelineStartNode(null);
                    await loadMapData(false);
                } catch (err: any) { setError(t('errors.saveData')); setPipelineStartNode(null); } 
            } else { setPipelineStartNode(null); }
        } else { setSelectedElement(node); }
    };

    const handleMouseDownOnNode = (e: React.MouseEvent, element: DraggableElement) => {
        e.stopPropagation(); if (!isEditMode || pipelineStartNode) return;
        const coords = getSVGCoordinates(e);
        setDraggingElement({ id: element.id, type: element.type, offsetX: coords.x - Number(element.x), offsetY: coords.y - Number(element.y) });
    };

    const handleMouseDownOnJoint = (e: React.MouseEvent, pipelineId: string, jointIndex: number) => {
        if (!isEditMode) return; e.stopPropagation(); setDraggingJoint({ pipelineId, jointIndex });
    };

    const handleMouseDownOnNewJoint = (e: React.MouseEvent, pipelineId: string, segmentIndex: number) => {
        if (!isEditMode) return; e.stopPropagation(); const coords = getSVGCoordinates(e);
        setPipelines(prev => prev.map(p => {
            if (p.id === pipelineId) {
                let currentJoints = typeof p.joints === 'string' ? JSON.parse(p.joints) : (p.joints || []);
                if(!Array.isArray(currentJoints)) currentJoints = [];
                const newJoints = [...currentJoints];
                newJoints.splice(segmentIndex, 0, { x: coords.x, y: coords.y });
                return { ...p, joints: newJoints };
            } return p;
        }));
        setDraggingJoint({ pipelineId, jointIndex: segmentIndex, isNew: true });
    };

    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const coords = getSVGCoordinates(e);
        if (pipelineStartNode) setCursorPosition(coords);
        if (draggingElement) {
            const newX = coords.x - draggingElement.offsetX;
            const newY = coords.y - draggingElement.offsetY;
            if (draggingElement.type === 'sensor') setSensors(prev => prev.map(s => s.id === draggingElement.id ? { ...s, x: newX, y: newY } : s));
            else if (draggingElement.type === 'household') setHouseholds(prev => prev.map(h => h.id === draggingElement.id ? { ...h, x: newX, y: newY } : h));
            else if (draggingElement.type === 'pump') setPumps(prev => prev.map(p => p.id === draggingElement.id ? { ...p, x: newX, y: newY } : p));
        } else if (draggingJoint) {
            setPipelines(prev => prev.map(p => {
                if (p.id === draggingJoint.pipelineId) {
                    let currentJoints = typeof p.joints === 'string' ? JSON.parse(p.joints) : (p.joints || []);
                    if(!Array.isArray(currentJoints)) currentJoints = [];
                    const updatedJoints = [...currentJoints];
                    updatedJoints[draggingJoint.jointIndex] = { x: coords.x, y: coords.y };
                    return { ...p, joints: updatedJoints };
                } return p;
            }));
        }
    };

    const handleSvgMouseUp = async () => {
        if (draggingElement) {
            const { id, type } = draggingElement;
            try {
                if (type === 'sensor') { const el = sensorsRef.current.find(s => s.id === id); if(el) await updateSensorPosition(id, el.x, el.y); }
                else if (type === 'household') { const el = householdsRef.current.find(h => h.id === id); if(el) await updateHouseholdPosition(id, el.x, el.y); }
                else if (type === 'pump') { const el = pumpsRef.current.find(p => p.id === id); if(el) await updatePumpPosition(id, el.x, el.y); }
            } catch(error) { loadMapData(); } finally { setDraggingElement(null); }
        } else if (draggingJoint) {
            const { pipelineId } = draggingJoint;
            const pipeline = pipelinesRef.current.find(p => p.id === pipelineId);
            if(pipeline) {
                try {
                    let jointsToSend = pipeline.joints;
                    if(typeof jointsToSend === 'string') jointsToSend = JSON.parse(jointsToSend);
                    await updatePipelineJoints(pipelineId, jointsToSend || []);
                } catch(error) { loadMapData(); }
            }
            setDraggingJoint(null);
        }
    };

    const handleJointDoubleClick = async (e: React.MouseEvent, pipelineId: string, jointIndex: number) => {
        e.stopPropagation(); if (!isEditMode) return;
        const pipeline = pipelines.find(p => p.id === pipelineId);
        if (pipeline) {
            let currentJoints = typeof pipeline.joints === 'string' ? JSON.parse(pipeline.joints) : (pipeline.joints || []);
            if(!Array.isArray(currentJoints)) return;
            const newJoints = currentJoints.filter((_, idx) => idx !== jointIndex);
            try { await updatePipelineJoints(pipelineId, newJoints); await loadMapData(false); } catch (err) {}
        }
    };

    const handleRemovePipeline = async () => {
        if (selectedElement?.type !== 'pipeline') return;
        if (!confirm("Are you sure you want to delete this pipeline?")) return;
        try { await removePipeline(selectedElement.id); addLog('Delete Pipeline', `Deleted pipeline ${selectedElement.id}`); setSelectedElement(null); await loadMapData(false); } catch (err) { setError('Failed to delete pipeline'); }
    };

    const mapDimensions = useMemo(() => {
        let maxX = 1200; let maxY = 800;
        const checkPoint = (x: any, y: any) => {
            const valX = Number(x); const valY = Number(y);
            if (!isNaN(valX) && valX > maxX) maxX = valX;
            if (!isNaN(valY) && valY > maxY) maxY = valY;
        };
        sensors.forEach(s => checkPoint(s.x, s.y));
        households.forEach(h => checkPoint(h.x, h.y));
        pumps.forEach(p => checkPoint(p.x, p.y));
        pipelines.forEach(p => {
            let joints: any[] = [];
            try { if (typeof p.joints === 'string') joints = JSON.parse(p.joints); else if (Array.isArray(p.joints)) joints = p.joints; } catch (e) {}
            if (Array.isArray(joints)) joints.forEach(j => checkPoint(j.x, j.y));
        });
        return { width: maxX + 300, height: maxY + 300 };
    }, [sensors, households, pumps, pipelines]);

    const renderBackground = () => {
        if (bgConfig.mode === 'map') {
            return (
                // ✅ pointer-events-auto only if editing, else map is inert
                <div className={`absolute inset-0 z-0 opacity-50 ${showBgSettings ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                    <MapContainer 
                        center={[bgConfig.lat, bgConfig.lng]} 
                        zoom={bgConfig.zoom} 
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        dragging={false}
                        doubleClickZoom={false}
                        attributionControl={false}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        
                        <MapController center={[bgConfig.lat, bgConfig.lng]} zoom={bgConfig.zoom} />
                        
                        {/* ✅ Enable Interaction ONLY when Settings Panel is Open */}
                        <EventComponent setConfig={setBgConfig} active={showBgSettings} />
                    </MapContainer>
                </div>
            );
        } else if (bgConfig.mode === 'image' && bgConfig.imageUrl) {
            return (
                <div 
                    className="absolute inset-0 z-0 opacity-60 pointer-events-none"
                    style={{ 
                        backgroundImage: `url(${import.meta.env.VITE_BACKEND_URL}${bgConfig.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
            );
        }
        return null;
    };

    // ... renderInfoPanel (reused from previous) ...
    const renderInfoPanel = () => {
        if (!selectedElement) return null;
        let title = 'Element Details';
        let content = null;
        if (selectedElement.type === 'pipeline') {
             title = `Pipeline: ${selectedElement.id}`;
             const isPipelineAlerted = activeAlertPipelineIds.has(String(selectedElement.id));
             content = (
                <>
                    {isPipelineAlerted && ( <div className="bg-red-50 border-l-4 border-red-500 p-2 mb-3 rounded"><p className="text-red-700 font-bold text-sm flex items-center gap-2">🚨 LEAK DETECTED</p></div> )}
                    <InfoDetail label="Connected From" value={selectedElement.from} />
                    <InfoDetail label="Connected To" value={selectedElement.to} />
                    {isEditMode && ( <button onClick={handleRemovePipeline} className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"><TrashIcon className="w-5 h-5"/> Delete Pipeline</button> )}
                </>
             );
        } else if (selectedElement.type === 'sensor') {
            title = `Sensor Node: ${selectedElement.id}`;
            content = ( <> <InfoDetail label="Description" value={selectedElement.description || 'No description'} /> <InfoDetail label="Coordinates" value={`X: ${Math.round(Number(selectedElement.x))}, Y: ${Math.round(Number(selectedElement.y))}`} /> {isEditMode && <div className="text-xs text-blue-600 mt-2 italic">To connect, click "Connect Pipeline" below</div>} </> );
        } else if (selectedElement.type === 'pump') {
            title = `Water Pump: ${selectedElement.id}`;
            content = ( <> <InfoDetail label="Status" value={ <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${selectedElement.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'}`}>{selectedElement.status}</span> } /> <InfoDetail label="Coordinates" value={`X: ${Math.round(Number(selectedElement.x))}, Y: ${Math.round(Number(selectedElement.y))}`} /> </> );
        } else if (selectedElement.type === 'household') {
            title = `Household: ${selectedElement.id}`;
            content = ( <> <InfoDetail label="Address" value={selectedElement.address || 'N/A'} /> <InfoDetail label="Coordinates" value={`X: ${Math.round(Number(selectedElement.x))}, Y: ${Math.round(Number(selectedElement.y))}`} /> </> );
        }
        return (
            <div className="absolute top-4 left-4 bg-white/95 p-5 rounded-lg shadow-xl w-72 border border-gray-200 z-10 animate-fade-in-up backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                   <h4 className="font-bold text-lg text-brand-dark truncate pr-2">{title}</h4>
                   <button onClick={() => setSelectedElement(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="space-y-2">{content}</div>
                {isEditMode && selectedElement.type !== 'pipeline' && (
                    <div className="mt-4 border-t pt-3">
                        <button onClick={() => setPipelineStartNode(selectedElement.id)} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"><LinkIcon className="w-5 h-5" /> Connect Pipeline</button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-brand-light p-6 rounded-xl shadow-md h-full flex flex-col relative">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-brand-dark">{t('pipelineMap.title')}</h2>
                <div className="flex gap-2">
                    {user.role === Role.Admin && (
                        <>
                            <button 
                                onClick={() => setShowBgSettings(true)}
                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 flex items-center gap-1 text-sm font-bold"
                            >
                                <PhotoIcon className="w-4 h-4" /> Background
                            </button>
                            <button
                                onClick={() => { setIsEditMode(!isEditMode); setSelectedElement(null); setPipelineStartNode(null); }}
                                className={`px-4 py-2 rounded-lg font-semibold text-white transition-colors ${isEditMode ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-primary hover:bg-blue-700'}`}
                            >
                                {isEditMode ? t('pipelineMap.viewMode') : t('pipelineMap.editMode')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ✅ MODAL FOR SETTINGS */}
            {showBgSettings && (
                <div className="absolute top-16 right-0 left-0 mx-auto w-96 bg-white p-6 rounded-xl shadow-2xl border z-50 animate-fade-in-down">
                    <h3 className="font-bold text-lg mb-4 flex justify-between items-center">
                        Map Background Settings
                        <button onClick={() => setShowBgSettings(false)}><XMarkIcon className="w-5 h-5 text-gray-400 hover:text-gray-600"/></button>
                    </h3>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Background Mode</label>
                        <select 
                            value={bgConfig.mode} 
                            onChange={(e) => setBgConfig(p => ({ ...p, mode: e.target.value }))}
                            className="w-full p-2 border rounded"
                        >
                            <option value="none">None (White)</option>
                            <option value="map">OpenStreetMap (World Map)</option>
                            <option value="image">Upload Image (Blueprint)</option>
                        </select>
                    </div>

                    {bgConfig.mode === 'map' && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Search Location</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation(e)}
                                    placeholder="e.g., Manila City Hall"
                                    className="flex-1 p-2 border rounded text-sm"
                                />
                                <button 
                                    onClick={handleSearchLocation}
                                    disabled={isSearching}
                                    className="px-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
                                >
                                    <MagnifyingGlassIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded">
                                📍 <strong>Drag & Zoom</strong> the map below to adjust the exact position. When satisfied, click <strong>Save Settings</strong>. The map will freeze in this position.
                            </p>
                        </div>
                    )}

                    {bgConfig.mode === 'image' && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Upload Image</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => setTempImage(e.target.files ? e.target.files[0] : null)}
                                className="w-full text-sm"
                            />
                            {bgConfig.imageUrl && <img src={`${import.meta.env.VITE_BACKEND_URL}${bgConfig.imageUrl}`} className="mt-2 h-20 object-cover rounded" />}
                        </div>
                    )}

                    <div className="flex gap-2 justify-end border-t pt-4">
                        <button onClick={() => setShowBgSettings(false)} className="px-3 py-1 text-gray-500 hover:underline">Cancel</button>
                        <button onClick={handleSaveBgSettings} className="px-4 py-2 bg-brand-primary text-white rounded font-bold">Save Settings</button>
                    </div>
                </div>
            )}

            {error && <ErrorDisplay message={error} />}
            
            {loading ? <p className="text-center">{t('pipelineMap.loading')}</p> : (
                <div className="relative flex-grow border rounded-lg bg-gray-100 shadow-inner overflow-hidden">
                    
                    <div className="absolute top-4 left-4 z-50 pointer-events-none">
                         <div className="pointer-events-auto">{renderInfoPanel()}</div>
                    </div>

                    {renderBackground()}

                    <div className="w-full h-full overflow-auto relative z-10" ref={containerRef}>
                        <div style={{ width: `${mapDimensions.width}px`, height: `${mapDimensions.height}px`, position: 'relative' }}>
                            <svg 
                                ref={svgRef} 
                                width="100%" 
                                height="100%" 
                                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: isEditMode ? 'auto' : 'none' }}
                                onMouseMove={handleSvgMouseMove}
                                onMouseDown={(e) => { if(!e.defaultPrevented && isEditMode) { setPipelineStartNode(null); setSelectedElement(null); } }}
                                onMouseUp={handleSvgMouseUp}
                                onMouseLeave={handleSvgMouseUp}
                            >
                                {pipelines.map(p => {
                                    const from = getPointForId(p.from); const to = getPointForId(p.to);
                                    if (!from || !to) return null;
                                    let jointsArray = p.joints;
                                    try { if (typeof p.joints === 'string') jointsArray = JSON.parse(p.joints); else if (Array.isArray(p.joints)) jointsArray = p.joints; } catch (e) { jointsArray = []; }
                                    if (!Array.isArray(jointsArray)) jointsArray = [];
                                    const validJoints = jointsArray.map((j: any) => ({ x: Number(j.x), y: Number(j.y) }));
                                    const allPoints = [from, ...validJoints, to];
                                    const pointsString = allPoints.map(pt => `${pt.x},${pt.y}`).join(' ');
                                    const isSelected = selectedElement?.type === 'pipeline' && selectedElement.id === p.id;
                                    const isAlerted = activeAlertPipelineIds.has(String(p.id));

                                    return (
                                        <g key={p.id} style={{ pointerEvents: 'auto' }}>
                                            {isAlerted && ( <polyline points={pointsString} fill="none" stroke="#DE350B" strokeWidth="12" strokeOpacity="0.3"><animate attributeName="stroke-opacity" values="0.3;0.7;0.3" dur="1s" repeatCount="indefinite" /></polyline> )}
                                            <polyline points={pointsString} fill="none" stroke="transparent" strokeWidth="20" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedElement({ ...p, type: 'pipeline' }); }}/>
                                            <polyline points={pointsString} fill="none" stroke={isAlerted ? '#DE350B' : (isSelected ? '#f59e0b' : '#a0aec0')} strokeWidth={isAlerted || isSelected ? 5 : 3} style={{ pointerEvents: 'none' }} />
                                            {isEditMode && allPoints.slice(0, -1).map((pt, idx) => {
                                                const nextPt = allPoints[idx + 1]; const midX = (pt.x + nextPt.x) / 2; const midY = (pt.y + nextPt.y) / 2;
                                                return ( <circle key={`${p.id}-new-${idx}`} cx={midX} cy={midY} r="6" fill="#0052CC" fillOpacity="0.5" className="cursor-grab hover:fill-opacity-100" onMouseDown={(e) => handleMouseDownOnNewJoint(e, p.id, idx)}/> )
                                            })}
                                            {isEditMode && validJoints.map((joint: any, idx: number) => (
                                                <circle key={`${p.id}-joint-${idx}`} cx={joint.x} cy={joint.y} r="6" fill="#fff" stroke="#0052CC" strokeWidth="2" className="cursor-move" onMouseDown={(e) => handleMouseDownOnJoint(e, p.id, idx)} onDoubleClick={(e) => handleJointDoubleClick(e, p.id, idx)} />
                                            ))}
                                        </g>
                                    );
                                })}
                                {pipelineStartNode && cursorPosition && getPointForId(pipelineStartNode) && ( <line x1={getPointForId(pipelineStartNode)!.x} y1={getPointForId(pipelineStartNode)!.y} x2={cursorPosition.x} y2={cursorPosition.y} stroke="#0052CC" strokeWidth="3" strokeDasharray="5,5" /> )}
                                {sensors.map(s => {
                                    const isStart = pipelineStartNode === s.id; const isSelected = selectedElement?.id === s.id;
                                    return ( <g key={s.id} transform={`translate(${s.x}, ${s.y})`} onMouseDown={(e) => handleMouseDownOnNode(e, { ...s, type: 'sensor' })} onClick={(e) => handleNodeClick(e, {...s, type: 'sensor'})} className={isEditMode ? 'cursor-grab' : 'cursor-pointer'} style={{ pointerEvents: 'auto' }}> <circle r={isStart ? "16" : "12"} fill={'#0052CC'} stroke={isStart || isSelected ? '#f59e0b' : '#fff'} strokeWidth="3" /> <text y="-18" textAnchor="middle" fontSize="10" fill="#333" className="pointer-events-none font-semibold">{s.id}</text> </g> )
                                })}
                                {households.map(h => {
                                    const isStart = pipelineStartNode === h.id; const isSelected = selectedElement?.id === h.id;
                                    return ( <g key={h.id} transform={`translate(${h.x}, ${h.y})`} onMouseDown={(e) => handleMouseDownOnNode(e, { ...h, type: 'household' })} onClick={(e) => handleNodeClick(e, {...h, type: 'household'})} className={isEditMode ? 'cursor-grab' : 'cursor-pointer'} style={{ pointerEvents: 'auto' }}> <rect x="-10" y="-10" width="20" height="20" fill="#2d3748" stroke={isStart || isSelected ? '#f59e0b' : '#fff'} strokeWidth="3" rx="2" /> <text y="-15" textAnchor="middle" fontSize="10" fill="#333" className="pointer-events-none font-semibold">{h.id}</text> </g> )
                                })}
                                {pumps.map(p => {
                                    const statusColor = p.status === 'Active' ? '#22c55e' : p.status === 'Inactive' ? '#6b7280' : '#ef4444'; const isStart = pipelineStartNode === p.id; const isSelected = selectedElement?.id === p.id;
                                    return ( <g key={p.id} transform={`translate(${p.x}, ${p.y})`} onMouseDown={(e) => handleMouseDownOnNode(e, { ...p, type: 'pump' })} onClick={(e) => handleNodeClick(e, {...p, type: 'pump'})} className={isEditMode ? 'cursor-grab' : 'cursor-pointer'} style={{ pointerEvents: 'auto' }}> <rect x="-10" y="-10" width="20" height="20" fill={statusColor} stroke={isStart || isSelected ? '#f59e0b' : '#fff'} strokeWidth="3" transform="rotate(45)" /> <text y="-18" textAnchor="middle" fontSize="10" fill="#333" className="pointer-events-none font-semibold">{p.id}</text> </g> );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PipelineMap;