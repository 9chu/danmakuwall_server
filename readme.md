# 弹幕墙 服务端

本项目旨在实现实时的弹幕吐槽功能，这是项目的后端部分。

项目运行在nodejs上，将提供一个HTTP服务用以接收弹幕评论并提供长轮询方式由弹幕客户端获取弹幕并予以显示。

## 配置

拷贝```config.default.json```为```config.json```并进行修改。

### 配置项含义

- port: web服务工作端口
- webroot: web文件夹
- index: 主页文件
- commentPostApiUrl: 提交弹幕的API的URL
- commentFetchApiUrl: 获取弹幕的API的URL
- commentFetchAuthKey: 获取弹幕的API的认证密钥
- commentFetchTimeout: 长轮询超时时间，不得长于nodejs超时时间（秒）
- commentCacheMaxTime: 弹幕缓存的最大时间（秒）
- commentMaxLength: 弹幕评论的最长长度

## 部署

直接运行```server.js```即可

## 素材版权申明

项目自带的web页中使用了以下素材：

- 来自网络的图片素材```images/back1.jpg```
- 来自ShiningACG动漫社社员绘制的图片素材```images/back2.jpg```

若将本项目用于盈利目的、商业用途的，请更换这些素材。

## 许可

项目代码基于**MIT LICENSE**许可

