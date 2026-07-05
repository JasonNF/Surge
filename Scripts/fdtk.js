/**
 * 帆书解锁 - fdtk
 * 拦截：resource-orchestration-system/book/vXXX/content 请求
 */
(function () {
    'use strict';

    const DEBUG = true;
    const TITLE = '帆书-fdtk';

    // 听书 token；失效时看 DEBUG 通知或 Surge 抓包后更新
    const UNLOCK_TOKEN = '20250621ObJJtQHZpFRmK5uH1Jj';

    function getEncryptionFlag(headers) {
        headers = headers || {};
        const value = headers.reqentryption || headers.reqEntryption || headers.Reqentryption || '';
        return String(value).toLowerCase() === 'base64';
    }

    function decodeBase64(raw) {
        const text = new TextDecoder('utf-8').decode(
            Uint8Array.from(atob(String(raw).replace(/=+$/, '')), (c) => c.charCodeAt(0))
        );
        return JSON.parse(text);
    }

    function encodeBase64(obj) {
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function parseBody(raw, headers) {
        const text = String(raw || '').trim();
        if (!text) throw new Error('empty body');

        if (getEncryptionFlag(headers)) {
            return { obj: decodeBase64(text), encoded: true };
        }
        if (/^[\[{]/.test(text)) {
            return { obj: JSON.parse(text), encoded: false };
        }
        try {
            return { obj: decodeBase64(text), encoded: true };
        } catch (e) {
            return { obj: JSON.parse(text), encoded: false };
        }
    }

    function serializeBody(obj, encoded) {
        return encoded ? encodeBase64(obj) : JSON.stringify(obj);
    }

    let body = $request.body || '';
    const url = $request.url || '';
    const headers = $request.headers || {};

    try {
        if (body && /\/resource-orchestration-system\/book\/v\d+\/content/.test(url)) {
            const parsed = parseBody(body, headers);
            const oldToken = parsed.obj.token;
            parsed.obj.token = UNLOCK_TOKEN;
            body = serializeBody(parsed.obj, parsed.encoded);

            if (DEBUG) {
                $notification.post(
                    TITLE,
                    'token',
                    (parsed.encoded ? 'base64' : 'plain') +
                    ' | old=' + String(oldToken || '').substring(0, 24) +
                    ' | ' + (url.split('.com/')[1] || url).substring(0, 100)
                );
            }
        } else if (DEBUG) {
            $notification.post(TITLE, 'skip', (url.split('.com/')[1] || url).substring(0, 120));
        }
    } catch (e) {
        if (DEBUG) {
            $notification.post(
                TITLE,
                'ERROR',
                String(e.message || e).substring(0, 180) + ' | ' + (url.split('.com/')[1] || url).substring(0, 80)
            );
        }
    }

    $done({ body });
})();
