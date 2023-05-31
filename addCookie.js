/**
 * 本脚本支持环境变量 及 说明
 * ADD_COOKIE_NOTIFY   （有用户提交新的CK时是否通知管理员，不配置默认通知，不需要通知请添加环境变量值为 false）
 * UPDATE_COOKIE_NOTIFY （有用户更新的CK时是否通知管理员，不配置默认不通知，不需要通知请添加环境变量值为 true）
 * JINGXIANGZHI     (京享值过滤，低于该值不允许提交)
 * JINGXIANGZHI_MSG (京享值过低提醒)
 * ADD_COOKIE_USE_SCORE  添加CK需要多少积分。（设置为0 或者 不设置时则表示不需要积分。）
 * 
 **/

let ADD_COOKIE = process.env.ADD_COOKIE || "pt_key=app_openAAJkb_ETADBG151Zi7S1dw9MnOFo1zH0m2v89Oh9OB1JTCbeexP-Z8WcCMGeHS26i6zkXatzF24;pt_pin=18690725682_p;";

//用户提交新CK是否通知管理员，默认通知，如果不想通知，添加量子环境变量：ADD_COOKIE_NOTIFY 值 false
if (process.env.ADD_COOKIE_NOTIFY) {
    ADD_COOKIE_NOTIFY = process.env.ADD_COOKIE_NOTIFY == "true"
}

if (process.env.UPDATE_COOKIE_NOTIFY) {
    UPDATE_COOKIE_NOTIFY = process.env.UPDATE_COOKIE_NOTIFY == "true"
}

let user_id = process.env.user_id;
let JINGXIANGZHI = (process.env.JINGXIANGZHI || 0) * 1;


let ADD_COOKIE_USE_SCORE = (process.env.ADD_COOKIE_USE_SCORE || 0) * 1;

let JINGXIANGZHI_MSG = process.env.JINGXIANGZHI_MSG || "您的京享值过低，无法自动完成任务！";

if (process.env.CARD_CODE_MESSAGE) {
    CARD_CODE_MESSAGE = process.env.CARD_CODE_MESSAGE;
}


if (process.env.JD_COOKIE) {
    jdCookies = process.env.JD_COOKIE.split("&");
}

var cookies = [];
const { sendNotify, getUserInfo, uuid, deductionIntegral,
} = require('./quantum');

const { addOrUpdateJDCookie, QueryJDUserInfo } = require('./jd_base');

!(async () => {
    if (ADD_COOKIE_USE_SCORE > 0) {
        user = (await getUserInfo()) || {};
        if (!user || user.MaxEnvCount < ADD_COOKIE_USE_SCORE) {
            await sendNotify(`该操作需要${ADD_COOKIE_USE_SCORE}积分
您当前积分剩余：${user.MaxEnvCount}`)
            return;
        }
    }
    cookies = ADD_COOKIE.split("&");
    console.log("触发指令信息：" + ADD_COOKIE);
    for (let i = 0; i < cookies.length; i++) {
        var cookie = cookies[i];
        if (cookie) {
            var pt_key = "";
            var pt_pin = ""
            if (cookie.indexOf("pt_pin") < 0) {
                cookie = cookie + "pt_pin=" + uuid(8) + ";"
            }
            cookie = cookie.replace(/[\r\n]/g, "");
            try {
                pt_key = cookie.match(/pt_key=([^; ]+)(?=;?)/)[1]
                pt_pin = cookie.match(/pt_pin=([^; ]+)(?=;?)/)[1]
            }
            catch (e) {
                console.log("CK： " + cookie + "格式不对，已跳过");
                continue;
            }
            if (!pt_key || !pt_pin) {
                continue;
            }
            user_id = cookie.match(/qq=([^; ]+)(?=;?)/)
            if (user_id) {
                user_id = user_id[1];
            } else {
                user_id = process.env.user_id;
            }
            //处理pt_pin中带中文的问题
            var reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
            if (reg.test(pt_pin)) {
                pt_pin = encodeURI(pt_pin);
            }
            cookie = `pt_key=${pt_key};pt_pin=${pt_pin};`
            let UserName = pt_pin
            let UserName2 = decodeURI(UserName);
            let index = i + 1;
            let nickName = UserName2;

            var jdInfo = await QueryJDUserInfo(cookie);

            let JingXiang = jdInfo.base.jvalue;

            if (jdInfo.retcode != 0) {
                await sendNotify(`【${cookie}】提交失败，Cookie可能过期了`)
                return false;
            }
            if (JINGXIANGZHI > 0) {
                console.log("判断用户京享值是否大于：" + JINGXIANGZHI);
                console.log("用户京享值：" + JingXiang);
                if (JingXiang < JINGXIANGZHI) {
                    console.log("用户京享值：" + JingXiang + "小于设置值：" + JINGXIANGZHI);
                    await sendNotify(`账号：${nickName}，京享值：${JingXiang}，提交失败！\r${JINGXIANGZHI_MSG}`)
                    continue;
                }
            }
            if (ADD_COOKIE_USE_SCORE && ADD_COOKIE_USE_SCORE > 0) {
                var result = await deductionIntegral(ADD_COOKIE_USE_SCORE)
                if (result.Code != 200) {
                    await sendNotify(result.Message);
                    return false;
                }
            }
            await addOrUpdateJDCookie(cookie, process.env.user_id, jdInfo.base.nickname);
            await sendNotify(`提交成功！
京享值：${jdInfo.base.jvalue}
用户级别：${jdInfo.base.userLevel}
剩余京豆：${jdInfo.base.jdNum}
京东昵称：${jdInfo.base.nickname}`);
        }
    }
})()
    .catch((e) => {
        console.log("addCookie.js 出现异常：" + e);
    });