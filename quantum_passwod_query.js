﻿/**
 * 查询我的密码
 * 
 * 如： 我的密码 量子 
 * 则查询有关量子的密码
 * 
 * */

const {
    sendNotify, getCustomData
} = require('./quantum');

const custom_data_type = "quantum_password"
let command = process.env.command;
!(async () => {
    command = command.replace("我的密码", "").trim();
    if(!command){
        await sendNotify("该指令格式为：我的密码xxxx");
        return;
    }
    const datas = await getCustomData(custom_data_type, null, null, { 
        Data1: command,
        Data4: process.env.CommunicationUserId 
    });
    if (datas.length<=0){
        await sendNotify(`没有找到关键词:[${command}]的密码。`);
        return;
    }
    if(datas.length==1){
        await sendNotify(datas[0].Data2)
        return;
    }
    let message ="为您找到以下密码：";
    for (let index = 0; index < datas.length; index++) {
        let element = datas[index];
        message+=`\r${element.Data1}，密码：${element.Data2}，备注：${element.Data3}`;
    }
    await sendNotify(message);
})().catch((e) => {
    console.log("脚本异常：" + e);
});