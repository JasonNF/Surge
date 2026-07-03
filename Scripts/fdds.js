/**
 * 帆书解锁 - fdds 干净可维护版
 * 拦截：myPage / program / course-info / ebookInfo
 *
 * 【使用方法】
 *   1. DEBUG=true 时，脚本会把响应体里的 VIP 相关字段推送到通知
 *   2. 先看通知，确认字段名，然后修改下方 CONFIG 区
 *   3. 修改完后设 DEBUG=false，或保持 DEBUG=true 观察是否修改成功
 *
 * 【CONFIG 区】—— 根据实际响应体结构填写字段名
 *   VIP_FIELD    = 表示"已VIP"的布尔字段名（如 isVip）
 *   EXPIRE_FIELD = VIP到期时间字段名（如 vipExpireTime）
 *   TRIAL_FIELD = 试用/试听限制字段名（如 isTrial）
 *   如果不填或填错，脚本会在通知里提示"未找到字段"
 */
(function () {
    'use strict';

    const DEBUG       = true;
    const NOTIFY_TITLE = '帆书-fdds';

    // ===== 在这里填实际的字段名（看完调试通知再改）=====
    const VIP_FIELD    = '';   // 例：'isVip'
    const EXPIRE_FIELD = '';   // 例：'vipExpireTime'
    const TRIAL_FIELD  = '';   // 例：'isTrial'
    // ================================================================

    let body = $response.body || '';
    let url  = $request.url  || '';
    let api  = url.includes('myPage') ? 'myPage'
               : url.includes('program') ? 'program'
               : url.includes('course') ? 'course-info'
               : 'ebookInfo';

    try {
        let data = JSON.parse(body);
        let d    = data.data || data;
        let info = '';

        if (DEBUG) {
            // 扫一遍常见 VIP 字段，打印实际值
            let candidates = ['isVip','vip','isVIP','hasVip','vipType',
                           'vipExpireTime','expireTime','expire',
                           'subscribe','isSubscribe','paid','isPaid',
                           'unlock','unlocked','access','permission',
                           'trial','isTrial','isFree','freeTrial'];
            let found = [];
            for (let f of candidates) {
                if (d[f] !== undefined) found.push(f + '=' + JSON.stringify(d[f]));
            }
            if (found.length) {
                info = '找到字段: ' + found.join(' | ');
            } else {
                // 没找到候选字段，打印 data 前 300 字符
                info = '未找到VIP字段! data.sample=' + JSON.stringify(d).substring(0, 300);
            }
            $notification.post(NOTIFY_TITLE, api, info.substring(0, 500));
        }

        // ===== 解锁逻辑 =====
        let changed = [];
        if (VIP_FIELD && d[VIP_FIELD] !== undefined) {
            d[VIP_FIELD] = true;
            changed.push(VIP_FIELD + '=true');
        }
        if (EXPIRE_FIELD && d[EXPIRE_FIELD] !== undefined) {
            d[EXPIRE_FIELD] = '2099-12-31 00:00:00';
            changed.push(EXPIRE_FIELD + '=2099-12-31');
        }
        if (TRIAL_FIELD && d[TRIAL_FIELD] !== undefined) {
            d[TRIAL_FIELD] = false;
            changed.push(TRIAL_FIELD + '=false');
        }

        // 如果 data 是数组（program 接口可能返回列表）
        if (Array.isArray(d)) {
            for (let item of d) {
                if (VIP_FIELD && item[VIP_FIELD] !== undefined) { item[VIP_FIELD] = true; changed.push('[数组]' + VIP_FIELD); }
                if (TRIAL_FIELD && item[TRIAL_FIELD] !== undefined) { item[TRIAL_FIELD] = false; changed.push('[数组]' + TRIAL_FIELD); }
            }
        }

        if (DEBUG && changed.length) {
            $notification.post(NOTIFY_TITLE, api + '[已解锁]', changed.join(' | '));
        }

        if (data.data) { data.data = d; } else { data = d; }
        body = JSON.stringify(data);

    } catch (e) {
        if (DEBUG) {
            $notification.post(NOTIFY_TITLE, api + '[ERROR]', e.message.substring(0, 200));
        }
    }

    $done({ body: body });
})();
