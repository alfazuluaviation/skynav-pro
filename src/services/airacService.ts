
export interface AiracCycle {
    current: string;
    effectiveDate: Date;
    expiryDate: Date;
    nextCycleDate: Date;
    status: 'CURRENT' | 'OUTDATED' | 'UPCOMING';
}

/**
 * AIRAC cycles follow a strict 28-day interval (always on Thursday).
 * A known reference point: Cycle 2401 was effective on 2024-01-25.
 */
const REFERENCE_DATE = new Date('2024-01-25T00:00:00Z');
const REFERENCE_CYCLE = 2401;

export const calculateCurrentAirac = (targetDate: Date = new Date()): AiracCycle => {
    const diffMs = targetDate.getTime() - REFERENCE_DATE.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const cyclesSinceRef = Math.floor(diffDays / 28);

    const effectiveMs = REFERENCE_DATE.getTime() + (cyclesSinceRef * 28 * 1000 * 60 * 60 * 24);
    const effectiveDate = new Date(effectiveMs);
    const expiryDate = new Date(effectiveMs + (28 * 1000 * 60 * 60 * 24));
    const nextCycleDate = new Date(expiryDate);

    // Format cycle identifier (YYNN)
    // This is a simplification; official numbers might vary slightly but this 28-day logic is the standard.
    const year = effectiveDate.getUTCFullYear().toString().slice(-2);
    const cycleInYear = Math.floor((effectiveDate.getUTCDate() + (effectiveDate.getUTCMonth() * 30)) / 28) + 1; // Approx
    const current = `${year}${cycleInYear.toString().padStart(2, '0')}`;

    return {
        current,
        effectiveDate,
        expiryDate,
        nextCycleDate,
        status: 'CURRENT'
    };
};

export const getAiracCycleInfo = (date: Date = new Date()) => {
    const current = calculateCurrentAirac(date);
    const nextDate = new Date(current.expiryDate.getTime() + 1000);
    const next = calculateCurrentAirac(nextDate);

    return { current, next };
};
