/**
 * 
 * 需要配置量子变量 
 * Pro_URL   
 *          Pro的服务地址  大概是这样  http://192.168.10.100:5016   http:// 不要丢了，端口号后面不要带/login 啥的
 * Pro_BotApiToken
 *          通过Pro 管理端 全局配置 BotApiToken 随便填一串，比如  L!Y-D&2f3VH4;^,7   ，然后配置量子变量
 * 
 * 
 * 
 */
const QRCode = require("qrcode");
let filePath = "wwwroot"

const {
    sendNotify, api, sleep, serverAddres
} = require('./quantum');

const { ProWskey, GetJDUserInfoUnion, addOrUpdateJDCookie, addOrUpdateProWskey } = require('./jd_base');

var fs = require("fs");

let qrc = "";
let timeOut = 180;
let Pro_URL = process.env.Pro_URL;
let Pro_BotApiToken = process.env.Pro_BotApiToken;
let serverPath = ""
let CommunicationUserName = process.env.CommunicationUserName;

!(async () => {

    t = Date.now();

    if (!Pro_URL) {
        console.log("未配置Pro wskey 扫码服务地址，环境变量名称：Pro_URL");
        return false;
    }

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

    if (Pro_URL.indexOf("http") < 0) {
        Pro_URL = "http://" + Pro_URL;
    }

    var key = await GetQRKey()
    await GetQR(key)
    // await JCommand(key)

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
            if (await checkWeixinLogin(key)) {
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

/**
 * 获取key
 */
async function JCommand(key) {

    var data = JSON.stringify({
        "url": `https://cjhy-isv.isvjcloud.com/yunying/viewSpecialTopicPage/openAppPage?actlink=https://qr.m.jd.com/p?k=${key}`,
        "title": "City-口令登录",
        "img": ""
    });

    try {
        var config = {
            method: 'POST',
            url: "http://api.nolanstore.cc/JCommand",
            headers: {
                'Content-Type': 'application/json'
            },
            body: data
        };
        var response = await api(config);
        var result = JSON.parse(response.body);
        await sendNotify(`复制口令：${result.data}
步骤：京东APP确认登录
机器人回复：添加成功，才算挂机成功`)
        qrc = result
        return result;
    }
    catch (e) {
        await JCommand(key)
        return
    }
}

async function GetQR(key) {
    QRCode.toDataURL(`https://qr.m.jd.com/p?k=${key}`)
        .then(url => {
            var base64Data = url.replace(/^data:image\/\w+;base64,/, "");
            var Readable = require('stream').Readable
            const imgBuffer = Buffer.from(base64Data, 'base64')
            var s = new Readable()
            s.push(imgBuffer)
            s.push(null)
            var path = filePath + "/qr_" + t + ".png"
            s.pipe(fs.createWriteStream(path));
            console.log("保存二维码图片到本地：" + path);
        })

    await sendNotify([{
        MessageType: 2,
        msg: `${serverPath}/qr_${t}.png`
    }, {
        MessageType: 1,
        msg: `请保存二维码，使用京东扫描二维码并确认登录。`
    }]);
}

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
 * 获取key
 */
async function GetQRKey() {
    var data = JSON.stringify({
        "botApitoken": Pro_BotApiToken
    });
    try {
        var config = {
            method: 'POST',
            url: Pro_URL + "/qr/GetQRKey",
            headers: {
                'Content-Type': 'application/json'
            },
            body: data
        };
        var response = await api(config);
        var result = JSON.parse(response.body).data.key;
        qrc = result
        return result;
    }
    catch (e) {
        await sendNotify("请求失败，请联系管理员")
        console.log("请求失败，请联系管理员")
        return
    }
}

/**
 * 
 * 获取扫码结果
 * 
 */
async function checkWeixinLogin(key) {
    var data = JSON.stringify({
        "qrkey": key,
        "botApitoken": Pro_BotApiToken
    });

    var config = {
        method: 'POST',
        responseType: 'json',
        url: Pro_URL + "/qr/CheckQRKey",
        headers: {
            'Content-Type': 'application/json'
        },
        body: data
    };
    const response = await api(config);
    var result = response.body;
    console.log(`会话Cookie：${key}\n${CommunicationUserName}：${result.message}`);
    if (result.success == true) {
        var wskey = result.data.rwskey;
        var tps = "扫码成功，但是提交失败了，请联系管理员查看相关日志。";
        if (!wskey) {
            console.log("扫码成功，但未返回wskey信息，请检查Pro配置信息。")
            await sendNotify(tps);
            return false;
        }
        console.log(`获取到wskey：${wskey}`);
        console.log("将wskey转换成app_open格式：" + wskey)
        var convertResult = await ProWskey(wskey);
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
        await addOrUpdateProWskey(key, pin, userInfo.data.userInfo.baseInfo.nickname)
        console.log("开始处理提交JDCOOKIE：" + convertResult.data)
        await addOrUpdateJDCookie(convertResult.data, process.env.user_id, userInfo.data.userInfo.baseInfo.nickname);
        await sendNotify(msg);
        return false;
    }
    if (result.data.status == 0) {
        return true;
    }
    if (result.data.status == -2) {
        console.log("二维码过期");
        return false;
    }
    return true;
}