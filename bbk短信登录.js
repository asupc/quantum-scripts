/**
 * 
 * BBK 短信登录
 * 
 * 需要配置量子变量 SCRIPT_BBK_SMS_ADDRESS ，实例： http://192.168.1.3:8888
 * 
 * 触发指令可能和Pro的短信登录有冲突，请自行调整。
 * 
 * 感谢脚本提供者 一心向北 （QQ：1579738787）
 * 
 */
let bbkStart = process.env.bbkStart;
let Phone = process.env.bbk_Phone;
let VerifyCode = process.env.bbk_VerifyCode;
let user_id = process.env.user_id;
let CommunicationUserName = process.env.CommunicationUserName;
let bbk_name = 'bbk' // 任务全局变量

if (process.env.CARD_CODE_MESSAGE) {
    CARD_CODE_MESSAGE = process.env.CARD_CODE_MESSAGE;
}

//BBK 服务地址，请添加量子变量或公共变量
let bbk_Sms = process.env.SCRIPT_BBK_SMS_ADDRESS;
let bbk_Cookie = ''
let bbk_Uid = ''
let bbk_Status = 1
let t = 0;
let timeOut = 180;
let cookies = [];

const {
    sendNotify, api, finshStepCommandTask, sleep, stepCommandTaskAddEnv
} = require('./quantum');

const { addOrUpdateJDCookie, commonWskey, GetJDUserInfoUnion
} = require('./jd_base');

const { addOrUpdateBbkWskey, addBbkWskeyCustomDataTitle
} = require('./bbk_base');

!(async () => {
    if (bbkStart) {
        if (!bbk_Sms) {
            let t1 = "未配置短信登录环境变量，无法使用短信登陆服务。";
            console.log(t1);
            await sendNotify(t1);
            await finshStepCommandTask();
            return;
        }
        else if (Phone && VerifyCode) {
            let message = `您提交的验证码：${VerifyCode}】，正在验证`
            await sendNotify(message);
            let data = JSON.parse(eval('process.env.' + bbk_name))
            let result = await verifyCode(data);
            if (!result.VerifyCodeSuccess) {
                await sendNotify(result.VerifyCodeErrorMessage);
                return false;
            }
        } else if (Phone) {
            console.log(`收到${user_id}手机号,${Phone}，开始请求bbk短信 服务`);
            if (await SendSMS()) {
                if (!bbk_Uid && !bbk_Cookie) {
                    await sendNotify('认证失败，请重新登录，要是还不行就通知群主');
                    return false
                } else {
                    await sendNotify(`请点击下面地址进去图形验证后再回来\n${bbk_Sms}/sms/getSmsHtml?uid=${bbk_Uid}`)
                    t = Date.now();
                    do {
                        await sleep(3000);
                        let ts = (Date.now() - t) / 1000;
                        if (ts >= timeOut) {
                            console.log("验证超时。")
                            await sendNotify('图形验证超时，请重新开始吧！');
                            await finshStepCommandTask();
                            return;
                        }
                        console.log(`超时剩余时间：${(timeOut - ts)}`);
                        if (await yanzheng()) {
                            if (bbk_Status == 0) {
                                break
                            }
                        } else {
                            await finshStepCommandTask();
                            return;
                        }
                    } while (true);
                }
                console.log(bbk_Status);
                await sendNotify("验证码发送成功，请回复6位验证码：");
            } else {
                await sendNotify("短信验证码发送失败，请重新登录。");
                await finshStepCommandTask();
            }
            return false;
        } else {
            await sendNotify(`请输入您的手机号码：\n`);
            return;
        }
    }
    for (let i = 0; i < cookies.length; i++) {
        let wskey = cookies[i];
        if (wskey) {
            try {
                var tps = "登录成功，但是提交失败了，请联系管理员查看相关日志。";
                console.log(`获取到wskey：${wskey}`);
                console.log("将wskey转换成app_open格式：" + wskey)
                await addBbkWskeyCustomDataTitle()
                var convertResult = await commonWskey(wskey);
                if (!convertResult.success || convertResult.data.indexOf("pt_key=app_open") < 0) {
                    console.log("wskey转换失败了。");
                    await sendNotify(tps);
                    return false;
                }
                var jdck = convertResult.data;
                console.log("开始获取京东账户基本信息");
                var userInfo = await GetJDUserInfoUnion(jdck)
                console.log("获取京东账户基本信息结果：" + JSON.stringify(userInfo));
                if (!userInfo || !userInfo.data || userInfo.retcode != "0") {
                    sendNotify(`wskey似乎失效了：【${wskey}】`);
                    await sendNotify(tps);
                    return false;
                }
                var msg = `提交成功辣！
        账号昵称：${userInfo.data.userInfo.baseInfo.nickname}
        用户等级：${userInfo.data.userInfo.baseInfo.levelName}
        剩余京豆：${userInfo.data.assetInfo.beanNum}
        剩余红包：${userInfo.data.assetInfo.redBalance}`;
                var key = wskey.match(/wskey=([^; ]+)(?=;?)/)[1]
                var pin = wskey.match(/pin=([^; ]+)(?=;?)/)[1]
                await addOrUpdateBbkWskey(key, pin, userInfo.data.userInfo.baseInfo.nickname)
                console.log("开始处理提交JDCOOKIE：" + convertResult.data)
                await addOrUpdateJDCookie(convertResult.data, process.env.user_id, userInfo.data.userInfo.baseInfo.nickname);
                await sendNotify(msg);
            } catch (e) {
                console.log('出错了' + e);
                await sendNotify(`登录出错了，去看看日志` + "\n用户：" + CommunicationUserName, true);
                await sendNotify(`登录出错` + "\n用户：" + CommunicationUserName);
            }
        }
    }

})().catch(async (e) => {
    console.log("出现异常:" + e);
    await sendNotify(`登录出错了，去看看日志` + "\n用户：" + CommunicationUserName, true);
    await finshStepCommandTask();
    return
})

async function yanzheng() {
    const options = {
        url: `${bbk_Sms}/sms/status?uid=${bbk_Uid}`,
        method: "get",
        headers: { Cookie: bbk_Cookie }
    }
    let data = await api(options).json()
    console.log(data)
    if (data.code != 500) {
        switch (data.code) {
            case 199:
                return true
            case 201:
                bbk_Status = 0
                return true
            case 408:
                return false
            default:
                return true
        }
    } else {
        await sendNotify(data.errorMsg, true);
        await sendNotify(data.errorMsg);
        return false
    }
}

async function verifyCode(obj) {
    const options = {
        url: `${bbk_Sms}/sms/verify?code=${VerifyCode}&uid=${obj.bbk_Uid}`,
        method: "get",
        headers: { Cookie: obj.bbk_Cookie }
    }
    let result = {
        VerifyCodeSuccess: false
    };
    try {
        let data = await api(options).json();
        console.log("VerifyCode Data：" + JSON.stringify(data))
        if (data.code == 200) {
            result.VerifyCodeSuccess = true;
            cookies.push(data.data.wskey);
            console.log('cookies', cookies);
            console.log("VerifyCode Success！")
        } else {
            await sendNotify(data.errorMsg);
            await sendNotify(data.errorMsg, true);
            console.log('错误');
            await finshStepCommandTask();
            return
        }
    } catch (e) {
        await sendNotify("请求登录失败了，请重新登录！");
        await sendNotify("请求登录失败了，请重新登录！", true);
        console.log("VerifyCode 请求异常：" + JSON.stringify(e))
        await finshStepCommandTask();
        return
    }
    return result;
}


async function SendSMS() {
    const options = {
        url: `${bbk_Sms}/sms/captcharStart?phone=${Phone}`,
        method: "get",
    }
    try {
        let body = await api(options);
        bbk_Uid = JSON.parse(body.body).data.uid
        console.log('bbk_Uid', bbk_Uid);
        let set_Cookie = body.headers['set-cookie'][0];
        bbk_Cookie = 'usr_=' + set_Cookie.substring(set_Cookie.indexOf('=') + 1, set_Cookie.indexOf(';') + 1)
        console.log('set_Cookie', bbk_Cookie);
        let data = {
            bbk_Uid,
            bbk_Cookie
        }
        await stepCommandTaskAddEnv(bbk_name, JSON.stringify(data))
        return true;
    } catch (e) {
        console.log(options.url + "请求异常。" + e)
        return false;
    }
}