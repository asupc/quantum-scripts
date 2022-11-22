
const {
    sendNotify
} = require('./quantum');


!(async () => {

    /**
     *
     * ����һ����ͨ������Ϣ
     * Ĭ�Ϸ��͸�������Ϣ���û�����Ҫ�ű�������Ϣ֪ͨ��
     * 
     **/
    await sendNotify("������Ϣ");

    /**
     *
     * ����һ��ͼƬ��Ϣ
     * Ĭ�Ϸ��͸�������Ϣ���û�����Ҫ�ű�������Ϣ֪ͨ��
     * 
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.jpg", MessageType: 2 })

    /**
     *
     * ����һ��ͼƬ��Ϣ
     * Ĭ�Ϸ��͸�������Ϣ���û�����Ҫ�ű�������Ϣ֪ͨ��
     * 
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.mp4", MessageType: 3 })


    /**
     * ������Ա����һ��������Ϣ
     **/
    await sendNotify("������Ϣ", true);

    /**
     * ������Ա����һ��ͼƬ��Ϣ
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.jpg", MessageType: 2 }, true);

    /**
     * ������Ա����һ����Ƶ��Ϣ
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.mp4", MessageType: 3 }, true);

    /**
     * ������Ա����һ��������Ϣ��ָ��ʹ��΢�ŷ���  ������ͼƬ��Ƶ�����޸ĵ�һ������
     **/
    await sendNotify("������Ϣ", true, null, null, 4);

    /**
     * ��ָ��QQ �û�����һ����Ϣ
     **/
    await sendNotify("������Ϣ", false, "QQ����", null, 1);

    /**
     * ��ָ��QQ �û�����һ��ͼƬ
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.jpg", MessageType: 2 }, false, "QQ����", null, 1);

    /**
     * ��ָ��QQ �û�����һ����Ƶ
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.mp4", MessageType: 3 }, false, "QQ����", null, 1);

    /**
     * ��ָ��΢���û�����һ����Ϣ
     **/
    await sendNotify("������Ϣ", false, "wxid", null, 4);

    /**
     * ��ָ��QQȺ����һ����Ϣ
     **/
    await sendNotify("������Ϣ", false, "NULL", "QQȺ��");

    /**
     * ��ָ��QQȺ����һ����Ϣ����@ĳ��
     **/
    await sendNotify("������Ϣ", false, "QQ��", "QQȺ��");

    /**
     * ��ָ��΢��Ⱥ����һ����Ϣ
     **/
    await sendNotify("������Ϣ", false, "NULL", "xxxx@chatroom", 4);


    /**
     * ��ָ��΢��Ⱥ����һ��ͼƬ
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.jpg", MessageType: 2 }, false, "NULL", "xxxx@chatroom", 4);

    /**
     * ��ָ��΢��Ⱥ����һ����Ƶ
     **/
    await sendNotify({ msg: "http://xxx.com/xxx.mp4", MessageType: 4 }, false, "NULL", "xxxx@chatroom", 4);

    /**
     * ��ָ��΢��Ⱥ����һ����Ϣ����@ĳ��
     **/
    await sendNotify("������Ϣ", false, "wxid", "xxxx@chatroom", 4);



})().catch((e) => {console.log("脚本异常：" + e);});