/**
 * 本脚本支持环境变量 及 说明
 * ADD_COOKIE_NOTIFY   （有用户提交新的CK时是否通知管理员，不配置默认通知，不需要通知请添加环境变量值为 false）
 * UPDATE_COOKIE_NOTIFY （有用户更新的CK时是否通知管理员，不配置默认不通知，不需要通知请添加环境变量值为 true）
 * NARK_URL   (Nolan NARK 服务地址，短信登录时需要 配置示例： http://192.168.2.1:9999  )
 * CARD_CODE_MESSAGE  (需要身份证前2后4时提醒)
 * DEVICE_LOGIN_CONFIRM （设备登录确认提醒）
 * JINGXIANGZHI     (京享值过滤，低于该值不允许提交)
 * JINGXIANGZHI_MSG (京享值过低提醒)
 * ADD_COOKIE_USE_SCORE  添加CK需要多少积分。（设置为0 或者 不设置时则表示不需要积分。）
 * 
 **/


//用户提交新CK是否通知管理员，默认通知，如果不想通知，添加量子环境变量：ADD_COOKIE_NOTIFY 值 false
let ADD_COOKIE_NOTIFY = true
if (process.env.ADD_COOKIE_NOTIFY) {
    ADD_COOKIE_NOTIFY = process.env.ADD_COOKIE_NOTIFY == "true"
}

//用户更新CK是否通知管理员 量子环境变量：UPDATE_COOKIE_NOTIFY:true
let UPDATE_COOKIE_NOTIFY = false
if (process.env.UPDATE_COOKIE_NOTIFY) {
    UPDATE_COOKIE_NOTIFY = process.env.UPDATE_COOKIE_NOTIFY == "true"
}

let Phone = process.env.NVJDCPhone;
let VerifyCode = process.env.NVJDCVerifyCode;
let user_id = process.env.user_id;
let CardCode = process.env.CardCode;


let ADD_COOKIE_USE_SCORE = (process.env.ADD_COOKIE_USE_SCORE || 0) * 1;

let CARD_CODE_MESSAGE = "本次登录需要提供您绑定身份证前2后4位认证，如：110324，如最后一位为X请输入大写。";
if (process.env.CARD_CODE_MESSAGE) {
    CARD_CODE_MESSAGE = process.env.CARD_CODE_MESSAGE;
}

let DEVICE_LOGIN_CONFIRM = `登录设备安全验证
请在三分钟内打开京东App>设置>账户安全>新设备登录>确认登录
操作后请回复：999999`;

if (process.env.DEVICE_LOGIN_CONFIRM) {
    DEVICE_LOGIN_CONFIRM = process.env.DEVICE_LOGIN_CONFIRM;
}

//nvjdc 服务地址，请添加量子变量或公共变量
let NARK_URL = process.env.NARK_URL;



const { sendNotify, getUserInfo, api, finshStepCommandTask, deductionIntegral
} = require('./quantum');


const { GetJDUserInfoUnion, addOrUpdateJDCookie
} = require('./jd_base');

!(async () => {

    var cookie = "";

    console.log("NARK_URL：" + NARK_URL);
    console.log("Phone：" + Phone);
    console.log("VerifyCode：" + VerifyCode);
    if (!NARK_URL) {
        var t = "未配置短信登录环境变量，无法使用短信登陆服务。";
        console.log(t);
        await sendNotify(t);
        await finshStepCommandTask();
        return;
    }
    if (NARK_URL && !NARK_URL.endsWith("/")) {
        NARK_URL = NARK_URL + "/";
    }

    if (Phone && VerifyCode && CardCode) {
        var message = `收到，稍等。。。`
        await sendNotify(message);
        var result = await VerifyCardCode();
        if (result.success) {
            cookie = result.data.ck;
        } else {
            await sendNotify(result.message);
            return false;
        }
    }
    else if (Phone && VerifyCode) {
        var message = `收到，稍等。。`
        await sendNotify(message);
        var verifyCodeResult = await verifyCode();
        if (verifyCodeResult == null) {
            return false;
        }
        if (verifyCodeResult.success) {
            cookie = verifyCodeResult.data.ck;
            console.log("VerifyCode Success！")
            await finshStepCommandTask();
        } else if (verifyCodeResult.data && verifyCodeResult.data.mode == "USER_ID") {
            console.log("需要身份证前2后4验证");
            await sendNotify(CARD_CODE_MESSAGE)
            return false;
        } else if (verifyCodeResult.data && verifyCodeResult.data.mode == "HISTORY_DEVICE") {
            console.log("登录触发设备安全验证");
            await sendNotify(DEVICE_LOGIN_CONFIRM);
            return false;
        } else {
            if (verifyCodeResult.message) {
                await sendNotify(verifyCodeResult.message);
            }
            else {
                await sendNotify("短信验证失败，请尝试其他获取方法。");
            }
            await finshStepCommandTask();
            return false;
        }
    }
    else if (Phone) {
        if (ADD_COOKIE_USE_SCORE > 0) {
            var user = (await getUserInfo()) || {};
            if (!user || user.MaxEnvCount < ADD_COOKIE_USE_SCORE) {
                await sendNotify(`该操作需要${ADD_COOKIE_USE_SCORE}积分
您当前积分剩余${user.MaxEnvCount}`)
                await finshStepCommandTask();
                return;
            }
        }

        console.log(`收到${user_id}手机号,${Phone}，开始请求nark服务`);
        await sendNotify("收到，稍等。");
        var sendSMSResult = await SendSMS();
        if (sendSMSResult != null) {
            if (sendSMSResult.success) {
                console.log("NVJDC SendSMS Success")
                await sendNotify("如收到验证码请回复");
            } else {
                console.log("NVJDC SendSMS Failed")
                await sendNotify("验证码发送失败：" + sendSMSResult.message);
                await finshStepCommandTask();
            }
        }
        return false;
    }
    else {
        await sendNotify("OK，请输入您的手机号码：");
        return;
    }
    console.log("nark服务获取到CK 信息：" + cookie);

    try {
        var jdInfo = await GetJDUserInfoUnion(cookie);
        if (jdInfo.retcode != "0" && !jdInfo.data) {
            return false;
        }
        if (ADD_COOKIE_USE_SCORE && ADD_COOKIE_USE_SCORE > 0) {
            var result = await deductionIntegral(ADD_COOKIE_USE_SCORE)
            if (result.Code != 200) {
                await sendNotify(result.Message);
                return false;
            }
        }
        await addOrUpdateJDCookie(cookie, process.env.user_id, jdInfo.data.userInfo.baseInfo.nickname);
        await sendNotify(`登录成功！
用户级别：${jdInfo.data.userInfo.baseInfo.levelName}
剩余京豆：${jdInfo.data.assetInfo.beanNum}
京东昵称：${jdInfo.data.userInfo.baseInfo.nickname}`);
    } catch (e) {
        await sendNotify("处理信息异常，您也可以尝试回复本消息重试提交：\n" + cookie)
        console.log("处理异常：" + e);
    }
})()
    .catch((e) => {
        console.log("nark登录出现异常：" + e);
    });

async function SendSMS() {
    const options = {
        url: NARK_URL + "api/SendSMS",
        body: JSON.stringify({
            Phone: Phone,
            qlkey: 0
        }),
        method: "post",
        headers: {
            Accept: 'text/plain',
            "Content-Type": "application/json-patch+json"
        }
    }
    var sendSMSResult = null;
    await api(options).then(async response => {
        console.log("nark 请求短信验证返回：" + response.body);
        var body = JSON.parse(response.body);
        sendSMSResult = body;
    }).catch(async (e) => {
        console.log("SendSMS 请求异常：" + JSON.stringify(e))
        await sendNotify("请求短信出现异常，已通知管理员！")
        await narkExceptionNotifyManager();
    });
    return sendSMSResult;
}


async function verifyCode() {
    const options = {
        url: NARK_URL + "api/VerifyCode",
        body: JSON.stringify({
            Phone: Phone,
            code: VerifyCode,
            qlkey: 0,
            QQ: ""
        }),
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    let verifyCodeResult = null;
    await api(options).then(async response => {
        data = JSON.parse(response.body);
        console.log("验证短信返回：" + response.body)
        verifyCodeResult = data;
    }).catch(async (e) => {
        console.log("短信验证码，请求异常：" + JSON.stringify(e))
        await sendNotify("请求登录失败了，尝试其他CK获取方式吧！");
        await narkExceptionNotifyManager();
    })
    return verifyCodeResult;
}

async function VerifyCardCode() {
    var data = JSON.stringify({
        Phone: Phone,
        Code: CardCode,
        qlkey: 0,
        QQ: ""
    })
    console.log("请求 VerifyCardCode：" + data);
    const options = {
        url: NARK_URL + "api/VerifyCardCode",
        body: data,
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    let VerifyCardCodeResult = null;
    await api(options).then(async response => {
        VerifyCardCodeResult = JSON.parse(response.body);
        console.log("身份或设备认证 返回：" + response.body)
    }).catch(async (e) => {
        console.log("身份或设备认证请求异常：" + JSON.stringify(e))
        await sendNotify("请求登录失败了，尝试其他CK获取方式吧！");
        await narkExceptionNotifyManager();
    })
    return VerifyCardCodeResult;
}

async function narkExceptionNotifyManager() {
    await sendNotify(`手机号：${Phone}，请求nark登录服务：${NARK_URL} 出现异常。请查阅日志查看详情。`);
    await finshStepCommandTask();
}