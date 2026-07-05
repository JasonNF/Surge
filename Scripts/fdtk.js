/**
 * 帆书解锁 - fdtk
 * 拦截：resource-orchestration-system/book/vXXX/content(/part) 请求
 */
(function () {
    'use strict';

    const DEBUG = false;
    const SCRIPT_VERSION = 'v1.8';
    const TITLE = '帆书-fdtk ' + SCRIPT_VERSION;

    // token 模式：
    // 0 = 保留客户端 token（默认，不会破坏播放）
    // 1 = 注入下方 PUBLIC_TOKEN（公开 token，2025-06-21 后通常已过期）
    // 2 = 注入 CUSTOM_TOKEN（请填入有效 VIP token，听书完整版关键）
    const TOKEN_MODE = 0;
    const PUBLIC_TOKEN = '20250621ObJJtQHZpFRmK5uH1Jj';
    // 填入有效 VIP token 后，将 TOKEN_MODE 改为 2
    const CUSTOM_TOKEN = '';

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

    function resolveUnlockToken() {
        if (TOKEN_MODE === 2 && CUSTOM_TOKEN) return CUSTOM_TOKEN;
        if (TOKEN_MODE === 1 && PUBLIC_TOKEN) return PUBLIC_TOKEN;
        return '';
    }

    function unlockRequestPayload(obj) {
        obj.isTrial = false;
        obj.trial = false;
        obj.isVip = true;
        obj.vip = true;
        obj.hasPermission = true;
        obj.unlock = true;
        obj.paid = true;
        if (obj.businessType === 1) obj.businessType = 2;

        const unlockToken = resolveUnlockToken();
        if (unlockToken) obj.token = unlockToken;
    }

    let body = $request.body || '';
    const url = $request.url || '';
    const headers = $request.headers || {};

    try {
        if (body && /\/resource-orchestration-system\/book\/v\d+\/content/.test(url)) {
            const parsed = parseBody(body, headers);
            const oldToken = parsed.obj.token || '';
            unlockRequestPayload(parsed.obj);
            body = serializeBody(parsed.obj, parsed.encoded);

            if (DEBUG) {
                const unlockToken = resolveUnlockToken();
                let modeLabel = '保留token';
                if (TOKEN_MODE === 1) modeLabel = unlockToken ? '公开token' : '公开token(空)';
                if (TOKEN_MODE === 2) modeLabel = unlockToken ? '自定义token' : '自定义token(未填)';

                $notification.post(
                    TITLE,
                    modeLabel,
                    (unlockToken || oldToken || '(empty)').substring(0, 28)
                );
            }
        }
    } catch (e) {
        if (DEBUG) {
            $notification.post(TITLE, 'ERROR', String(e.message || e).substring(0, 180));
        }
    }

    $done({ body });
})();
