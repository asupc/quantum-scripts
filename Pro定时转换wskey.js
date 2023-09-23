/**
 * 
 * 定时转换 Pro_wskey
 * 转换依赖脚本 jd_base.js , 如需修改转换服务请自行修改。
 * 建议每12小时转换一次。
 * 
 * 0 23 0/8 * * ?
 * 
 * 
 * */

const { sendNotify, getCustomData, updateCustomDatas, sleep, allEnvs } = require('./quantum');
const { ProWskey, addOrUpdateJDCookie, ProCustomDataType } = require('./jd_base');
const moment = require('moment');
const {
    syncEnvs
} = require('./quantum_syncEnv');

let WSKEY_MIN_CONVERT_HOUR = parseInt(process.env.WSKEY_MIN_CONVERT_HOUR || 8);

var successCount = 0;
var overdueCount = 0;
var failedCount = 0;
!(async () => {
    var datas = await getProWskey();
    var m1 = `开始转换，有效Pro_wskey：${datas.length}个。`
    console.log(m1)
    await sendNotify(m1, true)
    for (var i = 0; i < datas.length; i++) {
        var data = datas[i];
        if (data.Data9 && moment(data.Data9).add(WSKEY_MIN_CONVERT_HOUR, 'hours') > moment()) {
            console.log(`pin：${data.Data5}，上一次成功转换时间：${data.Data9}，未超过：${WSKEY_MIN_CONVERT_HOUR}小时，跳过转换。`)
            var data2 = await allEnvs(data.Data5, 2, true);
            if (data2.length == 0) {
                console.log(`在环境变量中未找到有效的 pt_pin为${data.Data5}的 JD_COOKIE，还是要转换。`);
            }
            else {
                continue;
            }
        }
        // 3秒转一个，防止过快转换失败了
        await sleep(2000);
        var wskey = `pin=${data.Data5};wskey=${data.Data4};`
        var convertResult = await ProWskey(wskey);
        if (!convertResult.success) {
            failedCount += 1;
            console.log(`Pro_wskey：【${wskey}】，转换失败。`)
            continue;
        }
        if (!convertResult.data || convertResult.data.indexOf("pt_key=app_open") < 0) {
            var msg = `Pro_wskey失效了，账户昵称：【${data.Data6 || "-"}】，pin：【${data.Data5}】`
            console.log(msg);
            console.log("开始禁用失效Pro_wskey。")
            data.Data8 = "否";
            overdueCount += 1;
        } else {
            successCount += 1;
            console.log("开始处理提交JDCOOKIE：" + convertResult.data)
            data.Data9 = moment().format("YYYY-MM-DD HH:mm:ss");
            await addOrUpdateJDCookie(convertResult.data, data.Data1, data.Data7);
        }
    }
    await updateCustomDatas(datas);
    await sendNotify(`ProWskey 转换完成，成功：${successCount}，失效：${overdueCount}，转换失败：${failedCount}。`, true)
    if (successCount > 0) {
        console.log("开始同步环境变量到青龙。")
        await syncEnvs(true);
    } else {
        console.log("没有转换成功的ProWskey，跳过同步环境变量。");
    }
})().catch((e) => {
    console.log("执行脚本出现异常了。" + e);
});

/**
 * 获取有效的wskey信息
 * */
async function getProWskey() {
    var datas = await getCustomData(ProCustomDataType, null, null, {
        Data8: "是"
    });
    return datas;
}
