# LG webOS IPTV

一个面向 LG webOS TV 的轻量 IPTV Web App。应用可从任意可访问的 HTTP/HTTPS 数据源获取 M3U 播放列表，并通过电视原生媒体能力播放其中的频道。

## 当前功能

- 从本地配置文件指定任意 M3U 数据源
- 支持配置请求方法、请求头、凭据和请求体
- 解析频道名称、分组和播放地址
- 支持 M3U 中相对于播放列表地址的频道 URL
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

安装 LG 官方 webOS CLI：

```bash
npm install -g @webos-tools/cli
ares-config --profile tv
ares-launch --version
```

## 本地预览

先创建仅供本机使用的配置文件：

```bash
cp config.example.js config.js
```

然后编辑 `config.js`：

```js
window.IPTV_CONFIG = {
  playlist: {
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  }
};
```

数据源只需返回标准 M3U 文本，不要求使用 rtp2httpd。普通静态文件服务器、NAS、反向代理、IPTV 服务或自建 API 均可作为来源。

`config.js` 已加入 `.gitignore`，不会被 Git 跟踪。不要把私人服务器地址写进源码、README 或示例配置。

安装 webOS CLI 后，在项目目录运行：

```bash
ares-server . --open
```

普通浏览器适合检查布局、M3U 解析和基本交互。遥控器焦点与部分 webOS 行为应在 Simulator 中验证；实际解码、换台和长时间播放必须在真机上验证。

## Simulator 调试

### 启动应用

使用 webOS Studio：

1. 在 VS Code 中打开本项目。
2. 在项目目录上右键。
3. 选择 **Run on Simulator**。
4. 选择 **webOS TV 25**。

也可以使用命令行：

```bash
ares-launch --simulator 25 .
```

如果 Simulator 不在 webOS CLI 默认搜索目录，使用 `--simulator-path` 指定解压目录：

```bash
ares-launch \
  --simulator 25 \
  --simulator-path /Users/odyssey/Development/env/webos/webOS_TV_25_Simulator_1.4.4 \
  /Users/odyssey/Development/github/lg-webos-iptv
```

也可以先手动打开 Simulator，然后选择 **File > Launch App**，选中包含 `appinfo.json` 的项目根目录。

### 使用 Inspector

应用运行后，在 Simulator 菜单选择 **Tools > Inspector**，或点击遥控器区域的 **Inspect**。Inspector 可以用于：

- 查看 JavaScript 异常和 Console 输出
- 检查播放列表与频道流的网络请求
- 调试 DOM、CSS、焦点状态和本地存储
- 查看 `<video>` 的 `MediaError`、`networkState` 和 `readyState`

### Simulator 的媒体限制

Simulator 适合测试界面、遥控器、焦点、M3U 加载和部分 webOS API，但其媒体能力不等同于电视硬件。如果 M3U 中的频道是连续 `video/mp2t` 流，TV 25 Simulator 可能返回：

```text
MediaError code 4
DEMUXER_ERROR_COULD_NOT_OPEN
FormatUnsupported
```

即使数据源自己的网页播放器能够加载频道列表，也可能因为 Simulator 无法解封装 MPEG-TS 或不支持 HEVC 而无法播放。以下项目必须以真机结果为准：

- MPEG-TS、HLS 和直播流起播
- H.264、HEVC、MPEG-2、4K、HDR 与隔行视频
- AAC、AC3、EAC3、多音轨和音画同步
- 硬件解码、连续换台、长时间播放和内存稳定性

## 真机调试

### 1. 准备电视

电视与开发电脑必须位于同一局域网。打开电视上的 LG **Developer Mode** App：

1. 登录 LG Developer 账号。
2. 确认 **Dev Mode Status** 为 ON。
3. 检查 **Remain Session**；需要时点击 **EXTEND**。
4. 打开 **Key Server**。
5. 记下 Developer Mode App 显示的 6 位 Passphrase，区分大小写。
6. 在电视网络设置中查看电视的局域网 IP。

Homebrew Channel 不替代 Developer Mode 的 SSH 授权；使用官方 CLI 安装开发包时仍需完成上述步骤。

### 2. 注册电视

运行：

```bash
ares-setup-device
```

选择 `add`，并填写：

```text
Device Name: myTV
Device IP address: 电视的局域网 IP
Device Port: 9922
ssh user: prisoner
description: LG TV
Set default: Yes
Save: Yes
```

Developer Mode 连接固定使用端口 `9922` 和用户 `prisoner`，密码留空。检查配置：

```bash
ares-setup-device --list
```

### 3. 获取 SSH Key 并验证连接

保持电视 Developer Mode App 的 **Key Server** 为 ON：

```bash
ares-novacom --device myTV --getkey
```

按提示输入电视上显示的 6 位 Passphrase，然后验证连接：

```bash
ares-device --system-info --device myTV
```

命令能够显示电视型号、SDK 和固件版本即表示连接成功。

### 4. 打包、安装和启动

在项目根目录运行：

```bash
# 打包
ares-package .

# 安装；myTV 替换为注册时设置的设备名
ares-install --device myTV com.odyssey.webos.iptv_0.1.0_all.ipk

# 启动
ares-launch --device myTV com.odyssey.webos.iptv
```

`config.js` 会被打进 IPK。安装前应确认其中使用的是电视能够访问的局域网地址，而不是 `localhost` 或 `127.0.0.1`。生成的 `*.ipk` 和本地 `config.js` 均已被 `.gitignore` 忽略。

代码修改后，重新执行打包、安装和启动命令即可覆盖开发版本。

### 5. 真机 Inspector

应用在电视上运行后执行：

```bash
ares-inspect \
  --device myTV \
  --app com.odyssey.webos.iptv \
  --open
```

真机 Inspector 适合检查实际频道请求、媒体错误、JavaScript 异常和播放状态。关闭应用：

```bash
ares-launch --device myTV --close com.odyssey.webos.iptv
```

### 调试范围建议

| 环境 | 适合验证 | 不应作为最终结论 |
| --- | --- | --- |
| 普通浏览器 | 页面布局、M3U 解析、数据逻辑、鼠标交互 | webOS API、遥控器、电视解码能力 |
| TV Simulator | 1920×1080 布局、遥控器按键、焦点、生命周期、Inspector | MPEG-TS、HEVC、4K、硬件解码和性能 |
| LG 真机 | 实际音视频解码、换台、局域网、遥控器、性能与稳定性 | 最终验收应以此环境为准 |

### 常见连接问题

- `ares-novacom --getkey` 失败：确认 Key Server 为 ON、IP 正确，并重新输入区分大小写的 Passphrase。
- 端口连接失败：确认使用 `9922`，电脑与电视处于同一局域网，路由器未启用客户端隔离。
- Developer Mode 突然失效：检查 Remain Session；过期前在 Developer Mode App 中点击 EXTEND。
- 应用能打开但列表加载失败：确认 `config.js` 中的服务器地址可由电视访问，并检查服务器防火墙与 CORS。
- 列表正常但频道无法播放：在真机 Inspector 查看 `MediaError`，并核对频道容器、视频编码和音频编码。

LG 官方文档：

- [Developer Mode App 真机连接](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
- [webOS CLI Developer Guide](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)
- [Simulator Developer Guide](https://webostv.developer.lge.com/develop/tools/simulator-dev-guide)

## 遥控器操作

| 按键 | 行为 |
| --- | --- |
| 上 / 下 | 选择频道 |
| OK | 播放选中的频道 |
| Back | 播放时先停止；再次按下退出应用 |
| Page Up / Page Down | 在电脑调试时快速跳过 8 个频道 |

## M3U 数据源配置

应用从未跟踪的 `config.js` 读取播放列表配置。推荐格式：

```js
window.IPTV_CONFIG = {
  playlist: {
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  }
};
```

以下请求选项可按数据源需要添加，最终会传给浏览器的 `fetch`：

```js
window.IPTV_CONFIG = {
  playlist: {
    url: "https://example.com/api/playlist",
    request: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer YOUR_LOCAL_TOKEN"
      },
      credentials: "omit",
      body: JSON.stringify({ format: "m3u" })
    }
  }
};
```

支持的请求字段包括 `method`、`headers`、`body`、`credentials`、`mode`、`redirect`、`referrer`、`referrerPolicy` 和 `cache`。不需要特殊请求配置时只填写 `url` 即可。

旧格式仍然兼容：

```js
window.IPTV_CONFIG = {
  playlistUrl: "http://YOUR_M3U_SERVER/playlist.m3u"
};
```

数据源要求：

- 响应正文必须是 M3U 文本。支持带 `#EXTINF` 元数据的扩展 M3U，也支持仅包含频道地址的简单 M3U；简单列表会使用自动生成的频道名。
- HTTP 状态码应为 2xx。
- 跨域数据源应允许电视应用访问，例如返回合适的 `Access-Control-Allow-Origin`。
- M3U 中可以使用绝对频道 URL，也可以使用相对于最终播放列表 URL 的相对地址。
- 频道流的容器和编码仍须由目标电视支持；能够获取 M3U 不代表所有频道都一定可播放。

rtp2httpd 只是可选数据源之一。例如使用它时可以将 `url` 设置为 `http://<server>:5140/playlist.m3u`；也可以替换为任何其他能够返回 M3U 的服务。

如数据源地址或请求参数发生变化，只需修改本地 `config.js`，无需修改或提交应用源码。认证 Token 等私人信息只能保存在未跟踪的 `config.js` 中；它们会随 IPK 安装到电视，不应提交到仓库。

## 已知限制

- 当前版本尚未显示 EPG 节目单，只使用 M3U 频道信息。
- 收藏、频道搜索和播放进度记忆尚未实现。
- Simulator 的音视频支持与真机不同，IPTV 播放必须在 LG C5 上进行最终验证。

## License

Private project. 未经授权请勿分发。
