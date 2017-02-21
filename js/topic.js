/**
 * Created by zhangfanglan on 2017/2/20.
 *//**
 * [description] 话题详情
 * @author guodanying,wangchunpeng
 * @dete 2016-06-22T10:53:46+0800
 guody 16.09.05 话题添加点赞，回复，一级加载，二级加载的接口，
 验证圈子是否存在或者审核通过(php包的同一个接口)
 */
define('conf/Group/detail.js', function(require, exports, module) {
    var ajax = require('utils/ajax'),
        common = require('common/index'),
        common_login = require('mods/login'),
        common_app = require("common/app"),
        shareInWX = require('mods/shareInWX'),
        xin_share = require('components/xin-share'),
        Vue = require("vue");
    var storage = require('mods/storage');
    var appEvent = require('mods/appEvent');
    var UI = require('UI/dialog/alert');
    var returnTop = require('mods/returnTop');
    var replace = require('mods/replace');
    require('components/dlclient'); //header部分的下载客户端
    var enHtml = require('mods/encodeHtml'); //encode Html标签
    require('vendors/dropload.js');
    require('conf/public/download.js');
    var mods_check = require("mods/check");
    var sg = require('mods/storage.js');
    //埋点的gId，tId
    var gId = typeof groupId !=="undefined" ? groupId :0,
        tId = typeof topicId !=="undefined" ? topicId :0;
    var vue_like,
        b_first = true,
        data_comment = {},
        internal_reply = {},
        placeholder = '说点什么吧：',
        serverTime = 0, // 根据ajax获取服务器时间
        internal_obj = {
            is_likeing: false,
            is_collecting: false
        };

    var $wrap_send = $(".send-bx"),
        $textarea = $wrap_send.find("textarea");

    Vue.filter("replaceFace", function(str) {
        str = enHtml(str).replace(/\n/g, '<br/>').replace(/\s/gi, "&nbsp;");
        return replace.replaceFace(str);
    });
    Vue.filter("replaceData", function(timestamp) {
        return replace.replaceData(timestamp, serverTime);
    });
    Vue.filter('reply_circ_origin', function(index, time) { //楼层--时间
        return (index + 1) + '楼&nbsp;&nbsp;&nbsp;' + replace.replaceData(time, serverTime);
    });
    Vue.filter('reply_topic_pic', function(top_pic) {
        if (!top_pic) {
            return [];
        }
        return top_pic.split(",");
    });
    Vue.filter("reply_item_price", function(price) {
        if (!price) {
            return "0.00";
        }
        return (price / 100).toFixed(2);
    });

    var vue_replys = new Vue({ //回复列表
        el: '#reply-count',
        template: '#tmpl_replys',
        replace: false,
        data: {
            replys: [],
            numper: 1,
            disabled_zone_loding1: false,
            html_zone_loading1: '点击加载更多',
            total: 0
        },
        methods: {
            click_circ_loadmore: function(reply) { //加载更多的回复列表(二级回复)
                // var pageNum = parseInt((reply.topicSubReplys.length) / 10) + 1;
                ajax.postData('/group/getmorereply', {
                    // pageNum: 1,
                    // numPerPage: reply.subReplyQuantity,
                    topicReplyId: reply.id
                }, function(data) {
                    //自动换行
                    if (data.code == 403) {
                        UI.alerter(data.message, undefined, function() {
                            location.reload();
                        });
                        $('.xin-mask,.xin-dialog').show();
                    } else if (data.code == 200) {
                        var list = data.data.topicSubReplys || [],
                            subReplys = reply.topicSubReplys;
                        // pageNum === 1 ? subReplys = [] : '';
                        subReplys = [];
                        reply.topicSubReplys = subReplys.concat(list);
                        reply.subReplyQuantity = list.length;
                    }
                },1,reply.subReplyQuantity);
            },
            // click_zone_loding1: function() { //加载更多一级回复
            //     if (this.disabled_zone_loding1) {
            //         return;
            //     }
            //     this.numper++;
            //     reply_api.reply(this.numper, 10);
            // },
            /**
             * [click_circ_answer description]回复一级回复
             * @param  {[type]} reply [description] 一级回复的数据
             */
            click_circ_answer: function(reply) {
                internal_reply.comment = {};
                internal_reply.reply = reply;
                reply_api.check_topic_comment({replyId: reply.id}, function() {
                    data_comment = {
                        topicId: topicId,
                        topicReplyId: reply.id,
                        replyId: reply.id
                    };
                },1);
                vue_main.placeholder_zone = ' 回复:' + reply.user.nickname;
            },
            /**
             * [click_subreplys description]回复二级回复
             * @param  {[type]} comment [description] 该二级回复的数据
             * @param  {[type]} reply   [description] 一级回复的数据
             */
            click_subreplys: function(comment, reply) {
                internal_reply.comment = comment;
                internal_reply.reply = reply;
                reply_api.check_topic_comment({replyId: comment.id}, function() {
                    data_comment = {
                        topicId: topicId,
                        topicReplyId: reply.id,
                        topicSubReplyId: comment.id
                    };

                },2);
                sg.setItem('topicReplyId', reply.id);
                sg.setItem('replyType', reply.replyType);
                vue_main.placeholder_zone = ' 回复:' + comment.user.nickname;
            }
        }
    });


    function load_likelist(flag) { //加载点赞列表
        ajax.postData('/group/praiseuserlist', {
            topicId: topicId
        }, function(data) {
            if (b_first) {
                b_first = false;
                vue_like = new Vue({ //点赞列表
                    el: '.tpc-like',
                    template: "#tmpl_head_list",
                    replace: false,
                    data: {
                        data: {},
                        wapjspath: wapjspath
                    }
                });
            }
            if (data.data) {
                vue_like.data = data.data;
                if (flag) {
                    $(".tpc-like .like-hd").removeClass("active");
                } else {
                    $(".tpc-like .like-hd").addClass("active");
                    /* $(".tpc-like-list").show()*/
                }
                setTimeout(function() {

                }, 200);
            } else {
                UI.alerter(data.message);
            }
        });
    }

    /*收藏和取消收藏*/
    function collect() {
        if (internal_obj.is_collecting) {
            return;
        }
        internal_obj.is_collecting = true;
        var $collection = $(".iconn-9"),
            url = $collection.length == 0 ? "/group/delCollectionTopic" : "/group/collectionTopic";
        ajax.postData(url, {
            userId: userId,
            topicId: topicId,
            groupId: groupId
        }, function(data) {
            if (data.code == 200) {
                if ($collection.length == 0) {
                    $(".iconn-46").addClass("iconn-9").removeClass("iconn-46");
                    UI.alertSecond('取消收藏成功');
                    BP.send({"event_id":"BW00H039","name":"收藏按钮的点击量","group_id":gId,"topic_id":tId,"type":"0"})
                } else {
                    $collection.addClass("iconn-46").removeClass("iconn-9");
                    UI.alertSecond('收藏成功');
                    BP.send({"event_id":"BW00H039","name":"收藏按钮的点击量","group_id":gId,"topic_id":tId,"type":"1"})
                }
            } else {
                UI.prompt(data.message);
            }
            internal_obj.is_collecting = false;
        })
    }
    /*点赞和取消点赞*/
    function like() {
        if (internal_obj.is_likeing) {
            return;
        }
        internal_obj.is_likeing = true;
        var $self = $(".iconn-12"),
            url = $self.length == 0 ? "/group/delpraise" : "/group/addpraise";
        ajax.postData(url, {
            topicId: topicId
        }, function(data) {
            if (data.code == 200) {
                if ($self.length == 0) {
                    $(".iconn-29").addClass("iconn-12").removeClass("iconn-29");
                    $(".tpc-like .like-hd").removeClass("active");
                } else {
                    $self.addClass("iconn-29").removeClass("iconn-12");
                    $(".tpc-like .like-hd").addClass("active");
                }
                load_likelist($self.length == 0);
            } else if (data.code == 403) { //审核不通过
                UI.alerter(data.message, "确定", function() {
                    location.reload();
                });
                $('.xin-mask,.xin-dialog').show();
            } else {
                UI.prompt(data.message);
            }
            internal_obj.is_likeing = false;
        })
    }

    var reply_api = {
        id_timeout_blur: "",
        id_timeout_weixin: "",
        id_timeout_touch: "",
        is_show_send: false, //是否显示评论框
        is_btn_active: false,
        num_scrolltop: 0,
        is_first: true,
        inner_height: 0,
        check_topic_comment: function(obj, callback,replyType) { //检测话题是否可回复
            var defaults = {
                topicId: topicId,
                type: replyType
            };
            $.extend(defaults,obj);

            if (common_login.isLogin) { //先判断是否登录
                ajax.postData('/group/checkTopicReply', defaults, function(data) {
                    if (data.code == 200) { //可以回复
                        reply_api.num_scrolltop = $("body").scrollTop();
                        callback();
                        reply_api.showSendBtn();
                    }else if(data.code == 403){
                        UI.alerter(data.message, "确定", function() {location.reload();});
                        $('.xin-mask,.xin-dialog').show();
                    }else {
                        if (data.message.indexOf("login") >= 0) {
                            common_login.login(true);
                            return;
                        }
                        UI.prompt(data.message, undefined, function() {
                            if (data.code == 404) {
                                location.reload(true);
                            }
                        });
                    }
                }, '', '', false);
            } else { //未登录，去登陆
                common_login.login(true);
            }
        },
        reply: function(numper, numPerPage) { //加载回复列表
            ajax.postData('/group/getReply', {
                topicId: topicId
            }, function(data, status, xhr) {
                serverTime = +new Date(xhr.getResponseHeader("Date"));
                $textarea[0].removeAttribute("disabled");
                if (data.code == 200 && data.data && data.data.topicReplys) {
                    var topicReplys = data.data.topicReplys;
                    if (!topicReplys.length && !reply_api.is_first) {
                        UI.alertSecond("没有更多内容了");
                        reply_api.is_first = false;
                        return;
                    }
                    if (topicReplys.length >= 10 && reply_api.is_first) {
                        reply_api.dropload();
                    }
                    reply_api.is_first = false;
                    for (var i = 0, l = topicReplys.length; i < l; i++) {
                        topicReplys[i].topicSubReplys = topicReplys[i].topicSubReplys || [];
                    }
                    var replys = vue_replys.replys;
                    vue_replys.replys = replys.concat(topicReplys);
                    vue_replys.total = data.data.total;
                }else if(data.code == 403||data.code == 404){
                    UI.alerter(data.message, "确定", function() {location.reload();});
                    $('.xin-mask,.xin-dialog').show();
                } else {
                    UI.alertSecond(data.message);
                    return;
                }
                setTimeout(function() { //处理头像没加载出来使用默认头像
                    $('.circ-head-list img,#reply-count .circ-head img').each(function() {
                        $(this).on("error", function() {
                            $(this).attr("src", wapcsspath + '/images/default_header.png');
                        })
                    });
                }, 0);
            }, numper, numPerPage);
        },
        bindEvent: function() {
            /*控制回复按钮*/
            $textarea.on("focus", function() { // 一级回复检测
                reply_api.showSendBtn();
            });
            $wrap_send.on('touchmove', function(event) {
                if (event.target.tagName.toLowerCase() != 'textarea') {
                    event.preventDefault();
                }
            });
            $textarea.on("blur", function() {
                if (reply_api.is_btn_active) {
                    reply_api.id_timeout_blur = setTimeout(function() {
                        callback();
                    }, 300);
                } else {
                    callback();
                }

                function callback() {
                    reply_api.hideSendBtn();
                }
            });
            $("#download .dl_close").on("click", function() { //只是针对本页面的
                $(".main").css("top", '0');
            });
            document.addEventListener('touchstart', function(e) {
                var target = e.target;
                if (target == $(".send-bx a.send-btn").get(0)) {
                    reply_api.is_btn_active = true;
                } else {
                    reply_api.is_btn_active = false;
                }
                var ua = navigator.userAgent.toLowerCase();
                if(ua.indexOf("iphone") > 0 && reply_api.is_show_send){
                    reply_api.id_timeout_touch = setTimeout(function(){
                        $textarea[0].blur();
                    },300);
                }
            });
        },
        hideSendBtn: function() {
            reply_api.is_show_send = false;
            // $wrap_send.css("position", 'fixed');
            if (mods_check.isWeiXin()) {
                $(".dl_clients").css("display", 'block');
            }
            vue_main.show_send_btn = false;
            vue_main.placeholder_zone = placeholder;
            $("body").scrollTop(reply_api.num_scrolltop);
        },
        showSendBtn: function() {
            reply_api.is_show_send = true;
            clearTimeout(reply_api.id_timeout_touch);
            reply_api.handle_meizu();
            var $body = $("body");
            vue_main.show_send_btn = true;
            $wrap_send.show();
            if (mods_check.isWeiXin()) {
                $(".dl_clients").css("display", 'none');
            }
            //$textarea.get(0).focus();
            //setTimeout(function() {
            reply_api.inner_height = window.innerHeight;
            reply_api.settimeout_weixin();
            var height = $body.get(0).scrollHeight;
            if (!mods_check.isWeiXin() && mods_check.isIOS()) {
                height = height - 275;
            } else {
                height = height + $textarea.height() + 300;
            }
            $body.scrollTop(height);
            //}, 300);
            $textarea.get(0).focus();
        },
        dropload: function() {
            $("#reply-count").dropload({
                scrollArea: window,
                domDown: {
                    domClass: 'dropload-down',
                    domRefresh: '<div class="dropload-refresh">↑上拉加载更多</div>',
                    domUpdate: '<div class="dropload-update">↓释放加载</div>',
                    domLoad: '<div class="dropload-load"><span class="loading"></span>加载中...</div>'
                },
                loadDownFn: function(me) {
                    setTimeout(function() {
                        me.resetload();
                        vue_replys.numper++;
                        reply_api.reply(vue_replys.numper, 10);
                    }, 500);
                }
            });
        },
        settimeout_weixin: function() {
            if (mods_check.isWeiXin()) {
                reply_api.id_timeout_weixin = setTimeout(function() {
                    var height = window.innerHeight;
                    if (height > reply_api.inner_height + 100) {
                        clearTimeout(reply_api.id_timeout_weixin);
                        reply_api.hideSendBtn();
                        $textarea[0].blur();
                    } else {
                        reply_api.settimeout_weixin();
                    }
                }, 1000);
            }
        },
        handle_meizu: function(){ //处理魅族手机在弹出软键盘的时候遮住一部分输入框
            var ua = navigator.userAgent.toLowerCase();
            if (ua.indexOf("mz") > 0 && ua.indexOf("android") > 0) {
                var h = (window.screen.height - window.innerHeight) / 2 + 10;
                $wrap_send.css("margin-bottom", h);
                $("body").one("touchmove", function() {
                    $wrap_send.css("margin-bottom", 0);
                });
            }
        }
    }

    /*init*/
    function init() {
        storage.removeItem('myHref', true);
        //新分享组件(分享到第三方)
        xin_share.init({
            imgsrc: topicPic,
            bdtext: topicTitle,
            shareMaiDian:{"topicId":tId}
        }, {
            weibo: {
                bdtext: '终于找到了和我志趣相同的小伙伴，有种找到组织的感觉。'
            }
        });
        //微信内部分享
        var link = location.href;
        shareInWX({
            title: topicTitle,
            link: link,
            imgUrl: topicPic,
            desc: topicText
        });
        appEvent.appStart(common_app.goToApp({
            type: 11,
            fir: topicId
        }), 1);
        /*加载回复列表*/
        reply_api.reply(1, 10);
        setTimeout(function() {
            if (common_login.isLogin) {
                if (storage.getItem("detail_login_collect") === "1") {
                    collect();
                    storage.removeItem("detail_login_collect");
                }
                if (storage.getItem("detail_login_like") === "1") {
                    like();
                    storage.removeItem("detail_login_like");
                }
            }
        }, 2000);
        $(".opg").on("tap", ".like-hd", function() {
            vue_main.click_like();
        });
    }

    var vue_main = new Vue({
        el: '.opg',
        data: {
            placeholder_zone: "说点什么吧：",
            show_send_btn: false,
            is_sending: false //解决网络慢的问题
        },
        init: function() {
            var self = this;
            init();
            /*播放视频*/
            $(".videoContainer .video-play").on("click", function() {
                var $videoplayer = $(this).parents(".videoContainer"),
                    id = $videoplayer.attr("id"),
                    videoid = $videoplayer.attr("data-videoid");
                var player = new MeixinPlayer();
                $videoplayer.empty();
                $videoplayer.removeClass('circ-img');
                player.init(videoid, id, {
                    autoplay: 1,
                    height: 'auto',
                    showFullBtn: 1
                });
            });
            reply_api.bindEvent();
        },
        methods: {
            click_send_btn: function() { //回复话题
                clearTimeout(reply_api.id_timeout_blur);
                var self = this;
                if (self.is_sending) {
                    return;
                }
                self.is_sending = true;
                var $self = $('.send-bx textarea'),
                    content = $self.val();
                if (!content.trim()) {
                    UI.alertSecond("输入内容不能为空！");
                    $self.val("");
                    reply_api.hideSendBtn();
                    return;
                }
                if (content.length > 200) {
                    UI.alertSecond("输入内容长度不能超过200");
                    return;
                }
                var url = '/group/replyTopicReply',
                    isLimb = false, //是否是一级回复
                    obj = {};
                for (var key in data_comment) { //防止污染了data_comment变量,否则在发送失败了再次发送有问题
                    obj[key] = data_comment[key];
                }
                if ($.isEmptyObject(obj)) {
                    url = '/group/replyTopic';
                    obj = {
                        replyType: 0,
                        topicId: topicId
                    };
                    isLimb = true;
                }
                obj["content"] = content;
                ajax.postData(url, obj, function(data, status, xhr) {
                    serverTime = +new Date(xhr.getResponseHeader("Date"));
                    self.is_sending = false;
                    if (data.code == 200) {
                        data_comment = {};
                        $self.val("").blur();
                        if (isLimb) { //一级评论
                            if (vue_replys.replys.length >= vue_replys.total) {
                                data.data.topicSubReplys = [];
                                vue_replys.replys.push(data.data);
                                vue_replys.total++;
                            }
                        } else { // 二级
                            var topicSubReplys = internal_reply.reply.topicSubReplys || [];
                            topicSubReplys.push(data.data);
                            internal_reply.reply.topicSubReplys = topicSubReplys;
                            internal_reply.reply.subReplyQuantity++;
                        }
                        reply_api.hideSendBtn();
                        UI.alertSecond('回复成功');
                    }else if(data.code == 403){
                        UI.alerter(data.message, "确定", function() {
                            location.reload();
                        });
                        $('.xin-mask,.xin-dialog').show();

                    }else {
                        if (data.message.indexOf("login") >= 0) {
                            common_login.login(true);
                            return;
                        }
                        UI.alertSecond(data.message);
                    }
                });
            },
            click_add_reply: function() { // 添加一级回复
                if (reply_api.is_first) { //如果还没加载出来回复列表，就先不响应这个事件
                    return;
                }
                internal_reply.comment = {};
                reply_api.check_topic_comment({}, function() {},0);
            },
            click_like: function() { // 点赞和取消点赞
                ajax.postData('/group/checktopic', {
                    topicId: topicId
                }, function(data) {
                    if (data.code == 200) {
                        if (!common_login.isLogin) { //如果没登录
                            storage.setItem("detail_login_like", 1);
                            common_login.login(true);
                            return;
                        }
                        like();

                    } else if (data.code == 403) {

                        UI.alerter(data.message, "确定", function() {
                            location.reload();
                        })
                        $('.xin-mask,.xin-dialog').show();
                        return;

                    } else if (data.code == 404 && data.code == 410) {
                        UI.alerter(data.message, "确定", function() {
                            location.reload();
                        })
                        $('.xin-mask,.xin-dialog').show();
                        return;

                    } else {
                        UI.alertSecond(data.message);
                        return;

                    }
                });
                /* */

            },
            click_collect: function() { // 收藏取消收藏
                if (common_login.isLogin) {
                    collect();
                } else {
                    storage.setItem("detail_login_collect", '1');
                    common_login.login(true);
                }
            },
            click_share: function() { //点击分享按钮
                UI.addliste();
                $("#share_panel").show();
                $('#share_cover').css({
                    'transition': 'all 0.5s ease-out',
                    'bottom': '0%',
                    '-webkit-transition': 'all 0.5s ease-out',
                    '-moz-transition': 'all 0.5s ease-out'
                });
                xin_share.show();
                BP.send({"event_id":"BW00H030","name":"分享按钮","topic_id":tId,"group_id":gId});
            }
        }
    });
});
