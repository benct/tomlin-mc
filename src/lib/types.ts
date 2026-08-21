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
