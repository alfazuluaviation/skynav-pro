
export interface EnrcSegment {
    id: string;
    type: 'HIGH' | 'LOW';
    name: string;
}

export const ENRC_SEGMENTS: EnrcSegment[] = [
    // ENRC HIGH
    { id: 'H1', type: 'HIGH', name: 'H1 - Sul' },
    { id: 'H2', type: 'HIGH', name: 'H2 - Sudeste' },
    { id: 'H3', type: 'HIGH', name: 'H3 - Leste' },
    { id: 'H4', type: 'HIGH', name: 'H4 - Centro-Oeste' },
    { id: 'H5', type: 'HIGH', name: 'H5 - Norte' },
    { id: 'H6', type: 'HIGH', name: 'H6 - Nordeste' },
    { id: 'H7', type: 'HIGH', name: 'H7 - Amazônia' },
    { id: 'H8', type: 'HIGH', name: 'H8 - Noroeste' },
    { id: 'H9', type: 'HIGH', name: 'H9 - Brasil Central' },

    // ENRC LOW
    { id: 'L1', type: 'LOW', name: 'L1 - Sul' },
    { id: 'L2', type: 'LOW', name: 'L2 - Sudeste' },
    { id: 'L3', type: 'LOW', name: 'L3 - Leste' },
    { id: 'L4', type: 'LOW', name: 'L4 - Centro-Oeste' },
    { id: 'L5', type: 'LOW', name: 'L5 - Norte' },
    { id: 'L6', type: 'LOW', name: 'L6 - Nordeste' },
    { id: 'L7', type: 'LOW', name: 'L7 - Amazônia' },
    { id: 'L8', type: 'LOW', name: 'L8 - Noroeste' },
    { id: 'L9', type: 'LOW', name: 'L9 - Brasil Central' },

    // REA
    { id: 'REA', type: 'LOW', name: 'REA - Visual' }
];
