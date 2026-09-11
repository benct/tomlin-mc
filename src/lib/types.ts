export type StatUnit = 'count' | 'duration' | 'distance' | 'health' | 'playtime';

export interface PlayerStats {
    uuid: string;
    name: string;
    custom: Record<string, number>;
    totals: Record<string, number>;
    advancements: number;
    recipes: number;
}

export interface LeaderboardEntry {
    uuid: string;
    name: string;
    value: number;
    share: number;
}

export interface Leaderboard {
    id: string;
    label: string;
    unit: StatUnit;
    entries: LeaderboardEntry[];
}

export interface LeaderboardGroup {
    title: string;
    boards: Leaderboard[];
}

export interface ServerStats {
    players: PlayerStats[];
    groups: LeaderboardGroup[];
    totals: {
        playTime: number;
        advancements: number;
        mined: number;
        mobKills: number;
        deaths: number;
    };
    untracked: string[];
}

export type AdvancementFrame = 'task' | 'goal' | 'challenge';

export interface Advancement {
    id: string;
    category: string;
    title: string;
    description: string;
    frame: AdvancementFrame;
    hidden?: boolean;
    icon?: string;
    requirements: string[][];
    steps?: string[];
}

export interface AdvancementStep {
    name: string;
    done: boolean;
}

export interface PlayerAdvancement extends Omit<Advancement, 'requirements' | 'steps'> {
    done: boolean;
    have: number;
    need: number;
    completedAt: number | null;
    checklist: AdvancementStep[];
}

export interface AdvancementCategory {
    key: string;
    title: string;
    done: number;
    total: number;
    entries: PlayerAdvancement[];
}

export interface AdvancementProgress {
    done: number;
    total: number;
    recipes: number;
    categories: AdvancementCategory[];
}

export interface StatRow {
    key: string;
    label: string;
    unit: StatUnit;
    value: number;
}

export interface StatSection {
    title: string;
    rows: StatRow[];
}

export interface BreakdownEntry {
    id: string;
    name: string;
    value: number;
    share: number;
}

export interface Breakdown {
    key: string;
    title: string;
    note: string;
    total: number;
    entries: BreakdownEntry[];
}

export type LogType = 'advancement' | 'death' | 'chat' | 'server' | 'join' | 'leave' | 'warn' | 'error';

export const LOG_FILTERS: readonly { key: string; label: string; types: LogType[] }[] = [
    { key: 'advancement', label: 'Advancement', types: ['advancement'] },
    { key: 'death', label: 'Death', types: ['death'] },
    { key: 'chat', label: 'Chat', types: ['chat'] },
    { key: 'server', label: 'Server', types: ['server'] },
    { key: 'connection', label: 'Connection', types: ['join', 'leave'] },
    { key: 'warn', label: 'Warning', types: ['warn'] },
    { key: 'error', label: 'Error', types: ['error'] },
];

export interface LogEntry {
    id: string;
    type: LogType;
    timestamp: number;
    player?: string;
    text: string;
}
