export type StatUnit = 'count' | 'duration' | 'distance' | 'health';

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
