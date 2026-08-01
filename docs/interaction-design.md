# 操作状态设计

应用的操作逻辑由单一状态对象驱动。遥控器、Magic Remote、播放器回调和定时器只负责发送事件，不直接组合修改界面。

## 状态

### 界面状态 `uiMode`

| 状态 | 含义 |
| --- | --- |
| `hidden` | 只显示视频或播放器状态遮罩 |
| `info` | 显示顶部状态、正在播放信息和按键提示 |
| `channels` | 显示信息界面和左侧频道列表 |

这三个值互斥，不再分别维护“UI 是否显示”和“列表是否打开”。

### 播放状态 `playbackStatus`

| 状态 | 含义 |
| --- | --- |
| `idle` | 尚未开始播放 |
| `loading` | 正在连接和起播 |
| `playing` | 正常播放 |
| `buffering` | 已进入缓冲或数据停滞 |
| `retrying` | 播放失败，等待自动重试 |
| `failed` | 自动重试已用尽 |
| `ended` | 媒体正常结束 |

`channelBrowser` 是频道库的嵌套子状态。它的 `column` 表示当前操作列：`0` 为 M3U、`1` 为分组、`2` 为频道；`focusedSourceIndex`、`focusedGroupIndex` 和 `focusedChannelIndex` 分别保存三列焦点，`selectedGroup` 保存已经确认进入的频道分组。主状态中的 `playingIndex` 表示播放器当前频道，移动子状态机焦点不会直接换台。

频道库子状态机的 OK/确认结果分为三种：

| 子状态结果 | 含义 | 是否触发播放 |
| --- | --- | --- |
| `SOURCE_SELECTED` | 确认当前 M3U，进入分组列 | 否 |
| `GROUP_SELECTED` | 确认当前分组，筛选并进入频道列 | 否 |
| `CHANNEL_SELECTED` | 确认当前频道，把频道索引交给主状态机 | 是 |

在 `info` / `hidden` 中连续按上、下换台时，`playingIndex` 和屏幕频道信息会立即更新，但媒体副作用会合并：默认等待最后一次输入 220ms 后，只对最终频道执行一次 `pause → src → load → play`。频道列表中按 OK 或点击频道仍立即播放，不经过合并等待。

播放列表加载成功并自动开始播放频道后，初始界面状态为 `info`。应用不会自动展开频道列表；连续 5 秒没有操作后进入 `hidden`。

## 操作矩阵

| 输入 | `hidden` | `info` | `channels` |
| --- | --- | --- | --- |
| `←` | 显示信息 | 保持信息 | 返回上一列；M3U 列关闭频道库 |
| `→` | 打开频道库 | 打开频道库 | 进入下一列；分组进入频道列时应用筛选 |
| `↑ / ↓` | 直接换台并显示信息 | 直接换台 | 在当前列移动焦点，不立即换台 |
| `OK` | 显示信息 | 打开频道库 | M3U/分组列进入下一列；频道列播放并关闭频道库 |
| `Back` | 弹出系统退出确认 | 隐藏信息界面 | 隐藏信息和频道列表 |
| 指针移动 | 显示信息 | 重置隐藏计时 | 重置隐藏计时 |
| 滚轮 | 显示信息，不移动焦点 | 打开列表并选择 | 移动一项 |
| 5 秒超时 | 保持隐藏 | 隐藏信息 | 隐藏信息和列表 |

例外规则：当频道库未打开、界面已经可见，且播放状态是 `failed` 或 `ended` 时，`OK` 优先直接重播当前频道；频道库打开时 `OK` 仍按当前列执行进入或选台。`hidden` 状态下第一次按 OK 只显示信息界面。

Back 的层级固定为：`channels/info → hidden → 系统退出确认`。右键在任意状态下都可以进入 `channels`；`hidden` 下导航上/下会直接换台并显示 `info`，Back 直接进入系统退出流程，其他普通输入只负责唤醒 `info`。

退出副作用优先调用 `webOS.platformBack()`；如果项目未加载 `webOSTV.js`，则直接调用电视运行环境注入的 `PalmSystem.platformBack()`。只有普通浏览器不存在这两个 API 时才使用 `window.close()`。

## 事件处理结构

```text
遥控器 / 鼠标 / 播放器 / 定时器
                ↓
           dispatch(event)
                ↓
       transition(state, event)
          ↓                ↘
 channelBrowser 子状态机     effects
          ↓
   新的 state
       ↓                     ↓
 renderState()        播放、计时、存储、退出
       ↓
 channelPanel.render()
```

M3U、分组和频道列的导航与确认由 `features/channels/channel-browser-state.js` 管理。主状态机只在收到 `CHANNEL_SELECTED` 时执行选台和播放副作用；`SOURCE_SELECTED` 与 `GROUP_SELECTED` 不会进入播放路径。

三级频道库的 DOM 创建、列位移、焦点样式、播放标记、节目单浮窗和滚动由
`features/channels/channel-panel.js` 独立负责。组件只接收状态快照，并把焦点和选择
转换成回调；它不直接修改应用状态，也不控制播放器。

频道库打开期间，底部 `now-playing` info 始终使用频道列聚焦状态下的固定左边界和宽度。播放源、分组、频道三列之间切换只移动频道库，不再改变 info 的长度。

节目单默认从 M3U 首行 `x-tvg-url` 自动发现，也可由 `epg.url` 覆盖。XMLTV 加载后会把 `<channel>` 的 `id` 与 `display-name` 建立别名，再与 M3U 的 `tvg-id`、`tvg-name` 或频道名匹配。频道列获得焦点时浮窗自动显示当前及后续节目；没有匹配数据时显示空态，不阻断频道选择和播放。

换台副作用分为即时播放和延迟提交两条路径。`START_PLAYBACK` 用于启动、重试和频道列表确认；`SCHEDULE_PLAYBACK_SWITCH` 用于信息/隐藏状态下的连续上、下换台。等待提交期间旧视频保持播放，播放器旧事件不会覆盖目标频道的状态。

## 换台性能策略

1. 连续导航默认合并 220ms，只重建最终目标频道的媒体连接。
2. 已成功播放过视频后，普通换台不立即显示全屏遮罩；500ms 后仍未起播才显示紧凑 loading。
3. 初次启动和最终播放失败仍显示完整状态遮罩。
4. 频道列表关闭时不遍历频道节点，也不执行 `scrollIntoView()`；打开列表后只更新旧、新焦点和播放项。
5. webOS 真机默认启用轻量视觉模式，关闭模糊滤镜、平滑滚动、重阴影和较长动画。
6. `window.__IPTV_PERFORMANCE__` 仅保存最近一次播放尝试的阶段耗时，包括输入到请求、输入到设置 `src`、`src` 到 metadata/canplay/playing；不保存频道名称、URL 或原始错误。

状态转换集中在 `transition()`；播放请求、定时器、`localStorage` 和退出应用放在 `runEffect()`。以后新增按键或修改行为时，应先更新本文件的操作矩阵，再增加事件和状态转换。

## 播放失败优先级

1. 每次播放尝试都有递增的 `playbackAttemptId`。
2. 超时和 Promise 回调必须携带发起时的尝试 ID。
3. 与当前 ID 不一致的旧回调直接忽略。
4. 同一次尝试只允许进入一次失败处理。
5. 自动重试用尽后进入 `failed`；此时按一次 `OK` 将重置计数并重播。
6. 用户切换频道时，旧频道的定时器和待执行重试会被清除。
