# 狂妄之人 · Sans 审判战

浏览器里运行的像素弹幕审判战，纯静态页面，无构建步骤、无依赖安装。

玩：<https://yun532523.github.io/sans-judgment/>

## 操作

| 按键 | 作用 |
| --- | --- |
| 方向键 / WASD | 移动 |
| Z / Enter | 确认 |
| X | 取消 |
| Esc | 暂停 |
| F | 全屏 |
| M | 静音 |

## 本地运行

直接用浏览器打开 `index.html` 即可，或起一个静态服务器：

```bash
python -m http.server 8000
```

## 目录

```
index.html    页面与画布
js/data.js    角色、台词、弹幕模式等数据
js/core.js    输入、音频、工具函数
js/timeline.js 审判战时间轴编排
js/sim.js     战斗数值模拟
js/render.js  像素渲染与特效
js/game.js    主循环与场景
music.m4a     背景音乐
```
