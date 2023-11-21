const {
    getCustomData, updateCustomData, addCustomData, addOrUpdateCustomDataTitle
} = require('./quantum');

/**
 * 添加或更新wskey 到自定义数据表中
 * @param {any} wskey key
 * @param {any} pin pin
 * @param {any} nickname 京东账号昵称
 */
module.exports.addOrUpdateBbkWskey = async (wskey, pin, nickname) => {
    console.log("开始提交ProWskey到自定义数据中");
    var customDatas = await getCustomData(bbkCustomDataType, null, null, { Data5: pin })
    var customData = {
        Type: bbkCustomDataType,
        Data1: process.env.user_id,
        Data2: process.env.CommunicationUserName,
        Data3: process.env.CommunicationUserId,
        Data4: wskey,
        Data5: pin,
        Data6: `wskey=${wskey};pin=${pin};`,
        Data7: nickname,
        Data8: await getJD_COOKIE_Pin_status(pin) ? "是" : "否"
    }
    if (customDatas && customDatas.length > 0) {
        console.log("更新ProWskey信息到自定义数据中");
        customData.Id = customDatas[0].Id;
        await updateCustomData(customData);
    }
    else {
        var result = await addCustomData([customData]);
        console.log("新增bbkWskey信息到自定义数据中，提交结果" + JSON.stringify(result));
    }
}

/**
 * 初始化BBK WSKEY 自定义数据
 */
module.exports.addBbkWskeyCustomDataTitle = async () => {
    await addOrUpdateCustomDataTitle({
        Type: bbkCustomDataType,
        TypeName: "bbk_wskey",
        Title1: "用户ID",
        Title2: "用户昵称",
        Title3: "QQ/WX",
        Title4: "wskey",
        Title5: "pin",
        Title6: "完整wskey",
        Title7: "账号名称",
        Title8: "是否有效",
        Title9: "转换时间"
    })
}