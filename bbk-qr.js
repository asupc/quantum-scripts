/**
 * 可用环境变量 请通过环境变量添加量子变量
 *
 * 
 * bbk_qr_url ，如：  http://www.123456.com:8888
 * 
 * bbk_qr_url_jd ，京东扫码登录地址  如：  http://www.123456.com:3081
 * 
 * bbk_token , 转换wskey需要的，否则京东扫码的wskey无法完成转换
 * 
 * 系统设置中 服务地址 需要配置为外网可访问的地址。
 *
 **/

let filePath = "wwwroot"

var fs = require("fs");
const {
    sendNotify, api, sleep, serverAddres
} = require('./quantum');

const { convertWskey, GetJDUserInfoUnion, addOrUpdateJDCookie, addOrUpdateWskey, checkAddJDCookie } = require('./jd_base');

var type = "微信";


let bbk_qr_url = process.env.bbk_qr_url;


let qrc = "";
let t = 0;
let timeOut = 180;

let serverPath = ""

!(async () => {
    if (process.env.command.indexOf("京东") > -1) {
        if (!process.env.bbk_qr_url_jd) {
            console.log("未配置BBK wskey 扫码服务地址，环境变量名称：bbk_qr_url_jd");
            return false;
        }
        bbk_qr_url = process.env.bbk_qr_url_jd;
        type = "京东";
    }
    else if (process.env.command.indexOf("口令") > -1) {
        type = "口令";
        bbk_qr_url = process.env.bbk_qr_url_jd;
    }
    else if (!process.env.bbk_qr_url) {
        console.log("未配置BBK wskey 扫码服务地址，环境变量名称：bbk_qr_url");
        return false;
    }
    console.log("扫码登录类型：" + type)
    const body = await api({
        url: serverAddres + `api/SystemConfig`,
        method: 'get',
        headers: {
            Accept: 'text/plain',
            "Content-Type": "application/json-patch+json"
        },
    }).json();

    if (!body.Data.ServerPath) {
        console.log("未配置服务地址，请通过系统设置配置外网可访问的量子地址。 如：http://www.123.com:5088")
        return;
    }
    serverPath = body.Data.ServerPath;
    if (bbk_qr_url.indexOf("http") < 0) {
        bbk_qr_url = "http://" + bbk_qr_url;
    }
    t = Date.now();
    await getWeixinQR();
    if (qrc) {
        do {
            await sleep(3000);
            var ts = (Date.now() - t) / 1000;
            if (ts >= timeOut) {
                console.log("扫码超时。")
                deleteQR();
                return;
            }
            console.log(`超时剩余时间：${(timeOut - ts)}`);
            if (await checkWeixinLogin()) {
            } else {
                deleteQR();
                return;
            }
        } while (true);
    }

})().catch((e) => {
    console.log("执行脚本出现异常了。");
    console.log(e);
});


function deleteQR() {
    fs.unlink(filePath + "/qr_" + t + ".png", function (error) {
        if (error) {
            console.log(error);
            return false;
        }
        console.log('删除二维码文件成功');
    })
}

/**
 * 
 * 获取扫码二维码
 * 
 */
async function getWeixinQR() {
    var config = {
        method: 'get',
        responseType: 'json',
        url: `${bbk_qr_url}/d/getQR?t=${t}`,
        headers: {
            Connection: 'Keep-Alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-cn'
        }
    };
    const response = await api(config);
    if (response.body.code === 500) {
        await sendNotify("获取二维码异常，请稍后重试。");
        return false;
    }
    console.log("获取二维码信息成功！")

    timeOut = response.body['data']['timeout'];
    qrc = (response.headers["set-cookie"][0] + ";").match(/usr_=([^; ]+)(?=;?)/)[1]
    console.log("会话Cookie：" + qrc)

    if (type == "微信" || type == "京东") {
        var imgData = response.body['data']['qr'];
        var base64Data = imgData.replace(/^data:image\/\w+;base64,/, "");
        var Readable = require('stream').Readable
        const imgBuffer = Buffer.from(base64Data, 'base64')
        var s = new Readable()
        s.push(imgBuffer)
        s.push(null)
        var path = filePath + "/qr_" + t + ".png"
        s.pipe(fs.createWriteStream(path));
        console.log("保存二维码图片到本地：" + path);
        await sendNotify([{
            MessageType: 2,
            msg: `${serverPath}/qr_${t}.png`
        }, {
            MessageType: 1,
            msg: `请使用${type}扫描二维码并确认登录。`
        }]);
    }
    else if (type == "口令") {
        await sendNotify(`复制口令：${response.body.data.kouling}
到京东APP确认登录`);
    }
}

/**
 * 
 * 获取扫码结果
 * 
 */
async function checkWeixinLogin() {
    let config = {
        method: 'get',
        responseType: 'json',
        url: `${bbk_qr_url}/d/status?t=${Date.now()}`,
        headers: {
            Connection: 'Keep-Alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'zh-cn',
            Cookie: "usr_=" + qrc
        }
    };
    const response = await api(config);
    let result = response.body;
    console.log(JSON.stringify(response.body));
    if (result.code == 200) {
        return true;
    }
    if (result.code == 408) {
        console.log("二维码过期");
        return false;
    }
    if (result.code == 202) {
        console.log(response.body.errorMsg)
        let msg = response.body.errorMsg;
        let regResult = msg.match("<a.*?href=[\"']?((https?://)?/?[^\"']+)[\"']?.*?>(.+)</a>")
        await sendNotify(`${regResult[3]}
${regResult[1]}`);
        return false;
    }
    if (result.code == 410) {
        let wskey = result.data.wskey;
        let tps = "扫码成功，但是提交失败了，请联系管理员查看相关日志。";

        if (!wskey) {
            console.log("扫码成功，但未返回wskey信息，请检查BBK配置信息。")
            await sendNotify(tps);
            return false;
        }
        console.log(`扫码获取到wskey：${wskey}`);
        console.log("开始将wskey转换成app_open格式：" + wskey)
        let convertResult = await convertWskey(wskey, type == "京东" || type == "口令" ? "是" : "否");
        if (!convertResult.success || convertResult.data.indexOf("pt_key=app_open") < 0) {
            console.log("wskey转换失败了。");
            await sendNotify(tps);
            return false;
        }
        let key = wskey.match(/wskey=([^; ]+)(?=;?)/)[1]
        let pin = wskey.match(/pin=([^; ]+)(?=;?)/)[1]
        let jdck = convertResult.data;
        await addOrUpdateWskey(key, pin, pin, type == "京东" || type == "口令" ? "是" : "否")
        await checkAddJDCookie(jdck);
        //         console.log("开始获取京东账户基本信息");
        //         var userInfo = await GetJDUserInfoUnion(jdck)
        //         console.log("获取京东账户基本信息结果：" + JSON.stringify(userInfo));
        //         if (!userInfo || !userInfo.data || userInfo.retcode != "0") {
        //             sendNotify(`wskey似乎失效了：【${wskey}】`);
        //             await sendNotify(tps);
        //             return false;
        //         }
        //         var msg = `提交成功辣！
        // 账号昵称：${userInfo.data.userInfo.baseInfo.nickname}
        // 用户等级：${userInfo.data.userInfo.baseInfo.levelName}
        // 剩余京豆：${userInfo.data.assetInfo.beanNum}
        // 剩余红包：${userInfo.data.assetInfo.redBalance}`;


        //         await addOrUpdateWskey(key, pin, userInfo.data.userInfo.baseInfo.nickname, type == "京东" || type == "口令" ? "是" : "否")
        //         console.log("开始处理提交JDCOOKIE：" + convertResult.data)
        //         await addOrUpdateJDCookie(convertResult.data, process.env.user_id, userInfo.data.userInfo.baseInfo.nickname);
        //         await sendNotify(msg);
        return false;
    }
    return true;
}