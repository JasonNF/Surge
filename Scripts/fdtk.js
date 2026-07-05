/**
 * 帆书解锁 - fdtk 干净可维护版
 * 拦截：resource-orchestration-system/book/vXXX/content
 *
 * 修复说明（相对旧版）：
 * 1. 请求体为 Base64 编码 JSON，需先解码再回写
 * 2. URL 版本号改为匹配 v101/v102...，不再写死 v101
 * 3. 匹配 /content 而非 /content/part（与上游一致）
 */
(function () {
    'use strict';

    const DEBUG = false;
    const TITLE = '帆书-fdtk';

    // 听书/正文解锁 token；若失效可在通知里抓包后更新
    const UNLOCK_TOKEN = '20250621ObJJtQHZpFRmK5uH1Jj';

    function decodeBody(raw) {
        const text = new TextDecoder('utf-8').decode(
            Uint8Array.from(atob(String(raw).replace(/=+$/, '')), (c) => c.charCodeAt(0))
        );
        return JSON.parse(text);
    }

    function encodeBody(obj) {
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    let body = $request.body || '';
    const url = $request.url || '';

    try {
        if (body && /\/resource-orchestration-system\/book\/v\d+\/content/.test(url)) {
            const payload = decodeBody(body);
            payload.token = UNLOCK_TOKEN;
            body = encodeBody(payload);

            if (DEBUG) {
                $notification.post(TITLE, 'OK', 'token updated');
            }
        }
    } catch (e) {
        if (DEBUG) {
            $notification.post(TITLE, 'ERROR', String(e.message || e).substring(0, 200));
        }
    }

    $done({ body });
})();
