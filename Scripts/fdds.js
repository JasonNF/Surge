/**
 * 帆书解锁 - fdds
 * 拦截：myPage / program / course / ebookInfo / book content 响应
 */
(function () {
    'use strict';

    const DEBUG = false;
    const SCRIPT_VERSION = 'v1.8';
    const NOTIFY_TITLE = '帆书-fdds ' + SCRIPT_VERSION;

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

    function isMediaUrl(value) {
        return typeof value === 'string'
            && /^https?:\/\//.test(value)
            && /\.(mp3|m4a|aac|m3u8|mp4)(\?|$)/i.test(value);
    }

    function isTrialMediaUrl(value) {
        return isMediaUrl(value) && /\/(trial|try|preview|sample)\//i.test(value);
    }

    function patchCommonVipFields(node, depth) {
        if (!node || typeof node !== 'object' || depth > 8) return;

        if (Array.isArray(node)) {
            for (const item of node) patchCommonVipFields(item, depth + 1);
            return;
        }

        const boolTrue = ['isVip', 'isVIP', 'hasVip', 'vip', 'feifanVip', 'paid', 'isPaid',
            'hasBought', 'isBought', 'isBuyed', 'unlock', 'unlocked', 'access', 'permission',
            'canRead', 'canWatch', 'canPlay', 'canListen', 'showFlag', 'playFlag', 'listenFlag',
            'trialWatch', 'free', 'vipReading'];
        const boolFalse = ['isTrial', 'freeTrial', 'locked', 'lock', 'needPay', 'needBuy', 'hasSample', 'audition'];
        const expireFields = ['vipExpireTime', 'vipEndTime', 'feifanVipEndTime', 'expireTime', 'expire'];
        const zeroFields = ['originalPrice', 'sellPrice', 'payStatus', 'saleStatus'];

        for (const key of boolTrue) {
            if (node[key] !== undefined) node[key] = true;
        }
        for (const key of boolFalse) {
            if (node[key] !== undefined) node[key] = false;
        }
        for (const key of expireFields) {
            if (node[key] !== undefined) node[key] = '2099-12-31 23:59:59';
        }
        if (node.trial !== undefined) node.trial = false;
        if (node.permissionType !== undefined) node.permissionType = 2;
        if (node.unlockType !== undefined) node.unlockType = 2;
        if (node.vipRemainDay !== undefined) node.vipRemainDay = 9999;
        if (node.vipStatus !== undefined) node.vipStatus = 1;
        if (node.vipType !== undefined) node.vipType = 1;
        for (const key of zeroFields) {
            if (node[key] !== undefined) node[key] = '0';
        }

        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') patchCommonVipFields(value, depth + 1);
        }
    }

    function unlockMyPage(d) {
        if (d.userInfo) {
            d.userInfo.likeCount = 9999;
            d.userInfo.followingCount = 9999;
            d.userInfo.followerCount = 9999;
        }
        patchCommonVipFields(d, 0);
    }

    function unlockProgram(d) {
        if (Array.isArray(d.programList)) {
            for (const item of d.programList) {
                item.free = true;
                item.unlockType = 2;
                item.showFlag = true;
                item.playFlag = true;
                item.listenFlag = true;
                item.hasSample = false;
                item.vipReading = true;
                promoteAudioUrls(item, 0);
            }
        }
        d.free = true;
        d.isBuyed = true;
        patchCommonVipFields(d, 0);
        promoteAudioUrls(d, 0);
    }

    function unlockCourseInfo(d) {
        d.originalPrice = '0';
        d.sellPrice = '0';
        d.hasBought = true;
        if (Array.isArray(d.programList)) {
            for (const item of d.programList) {
                item.permissionType = 2;
                item.trialWatch = true;
                item.canWatch = true;
                item.audition = false;
                promoteAudioUrls(item, 0);
            }
        }
        patchCommonVipFields(d, 0);
        promoteAudioUrls(d, 0);
    }

    function unlockEbookInfo(d) {
        d.payStatus = '0';
        d.saleStatus = '0';
        d.canRead = true;
        d.isBought = true;
        patchCommonVipFields(d, 0);
    }

    function unlockContentNode(node, depth) {
        if (!node || typeof node !== 'object' || depth > 10) return;

        if (Array.isArray(node)) {
            for (const item of node) unlockContentNode(item, depth + 1);
            return;
        }

        const zeroKeys = [
            'trialDuration', 'trialTime', 'durationLimit', 'limitDuration',
            'maxTrialDuration', 'remainTrialTime', 'tryDuration', 'tryTime',
            'lockType', 'authType', 'payStatus', 'saleStatus', 'unlockType'
        ];
        const trueKeys = [
            'canPlay', 'canListen', 'canRead', 'paid', 'purchased', 'hasPermission',
            'allowPlay', 'fullVersion', 'playFlag', 'listenFlag', 'showFlag',
            'free', 'unlocked', 'hasBought', 'isBought', 'isBuyed', 'vipReading'
        ];
        const falseKeys = ['isTrial', 'needPay', 'needBuy', 'locked', 'lockFlag', 'trial', 'hasSample', 'audition'];

        for (const key of zeroKeys) {
            if (node[key] !== undefined) node[key] = 0;
        }
        for (const key of trueKeys) {
            if (node[key] !== undefined) node[key] = true;
        }
        for (const key of falseKeys) {
            if (node[key] !== undefined) node[key] = false;
        }
        if (node.permissionType !== undefined) node.permissionType = 2;
        if (node.status === 'trial' || node.status === 'lock') node.status = 'paid';

        if (node.compBanner !== undefined) delete node.compBanner;

        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') unlockContentNode(value, depth + 1);
        }
    }

    function collectFullMediaUrls(node, depth, bucket) {
        if (!node || typeof node !== 'object' || depth > 16) return;

        if (Array.isArray(node)) {
            for (const item of node) collectFullMediaUrls(item, depth + 1, bucket);
            return;
        }

        for (const key of [
            'fullLink', 'fullAudioUrl', 'fullAudio', 'fullUrl', 'completeUrl',
            'originUrl', 'mediaFullUrl', 'audioFullUrl', 'playFullUrl'
        ]) {
            const value = node[key];
            if (isMediaUrl(value) && !isTrialMediaUrl(value)) bucket.push(value);
        }

        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') collectFullMediaUrls(value, depth + 1, bucket);
        }
    }

    function promoteAudioUrls(node, depth) {
        if (!node || typeof node !== 'object' || depth > 16) return;

        if (Array.isArray(node)) {
            for (const item of node) promoteAudioUrls(item, depth + 1);
            return;
        }

        // 1=试听 2=完整（开放平台约定）
        for (const key of ['type', 'linkType', 'playType', 'resourceType', 'mediaType', 'authType']) {
            if (node[key] === 1) node[key] = 2;
        }
        if (node.businessType === 1) node.businessType = 2;

        const fullDuration = node.fullAudioTime || node.fullVideoTime || node.fullLinkTime
            || node.fullDuration || node.totalDuration || node.duration || node.audioDuration
            || node.mediaDuration;
        const tryDuration = node.tryAudioTime || node.tryVideoTime || node.tryDuration
            || node.trialDuration || node.trialTime;

        for (const key of [
            'trialDuration', 'trialTime', 'tryAudioTime', 'tryVideoTime', 'tryDuration',
            'previewDuration', 'listenDuration', 'limitDuration', 'durationLimit',
            'maxTrialDuration', 'remainTrialTime', 'tryTime'
        ]) {
            if (typeof node[key] === 'number' && node[key] > 0 && node[key] <= 900) {
                node[key] = fullDuration || 999999;
            }
        }

        const fullUrl = node.fullLink || node.fullAudioUrl || node.fullAudio || node.fullUrl
            || node.completeUrl || node.originUrl || node.mediaFullUrl || node.audioFullUrl
            || node.playFullUrl;

        if (fullUrl && typeof fullUrl === 'string' && !isTrialMediaUrl(fullUrl)) {
            for (const key of [
                'url', 'audioUrl', 'playUrl', 'mediaUrl', 'streamUrl', 'src',
                'tryAudio', 'tryVideo', 'trialUrl', 'previewUrl', 'link', 'mp3Url', 'm3u8Url'
            ]) {
                if (node[key] !== undefined) node[key] = fullUrl;
            }
            if (typeof fullDuration === 'number' && fullDuration > 0) {
                node.tryAudioTime = fullDuration;
                node.tryVideoTime = fullDuration;
            }
        } else if (typeof fullDuration === 'number' && typeof tryDuration === 'number'
            && fullDuration > tryDuration && tryDuration > 0 && tryDuration <= 900) {
            // 仅有试听链接时，把 UI 时长拉到完整值（实际音频仍受 CDN 限制）
            node.tryAudioTime = fullDuration;
            node.tryVideoTime = fullDuration;
        }

        node.hasSample = false;
        node.audition = false;
        node.vipReading = true;

        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') promoteAudioUrls(value, depth + 1);
        }
    }

    function applyCollectedFullUrls(root) {
        const bucket = [];
        collectFullMediaUrls(root, 0, bucket);
        if (!bucket.length) return { hasFullLink: false, fullCount: 0, hasTryAudio: false };

        const fullUrl = bucket[0];
        const applyTo = (node, depth) => {
            if (!node || typeof node !== 'object' || depth > 16) return;
            if (Array.isArray(node)) {
                for (const item of node) applyTo(item, depth + 1);
                return;
            }
            for (const key of [
                'url', 'audioUrl', 'playUrl', 'mediaUrl', 'streamUrl', 'src',
                'tryAudio', 'tryVideo', 'trialUrl', 'previewUrl', 'link', 'mp3Url', 'm3u8Url'
            ]) {
                if (isTrialMediaUrl(node[key]) || node[key] === undefined) node[key] = fullUrl;
            }
            for (const value of Object.values(node)) {
                if (value && typeof value === 'object') applyTo(value, depth + 1);
            }
        };
        applyTo(root, 0);
        return { hasFullLink: true, fullCount: bucket.length, hasTryAudio: true };
    }

    function scanMediaDiagnostics(node, depth, stats) {
        if (!node || typeof node !== 'object' || depth > 16) return;

        if (Array.isArray(node)) {
            for (const item of node) scanMediaDiagnostics(item, depth + 1, stats);
            return;
        }

        for (const [key, value] of Object.entries(node)) {
            if (typeof value === 'string' && isMediaUrl(value)) {
                if (isTrialMediaUrl(value) || /try/i.test(key)) stats.tryCount += 1;
                if (/full/i.test(key) || (!isTrialMediaUrl(value) && /\/media\//i.test(value))) stats.fullCount += 1;
            }
        }

        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') scanMediaDiagnostics(value, depth + 1, stats);
        }
    }

    function unlockBookContent(d) {
        if (d.businessType === 1) d.businessType = 2;

        if (d.bookInfo && typeof d.bookInfo === 'object') {
            d.bookInfo.isBought = true;
            d.bookInfo.hasBought = true;
            d.bookInfo.paid = true;
            d.bookInfo.canPlay = true;
            d.bookInfo.canListen = true;
            d.bookInfo.vipReading = true;
            promoteAudioUrls(d.bookInfo, 0);
            unlockContentNode(d.bookInfo, 0);
        }
        if (d.audioInfo && typeof d.audioInfo === 'object') {
            d.audioInfo.canPlay = true;
            d.audioInfo.canListen = true;
            d.audioInfo.isTrial = false;
            d.audioInfo.trial = false;
            d.audioInfo.vipReading = true;
            promoteAudioUrls(d.audioInfo, 0);
            unlockContentNode(d.audioInfo, 0);
        }
        if (Array.isArray(d.bookComponent)) {
            for (const comp of d.bookComponent) {
                promoteAudioUrls(comp, 0);
                unlockContentNode(comp, 0);
                if (comp && comp.compBanner !== undefined) delete comp.compBanner;
            }
        }
        promoteAudioUrls(d, 0);
        unlockContentNode(d, 0);
        patchCommonVipFields(d, 0);
        return applyCollectedFullUrls(d);
    }

    let body = $response.body || '';
    const url = $request.url || '';
    const headers = $response.headers || {};

    try {
        const parsed = parseBody(body, headers);
        const root = parsed.obj;
        const d = root.data !== undefined ? root.data : root;
        let matched = '';
        let mediaStats = null;

        if (/\/homePage\/api\/v\d+\/myPage/.test(url)) {
            unlockMyPage(d);
            matched = 'myPage';
        } else if (/\/smart-orch\/program\/v\d+\/(info|list)/.test(url) || /\/smart-orch\/program(?:\?|$)/.test(url)) {
            unlockProgram(d);
            matched = 'program';
        } else if (/\/smart-orch\/course\/v\d+\/info/.test(url)) {
            unlockCourseInfo(d);
            matched = 'course';
        } else if (/\/ebook\/v\d+\/ebookInfo/.test(url)) {
            unlockEbookInfo(d);
            matched = 'ebook';
        } else if (/\/resource-orchestration-system\/book\/v\d+\/content/.test(url)) {
            mediaStats = unlockBookContent(d);
            matched = 'content-response';
        }

        if (matched) {
            if (root.data !== undefined) root.data = d;
            body = serializeBody(root, parsed.encoded);

            if (DEBUG) {
                const path = (url.split('.com/')[1] || url).substring(0, 100);
                const keys = Object.keys(d).slice(0, 20).join(',');

                console.log('[FanShu-fdds]', matched, path);
                console.log('[FanShu-fdds] format=' + (parsed.encoded ? 'base64' : 'plain'));
                if (keys) console.log('[FanShu-fdds] keys=' + keys);

                if (matched === 'content-response') {
                    const diag = { tryCount: 0, fullCount: 0 };
                    scanMediaDiagnostics(d, 0, diag);
                    const summary = (mediaStats && mediaStats.hasFullLink ? '有fullLink' : '无fullLink')
                        + ' | try=' + diag.tryCount + ' full=' + diag.fullCount;
                    $notification.post('帆书诊断 ' + SCRIPT_VERSION, summary, path);
                    $notification.post('帆书字段 ' + SCRIPT_VERSION, keys || '(empty)', path);
                }

                $notification.post(
                    NOTIFY_TITLE,
                    matched === 'content-response' ? (keys || matched) : matched,
                    (parsed.encoded ? 'base64' : 'plain') + ' | ' + path
                );
            }
        } else if (DEBUG) {
            $notification.post(NOTIFY_TITLE, 'skip', (url.split('.com/')[1] || url).substring(0, 120));
        }
    } catch (e) {
        if (DEBUG) {
            $notification.post(
                NOTIFY_TITLE,
                'ERROR',
                String(e.message || e).substring(0, 180) + ' | ' + (url.split('.com/')[1] || url).substring(0, 80)
            );
        }
    }

    $done({ body });
})();
