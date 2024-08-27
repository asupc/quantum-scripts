const {
    sendNotify
} = require('./quantum');
const {
    syncEnvs
} = require('./quantum_syncEnv');

!(async () => {
    if (process.env.IsSystem != "true") {
        await sendNotify("开始同步环境变量了，可能要点时间，骚等一下。", true)
    }
    await syncEnvs(process.env.IsSystem != "true");
})().catch((e) => {
    console.log("脚本异常：" + e);
});