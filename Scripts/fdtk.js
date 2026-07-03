/**
 * 帆书解锁 - fdtk 干净可维护版
 * 拦截：resource-orchestration-system/book/v101/content/part
 * 功能：修改请求参数或响应体，解锁听书/音频内容
 *
 * 【使用方法】
 *   1. DEBUG=true 时，推送请求参数到通知
 *   2. 看完通知，确认是「请求参数」还是「响应体」里控制权限
 *   3. 如果是请求参数里有限制字段 → 改下方 CONFIG 区
 *   4. 如果是响应体里有限制字段 → 把 TYPE 改为 http-response，再改 CONFIG
 *
 * 【重要】本脚本当前为 http-request 类型（拦截客户端发出的请求）
 *   如果权限控制在服务端响应里，把下面 [Script] 段里的
 *   type=http-request 改为 type=http-response，并取消响应体解析的注释
 */
(function () {
    'use strict';

    const DEBUG  = true;
    const TITLE = '帆书-fdtk';

    // ===== CONFIG 区（根据实际抓包结果填写）=====
    // 请求体（body）中控制试听/解锁的字段名
    const TRIAL_FIELD  = '';   // 例：'trial' 或 'isTrial'
    const LIMIT_FIELD  = '';   // 例：'limit' 或 'duration'
    const UNLOCK_FIELD = '';   // 例：'unlocked' 或 'paid'
    // =======================================================

    let url    = $request.url     || '';
    let method = $request.method    || '';
    let body   = $request.body    || '';   // http-request 时：客户端发出的请求体
    let headers = $request.headers || {};

    try {
        if (DEBUG) {
            let info = 'method=' + method;
            if (body) {
                try {
                    let d = JSON.parse(body);
                    let keys = Object.keys(d).join(', ');
                    info += ' | body.keys: ' + keys;
                    for (let k of ['bookId','chapterId','partId','trial','isTrial','limit','duration','audioUrl','expire','expireTime']) {
                        if (d[k] !== undefined) info += ' | ' + k + '=' + d[k];
                    }
                } catch (e) {
                    info += ' | body(raw): ' + body.substring(0, 120);
                }
            }
            if (url.includes('?')) {
                info += ' | query: ' + url.split('?')[1].substring(0, 120);
            }
            $notification.post(TITLE, 'REQUEST', info.substring(0, 500));
        }

        // ===== 解锁逻辑（请求体模式）=====
        if (body) {
            try {
                let d = JSON.parse(body);
                let changed = [];
                if (TRIAL_FIELD && d[TRIAL_FIELD] !== undefined) {
                    d[TRIAL_FIELD] = false;
                    changed.push(TRIAL_FIELD + '=false');
                }
                if (LIMIT_FIELD && d[LIMIT_FIELD] !== undefined) {
                    d[LIMIT_FIELD] = 0;   // 0 表示无限制
                    changed.push(LIMIT_FIELD + '=0');
                }
                if (UNLOCK_FIELD && d[UNLOCK_FIELD] !== undefined) {
                    d[UNLOCK_FIELD] = true;
                    changed.push(UNLOCK_FIELD + '=true');
                }
                if (changed.length && DEBUG) {
                    $notification.post(TITLE, '[已改]', changed.join(' | '));
                }
                if (changed.length) body = JSON.stringify(d);
            } catch (e) {}
        }

    } catch (e) {
        if (DEBUG) {
            $notification.post(TITLE, 'ERROR', e.message.substring(0, 200));
        }
    }

    $done({ body: body });
})();
