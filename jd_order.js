//京东订单搜索
const {
    sendNotify, getCookies, api
} = require('./quantum');

let key = "";
let orderList = [];

!(async () => {
    const match = process.env.command.match(/搜订单(.+)/);
    if (match && match[1]) {
        console.log(match[1]); // 输出：香肠
    } else {
        await sendNotify(`格式错误，正确格式是：搜订单xxx，这个xxx就是你需要搜索的商品`)
        return;
    }
    key = match[1].toString();
    var cookies = await getCookies();
    cookies = cookies.filter(s => s.Enable);
    if (cookies.length == 0) {
        console.log("没有Cookies信息结束任务。");
        await sendNotify(`你还没有登录账号，对我发登录即可！`)
        return;
    }
    await sendNotify(`正在搜索订单中，请稍等...`)
    for (i = 0; i < cookies.length; i++) {
        if (cookies[i]) {
            cookie = cookies[i].Value;
            await searchOrder(cookie)
        }
    }
    if (orderList.length == 0) {
        await sendNotify(`没有搜索到【${key}】相关商品`)
    }
})().catch((e) => {
    console.log("脚本异常：" + e);
});

async function searchOrder(cookie) {
    const options = {
        "method": 'get',
        "url": `https://api.m.jd.com/client.action?loginType=11&appid=new_order&functionId=common_order_search&body={"platform":2,"uuid":"21416750048251673683672275","keyword":"${key}","page":1,"pageSize":3}`,
        "headers": {
            "Host": "api.m.jd.com",
            "User-Agent": "okhttp/3.12.1;jdmall;android;version/11.3.4;build/98475;",
            "Referer": "https://servicewechat.com/wx91d27dbf599dff74/689/page-frame.html",
            "Cookie": cookie
        }
    }
    let result = await api(options).json();
    console.log(JSON.stringify(result))
    if (result) {
        var pin = result.body.baseInfo.pin;
        let orders = result.body.orderList
        if (orders && orders.length > 0) {
            for (let i = 0; i < orders.length; i++) {
                let order = orders[i];
                let orderId = order.orderId // 订单号
                let orderStatus = order.orderStatusInfo.orderStatusName //订单完成状态
                let shouldPay = order.shouldPay // 付款金额
                let shouldPayTip = order.shouldPayTip // 实付
                let submitDate = order.submitDate // 下单时间
                let wareName = order.wareInfoList[0].wareName // 商品名称
                orderList.push(`账号名称：${pin}
商品名称：${wareName}
订单编号：${orderId}
订单状态：${orderStatus}
付款金额：${shouldPayTip}${shouldPay}元
下单时间：${submitDate}`)
                await sendNotify(orderList[orderList.length - 1])
            }
        }
    }
}