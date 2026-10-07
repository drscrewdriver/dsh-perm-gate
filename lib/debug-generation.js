export const DEBUG_GENERATION_ROUTE = '/api/dsh-perm-gate/debug-generation';
export function registerDebugGenerationRoute(server, getSettingsSvc) {
    if (typeof server !== 'object' || server === null)
        return undefined;
    const ws = typeof server.register === 'function' ? server : undefined;
    if (ws === undefined || typeof ws.register !== 'function')
        return undefined;
    return ws.register({
        kind: 'exact',
        path: DEBUG_GENERATION_ROUTE,
        handler: (rawReq, rawRes) => {
            const req = rawReq;
            const res = rawRes;
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                res.writeHead(405);
                res.end();
                return;
            }
            const svc = getSettingsSvc();
            let namespaces = [];
            let describeError;
            if (svc !== undefined && typeof svc.describe === 'function') {
                try {
                    const descriptors = svc.describe();
                    namespaces = descriptors.map((d) => String(d.ns));
                }
                catch (e) {
                    describeError = e instanceof Error ? e.message : String(e);
                }
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                hasSvc: svc !== undefined,
                describeError,
                namespaces,
                methods: svc === undefined ? null : {
                    register: typeof svc.register === 'function',
                    installSection: typeof svc.installSection === 'function',
                    update: typeof svc.update === 'function',
                },
            }, null, 2));
        },
    });
}
