# IPTV for webOS

[English](README.md) | 简体中文

*A lightweight IPTV player built for LG webOS TV.*

一个面向 LG webOS TV 的轻量 IPTV Web App。应用可从任意可访问的 HTTP/HTTPS 数据源获取 M3U 播放列表，并通过电视原生媒体能力播放其中的频道。

## 界面截图

截图在 webOS TV 25 Simulator 中以 1920×1080 取得。频道、分组、台标与节目名均来自一份虚构的演示播放列表；界面背后的画面是一张合成静帧，而非解码后的直播流。

正在播放信息，包含频道台标、分组、播放清晰度与当前节目进度：

![正在播放面板](docs/screenshots/now-playing.png)

频道浏览器，焦点位于频道列表，右侧显示当前焦点频道的节目单：

![频道浏览器：频道列表与节目单](docs/screenshots/channels.png)

播放源、分组、频道三列完整展开时的浏览器：

![三列浏览器：播放源、分组与频道](docs/screenshots/channel-browser.png)

## 当前功能

- 从本地配置文件指定任意 M3U 数据源
- 可在电视端添加、编辑和删除最多 10 个 M3U 播放源，并记住上次使用的播放源
- 支持配置请求方法、请求头、凭据和请求体
- 解析频道名称、分组和播放地址
- 支持 M3U 中相对于播放列表地址的频道 URL
- 播放器始终占满屏幕，启动播放时默认显示频道信息，频道库以 M3U、分组、频道三级浮层按需打开
- 三级频道库会随当前操作列向左移动，频道聚焦后自动显示当前及后续节目
- 自动读取 M3U 首行 `x-tvg-url` 指向的 XMLTV 节目单，也支持通过配置覆盖 EPG 地址
- 启动后自动播放上次选择的频道；没有有效记录时播放当前列表第一个频道
- 5 秒没有遥控器或 Magic Remote 操作后自动隐藏界面，视频继续播放
- 使用 Enact Spotlight 管理电视端 DOM 焦点、5-way 导航和焦点恢复；业务选择、切列、Back 与播放仍由现有状态机管理
- 支持鼠标点击，方便在浏览器和 Simulator 中调试
- 启动时自动匹配系统语言，支持英文、简体中文、繁体中文、日文和韩文；无法匹配时使用英文
- 使用原生 `<video>` 播放 rtp2httpd 提供的 HTTP 视频流
- 连续上/下换台会合并为最后一次请求，避免反复重建媒体连接
- 普通换台延迟显示紧凑 loading，已播放画面不会立刻被全屏遮罩覆盖
- webOS 真机自动使用低合成开销的轻量视觉模式
- 适配 1920×1080，并兼容较低分辨率的调试窗口

## 项目结构

```text
.
├── appinfo.json   # webOS 应用清单
├── index.html     # Vite 应用入口和播放器外壳
├── styles.css     # 电视端全局界面样式
├── src/
│   ├── core/      # TypeScript：M3U、XMLTV、播放源和频道浏览状态
│   ├── i18n/      # 多语言资源、系统语言匹配和格式化
│   ├── ui/        # React：频道库、播放源表单和 Enact Spotlight 适配
│   └── main.tsx   # 新核心、React UI 与旧播放控制器的兼容装配
├── features/
│   ├── channels/
│   │   └── channel-panel.css # 频道列表样式
│   └── sources/
│       └── source-form.css # 播放源表单样式
├── interaction.js # 操作状态机与事件转换
├── app.js         # 保留的 HTMLVideoElement 播放与 webOS 副作用
├── vite.config.ts # Web 构建和 webOS 资源复制
├── dist/          # pnpm build 生成的 webOS 可运行目录（不提交）
├── docs/
│   ├── interaction-design.md  # 操作状态与事件转换规范
│   └── screenshots/           # README 使用的界面截图
├── config.example.js # 脱敏的本地配置模板
├── icon.png
├── largeIcon.png
└── tests/
    ├── interaction.test.js
    └── channel-panel.test.js
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

安装项目依赖：

```bash
corepack enable
corepack install
pnpm install
```

如果当前终端仍提示找不到 `pnpm`，关闭并重新打开 PowerShell 后再执行上述命令。

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

开发服务器会自动读取存在于项目根目录的本地 `config.js`：

```bash
pnpm dev
```

普通浏览器适合检查布局、M3U 解析和基本交互。遥控器焦点与部分 webOS 行为应在 Simulator 中验证；实际解码、换台和长时间播放必须在真机上验证。

运行 TypeScript 核心测试、当前状态机回归测试和生产构建：

```bash
pnpm test
pnpm build
```

`pnpm build` 会生成 `dist/`。出于隐私保护，构建只写入空的安全配置，不会自动把本地 `config.js` 复制进分发目录；没有预置源时，应用会在电视端打开播放源表单。

## Simulator 调试

### 启动应用

先运行 `pnpm build`，再使用仓库脚本校验并启动生成的 `dist/` 应用。

Windows 使用 PowerShell 7：

```powershell
& .\.agents\skills\webos-tv-debug\scripts\run-simulator.ps1 -Version 25 -AppDir .\dist
```

macOS 使用终端：

```bash
./.agents/skills/webos-tv-debug/scripts/run-simulator.sh 25 "$(pwd -P)/dist"
```

如果 Simulator 不在 webOS CLI 默认搜索目录，Windows 增加 `-SimulatorDir $env:WEBOS_SIMULATOR_DIR`，macOS 在命令末尾增加 `"$WEBOS_SIMULATOR_DIR"`。变量应指向包含 Simulator 可执行程序的已解压目录。

以下是 webOS Studio 和原始 CLI 的手工启动方式，可用于排查脚本或 Simulator 路径问题。

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
  --simulator-path "$SIMULATOR_DIR" \
  "$APP_DIR"
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

确认电视连接成功后，可以在项目根目录一键完成校验、打包、安装和启动。将 `myTV` 替换成 `ares-setup-device` 中注册的设备名。

Windows 使用 PowerShell 7：

```powershell
& .\.agents\skills\webos-tv-debug\scripts\deploy-to-tv.ps1 -Device myTV -AppDir .\dist
```

macOS 使用终端：

```bash
./.agents/skills/webos-tv-debug/scripts/deploy-to-tv.sh myTV "$(pwd -P)/dist"
```

需要同时打开 Inspector 时，Windows 在命令末尾增加 `-Inspect`，macOS 增加 `--inspect`。部署脚本使用临时目录生成 IPK，不会为了覆盖安装而修改本地 `appinfo.json` 版本号。

也可以手工依次运行：

```bash
# 打包
ares-package dist

# 安装；myTV 替换为注册时设置的设备名
ares-install --device myTV com.odyssey.webos.iptv_0.1.0_all.ipk

# 启动
ares-launch --device myTV com.odyssey.webos.iptv
```

默认构建不会把私人 `config.js` 打进 IPK，首次启动时可直接在电视端添加播放源。如果确实需要预置源，应在本机完成构建后自行将配置放入 `dist/config.js`，确认目标地址可由电视访问，并且不要提交或分享该目录及其 IPK。生成的 `*.ipk`、`dist/` 和本地 `config.js` 均已被 `.gitignore` 忽略。

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
- 应用能打开但列表加载失败：在第二列选择“编辑此播放源”，确认服务器地址可由电视访问，并检查服务器防火墙与 CORS。
- 列表正常但频道无法播放：在真机 Inspector 查看 `MediaError`，并核对频道容器、视频编码和音频编码。

LG 官方文档：

- [Developer Mode App 真机连接](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
- [webOS CLI Developer Guide](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)
- [Simulator Developer Guide](https://webostv.developer.lge.com/develop/tools/simulator-dev-guide)

## 遥控器操作

| 按键 | 行为 |
| --- | --- |
| 右 | 打开频道库；在频道库内依次进入 M3U、分组、频道列 |
| 左 | 在频道库内返回上一列；从 M3U 列返回播放信息 |
| 上 / 下 | 信息界面或隐藏状态下直接换台；频道库打开时在当前列移动焦点 |
| OK | 界面隐藏时先显示信息；在 M3U/分组列进入下一列；在频道列播放选中频道 |
| Back | 信息或频道列表可见时隐藏界面；界面已经隐藏时弹出系统退出确认 |
| Page Up / Page Down | 在电脑调试时快速跳过 8 个频道 |
| Magic Remote 指针 | 悬停频道时同步焦点，点击播放 |
| Magic Remote 滚轮 | 向上或向下移动一个频道 |

界面隐藏时，导航上/下会直接换台并显示频道信息，右键会打开频道库，其他普通按键和指针操作只显示信息界面；Back 会弹出系统退出确认。连续 5 秒没有操作后，顶部状态、频道库、正在播放信息和操作提示都会隐藏，底层视频不会暂停或停止。播放失败或结束时，频道库未打开且界面可见时按 OK 会优先直接重播当前频道；频道库打开时仍可正常进入分组或确认新频道。

## M3U 数据源配置

应用会把电视端管理的播放源保存在本地存储中。首次升级时，如果本地还没有初始化播放源，会将未跟踪的 `config.js` 播放列表配置自动导入为第一个播放源；完成初始化后，以电视端保存的播放源为准。推荐的首次引导配置格式：

```js
window.IPTV_CONFIG = {
  playlist: {
    name: "家庭 IPTV",
    url: "http://YOUR_M3U_SERVER/playlist.m3u",
    request: {
      method: "GET"
    }
  },
  epg: {
    url: ""
  },
  playback: {
    startupTimeoutMs: 15000,
    stallTimeoutMs: 12000,
    maxRetries: 2,
    retryDelayMs: 1200,
    channelSwitchDelayMs: 100,
    loadingIndicatorDelayMs: 500
  },
  ui: {
    simpleMode: "auto"
  }
};
```

`epg.url` 留空时，应用会自动读取 `#EXTM3U` 首行的 `x-tvg-url`。rtp2httpd 常见的 `.xml.gz` 声明会自动切换到对应 XML 地址，并使用 XMLTV 的 `channel` / `display-name` 与 M3U 的 `tvg-id`、`tvg-name` 和频道名进行匹配。只有需要覆盖 M3U 声明时才填写 `epg.url`。

`playback` 为可选播放配置：起播超过 `startupTimeoutMs`，或者已经播放后连续缓冲超过 `stallTimeoutMs`，应用会按 `retryDelayMs` 间隔重新加载当前频道，最多重试 `maxRetries` 次。`channelSwitchDelayMs` 用于合并连续上/下换台，`loadingIndicatorDelayMs` 控制普通换台多久后才显示紧凑 loading。切换频道或手动按 OK 会重置重试次数。

`ui.simpleMode` 默认是 `"auto"`，在 webOS 运行时自动关闭模糊滤镜、重阴影、平滑滚动和较长动画。也可以设为 `true` / `"on"` 强制开启，或设为 `false` / `"off"` 强制关闭。

调试换台耗时时可以在 Inspector 中读取 `window.__IPTV_PERFORMANCE__`。对象只包含最近一次尝试的阶段耗时和尝试编号，不包含频道名称、播放地址、请求头或原始错误信息。

播放失败时界面会显示脱敏诊断，包括 `MediaError`、`networkState`、`readyState`、推断的流类型和已用重试次数。诊断不会显示频道 URL、查询参数或请求头。`MEDIA_ERR_SRC_NOT_SUPPORTED` 只表示当前目标无法打开该媒体，不等同于服务器不可访问；Simulator 上的 MPEG-TS、HEVC 等错误仍需在真机复现。

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

电视端初始化完成后，名称和 M3U 地址应通过播放源编辑界面修改。`config.js` 主要用于首次导入以及带请求头、请求体等高级请求配置的部署场景；认证 Token 等私人信息只能保存在未跟踪的 `config.js` 中，不应提交到仓库。

## 已知限制

- 收藏和频道搜索尚未实现。
- Simulator 的音视频支持与真机不同，IPTV 播放必须在 LG C5 上进行最终验证。

## License

Private project. 未经授权请勿分发。
