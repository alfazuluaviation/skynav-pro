
export interface AircraftType {
    id: string;
    label: string; // e.g. "Cessna 172 Skyhawk"
    speed: number; // Default cruise speed in KT
}

// User's saved aircraft with additional info
export interface UserAircraft extends AircraftType {
    registration: string; // e.g. "PT-ABC"
    fuelConsumption?: number; // L/h or Gal/h
    notes?: string;
}

// Master list of aircraft models for search
export const commonAircraft: AircraftType[] = [
    { id: 'C152', label: 'Cessna 152', speed: 100 },
    { id: 'C172', label: 'Cessna 172 Skyhawk', speed: 110 },
    { id: 'C182', label: 'Cessna 182 Skylane', speed: 140 },
    { id: 'C206', label: 'Cessna 206 Stationair', speed: 135 },
    { id: 'C208', label: 'Cessna 208 Caravan', speed: 170 },
    { id: 'PA28', label: 'Piper PA-28 Cherokee', speed: 115 },
    { id: 'PA34', label: 'Piper PA-34 Seneca', speed: 165 },
    { id: 'PA44', label: 'Piper PA-44 Seminole', speed: 160 },
    { id: 'PA46', label: 'Piper Malibu/Mirage', speed: 200 },
    { id: 'SR20', label: 'Cirrus SR20', speed: 155 },
    { id: 'SR22', label: 'Cirrus SR22', speed: 180 },
    { id: 'BE33', label: 'Beechcraft Debonair', speed: 165 },
    { id: 'BE35', label: 'Beechcraft Bonanza V35', speed: 170 },
    { id: 'BE36', label: 'Beechcraft Bonanza G36', speed: 175 },
    { id: 'BE55', label: 'Beechcraft Baron 55', speed: 190 },
    { id: 'BE58', label: 'Beechcraft Baron G58', speed: 200 },
    { id: 'BE9L', label: 'Beechcraft King Air 90', speed: 220 },
    { id: 'BE20', label: 'Beechcraft King Air 200', speed: 270 },
    { id: 'BE30', label: 'Beechcraft King Air 350', speed: 300 },
    { id: 'B190', label: 'Beechcraft 1900C', speed: 280 },
    { id: 'B19D', label: 'Beechcraft 1900D', speed: 285 },
    { id: 'DA40', label: 'Diamond DA40 Star', speed: 125 },
    { id: 'DA42', label: 'Diamond DA42 Twin Star', speed: 160 },
    { id: 'DA62', label: 'Diamond DA62', speed: 180 },
    { id: 'RV10', label: "Van's RV-10", speed: 160 },
    { id: 'RV7', label: "Van's RV-7", speed: 180 },
    { id: 'M20R', label: 'Mooney M20 Ovation', speed: 190 },
    { id: 'M20V', label: 'Mooney Acclaim Ultra', speed: 210 },
    { id: 'P28A', label: 'Piper Cherokee 180', speed: 120 },
    { id: 'P28R', label: 'Piper Arrow', speed: 145 },
    { id: 'P32R', label: 'Piper Saratoga', speed: 165 },
    { id: 'C310', label: 'Cessna 310', speed: 190 },
    { id: 'C340', label: 'Cessna 340', speed: 210 },
    { id: 'C402', label: 'Cessna 402', speed: 195 },
    { id: 'C414', label: 'Cessna 414 Chancellor', speed: 225 },
    { id: 'C421', label: 'Cessna 421 Golden Eagle', speed: 230 },
    { id: 'C425', label: 'Cessna Conquest I', speed: 260 },
    { id: 'C441', label: 'Cessna Conquest II', speed: 295 },
    { id: 'C525', label: 'Cessna CJ1', speed: 380 },
    { id: 'C52A', label: 'Cessna CJ2', speed: 400 },
    { id: 'C56X', label: 'Cessna Citation Excel', speed: 430 },
    { id: 'E50P', label: 'Embraer Phenom 100', speed: 380 },
    { id: 'E55P', label: 'Embraer Phenom 300', speed: 450 },
    { id: 'E545', label: 'Embraer Legacy 450', speed: 465 },
    { id: 'E35L', label: 'Embraer Legacy 650', speed: 480 },
    { id: 'PC12', label: 'Pilatus PC-12', speed: 270 },
    { id: 'PC24', label: 'Pilatus PC-24', speed: 430 },
    { id: 'TBM7', label: 'TBM 700', speed: 285 },
    { id: 'TBM9', label: 'TBM 900/910/940', speed: 330 },
    { id: 'T206', label: 'Cessna T206H Turbo Stationair', speed: 155 },
    { id: 'P46T', label: 'Piper Meridian', speed: 260 },
    { id: 'AEST', label: 'Neiva Ipanema', speed: 95 },
    { id: 'EMB7', label: 'Embraer EMB-711 Corisco', speed: 145 },
    { id: 'EMB5', label: 'Embraer EMB-720 Minuano', speed: 175 },
    { id: 'EMB8', label: 'Embraer EMB-810 Seneca II', speed: 170 },
    { id: 'EMB1', label: 'Embraer EMB-110 Bandeirante', speed: 210 },
    { id: 'EMB2', label: 'Embraer EMB-120 Brasília', speed: 300 },
];

const USER_AIRCRAFT_KEY = 'skyfpl_user_aircraft';

export function loadUserAircraft(): UserAircraft[] {
    try {
        const data = localStorage.getItem(USER_AIRCRAFT_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveUserAircraft(aircraft: UserAircraft[]): void {
    localStorage.setItem(USER_AIRCRAFT_KEY, JSON.stringify(aircraft));
}

export function addUserAircraft(aircraft: UserAircraft): UserAircraft[] {
    const current = loadUserAircraft();
    const updated = [...current, aircraft];
    saveUserAircraft(updated);
    return updated;
}

export function removeUserAircraft(registration: string): UserAircraft[] {
    const current = loadUserAircraft();
    const updated = current.filter(a => a.registration !== registration);
    saveUserAircraft(updated);
    return updated;
}
