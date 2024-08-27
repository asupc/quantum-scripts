/**
 * 环境变量同步
 * */

const {
    addEnvs, sendNotify, getEnvs, getQLPanels, getQLEnvs, syncEnv, sleep
} = require('./quantum');

const moment = require('moment');
let notifyMessage = "";

/**
 * 青龙量子双向 同步环境变量
 * @param {any} notify 
 */
async function sync(notify) {
    console.log("开始同步环境变量。")
    let allQuantumEnvs = await getEnvs();
    console.log("获取所有环境变量完成，" + moment().format("YYYY-MM-DD HH:mm:ss"));
    let commonEnvs = allQuantumEnvs.filter((n => n.EnvType == 1));
    let userEnvs = allQuantumEnvs.filter((n => n.EnvType == 2));
    let qlPanels = (await getQLPanels()).filter((n) => n.Enable);

    console.log("获取青龙容器完成，" + moment().format("YYYY-MM-DD HH:mm:ss"));

    let m = `环境变量：${allQuantumEnvs.length}个
公共变量：${commonEnvs.length}个
用户变量：${userEnvs.length}个
量子变量：${allQuantumEnvs.filter((n => n.EnvType == 3)).length}个
青龙容器：${qlPanels.length}个`;
    console.log(m);
    notifyMessage = m;

    if (qlPanels.length == 0) {
        console.log("没青龙容器，不同步。");
        return;
    }
    /**
     * 从青龙中同步elmck
     */
    // await bisynchronous(qlPanels, userEnvs, "elmck", "USERID=(.*?);", true, false)

    /**
     * 从青龙中同步JD_COOKIE
     */
    // await bisynchronous(qlPanels,userEnvs, "JD_COOKIE", "pt_pin=(.*?);", true, true)

    console.log("开始调用同步API，" + moment().format("YYYY-MM-DD HH:mm:ss"));
    let message = await syncEnv();
    console.log("同步完成：" + moment().format("YYYY-MM-DD HH:mm:ss"));
    if (message) {
        for (let i = 0; i < message.length; i++) {
            console.log(message[i]);
            notifyMessage += "\r" + message[i]
        }
    }
    if (notify) {
        await sendNotify(notifyMessage, true)
    }
}

/**
 * 环境变量双向同步
 * @param {*} qlPanels  所有的青龙面板
 * @param {*} envName  双向同步的环境变量名称 如 ：JD_COOKIE ，elmck 等等等
 * @param {*} reg  获取变量唯一标识的正则表达式
 * @param {*} update  两边都有的变量做更新
 * @param {*} create  量子没有的做新增
 */
async function bisynchronous(qlPanels, userEnvs, envName, reg, update, create) {
    let newEnvs = [];
    console.log(`双向同步环境变量[${envName}]开始。`)
    for (let i = 0; i < qlPanels.length; i++) {
        let ql = qlPanels[i];
        if (ql.Weight <= 0) {
            console.log(`青龙容器:${ql.Name}权重小于1跳过同步`);
            continue;
        }
        let qlEnvs = await getQLEnvs(ql, envName);
        console.log(`青龙容器：【${ql.Name}】，获取环境变量：【${qlEnvs.length}】个，` + moment().format("YYYY-MM-DD HH:mm:ss"));
        for (let x = 0; x < qlEnvs.length; x++) {
            let qlenv = qlEnvs[x];
            if (qlenv == undefined) {
                continue;
            }
            if (qlenv.status == 0 && qlenv.value.match(reg)) {
                try {
                    let envId = qlenv.value.match(reg)[1]
                    let quantumEnv = userEnvs.filter((n) => n.Name == envName && n.Value && n.Value.indexOf(envId) > -1)[0];
                    if (update && quantumEnv && quantumEnv.Value != qlenv.value && Date.parse(qlenv.timestamp) > Date.parse(quantumEnv.UpdateTime)) {
                        quantumEnv.Value = qlenv.value;
                        quantumEnv.Enable = true;
                        console.log(`容器：【${ql.Name}】中，环境变量【${envName}：${envId} 】更新时间【${qlenv.timestamp}】，将青龙中的环境变量更新到量子。`);
                        newEnvs.push(quantumEnv);
                    }
                    else if (create && (!quantumEnv || !quantumEnv.Id)) {
                        console.log("青龙容器中有新的环境变量：" + qlenv.value);
                        let newEnv = newEnvs.filter((b) => b.Value == qlenv.value)[0];
                        if (newEnv) {
                            newEnv.QLPanelEnvs.push({
                                QLPanelId: ql.Id,
                                Mode: 2
                            });
                        } else {
                            newEnvs.push({
                                Value: qlenv.value,
                                Name: qlenv.name,
                                Enable: true,
                                UserRemark: qlenv.remarks,
                                Remark: qlenv.remarks,
                                EnvType: 2,
                                Weight: 0,
                                QLPanelEnvs: [{
                                    QLPanelId: ql.Id,
                                    Mode: 2
                                }]
                            });
                        }
                    }
                } catch (e) {
                    console.log("Error：" + e);
                }
            }
        }
        qlPanels[i].Envs = [];
        qlPanels[i].EnvCount = 0;
    }
    console.log("处理完成，" + moment().format("YYYY-MM-DD HH:mm:ss"))
    if (newEnvs && newEnvs.length > 0) {
        console.log("将更新的环境变量同步到量子：" + newEnvs.length);
        await addEnvs(newEnvs);
        await sleep(200);
    }
    console.log(`双向同步环境变量[${envName}]结束。`)
}

module.exports.syncEnvs = sync;