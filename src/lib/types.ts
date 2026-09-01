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
    /** The value as a fraction (0–1) of the leader's, used for the bar length. */
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

export type ServerEventType = 'join' | 'leave' | 'death' | 'advancement';

export interface ServerEvent {
    id: string;
    type: ServerEventType;
    timestamp: number;
    player: string;
    text: string;
}

export interface ServerStatus {
    hostname: string;
    port: number;
    online: boolean;
    version: string | null;
    gametype: string | null;
    motd: string[];
    icon: string | null;
    players: {
        online: number;
        max: number;
        list: string[];
    };
    timestamp: number;
}
