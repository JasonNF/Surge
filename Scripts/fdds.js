/**
 * 帆书解锁 - fdds 干净可维护版
 * 拦截：myPage / program / course-info / ebookInfo
 *
 * 修复说明（相对旧版）：
 * 1. 响应体为 Base64 编码 JSON，需先解码再回写
 * 2. URL 版本号改为匹配 v100/v101/v102...，不再写死 v100
 * 3. 恢复上游解锁字段逻辑，并补充常见 VIP 字段兜底
 */
(function () {
    'use strict';

    const DEBUG = false;
    const NOTIFY_TITLE = '帆书-fdds';

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

    function patchCommonVipFields(node, depth) {
        if (!node || typeof node !== 'object' || depth > 6) return;

        if (Array.isArray(node)) {
            for (const item of node) patchCommonVipFields(item, depth + 1);
            return;
        }

        const boolTrue = ['isVip', 'isVIP', 'hasVip', 'vip', 'feifanVip', 'paid', 'isPaid',
            'hasBought', 'isBought', 'isBuyed', 'unlock', 'unlocked', 'access', 'permission'];
        const boolFalse = ['trial', 'isTrial', 'freeTrial'];
        const expireFields = ['vipExpireTime', 'vipEndTime', 'feifanVipEndTime', 'expireTime', 'expire'];
        const countFields = ['vipRemainDay', 'remainDays', 'vipStatus', 'vipType', 'vipLevel'];

        for (const key of boolTrue) {
            if (node[key] !== undefined) node[key] = true;
        }
        for (const key of boolFalse) {
            if (node[key] !== undefined) node[key] = false;
        }
        for (const key of expireFields) {
            if (node[key] !== undefined) node[key] = '2099-12-31 23:59:59';
        }
        for (const key of countFields) {
            if (node[key] !== undefined && typeof node[key] === 'number') node[key] = 9999;
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

    function unlockProgramInfo(d) {
        if (Array.isArray(d.programList)) {
            for (const item of d.programList) {
                item.free = true;
                item.trial = true;
                item.unlockType = 2;
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
                item.free = true;
                item.trial = true;
                item.unlock = true;
            }
        }
        patchCommonVipFields(d, 0);
    }

    function unlockEbookInfo(d) {
        d.isBought = true;
        d.free = true;
        d.isBuyed = true;
        patchCommonVipFields(d, 0);
    }

    let body = $response.body || '';
    const url = $request.url || '';

    try {
        const payload = decodeBody(body);
        const root = payload;
        const d = root.data !== undefined ? root.data : root;

        if (/\/homePage\/api\/v\d+\/myPage(?:\?|$|\/)/.test(url)) {
            unlockMyPage(d);
        } else if (/\/smart-orch\/program\/v\d+\/info(?:\?|$|\/)/.test(url)) {
            unlockProgramInfo(d);
        } else if (/\/smart-orch\/course\/v\d+\/info(?:\?|$|\/)/.test(url)) {
            unlockCourseInfo(d);
        } else if (/\/ebook\/v\d+\/ebookInfo(?:\?|$|\/)/.test(url)) {
            unlockEbookInfo(d);
        } else if (/\/smart-orch\/program(?:\?|$|\/)/.test(url)) {
            unlockProgramInfo(d);
        }

        if (root.data !== undefined) root.data = d;
        body = encodeBody(root);

        if (DEBUG) {
            $notification.post(NOTIFY_TITLE, 'OK', url.split('.com/')[1] || url);
        }
    } catch (e) {
        if (DEBUG) {
            $notification.post(NOTIFY_TITLE, 'ERROR', String(e.message || e).substring(0, 200));
        }
    }

    $done({ body });
})();
