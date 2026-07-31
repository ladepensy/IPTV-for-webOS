# LG webOS IPTV

一个面向 LG webOS TV 的轻量 IPTV Web App。默认连接家中 `rtp2httpd` 服务，获取 M3U 播放列表并通过电视原生媒体能力播放频道。

## 当前功能

- 从本地配置文件指定的 rtp2httpd 地址加载频道
- 解析频道名称、分组和播放地址
- 支持遥控器方向键、OK 和 Back
- 支持鼠标点击，方便在浏览器和 Simulator 中调试
- 使用原生 `<video>` 播放 rtp2httpd 提供的 HTTP 视频流
- 适配 1920×1080，并兼容较低分辨率的调试窗口

## 项目结构

```text
.
├── appinfo.json   # webOS 应用清单
├── index.html     # 应用页面
├── styles.css     # 电视端界面样式
├── app.js         # M3U 解析、遥控器和播放逻辑
├── config.example.js # 脱敏的本地配置模板
├── icon.png
└── largeIcon.png
```

## 开发环境

建议安装：

- [Visual Studio Code](https://code.visualstudio.com/)
- LG 官方 webOS Studio 扩展
- webOS TV 25 Simulator
- LG webOS CLI

Simulator 下载及要求见 [LG webOS TV Simulator Installation](https://webostv.developer.lge.com/develop/tools/simulator-installation)。

## 本地预览

先创建仅供本机使用的配置文件：

```bash
cp config.example.js config.js
```

然后编辑 `config.js`：

```js
window.IPTV_CONFIG = {
  playlistUrl: "http://YOUR_IPTV_SERVER:5140/playlist.m3u"
};
```

`config.js` 已加入 `.gitignore`，不会被 Git 跟踪。不要把私人服务器地址写进源码、README 或示例配置。

安装 webOS CLI 后，在项目目录运行：

```bash
ares-server . --open
```

普通浏览器适合检查布局和 M3U 解析；遥控器焦点、实际解码和换台表现应在 Simulator 与 LG C5 真机上验证。

## 在 Simulator 中运行

使用 webOS Studio：

1. 在 VS Code 中打开本项目。
2. 在项目目录上右键。
3. 选择 **Run on Simulator**。
4. 选择 **webOS TV 25**。

也可以使用命令行：

```bash
ares-launch --simulator 25 .
```

## 安装到 LG C5

电视需要开启 Developer Mode，并确保电脑与电视位于同一局域网。

```bash
# 添加电视；按提示填写电视 IP
ares-setup-device

# 打包
ares-package .

# 安装，myTV 替换为 ares-setup-device 中设置的设备名
ares-install --device myTV com.odyssey.webos.iptv_0.1.0_all.ipk

# 启动
ares-launch --device myTV com.odyssey.webos.iptv
```

## 遥控器操作

| 按键 | 行为 |
| --- | --- |
| 上 / 下 | 选择频道 |
| OK | 播放选中的频道 |
| Back | 播放时先停止；再次按下退出应用 |
| Page Up / Page Down | 在电脑调试时快速跳过 8 个频道 |

## IPTV 服务依赖

应用从未跟踪的 `config.js` 读取播放列表地址：

```js
window.IPTV_CONFIG = {
  playlistUrl: "http://YOUR_IPTV_SERVER:5140/playlist.m3u"
};
```

请求链路：

```text
LG webOS App
  → rtp2httpd :5140
  → 本机 PHP M3U 服务 :8080
  → IPTV 组播网络
```

PHP 的 `8080` 端口仅监听服务器回环地址；客户端只需访问 `5140`。rtp2httpd 同时负责频道地址转换和 EPG 代理。

如服务器地址发生变化，只需修改本地 `config.js`，无需修改或提交应用源码。

## 已知限制

- 当前版本尚未显示 EPG 节目单，只使用 M3U 频道信息。
- 收藏、频道搜索和播放进度记忆尚未实现。
- Simulator 的音视频支持与真机不同，IPTV 播放必须在 LG C5 上进行最终验证。

## License

Private project. 未经授权请勿分发。
