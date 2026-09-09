import useSWR from 'swr';

const REFRESH_MS = 30_000;

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

const fetcher = (url: string) =>
    fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json() as Promise<ServerStatus>;
    });

export const useServerStatus = () =>
    useSWR<ServerStatus>('/api/status', fetcher, {
        refreshInterval: REFRESH_MS,
        revalidateOnFocus: true,
    });
