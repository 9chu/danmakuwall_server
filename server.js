var http = require('http');
var url = require('url');
var fs = require('fs');
var mine = require('./mine').types;
var path = require('path');
var querystring = require('querystring');

Date.prototype.format = function(fmt) {  // author: meizz 
    var o = { 
        "M+" : this.getMonth()+1,                 // 月份 
        "d+" : this.getDate(),                    // 日 
        "h+" : this.getHours(),                   // 小时 
        "m+" : this.getMinutes(),                 // 分 
        "s+" : this.getSeconds(),                 // 秒 
        "q+" : Math.floor((this.getMonth()+3)/3), // 季度 
        "S"  : this.getMilliseconds()             // 毫秒 
    }; 
    if(/(y+)/.test(fmt)) 
        fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length)); 
    for(var k in o) 
        if(new RegExp("("+ k +")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length))); 
    return fmt; 
};

String.prototype.startWith = function(str) {
    var strlen = str.length;
    if (this.length < strlen)
        return false;
    for (var i = 0; i < strlen; ++i) {
        if (str.charAt(i) != this.charAt(i))
            return false;
    }
    return true;
};

function response400(response, requestPath) {
    response.writeHead(400, {
        'Content-Type': 'text/html'
    });
    response.write("<body><h1>400 wrong paramenters</h1><br /><p>Request path: '" + requestPath + "'.</p></body>");
    response.end();
}

function response403(response, requestPath) {
    response.writeHead(403, {
        'Content-Type': 'text/html'
    });
    response.write("<body><h1>403 forbidden</h1><br /><p>Request path: '" + requestPath + "'.</p></body>");
    response.end();
}

function response404(response, requestPath) {
    response.writeHead(404, {
        'Content-Type': 'text/html'
    });
    response.write("<body><h1>404 page not found</h1><br /><p>Request path: '" + requestPath + "'.</p></body>");
    response.end();
}

function response500(response, requestPath) {
    response.writeHead(500, {
        'Content-Type': 'text/html'
    });
    response.write("<body><h1>500 server internal error</h1><br /><p>Request path: '" + requestPath + "'.</p></body>");
    response.end();
}

// 载入配置
console.log("正在读取配置...");
var config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

// 黑名单列表
console.log("正在读取黑名单...");
if (!fs.existsSync('blacklist.txt')) {
    console.log('未识别到黑名单...');
}
else {
    console.log('正在载入黑名单...');
    var blacklist = fs.readFileSync('blacklist.txt', 'utf-8').split('\n').filter(function(value) {
        if (value !== '' && value[0] !== '!') {
            return value;
        }
    });
}


if (typeof(config.webroot) !== "string" || !fs.existsSync(config.webroot))
    console.error("webroot文件夹不存在或无效!");
else {
    var realRootPath = fs.realpathSync(config.webroot);
    console.log("根资源目录: " + realRootPath);
    console.log("正在初始化服务器...");
    
    var commentQueue = [];  // 弹幕队列
    var waitQueue = [];  // 等待响应队列
    
    var doPostComment = function (remoteAddr, param) {
        // NOTE:
        //   要求POST中的数据包括以下几个参数：
        //     comment 评论文本
        //     colorR  颜色值红色分量
        //     colorG  颜色值绿色分量
        //     colorB  颜色值蓝色分量
        //     size    字体大小(0~5) 小\较小\普通\较大\大
        //     type    样式(0~2) 普通\顶端\底端
        var data = {};
        var now = Date.now() / 1000;
        if (!("comment" in param) || !("colorR" in param) || !("colorG" in param) || !("colorB" in param) || 
            !("size" in param) || !("type" in param))
            return false;
        if (param["comment"].length > config.commentMaxLength)
            return false;
        data["ip"] = remoteAddr;
        data["comment"] = param["comment"];
        data["color"] = [ parseInt(param["colorR"]), parseInt(param["colorG"]), parseInt(param["colorB"]) ];
        data["time"] = now;
        data["size"] = parseInt(param["size"]);
        data["type"] = parseInt(param["type"]);
        
        // 检查参数合法性
        if (data["size"] < 0 || data["size"] > 4 || data["color"][0] < 0 || data["color"][0] > 255 || 
            data["color"][1] < 0 || data["color"][1] > 255 || data["color"][2] < 0 || data["color"][2] > 255 ||
            data["type"] < 0 || data["type"] > 2)
            return false;

        // 检查是否在黑名单列表
        if (!blacklist.every(function(value) {
                return data.comment.indexOf(value) === -1;
            })) {
            console.log('评论"' + data.comment + '"已被黑名单屏蔽!');
            return true;
        }
        
        // 递交到队列前清理过期的弹幕
        while (commentQueue.length > 0) {
            if (now - commentQueue[0].time > config.commentCacheMaxTime)
                commentQueue.shift();
            else
                break;
        }
        commentQueue.push(data);
        handleWaitQueue();
        
        console.log("[弹幕池] 收到来自 " + remoteAddr + " 的弹幕: " + data.comment);
        return true;
    };
    
    var sendComment = function (response) {
        var now = Date.now() / 1000;
        
        // 清理过期的弹幕
        while (commentQueue.length > 0) {
            if (now - commentQueue[0].time > config.commentCacheMaxTime)
                commentQueue.shift();
            else
                break;
        }
        
        if (commentQueue.length === 0)
            return false;
            
        var data = JSON.stringify(commentQueue);
        commentQueue.splice(0, commentQueue.length);
        response.writeHead(200, {
            'Content-Type': "text/plain; charset=utf-8"
        });
        response.write(data);
        response.end();
        return true;
    };
    
    var handleWaitQueue = function () {
        if (waitQueue.length > 0) {
            var data = JSON.stringify(commentQueue);
            commentQueue.splice(0, commentQueue.length);
            
            while (waitQueue.length > 0) {
                var request = waitQueue.shift();
                if (request.timeout == true)
                    continue;
                
                // 写出弹幕评论
                request.response.writeHead(200, {
                    'Content-Type': "text/plain; charset=utf-8"
                });
                request.response.write(data);
                request.response.end();
                
                clearTimeout(request.timeoutHandle);
                console.log("[" + new Date().format("yyyy-MM-dd hh:mm:ss") + "] 长轮询响应 IP: " + request.remoteAddr + " <- 200");
            }
        }
    };
    
    var clearTimeoutQueueElement = function () {
        if (waitQueue.length > 50) {
            var newQueue = [];
            for (var i = 0; i < waitQueue.length; ++i) {
                if (!waitQueue[i].timeout)
                    newQueue.push(waitQueue[i]);
            }
            waitQueue = newQueue;
        }
    };
    
    // 初始化服务端
    var server = http.createServer(function (request, response) {
        var requestTime = new Date().format("yyyy-MM-dd hh:mm:ss");
        var requestPath = url.parse(request.url).pathname;
        if (requestPath === "/")  // index
            requestPath += config.index;
        var realPath = path.join(config.webroot, requestPath);
        var remoteAddr = request.socket.remoteAddress;
        
        try {
            // 写出日志
            console.log("[" + requestTime + "] 请求 IP: " + remoteAddr + " " + request.method + " " + requestPath);
            
            var postData = "";
            if (requestPath === config.commentPostApiUrl) {
                if (request.method !== "POST") {
                    response400(response, requestPath);
                    console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 400");
                    return;
                }
                
                // 设置接收数据编码格式为 UTF-8
                request.setEncoding('utf-8');
                request.addListener("data", function (postDataChunk) {  // 数据块接收中
                    // !TODO: 如何限制postData大小
                    postData += postDataChunk;
                });
                request.addListener("end", function () {  // 数据接收完毕，执行回调函数
                    if (!doPostComment(remoteAddr, querystring.parse(postData))) {
                        response400(response, requestPath);
                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 400");
                    }
                    else {
                        response.writeHead(200, {
                            'Content-Type': "text/plain"
                        });
                        response.write("OK");
                        response.end();
                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 200");
                    }
                });
            }
            else if (requestPath === config.commentFetchApiUrl) {
                if (request.method !== "POST") {
                    response400(response, requestPath);
                    console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 400");
                    return;
                }
                
                // 设置接收数据编码格式为 UTF-8
                request.setEncoding('utf-8');
                request.addListener("data", function (postDataChunk) {  // 数据块接收中
                    // !TODO: 如何限制postData大小
                    postData += postDataChunk;
                });
                request.addListener("end", function () {  // 数据接收完毕，执行回调函数
                    var params = querystring.parse(postData);
                    if (!("key" in params)) {
                        response400(response, requestPath);
                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 400");
                    }
                    else if (params["key"] !== config.commentFetchAuthKey) {  // 认证失败
                        response403(response, requestPath);
                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 403");
                    }
                    else {
                        // 若有缓存的弹幕，则立即发送
                        if (commentQueue.length > 0 && sendComment(response))
                            console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 200");
                        else {
                            // 打包缓存
                            var req = { timeout: false, response: response, remoteAddr: remoteAddr, timeoutHandle: null };
                            req.timeoutHandle = setTimeout(function () {
                                req.timeout = true;
                                response.writeHead(200, {
                                    'Content-Type': "text/plain"
                                });
                                response.write("[]");
                                response.end();
                                console.log("[" + requestTime + "] 长轮询响应(已超时) IP: " + remoteAddr + " <- 200");
                                clearTimeout(req.timeoutHandle);
                                
                                clearTimeoutQueueElement();
                            }, config.commentFetchTimeout * 1000);
                            waitQueue.push(req);
                        }
                    }
                });
            }
            else {
                fs.exists(realPath, function (exists) {
                    if (!exists) {  // 被请求的路径不存在
                        response404(response, requestPath);
                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 404");
                    }
                    else {
                        fs.stat(realPath, function (err, info) {
                            if (err) {  // 若无法获取被请求的资源
                                console.error("[错误] 无法获取'" + realPath + "'的属性(fs.stat failed)。");
                                response500(response, requestPath);
                                console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 500");
                                return;
                            }
                            // 获取真实路径
                            fs.realpath(realPath, function (err, fullRealPath) {
                                if (err) {  // 若无法获取被请求的资源
                                    console.error("[错误] 无法获取'" + realPath + "'的真实路径(fs.realpath failed)。");
                                    response500(response, requestPath);
                                    console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 500");
                                    return;
                                }
                                if (!fullRealPath.startWith(realRootPath) || info.isDirectory()) {  // 检查跨域或文件夹
                                    response403(response, requestPath);
                                    console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 403");
                                    return;
                                }
                                
                                // 一般文件
                                var ext = path.extname(fullRealPath);
                                ext = ext ? ext.slice(1) : 'unknown';
                                
                                // 写出文件到流
                                fs.readFile(fullRealPath, "binary", function (err, file) {
                                    if (err) {
                                        console.error("[错误] 无法读取文件'" + fullRealPath + "'。");
                                        response500(response, requestPath);
                                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 500");
                                        return;
                                    }
                                    else {
                                        response.writeHead(200, {
                                            'Content-Type': mine[ext] || "text/plain"
                                        });
                                        response.write(file, "binary");
                                        response.end();
                                        console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 200");
                                    }
                                });
                            });
                        });
                    }
                });
            }
        }
        catch (e) {
            console.error("[错误] 处理请求时发生错误。");
            try {
                response500(response, requestPath);
            }
            catch (e) { }
            console.log("[" + requestTime + "] 响应 IP: " + remoteAddr + " " + request.method + " " + requestPath + " <- 500");
        }
    });
    server.listen(config.port);
    console.log("服务器监听于端口: " + config.port + ".");
}
