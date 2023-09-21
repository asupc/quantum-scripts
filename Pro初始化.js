/**
 * 
 * ProWskey自定义数据标题初始化，仅执行一次即可
 * 
 **/

const {
    sendNotify
} = require('./quantum');

const {
    addProWskeyCustomDataTitle
} = require("./jd_base")


!(async () => {
    await addProWskeyCustomDataTitle();
    await sendNotify("【Pro_wskey】初始化完毕！")
})();