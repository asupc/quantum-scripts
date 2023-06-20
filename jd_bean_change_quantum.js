/**
 * 
 * 京东账户信息查询
 * 该脚本中的各个API 均收集于各个库中。
 * 支持变量
 * NO_CK_NOTIFY 没有京东ck时提示消息
 * QUERY_JD_USE_SCORE 查询所需积分。
 * QUERY_JD_USE_SCORE_TIPS 查询时用户积分不足提醒
 * QUERY_JD_USE_SCORE_TYPE  积分扣费模式，如  QUERY_JD_USE_SCORE 设置为 10 ， QUERY_JD_USE_SCORE_TYPE 为1 则查询一次 扣 10 ，如设置为2 则一个账号扣 10 , 默认 1
 * 
 */

const CryptoJS = require("crypto-js");
const md5 = require("md5");
const moment = require("moment")


let QUERY_JD_USE_SCORE = (process.env.QUERY_JD_USE_SCORE || 0) * 1;
let QUERY_JD_USE_SCORE_TYPE = process.env.QUERY_JD_USE_SCORE_TYPE * 1;
let QUERY_JD_USE_SCORE_TIPS = process.env.QUERY_JD_USE_SCORE_TIPS || "查询积分不足。"

let NO_CK_NOTIFY = process.env.NO_CK_NOTIFY || "未提交Cookie";



const {
    sendNotify, getCookies, api, clearProxy, getUserInfo, deductionIntegral
} = require('./quantum');

const {
    islogin, QueryJDUserInfo
} = require('./jd_base');

//单个账号异常重试次数
var tryCount = 3;

!(async () => {
    var cookiesArr = await getCookies();


    if (cookiesArr.length == 0) {
        console.log("没有Cookies信息结束任务。");
        await sendNotify(NO_CK_NOTIFY);
        return;
    }

    if (QUERY_JD_USE_SCORE > 0) {
        var user = (await getUserInfo()) || {};
        var deductionScore = QUERY_JD_USE_SCORE_TYPE == 1 ? QUERY_JD_USE_SCORE : cookiesArr.length * QUERY_JD_USE_SCORE;
        console.log("此次查询需要积分：" + deductionScore)
        if (!user || user.MaxEnvCount < deductionScore) {
            await sendNotify(QUERY_JD_USE_SCORE_TIPS)
            return;
        }
        await deductionIntegral(deductionScore)
        await sendNotify(`此次查询扣除积分：${deductionScore}，请稍后。`)
    }
    for (var ttt = 0; ttt < cookiesArr.length; ttt++) {
        var env = cookiesArr[ttt];
        var cookie = env.Value;
        for (var i = 0; i < tryCount; i++) {
            try {
                await QueryAccount(env);
                clearProxy();
                break;
            }
            catch (e) {
                console.log(`【${getPin(cookie)}】第${(i + 1)}次执行异常，再来一次：` + e.message);
                if (i >= tryCount) {
                    console.log(`【${getPin(cookie)}】执行异常重试上限。`);
                }
                clearProxy();
            }
        }
    }
})().catch(async (e) => {
    console.log("脚本执行异常：" + e.message);
    console.log(e.stack)
});


/**
 * 查询账户信息
 * @param {any} env
 */
async function QueryAccount(env) {
    var cookie = env.Value;
    var overdueDate = moment(env.CreateTime);
    var day = moment(new Date()).diff(overdueDate, 'day');
    var overdueDate1 = moment(env.UpdateTime).add(30, 'days');
    var day1 = overdueDate1.diff(new Date(), 'day');
    var overdue = `【您已挂机】${day}天
【预计失效】${day1}天后，${overdueDate1.format("MM月DD日")}失效。`

    var loginState = true;
    for (var i = 0; i < 5; i++) {
        try {
            loginState = await islogin(cookie);
            break;
        } catch (e) {
            clearProxy();
        }
    }
    if (!loginState) {
        await sendNotify(`账号：【${getPin(cookie)}】，失效了，请重新提交！`, false, cookie.UserId);
        ss = false;
        return;
    }
    var userInfo = await TotalBean(cookie);  //账户基本信息
    var goldBalance = await GoldBalance(cookie); // 极速版金币
    var PlustotalScore = 0;
    if (!userInfo.isPlusVip) {
        console.log("非plus会员不查询plus积分。");
    } else {
        PlustotalScore = await queryScores(cookie); //plus会员分
    }
    var redPackets = await redPacket(cookie); //红包】
    var beanData = await bean(cookie);// 查询京豆
    var cash = await jdCash(cookie); // 领现金
    var jf = await hfjifen(cookie); //积分查询
    var coupons = await getCoupons(cookie);  //优惠券
    var plantBeans = await plantBean(cookie);//种豆得豆
    var ecards = await ecard(cookie);
    var fruit = await getjdfruit(cookie);
    var healthScore = await health(cookie);

    var msg = `【温馨提示】查询显示为0，京东接口限流，正常情况！
【京东账号】${userInfo.nickName}`;

    if (userInfo.JingXiang) {
        if (userInfo.isRealNameAuth)
            msg += `(已实名)\n`;
        else
            msg += `(未实名)\n`;
        msg += `【账号信息】`;
        if (userInfo.isPlusVip) {
            msg += `Plus会员`;
            if (PlustotalScore > 0)
                msg += `(${PlustotalScore}分)`
        } else {
            msg += `普通会员`;
        }
        msg += `,京享值${userInfo.JingXiang}`;
    }

    if (beanData.todayIncomeBean != 0)
        msg += `\n【今日京豆】收${beanData.todayIncomeBean || 0}豆`;

    if (beanData.todayOutcomeBean != 0) {
        msg += `,支${beanData.todayOutcomeBean}豆`;
    }
    msg += `\n【昨日京豆】收${beanData.incomeBean}豆`;

    if (beanData.expenseBean != 0) {
        msg += `,支${beanData.expenseBean}豆`;
    }
    msg += `\n【当前京豆】${userInfo.beanCount}豆(≈${(userInfo.beanCount / 100).toFixed(2)}元)\n`;

    if (goldBalance) {
        msg += `【特价金币】${goldBalance}币(≈${(goldBalance / 10000).toFixed(2)}元)\n`;
    }

    if (ecards) {
        msg += `【礼卡余额】${ecards}\n`;
    }

    if (cash) {
        msg += `【签到现金】${cash}元\n`;
    }

    if (jf) {
        msg += `【积分签到】${jf}积分\n`;
    }

    if (healthScore) {
        msg += `【健康社区】${healthScore}能量\n`
    }

    if (plantBeans.growth) {
        msg += `【种豆得豆】${plantBeans.growth}成长值,${plantBeans.dateDesc}\n`
    }

    if (fruit.JdFarmProdName) {
        if (fruit.JdtreeEnergy != 0) {
            if (fruit.treeState === 2 || fruit.treeState === 3) {
                msg += `【东东农场】${fruit.JdFarmProdName} 可以兑换了!\n`;
                await sendNotify(`【${userInfo.nickName}】东东农场的【${fruit.JdFarmProdName}】已经可以兑换啦 `);
            } else {
                msg += `【东东农场】${fruit.JdFarmProdName}(${((fruit.JdtreeEnergy / fruit.JdtreeTotalEnergy) * 100).toFixed(0)}%),共种值${fruit.JdwinTimes}次,已浇水${fruit.farmInfo.farmUserPro.treeEnergy / 10}次,还需${(fruit.farmInfo.farmUserPro.treeTotalEnergy - fruit.farmInfo.farmUserPro.treeEnergy) / 10}次\n`;
            }
        } else {
            if (fruit.treeState === 0) {
                await sendNotify(`【{${userInfo.nickName}】东东农场水果领取后未重新种植 `);
            } else if (fruit.treeState === 1) {
                msg += `【东东农场】${fruit.JdFarmProdName}种植中,共种值${fruit.JdwinTimes}次\n`;
            }
        }
    } else {
        msg += `【东东农场】查询异常\n`;
    }
    if (coupons.message) {
        msg += coupons.message;
    }
    if (redPackets.message) {
        msg += redPackets.message;
    }
    if (overdue) {
        msg += overdue;
    }
    console.log(msg);
    await sendNotify(msg)
}



async function health(cookie) {
    let opts = {
        url: `https://api.m.jd.com/client.action?functionId=jdhealth_getHomeData&client=wh5&clientVersion=1.0.0&uuid=`,
        headers: {
            'cookie': cookie,
            'user-agent': `jdpingou;iPhone;4.13.0;14.4.2;${randomString(40)};network/wifi;model/iPhone10,2;appBuild/100609;supportApplePay/1;hasUPPay/0;pushNoticeIsOpen/1;hasOCPay/0;supportBestPay/0;session/${Math.random * 98 + 1};pap/JA2019_3111789;brand/apple;supportJDSHWK/1;Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`,
            'referer': 'https://h5.m.jd.com/',
            'content-type': 'application/json;charset=utf-8'
        },
        body: "body={}",
        method: "post"
    }
    let data = await api(opts).json();
    return data.data.result.userScore;
}

async function getjdfruit(cookie) {
    const options = {
        url: `https://api.m.jd.com/client.action?functionId=initForFarm`,
        body: `body=${escape(JSON.stringify({ "version": 4 }))}&appid=wh5&clientVersion=9.1.0`,
        headers: {
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "zh-CN,zh;q=0.9",
            "cache-control": "no-cache",
            "Cookie": cookie,
            "origin": "https://home.m.jd.com",
            "pragma": "no-cache",
            "referer": "https://home.m.jd.com/myJd/newhome.action",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "User-Agent": "jdapp;iPhone;9.4.4;14.3;network/4g;Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 10000,
        method: "post"
    };
    var data = await api(options).json();
    var result = {};
    if (data.farmUserPro) {
        result.farmInfo = data;
        result.JdFarmProdName = data.farmUserPro.name;
        result.JdtreeEnergy = data.farmUserPro.treeEnergy;
        result.JdtreeTotalEnergy = data.farmUserPro.treeTotalEnergy;
        result.JdwinTimes = data.farmUserPro.winTimes;
        result.treeState = data.treeState;
        let waterEveryDayT = result.JDwaterEveryDayT;
        let waterTotalT = (data.farmUserPro.treeTotalEnergy - data.farmUserPro.treeEnergy - data.farmUserPro.totalEnergy) / 10; //一共还需浇多少次水
        let waterD = Math.ceil(waterTotalT / waterEveryDayT);
        result.JdwaterTotalT = waterTotalT;
        result.JdwaterD = waterD;
    } else {
        console.log("东东农场信息获取异常：" + JSON.stringify(data));
    }
    return result;
}

async function ecard(cookie) {
    var balEcard = 0;
    var options = {
        url: 'https://mygiftcard.jd.com/giftcard/queryGiftCardItem/app?source=JDAP',
        body: "pageNo=1&queryType=1&cardType=-1&pageSize=20",
        headers: {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "zh-CN,zh-Hans;q=0.9",
            "content-length": "44",
            "content-type": "application/x-www-form-urlencoded",
            "cookie": cookie,
            "origin": "https://mygiftcard.jd.com",
            "referer": "https://mygiftcard.jd.com/giftcardForM.html?source=JDAP&sid=9f55a224c8286baa2fe3a7545bbd411w&un_area=16_1303_48712_48758",
            "user-agent": "jdapp;iPhone;10.1.2;15.0;network/wifi;Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1"
        },
        timeout: 10000,
        method: "post"
    }
    var ECardinfo = "";
    var data = await api(options).json();
    let useable = data.couponVOList;
    if (useable) {
        for (let k = 0; k < useable.length; k++) {
            if (useable[k].balance > 0)
                balEcard += useable[k].balance;
        }
        if (balEcard)
            ECardinfo = '共' + useable.length + '张E卡,合计' + parseFloat(balEcard).toFixed(2) + '元';
    }
    return ECardinfo;
}

//种豆成长值查询
async function plantBean(cookie) {
    let options = {
        url: `https://api.m.jd.com/client.action?functionId=plantBeanIndex&body=%7B%22monitor_source%22%3A%22plant_m_plant_index%22%2C%22monitor_refer%22%3A%22%22%2C%22version%22%3A%229.2.4.2%22%7D&appid=ld&client=android&clientVersion=11.2.5&networkType=UNKNOWN&osVersion=9&uuid=`,  //${result.UUID}
        headers: {
            'cookie': cookie,
            'user-agent': `jdpingou;iPhone;4.13.0;14.4.2;${randomString(40)};network/wifi;model/iPhone10,2;appBuild/100609;supportApplePay/1;hasUPPay/0;pushNoticeIsOpen/1;hasOCPay/0;supportBestPay/0;session/${Math.random * 98 + 1};pap/JA2019_3111789;brand/apple;supportJDSHWK/1;Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`,
            'referer': 'https://plantearth.m.jd.com/',
            'content-type': 'application/json;charset=utf-8',
        },
        method: "get"
    }
    var result = await api(options).json();

    if (result && result.data && result.data.roundList && result.data.roundList.length > 1) {
        return {
            growth: result.data.roundList[1].growth,
            dateDesc: result.data.roundList[1].dateDesc
        }
    }
}

async function getCoupons(cookie) {
    let options = {
        url: `https://wq.jd.com/activeapi/queryjdcouponlistwithfinance?state=1&wxadd=1&filterswitch=1&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKB&g_ty=ls`,
        headers: {
            'authority': 'wq.jd.com',
            "User-Agent": "jdapp;iPhone;10.1.2;15.0;network/wifi;Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1",
            'accept': '*/*',
            'referer': 'https://wqs.jd.com/',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'cookie': cookie
        },
        timeout: 10000,
        method: "get"
    }
    var response = await api(options);

    var data = response.body;

    data = JSON.parse(data.match(new RegExp(/jsonpCBK.?\((.*);*/))[1]);
    // 删除可使用且非超市、生鲜、京贴;
    let useable = data.coupon.useable;
    var result = { message: "" };
    result.todayEndTime = new Date(new Date(new Date().getTime()).setHours(23, 59, 59, 999)).getTime();
    result.tomorrowEndTime = new Date(new Date(new Date().getTime() + 24 * 60 * 60 * 1000).setHours(23, 59, 59, 999)).getTime();
    result.platFormInfo = "";
    //console.log(useable);
    for (let i = 0; i < useable.length; i++) {
        //console.log(useable[i]);
        if (useable[i].limitStr.indexOf('全品类') > -1) {
            result.beginTime = useable[i].beginTime;
            if (result.beginTime < new Date().getTime() && useable[i].quota < 20 && useable[i].coupontype === 1) {
                //result.couponEndTime = new Date(parseInt(useable[i].endTime)).Format('yyyy-MM-dd');
                result.couponName = useable[i].limitStr;
                if (useable[i].platFormInfo)
                    result.platFormInfo = useable[i].platFormInfo;
                var decquota = parseFloat(useable[i].quota).toFixed(2);
                var decdisc = parseFloat(useable[i].discount).toFixed(2);

                result.message += `【全品类券】满${decquota}减${decdisc}元`;

                if (useable[i].endTime < result.todayEndTime) {
                    result.message += `(今日过期,${result.platFormInfo})\n`;
                } else if (useable[i].endTime < result.tomorrowEndTime) {
                    result.message += `(明日将过期,${result.platFormInfo})\n`;
                } else {
                    result.message += `(${result.platFormInfo})\n`;
                }
            }
        }
        if (useable[i].couponTitle.indexOf('运费券') > -1 && useable[i].limitStr.indexOf('自营商品运费') > -1) {
            var item = useable[i];
            var endTime = moment(new Date(parseInt(useable[i].endTime))).format('YYYY-MM-DD');
            result.message += `【运费券】${parseInt(item.discount)}元,过期(${endTime})\n`;
        }
        if (useable[i].couponTitle.indexOf('极速版APP活动') > -1 && useable[i].limitStr == '仅可购买活动商品') {
            result.beginTime = useable[i].beginTime;
            if (result.beginTime < new Date().getTime() && useable[i].coupontype === 1) {
                if (useable[i].platFormInfo)
                    result.platFormInfo = useable[i].platFormInfo;
                var decquota = parseFloat(useable[i].quota).toFixed(2);
                var decdisc = parseFloat(useable[i].discount).toFixed(2);

                result.message += `【极速版券】满${decquota}减${decdisc}元`;

                if (useable[i].endTime < result.todayEndTime) {
                    result.message += `(今日过期,${result.platFormInfo})\n`;
                } else if (useable[i].endTime < result.tomorrowEndTime) {
                    result.message += `(明日将过期,${result.platFormInfo})\n`;
                } else {
                    result.message += `(${result.platFormInfo})\n`;
                }
            }
        }
        //8是支付券， 7是白条券
        if (useable[i].couponStyle == 7 || useable[i].couponStyle == 8) {
            result.beginTime = useable[i].beginTime;
            if (result.beginTime > new Date().getTime() || useable[i].quota > 50 || useable[i].coupontype != 1) {
                continue;
            }

            if (useable[i].couponStyle == 8) {
                result.couponType = "支付立减";
            } else {
                result.couponType = "白条优惠";
            }
            if (useable[i].discount < useable[i].quota)
                result.message += `【${result.couponType}】满${useable[i].quota}减${useable[i].discount}元`;
            else
                result.message += `【${result.couponType}】立减${useable[i].discount}元`;
            if (useable[i].platFormInfo)
                result.platFormInfo = useable[i].platFormInfo;
            if (useable[i].endTime < result.todayEndTime) {
                result.message += `(今日过期,${result.platFormInfo})\n`;
            } else if (useable[i].endTime < result.tomorrowEndTime) {
                result.message += `(明日将过期,${result.platFormInfo})\n`;
            } else {
                result.message += `(${result.platFormInfo})\n`;
            }
        }
    }
    return result;
}

async function hfjifen(cookie) {
    let t = new Date().getTime()
    let encstr = md5(t + "e9c398ffcb2d4824b4d0a703e38yffdd")
    let opts = {
        url: `https://dwapp.jd.com/user/dwSignInfo`,
        headers: {
            'cookie': cookie,
            'user-agent': `jdpingou;iPhone;4.13.0;14.4.2;${randomString(40)};network/wifi;model/iPhone10,2;appBuild/100609;supportApplePay/1;hasUPPay/0;pushNoticeIsOpen/1;hasOCPay/0;supportBestPay/0;session/${Math.random * 98 + 1};pap/JA2019_3111789;brand/apple;supportJDSHWK/1;Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`,
            'referer': 'https://mypoint.jd.com/',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            't': t,
            'encStr': encstr
        }),
        method: "post"
    }
    let data = await api(opts).json();
    return data.data.balanceNum;
}

async function jdCash(cookie) {
    let sign = `body=%7B%7D&build=167968&client=apple&clientVersion=10.4.0&d_brand=apple&d_model=iPhone13%2C3&ef=1&eid=eidI25488122a6s9Uqq6qodtQx6rgQhFlHkaE1KqvCRbzRnPZgP/93P%2BzfeY8nyrCw1FMzlQ1pE4X9JdmFEYKWdd1VxutadX0iJ6xedL%2BVBrSHCeDGV1&ep=%7B%22ciphertype%22%3A5%2C%22cipher%22%3A%7B%22screen%22%3A%22CJO3CMeyDJCy%22%2C%22osVersion%22%3A%22CJUkDK%3D%3D%22%2C%22openudid%22%3A%22CJSmCWU0DNYnYtS0DtGmCJY0YJcmDwCmYJC0DNHwZNc5ZQU2DJc3Zq%3D%3D%22%2C%22area%22%3A%22CJZpCJCmC180ENcnCv80ENc1EK%3D%3D%22%2C%22uuid%22%3A%22aQf1ZRdxb2r4ovZ1EJZhcxYlVNZSZz09%22%7D%2C%22ts%22%3A1648428189%2C%22hdid%22%3A%22JM9F1ywUPwflvMIpYPok0tt5k9kW4ArJEU3lfLhxBqw%3D%22%2C%22version%22%3A%221.0.3%22%2C%22appname%22%3A%22com.360buy.jdmobile%22%2C%22ridx%22%3A-1%7D&ext=%7B%22prstate%22%3A%220%22%2C%22pvcStu%22%3A%221%22%7D&isBackground=N&joycious=104&lang=zh_CN&networkType=3g&networklibtype=JDNetworkBaseAF&partner=apple&rfs=0000&scope=11&sign=98c0ea91318ef1313786d86d832f1d4d&st=1648428208392&sv=101&uemps=0-0&uts=0f31TVRjBSv7E8yLFU2g86XnPdLdKKyuazYDek9RnAdkKCbH50GbhlCSab3I2jwM04d75h5qDPiLMTl0I3dvlb3OFGnqX9NrfHUwDOpTEaxACTwWl6n//EOFSpqtKDhg%2BvlR1wAh0RSZ3J87iAf36Ce6nonmQvQAva7GoJM9Nbtdah0dgzXboUL2m5YqrJ1hWoxhCecLcrUWWbHTyAY3Rw%3D%3D`
    var options = {
        url: `https://api.m.jd.com/client.action?functionId=cash_homePage`,
        body: sign,
        headers: {
            'Cookie': cookie,
            'Host': 'api.m.jd.com',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': '',
            'User-Agent': 'JD4iPhone/167774 (iPhone; iOS 14.7.1; Scale/3.00)',
            'Accept-Language': 'zh-Hans-CN;q=1',
            'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 10000,
        method: "post"
    }
    var data = await api(options).json();

    if (data.code === 0 && data.data.result) {
        return data.data.result.totalMoney || 0;
    }
    return 0;
}

async function bean(cookie) {
    const tm = parseInt((Date.now() + 28800000) / 86400000) * 86400000 - 28800000 - (24 * 60 * 60 * 1000);
    const tm1 = parseInt((Date.now() + 28800000) / 86400000) * 86400000 - 28800000;
    var page = 1;
    var t = 0;
    var yesterdayArr = [];
    var todayArr = [];
    do {
        let response = await getJingBeanBalanceDetail(cookie, page);
        if (response && response.code === "0") {
            page++;
            let detailList = response.detailList;
            if (detailList && detailList.length > 0) {
                for (let item of detailList) {
                    const date = item.date.replace(/-/g, '/') + "+08:00";
                    if (new Date(date).getTime() >= tm1) {
                        todayArr.push(item);
                    } else if (tm <= new Date(date).getTime()) {
                        //昨日的
                        yesterdayArr.push(item);
                    } else if (tm > new Date(date).getTime()) {
                        //前天的
                        t = 1;
                        break;
                    }
                }
            } else {
                console.log("数据异常");
                t = 1;
            }
        } else if (response && response.code === "3") {
            console.log(`cookie已过期，或者填写不规范，跳出`)
            t = 1;
        } else {
            console.log(`未知情况：${JSON.stringify(response)}`);
            console.log(`未知情况，跳出`)
            t = 1;
        }
    } while (t === 0);
    var resultInfo = {
        incomeBean: 0,
        expenseBean: 0,
        todayIncomeBean: 0,
        todayOutcomeBean: 0
    }
    for (let item of yesterdayArr) {
        if (Number(item.amount) > 0) {
            resultInfo.incomeBean += Number(item.amount);
        } else if (Number(item.amount) < 0) {
            resultInfo.expenseBean += Number(item.amount);
        }
    }
    for (let item of todayArr) {
        if (Number(item.amount) > 0) {
            resultInfo.todayIncomeBean += Number(item.amount);
        } else if (Number(item.amount) < 0) {
            resultInfo.todayOutcomeBean += Number(item.amount);
        }
    }
    resultInfo.todayOutcomeBean = -resultInfo.todayOutcomeBean;
    resultInfo.expenseBean = -resultInfo.expenseBean;

    return resultInfo;
}

async function redPacket(cookie) {
    const options = {
        "url": `https://api.m.jd.com/client.action?functionId=myhongbao_getUsableHongBaoList&body=%7B%22appId%22%3A%22appHongBao%22%2C%22appToken%22%3A%22apphongbao_token%22%2C%22platformId%22%3A%22appHongBao%22%2C%22platformToken%22%3A%22apphongbao_token%22%2C%22platform%22%3A%221%22%2C%22orgType%22%3A%222%22%2C%22country%22%3A%22cn%22%2C%22childActivityId%22%3A%22-1%22%2C%22childActiveName%22%3A%22-1%22%2C%22childActivityTime%22%3A%22-1%22%2C%22childActivityUrl%22%3A%22-1%22%2C%22openId%22%3A%22-1%22%2C%22activityArea%22%3A%22-1%22%2C%22applicantErp%22%3A%22-1%22%2C%22eid%22%3A%22-1%22%2C%22fp%22%3A%22-1%22%2C%22shshshfp%22%3A%22-1%22%2C%22shshshfpa%22%3A%22-1%22%2C%22shshshfpb%22%3A%22-1%22%2C%22jda%22%3A%22-1%22%2C%22activityType%22%3A%221%22%2C%22isRvc%22%3A%22-1%22%2C%22pageClickKey%22%3A%22-1%22%2C%22extend%22%3A%22-1%22%2C%22organization%22%3A%22JD%22%7D&appid=JDReactMyRedEnvelope&client=apple&clientVersion=7.0.0`,
        "headers": {
            'Host': 'api.m.jd.com',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Accept-Language': 'zh-cn',
            'Referer': 'https://h5.m.jd.com/',
            'Accept-Encoding': 'gzip, deflate, br',
            "Cookie": cookie,
            'User-Agent': "jdapp;iPhone;9.4.4;14.3;network/4g;Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1"
        },
        method: "get"
    }
    var data = await api(options).json();
    var result = { message: "" };
    if (data) {
        result.jxRed = 0;
        result.jsRed = 0;
        result.jdRed = 0;
        result.jdhRed = 0;
        result.jdwxRed = 0;
        result.jdGeneralRed = 0;
        result.jxRedExpire = 0;
        result.jsRedExpire = 0;
        result.jdRedExpire = 0;
        result.jdhRedExpire = 0;
        result.jdwxRedExpire = 0;
        result.jdGeneralRedExpire = 0;
        let t = new Date();
        t.setDate(t.getDate() + 1);
        t.setHours(0, 0, 0, 0);
        t = parseInt((t - 1) / 1000) * 1000;
        for (let vo of data.hongBaoList || []) {
            if (vo.orgLimitStr) {
                if (vo.orgLimitStr.includes("京喜") && !vo.orgLimitStr.includes("特价")) {
                    result.jxRed += parseFloat(vo.balance)
                    if (vo['endTime'] === t) {
                        result.jxRedExpire += parseFloat(vo.balance)
                    }
                    continue;
                } else if (vo.orgLimitStr.includes("购物小程序")) {
                    result.jdwxRed += parseFloat(vo.balance)
                    if (vo['endTime'] === t) {
                        result.jdwxRedExpire += parseFloat(vo.balance)
                    }
                    continue;
                } else if (vo.orgLimitStr.includes("京东商城")) {
                    result.jdRed += parseFloat(vo.balance)
                    if (vo['endTime'] === t) {
                        result.jdRedExpire += parseFloat(vo.balance)
                    }
                    continue;
                } else if (vo.orgLimitStr.includes("极速") || vo.orgLimitStr.includes("京东特价") || vo.orgLimitStr.includes("京喜特价")) {
                    result.jsRed += parseFloat(vo.balance)
                    if (vo['endTime'] === t) {
                        result.jsRedExpire += parseFloat(vo.balance)
                    }
                    continue;
                } else if (vo.orgLimitStr && vo.orgLimitStr.includes("京东健康")) {
                    result.jdhRed += parseFloat(vo.balance)
                    if (vo['endTime'] === t) {
                        result.jdhRedExpire += parseFloat(vo.balance)
                    }
                    continue;
                }
            }
            result.jdGeneralRed += parseFloat(vo.balance)
            if (vo['endTime'] === t) {
                result.jdGeneralRedExpire += parseFloat(vo.balance)
            }
        }
        result.balance = (result.jxRed + result.jsRed + result.jdRed + result.jdhRed + result.jdwxRed + result.jdGeneralRed).toFixed(2);
        result.jxRed = result.jxRed.toFixed(2);
        result.jsRed = result.jsRed.toFixed(2);
        result.jdRed = result.jdRed.toFixed(2);
        result.jdhRed = result.jdhRed.toFixed(2);
        result.jdwxRed = result.jdwxRed.toFixed(2);
        result.jdGeneralRed = result.jdGeneralRed.toFixed(2);
        result.expiredBalance = (result.jxRedExpire + result.jsRedExpire + result.jdRedExpire + result.jdhRedExpire + result.jdwxRedExpire + result.jdGeneralRedExpire).toFixed(2);
        result.message += `【红包总额】${result.balance}(总过期${result.expiredBalance})元 \n`;
        if (result.jxRed > 0) {
            if (result.jxRedExpire > 0)
                result.message += `【京喜红包】${result.jxRed}(将过期${result.jxRedExpire.toFixed(2)})元 \n`;
            else
                result.message += `【京喜红包】${result.jxRed}元 \n`;
        }
        if (result.jsRed > 0) {
            if (result.jsRedExpire > 0)
                result.message += `【京喜特价】${result.jsRed}(将过期${result.jsRedExpire.toFixed(2)})元(原极速版) \n`;
            else
                result.message += `【京喜特价】${result.jsRed}元(原极速版) \n`;
        }
        if (result.jdRed > 0) {
            if (result.jdRedExpire > 0)
                result.message += `【京东红包】${result.jdRed}(将过期${result.jdRedExpire.toFixed(2)})元 \n`;
            else
                result.message += `【京东红包】${result.jdRed}元 \n`;
        }
        if (result.jdhRed > 0) {
            if (result.jdhRedExpire > 0)
                result.message += `【健康红包】${result.jdhRed}(将过期${result.jdhRedExpire.toFixed(2)})元 \n`;
            else
                result.message += `【健康红包】${result.jdhRed}元 \n`;
        }
        if (result.jdwxRed > 0) {
            if (result.jdwxRedExpire > 0)
                result.message += `【微信小程序】${result.jdwxRed}(将过期${result.jdwxRedExpire.toFixed(2)})元 \n`;
            else
                result.message += `【微信小程序】${result.jdwxRed}元 \n`;
        }
        if (result.jdGeneralRed > 0) {
            if (result.jdGeneralRedExpire > 0)
                result.message += `【全平台通用】${result.jdGeneralRed}(将过期${result.jdGeneralRedExpire.toFixed(2)})元 \n`;
            else
                result.message += `【全平台通用】${result.jdGeneralRed}元 \n`;
        }
    } else {
        console.log(`京东服务器返回空数据`)
    }
    return result;
}
async function getJingBeanBalanceDetail(cookie, page) {
    const options = {
        "url": `https://api.m.jd.com/client.action?functionId=getJingBeanBalanceDetail`,
        "body": `body=${escape(JSON.stringify({ "pageSize": "20", "page": page.toString() }))}&appid=ld`,
        "headers": {
            'User-Agent': "jdapp;iPhone;9.4.4;14.3;network/4g;Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1",
            'Host': 'api.m.jd.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie,
        },
        method: "post"
    }
    var data = await api(options).json();
    return data;
}

async function queryScores(cookie) {
    var options = {
        url: `https://rsp.jd.com/windControl/queryScore/v1?lt=m&an=plus.mobile&stamp=${Date.now()}`,
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Redmi Note 8 Pro Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/77.0.3865.120 MQQBrowser/6.2 TBS/045715 Mobile Safari/537.36',
            'Referer': 'https://plus.m.jd.com/rights/windControl'
        }, method: "get"
    };
    var data = await api(options).json();
    return data.rs.userSynthesizeScore.totalScore;
}

async function TotalBean(cookie) {
    var data = await QueryJDUserInfo(cookie);
    return {
        nickName: (data['base'] && data['base'].nickname) || getPin(cookie),
        isPlusVip: data['isPlusVip'],
        isRealNameAuth: data['isRealNameAuth'],
        beanCount: (data['base'] && data['base'].jdNum) || 0,
        JingXiang: (data['base'] && data['base'].jvalue) || 0,
    }
}

async function GoldBalance(cookie) {
    var options = taskcashUrl('MyAssetsService.execute', {
        "method": "userCashRecord",
        "data": {
            "channel": 1,
            "pageNum": 1,
            "pageSize": 20
        }
    });
    options.method = "get";
    options.headers["cookie"] = cookie;
    var data = await api(options).json();
    return data.data.goldBalance;
}

function getPin(cookie) {
    return decodeURIComponent(cookie.match(/pt_pin=([^; ]+)(?=;?)/) && cookie.match(/pt_pin=([^; ]+)(?=;?)/)[1]);
}

function randomString(e) {
    e = e || 32;
    let t = "0123456789abcdef",
        a = t.length,
        n = "";
    for (let i = 0; i < e; i++)
        n += t.charAt(Math.floor(Math.random() * a));
    return n
}

function taskcashUrl(functionId, body = {}) {
    const struuid = randomString(16);
    let nowTime = Date.now();
    let key1 = `lite-android&${JSON.stringify(body)}&android&3.1.0&${functionId}&${nowTime}&${struuid}`;
    let key2 = "12aea658f76e453faf803d15c40a72e0";
    let sign = CryptoJS.HmacSHA256(key1, key2).toString();
    let strurl = "https://api.m.jd.com/client.action/api?functionId=" + functionId + "&body=" + `${escape(JSON.stringify(body))}&appid=lite-android&client=android&uuid=` + struuid + `&clientVersion=3.1.0&t=${nowTime}&sign=${sign}`;
    return {
        url: strurl,
        headers: {
            'Host': "api.m.jd.com",
            'accept': "*/*",
            'kernelplatform': "RN",
            'user-agent': "JDMobileLite/3.1.0 (iPad; iOS 14.4; Scale/2.00)",
            'accept-language': "zh-Hans-CN;q=1, ja-CN;q=0.9"
        },
        timeout: 10000
    }
}