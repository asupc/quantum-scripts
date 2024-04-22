/**
 * 
 * 需要配置量子变量 
 * Pro_URL   
 *          Pro的服务地址  大概是这样  http://192.168.10.100:5016   http:// 不要丢了，端口号后面不要带/login 啥的
 * Pro_BotApiToken
 *          通过Pro 管理端 全局配置 BotApiToken 随便填一串，比如  L!Y-D&2f3VH4;^,7   ，然后配置量子变量
 * 
 */


let ADD_COOKIE = process.env.ADD_COOKIE || "";
let ProStart = process.env.ProStart;
let Phone = process.env.ProSMS_Phone;
let VerifyCode = process.env.ProSMS_VerifyCode;
let user_id = process.env.user_id;
let CardCode = process.env.ProSMS_CardCode;

let ADD_COOKIE_USE_SCORE = (process.env.ADD_COOKIE_USE_SCORE || 0) * 1;


let CARD_CODE_MESSAGE = "本次登录需要提供您绑定身份证前2后4位认证，如：110324，如最后一位为X请输入大写。";
if (process.env.CARD_CODE_MESSAGE) {
    CARD_CODE_MESSAGE = process.env.CARD_CODE_MESSAGE;
}

//Pro 服务地址，请添加量子变量或公共变量
let Pro_URL = process.env.Pro_URL;
let Pro_BotApiToken = process.env.Pro_BotApiToken;

var cookies = [];
const { sendNotify, getUserInfo, api, finshStepCommandTask
} = require('./quantum');

const { checkAddJDCookie
} = require('./jd_base');

!(async () => {
    user = (await getUserInfo()) || {};

    if (ADD_COOKIE_USE_SCORE > 0) {
        if (!user || user.MaxEnvCount < ADD_COOKIE_USE_SCORE) {
            await sendNotify(`该操作需要${ADD_COOKIE_USE_SCORE}积分
您当前积分剩余${user.MaxEnvCount}`)
            return;
        }
    }
    cookies = [];
    if (ProStart) {
        console.log("Pro_URL：" + Pro_URL);
        console.log("Pro_Start：" + ProStart);
        console.log("Phone：" + Phone);
        console.log("VerifyCode：" + VerifyCode);
        if (!Pro_URL) {
            var t = "未配置短信登录环境变量，无法使用短信登陆服务。";
            console.log(t);
            await sendNotify(t);
            return;
        }
        if (Phone && VerifyCode && CardCode) {
            var message = `收到，稍等正在验证`
            await sendNotify(message);
            console.log(message)
            var result = await VerifyCardCode();
            if (!result.VerifyCodeSuccess && result.VerifyCodeErrorMessage) {
                await sendNotify(result.VerifyCodeErrorMessage);
                return false;
            }
        }
        else if (Phone && VerifyCode) {
            var message = `您的验证码:${VerifyCode}，正在验证`
            await sendNotify(message);
            console.log(message)
            var result = await verifyCode();
            if (!result.VerifyCodeSuccess) {
                await sendNotify(result.VerifyCodeErrorMessage);
                return false;
            }
        } else if (Phone) {
            console.log(`收到${user_id}手机号,${Phone}，开始请求Pro 服务`);
            if (await SendSMS()) {
                await sendNotify("已发送，请回复6位验证码：");
            } else {
                await sendNotify("短信验证码发送失败，未知异常。请联系管理员。");
                await finshStepCommandTask();
            }
            return false;
        } else {
            await sendNotify("请输入您的手机号码：");
            return;
        }
    }
    console.log("触发指令信息：" + ADD_COOKIE);
    for (let i = 0; i < cookies.length; i++) {
        var cookie = cookies[i];
        if (cookie) {
            await checkAddJDCookie(cookie);
        }
    }

    await finshStepCommandTask();
})()
    .catch(async (e) => {
        console.log("出现异常:" + e);
        await finshStepCommandTask();
    })

async function verifyCode() {
    const options = {
        method: 'POST',
        url: Pro_URL + "/sms/VerifyCode",
        body: JSON.stringify({
            Phone: Phone,
            code: VerifyCode,
            botApitoken: Pro_BotApiToken,
        }),
        headers: {
            "Content-Type": "application/json"
        }
    }
    var result = {
        VerifyCodeSuccess: false
    };
    try {
        var data = await api(options).json();

        console.log("VerifyCode Data：" + JSON.stringify(data))
        if (data.success) {
            result.VerifyCodeSuccess = true;
            cookies.push(JSON.stringify(data));
            console.log("VerifyCode Success！")
        } else if (data.data && data.data.status == 555) {
            result.VerifyCodeSuccess = false;
            result.VerifyCodeErrorMessage = CARD_CODE_MESSAGE;
            console.log("需要身份证前2后4验证");
        } else {
            result.VerifyCodeSuccess = false;
            console.log(data.message)
            if (data.message) {
                result.VerifyCodeErrorMessage = data.message;
            }
            else {
                result.VerifyCodeErrorMessage = "短信验证失败，请尝试其他获取方法。"
            }
        }
    } catch (e) {
        await sendNotify("请求登录失败了，尝试其他CK获取方式吧！");
        console.log("VerifyCode 请求异常：" + JSON.stringify(e))
    }
    return result;
}

async function VerifyCardCode() {
    var data = JSON.stringify({
        Phone: Phone,
        Code: CardCode,
        botApitoken: Pro_BotApiToken,
    })
    console.log("请求 VerifyCard：" + data);
    const options = {
        url: Pro_URL + "/sms/VerifyCard",
        body: data,
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        }
    }
    var result = {
        VerifyCodeSuccess: false
    };
    try {
        var data = await api(options).json();
        if (data.success) {
            cookies = [];
            result.VerifyCodeSuccess = true;
            cookies.push(JSON.stringify(data));
        } else {
            result.VerifyCodeSuccess = false;
            if (data.message) {
                result.VerifyCodeErrorMessage = data.message;
            }
            else {
                result.VerifyCodeErrorMessage = "短信验证失败，请尝试其他获取方法。"
            }
        }
    } catch (e) {
        console.log("VerifyCard 请求异常：" + JSON.stringify(err))
    }
    return result;
}

async function SendSMS() {
    const options = {
        url: Pro_URL + "/sms/SendSMS",
        method: 'POST',
        body: JSON.stringify({
            Phone: Phone,
            botApitoken: Pro_BotApiToken
        }),
        headers: {
            Accept: 'text/plain',
            "Content-Type": "application/json-patch+json"
        }
    }
    try {

        await api(options).json();
        return true;
    } catch (e) {
        console.log(options.url + "请求异常。" + e)
        return false;
    }
}