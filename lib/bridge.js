export const BRIDGE_DESCRIBE_ROUTE = '/api/dsh-perm-gate/settings/describe';
export const BRIDGE_MUTATE_ROUTE = '/api/dsh-perm-gate/settings/mutate';
function readJsonBody(reqRaw, limit = 256 * 1024) {
    const req = reqRaw;
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            const buf = chunk;
            size += buf.length;
            if (size > limit) {
                reject(new Error('bridge body too large'));
                req.resume?.();
                return;
            }
            chunks.push(buf);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (raw === '') {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            }
            catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
            }
        });
        req.on('error', reject);
    });
}
function sendJson(res, code, body) {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' });
    res.end(JSON.stringify(body));
}
function isConflict(e) {
    return e instanceof Error && /conflict|revision/i.test(e.message);
}
export function registerSettingsBridgeRoutes(server, getSettingsSvc, ns) {
    if (typeof server !== 'object' || server === null)
        return [];
    const ws = typeof server.register === 'function' ? server : undefined;
    if (ws === undefined)
        return [];
    const offs = [];
    offs.push(ws.register({
        kind: 'exact',
        path: BRIDGE_DESCRIBE_ROUTE,
        handler: (rawReq, rawRes) => {
            const req = rawReq;
            const res = rawRes;
            if (req.method !== 'POST') {
                sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
                return;
            }
            const svc = getSettingsSvc();
            if (svc === undefined || typeof svc.describe !== 'function') {
                sendJson(res, 200, { ok: false, code: 'settings-unavailable', message: 'settings service not resolved yet' });
                return;
            }
            try {
                const descriptor = svc
                    .describe({ redactSecrets: true })
                    .find((d) => d.ns === ns);
                if (descriptor === undefined) {
                    sendJson(res, 200, { ok: false, code: 'ns-not-registered', message: `settings namespace "${ns}" is not registered` });
                    return;
                }
                sendJson(res, 200, { ok: true, value: { descriptor, writable: svc.writable !== false } });
            }
            catch (e) {
                sendJson(res, 200, { ok: false, code: 'internal', message: e instanceof Error ? e.message : String(e) });
            }
        },
    }));
    offs.push(ws.register({
        kind: 'exact',
        path: BRIDGE_MUTATE_ROUTE,
        handler: (rawReq, rawRes) => {
            const req = rawReq;
            const res = rawRes;
            if (req.method !== 'POST') {
                sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
                return;
            }
            const svc = getSettingsSvc();
            const mutate = svc === undefined ? undefined : svc.mutate;
            if (typeof mutate !== 'function') {
                sendJson(res, 200, { ok: false, code: 'settings-unavailable', message: 'settings service mutate not available' });
                return;
            }
            readJsonBody(req).then((body) => {
                const ops = body.ops;
                if (!Array.isArray(ops) || ops.some((op) => !op || typeof op !== 'object' || !(op.op in { set: 1, unset: 1 }))) {
                    sendJson(res, 200, { ok: false, code: 'settings-rejected', message: 'malformed bridge mutate ops' });
                    return;
                }
                const expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined;
                mutate
                    .call(svc, ns, ops, expectedRevision)
                    .then(() => {
                    // mutate 成功即 describe 回填（规范：写路径仍归口宿主服务，无第二份状态）
                    const descriptor = svc
                        .describe({ redactSecrets: true })
                        .find((d) => d.ns === ns);
                    if (descriptor === undefined) {
                        sendJson(res, 200, { ok: false, code: 'internal', message: `namespace "${ns}" disposed after mutate` });
                        return;
                    }
                    sendJson(res, 200, { ok: true, value: { descriptor } });
                })
                    .catch((e) => {
                    sendJson(res, 200, isConflict(e)
                        ? { ok: false, code: 'settings-conflict', message: e instanceof Error ? e.message : String(e) }
                        : { ok: false, code: 'internal', message: e instanceof Error ? e.message : String(e) });
                });
            }).catch((e) => {
                sendJson(res, 200, { ok: false, code: 'bad-request', message: e instanceof Error ? e.message : String(e) });
            });
        },
    }));
    return offs;
}
