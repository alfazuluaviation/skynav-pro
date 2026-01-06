
export interface AircraftType {
    id: string;
    label: string; // e.g. "Cessna 172 Skyhawk"
    speed: number; // Default cruise speed in KT
}

export const commonAircraft: AircraftType[] = [
    { id: 'C152', label: 'Cessna 152', speed: 100 },
    { id: 'C172', label: 'Cessna 172 Skyhawk', speed: 110 },
    { id: 'C182', label: 'Cessna 182 Skylane', speed: 140 },
    { id: 'C206', label: 'Cessna 206 Stationair', speed: 135 },
    { id: 'C208', label: 'Cessna 208 Caravan', speed: 170 },
    { id: 'PA28', label: 'Piper PA-28 Cherokee', speed: 115 },
    { id: 'PA34', label: 'Piper PA-34 Seneca', speed: 165 },
    { id: 'PA46', label: 'Piper Malibu/Mirage', speed: 200 },
    { id: 'SR20', label: 'Cirrus SR20', speed: 155 },
    { id: 'SR22', label: 'Cirrus SR22', speed: 180 },
    { id: 'BE36', label: 'Beechcraft Bonanza G36', speed: 170 },
    { id: 'BE58', label: 'Beechcraft Baron G58', speed: 200 },
    { id: 'DA40', label: 'Diamond DA40 Star', speed: 125 },
    { id: 'DA42', label: 'Diamond DA42 Twin Star', speed: 160 },
    { id: 'RV10', label: 'Van\'s RV-10', speed: 160 },
    { id: 'M20R', label: 'Mooney M20 Ovation', speed: 190 },
];
