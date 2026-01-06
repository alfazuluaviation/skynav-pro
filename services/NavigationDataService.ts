import { LatLngBounds } from 'leaflet';
import { NavPoint } from '../types';
import { searchAerodrome } from './geminiService'; // Import searchAerodrome

const BASE_WFS_URL = '/geoserver/wfs';

export const fetchNavigationData = async (bounds: LatLngBounds): Promise<NavPoint[]> => {
    // Construct BBOX string: minLng,minLat,maxLng,maxLat
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    // Validated layers
    const layers = ['ICA:airport', 'ICA:vor', 'ICA:ndb', 'ICA:waypoint'];

    const results: NavPoint[] = [];

    const fetchLayer = async (layerName: string) => {
        try {
            const params = new URLSearchParams({
                service: 'WFS',
                version: '1.0.0',
                request: 'GetFeature',
                typeName: layerName,
                outputFormat: 'application/json',
                bbox: bbox
            });

            const response = await fetch(`${BASE_WFS_URL}?${params.toString()}`);
            if (!response.ok) return;

            const data = await response.json();

            // Parse features
            if (data.features) {
                for (const f of data.features) { // Changed to for...of to allow await inside
                    // Check geometry type
                    if (f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')) {
                        const coords = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates; // GeoJSON is always lng, lat
                        const [lng, lat] = coords;

                        let type: NavPoint['type'] = 'airport';
                        let name = f.properties?.name || f.id;
                        let icao = f.properties?.icao || '';
                        let magneticVariation: number | undefined = undefined;

                        // Specific property checking
                        if (layerName === 'ICA:airport') {
                            name = f.properties?.nome || name;
                            icao = f.properties?.localidade_id || icao;
                            // WFS for ICA:airport often doesn't have magvariati.
                            // We'll try to get it from Gemini if not present.
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - fetchNavigationData] Airport ${icao} - MagVar from WFS: ${magneticVariation}`);
                            } else if (icao) {
                                console.log(`[NavDataService - fetchNavigationData] Airport ${icao} - MagVar not in WFS, trying Gemini...`);
                                try {
                                    const geminiResult = await searchAerodrome(icao);
                                    if (geminiResult?.magneticVariation !== undefined) {
                                        magneticVariation = geminiResult.magneticVariation;
                                        console.log(`[NavDataService - fetchNavigationData] Airport ${icao} - MagVar from Gemini: ${magneticVariation}`);
                                    } else {
                                        console.warn(`[NavDataService - fetchNavigationData] Airport ${icao} - Gemini returned no magneticVariation.`);
                                    }
                                } catch (geminiError) {
                                    console.error(`[NavDataService - fetchNavigationData] Error fetching magnetic variation from Gemini for ICAO ${icao}:`, geminiError);
                                }
                            }
                        } else if (layerName === 'ICA:waypoint') {
                            type = 'fix';
                            name = f.properties?.ident || f.properties?.nome || name;
                            icao = f.properties?.ident || '';
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - fetchNavigationData] Waypoint ${icao} - MagVar from WFS: ${magneticVariation}`);
                            }
                        } else if (layerName === 'ICA:vor') {
                            type = 'vor';
                            name = f.properties?.nome || f.properties?.ident || name;
                            icao = f.properties?.ident || '';
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - fetchNavigationData] VOR ${icao} - MagVar from WFS: ${magneticVariation}`);
                            }
                        } else if (layerName === 'ICA:ndb') {
                            type = 'ndb';
                            name = f.properties?.nome || f.properties?.ident || name;
                            icao = f.properties?.ident || '';
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - fetchNavigationData] NDB ${icao} - MagVar from WFS: ${magneticVariation}`);
                            }
                        }

                        // Fallback if name is empty
                        if (!name) name = icao || f.id;

                        results.push({
                            id: f.id,
                            type,
                            name,
                            lat,
                            lng,
                            icao,
                            magneticVariation
                        });
                    }
                }

            }

        } catch (error) {
            console.warn(`[NavDataService - fetchNavigationData] Failed to fetch layer ${layerName}`, error);
        }
    };

    await Promise.all(layers.map(l => fetchLayer(l)));

    return results;
};

export const searchNavigationPoints = async (query: string): Promise<NavPoint[]> => {
    if (!query || query.length < 2) return [];

    // Layers to search
    // ICA:airport (Aerodromes)
    // ICA:waypoint (Fixes - e.g., ARURU)
    // ICA:vor (VORs)
    // ICA:ndb (NDBs)
    const layers = ['ICA:airport', 'ICA:waypoint', 'ICA:vor', 'ICA:ndb'];
    const results: NavPoint[] = [];

    // CQL Filter for ICA:airport
    // Properties found: localidade_id (ICAO), nome (Name)
    // Properties for Waypoint/VOR/NDB: ident (Code)

    // We construct a filter that attempts to match ANY of these fields.
    // However, WFS 1.0.0 might error if we query a property that doesn't exist on a specific layer (e.g. querying 'localidade_id' on 'ICA:waypoint').
    // So we need specific filters per layer or a generic strategy.

    // Best strategy: Specific filter per layer loop.

    const fetchLayer = async (layerName: string) => {
        let cql = '';
        const q = query.toLowerCase();

        if (layerName === 'ICA:airport') {
            cql = `strToLowerCase(localidade_id) like '%${q}%' OR strToLowerCase(nome) like '%${q}%'`;
        } else {
            // For Waypoint, VOR, NDB, the key is usually 'ident' or 'nome'
            // Based on debug_waypoint.json: 'ident' exists.
            cql = `strToLowerCase(ident) like '%${q}%'`;
            // Note: 'nome' might not exist on waypoint layer, causing error if queried.
            // If we want to be safe, we just search 'ident' for fix/navaid for now.
            // If they have 'nome', we can add OR strToLowerCase(nome)... but 'ident' is most important for waypoints.
        }

        try {
            const params = new URLSearchParams({
                service: 'WFS',
                version: '1.0.0',
                request: 'GetFeature',
                typeName: layerName,
                outputFormat: 'application/json',
                maxFeatures: '10',
                cql_filter: cql
            });

            const response = await fetch(`${BASE_WFS_URL}?${params.toString()}`);
            if (!response.ok) return;

            const data = await response.json();

            if (data.features) {
                for (const f of data.features) { // Changed to for...of to allow await inside
                    if (f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')) {
                        // Handle MultiPoint
                        const coords = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates;
                        const [lng, lat] = coords;

                        let type: NavPoint['type'] = 'fix'; // Default for non-airport layers here
                        let name = f.properties?.name || f.id;
                        let icao = '';
                        let magneticVariation: number | undefined = undefined;

                        if (layerName === 'ICA:airport') {
                            type = 'airport';
                            name = f.properties?.nome || name;
                            icao = f.properties?.localidade_id || '';
                            // WFS for ICA:airport often doesn't have magvariati.
                            // We'll try to get it from Gemini if not present.
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - searchNavigationPoints] Airport ${icao} - MagVar from WFS: ${magneticVariation}`);
                            } else if (icao) {
                                console.log(`[NavDataService - searchNavigationPoints] Airport ${icao} - MagVar not in WFS, trying Gemini...`);
                                try {
                                    const geminiResult = await searchAerodrome(icao);
                                    if (geminiResult?.magneticVariation !== undefined) {
                                        magneticVariation = geminiResult.magneticVariation;
                                        console.log(`[NavDataService - searchNavigationPoints] Airport ${icao} - MagVar from Gemini: ${magneticVariation}`);
                                    } else {
                                        console.warn(`[NavDataService - searchNavigationPoints] Airport ${icao} - Gemini returned no magneticVariation.`);
                                    }
                                } catch (geminiError) {
                                    console.error(`[NavDataService - searchNavigationPoints] Error fetching magnetic variation from Gemini for ICAO ${icao}:`, geminiError);
                                }
                            }
                        } else if (layerName === 'ICA:waypoint') {
                            type = 'fix';
                            icao = f.properties?.ident || '';
                            // Usually valid fixes don't have separate names, just the 5-letter code.
                            name = icao;
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - searchNavigationPoints] Waypoint ${icao} - MagVar from WFS: ${magneticVariation}`);
                            }
                        } else if (layerName === 'ICA:vor') {
                            type = 'vor';
                            icao = f.properties?.ident || '';
                            name = f.properties?.nome || icao;
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - searchNavigationPoints] VOR ${icao} - MagVar from WFS: ${magneticVariation}`);
                            }
                        } else if (layerName === 'ICA:ndb') {
                            type = 'ndb';
                            icao = f.properties?.ident || '';
                            name = f.properties?.nome || icao;
                            if (f.properties?.magvariati !== undefined) {
                                magneticVariation = parseFloat(f.properties.magvariati);
                                console.log(`[NavDataService - searchNavigationPoints] NDB ${icao} - MagVar from WFS: ${magneticVariation}`);
                            }
                        }

                        // Deduplicate
                        const key = icao || name;
                        if (!results.find(r => (r.icao === key || r.name === key))) {
                            results.push({
                                id: f.id,
                                type,
                                name,
                                lat,
                                lng,
                                icao,
                                magneticVariation
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`[NavDataService - searchNavigationPoints] Search failed for ${layerName}`, error);
        }
    };

    await Promise.all(layers.map(l => fetchLayer(l)));
    return results;
};