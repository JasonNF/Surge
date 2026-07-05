/**
 * 帆书解锁 - fdds
 * 拦截：myPage / program / course / ebookInfo / book content 响应
 */
(function () {
    'use strict';

    const DEBUG = true;
    const SCRIPT_VERSION = 'v1.6';
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

    function patchCommonVipFields(node, depth) {
        if (!node || typeof node !== 'object' || depth > 8) return;

        if (Array.isArray(node)) {
            for (const item of node) patchCommonVipFields(item, depth + 1);
            return;
        }

        const boolTrue = ['isVip', 'isVIP', 'hasVip', 'vip', 'feifanVip', 'paid', 'isPaid',
            'hasBought', 'isBought', 'isBuyed', 'unlock', 'unlocked', 'access', 'permission',
            'canRead', 'canWatch', 'canPlay', 'canListen', 'showFlag', 'playFlag', 'listenFlag',
            'trialWatch', 'free'];
        const boolFalse = ['isTrial', 'freeTrial', 'locked', 'lock', 'needPay', 'needBuy'];
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
            }
        }
        d.free = true;
        d.isBuyed = true;
        patchCommonVipFields(d, 0);
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
            }
        }
        patchCommonVipFields(d, 0);
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
            'free', 'unlocked', 'hasBought', 'isBought', 'isBuyed'
        ];
        const falseKeys = ['isTrial', 'needPay', 'needBuy', 'locked', 'lockFlag', 'trial'];

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

    function unlockBookContent(d) {
        if (d.bookInfo && typeof d.bookInfo === 'object') {
            d.bookInfo.isBought = true;
            d.bookInfo.hasBought = true;
            d.bookInfo.paid = true;
            d.bookInfo.canPlay = true;
            d.bookInfo.canListen = true;
            unlockContentNode(d.bookInfo, 0);
        }
        if (d.audioInfo && typeof d.audioInfo === 'object') {
            d.audioInfo.canPlay = true;
            d.audioInfo.canListen = true;
            d.audioInfo.isTrial = false;
            d.audioInfo.trial = false;
            if (d.audioInfo.trialDuration !== undefined) d.audioInfo.trialDuration = 999999;
            if (d.audioInfo.durationLimit !== undefined) d.audioInfo.durationLimit = 0;
            unlockContentNode(d.audioInfo, 0);
        }
        if (Array.isArray(d.bookComponent)) {
            for (const comp of d.bookComponent) {
                unlockContentNode(comp, 0);
                if (comp && comp.compBanner !== undefined) delete comp.compBanner;
            }
        }
        unlockContentNode(d, 0);
        patchCommonVipFields(d, 0);
    }

    let body = $response.body || '';
    const url = $request.url || '';
    const headers = $response.headers || {};

    try {
        const parsed = parseBody(body, headers);
        const root = parsed.obj;
        const d = root.data !== undefined ? root.data : root;
        let matched = '';

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
            unlockBookContent(d);
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
