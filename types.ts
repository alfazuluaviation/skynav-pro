
export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'AIRPORT' | 'FIX' | 'VOR' | 'USER';
  description?: string;
  icao?: string;
  role?: 'ORIGIN' | 'WAYPOINT' | 'DESTINATION';
}

export interface FlightSegment {
  from: Waypoint;
  to: Waypoint;
  track: number;
  distance: number;
  ete: string;
  fuel: number;
}

export interface FlightStats {
  groundSpeed: number;
  altitude: number;
  heading: number;
  nextWaypointDistance: number | null;
  ete: string | null;
}

export type BaseMapType = 'DARK' | 'LIGHT' | 'TERRAIN' | 'SATELLITE' | 'CLEAN_SATELLITE' | 'WAC' | 'REA' | 'ARC' | 'REH' | 'REUL';

export interface AiracCycle {
  current: string;
  effectiveDate: string;
  expiryDate: string;
  nextCycleDate: string;
  status: 'CURRENT' | 'OUTDATED' | 'UPCOMING';
}

export interface ChartConfig {
  id: string;
  name: string;
  shortName: string;
  type: 'OVERLAY' | 'ENRC_LOW' | 'ENRC_HIGH' | 'WAC' | 'REA' | 'ARC' | 'REH' | 'REUL';
  thumbnail: string;
  bounds?: [[number, number], [number, number]];
  lastSync?: string;
  cycle?: string;
}

export interface SavedPlan {
  name: string;
  date: string;
  waypoints: Waypoint[];
  aircraft: { id: string, label: string, speed: number };
  speed: number;
}
