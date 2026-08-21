/** Flatten a chat-component MOTD (or legacy string) into plain text lines. */
export const flattenMotd = (description: unknown): string[] => {
    const collect = (node: unknown): string => {
        if (node == null) return '';
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(collect).join('');
        if (typeof node === 'object') {
            const obj = node as { text?: string; extra?: unknown };
            return (obj.text ?? '') + (obj.extra ? collect(obj.extra) : '');
        }
        return '';
    };
    // Strip Minecraft "§x" color/format codes, then split into lines.
    return collect(description)
        .replace(/§[0-9a-fk-or]/gi, '')
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0);
};
