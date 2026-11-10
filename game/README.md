# 口袋潮汐 / Pocket Tide

一台可在桌面和手机浏览器里玩的复古水中套圈玩具。奶油白塑料壳、浅青玻璃水箱、珊瑚色双按钮；原创程序绘制，无外部美术或运行时网络请求。

**实际使用 Cocos Engine 3.8.7**：`cc.Scene`、`cc.Node`、`cc.Canvas`、`cc.Camera`、`cc.Graphics` 和 `cc.Component.update` 负责场景、WebGL2 绘制和游戏循环；**cannon-es 0.20.0** 负责真正的三维刚体。没有用 Canvas2D/Phaser/Three.js 替代 Cocos。这里是开源引擎独立启动的 Web 游戏，不声称经过 Cocos Creator 编辑器构建，也不是可直接打开的 Creator 场景工程。

## 快速运行

需要 Node.js 20+，浏览器需要 WebGL 2（当前 Chrome/Edge/Firefox/Safari 通常支持，实际设备仍须验证）。不要直接双击 HTML，ES Modules 需要 HTTP。

```sh
cd game
npm ci
npm test
npm run build
npm start
# 浏览器打开 http://127.0.0.1:8080
```

`npm run build` 检查游戏模块语法并组装 `dist/`，包含已经从官方固定源码编译、随仓库保存的真实 Cocos 引擎。`dist/` 是完整静态网站，可通过任意普通 HTTP 静态服务运行，没有服务器业务、账号、广告或支付。`PORT=8081 npm start` 可改端口；需要局域网手机访问时可显式 `HOST=0.0.0.0 npm start`。

## 操作

- 按住左/右按钮，或键盘 **A / ←**、**D / →**，推动对应喷流；支持两个按钮同时按住和多点触摸。
- 松手后，水阻让彩环缓慢下沉。试着让真正的环孔越过柱顶，等待它沿柱落稳。
- 彩环实际穿柱、落到柱底附近且低速稳定 **0.7 秒**，才计入分数。喷流仍可重新抬起已落稳的环，分数会随实际状态变化。
- 八个彩环全部稳定套入即获胜，显示耗时和喷流次数。没有倒计时、失败惩罚或付费点。
- 点击顶部菜单可暂停；点击“继续游玩”、顶部“返回”或 Esc 可继续。“重新开始”仅在菜单内，须明确点击。声音默认关闭，可在菜单开启，由浏览器合成。
- 页面失焦、隐藏或触摸取消会释放喷流，避免按钮卡住。减少动态效果偏好会减少装饰气泡，保留核心物理。

## 物理与画面边界

每个环由 **24 个重叠球体**组成有孔的刚性圆环；两柱为真实圆柱，底座和六面水箱为静态刚体。环与环、柱、箱壁都经过 Cannon 碰撞求解。固定物理步长 1/120 秒，水下重力与近似浮力、速度阻力、旋转阻尼、喷流锥及偏心推力产生上浮、翻转、碰撞与下沉。宽面水阻用弱的回正力矩近似。

计分根据柱轴与当前四元数定义的环平面相交，检查环孔实际包围柱体、位于柱段及底部稳定条件。不会按屏幕距离吸附、传送或焊接到柱上。画面把同一三维刚体姿态投影为略俯视的 2.5D 圆环，按深度分段排序，保留前后遮挡和厚度。流体是为手感调校的外力模型，**不是真实流体/流固耦合求解**；复合球体是环面碰撞近似，并非精确连续网格。

## 从官方源码重建引擎

普通运行无需下载引擎源码。需要审查或重建时：

```sh
npm run bootstrap
npm run build:engine
npm run build
npm test
```

`bootstrap` 下载官方固定 commit 的约 86 MB 源码包，先核对 SHA-256，再只在项目目录使用上游锁文件 `npm ci --ignore-scripts` 安装构建依赖。引擎源码在 `vendor/cocos-engine/`，不进入 Git。未执行编辑器/native 的 postinstall，也未安装任何全局软件。构建使用官方 `@cocos/ccbuild`，只启用 base、WebGL2、2d、graphics、legacy-pipeline。选择 Chrome 90 语法目标以规避旧 ES5 变换的局部循环变量问题。

完整来源、commit、哈希、模块和编辑器边界见 [ENGINE-SOURCE.json](ENGINE-SOURCE.json)。源码未修改；[src/engine-bootstrap.js](src/engine-bootstrap.js) 在项目侧把官方测试夹具中的预编译 GLSL4 声明适配为 WebGL2 GLSL3，并使 `CCGlobal` 布局与当前引擎一致。只提供 WebGL2；未宣称 WebGL1、原生 App 或 Creator 导入已验证。MIT 及依赖声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 验证与文件

`npm test` 使用 Node 内建测试器，直接运行真实 Cannon 世界，覆盖喷流、浮力/阻尼、实体碰撞、环孔穿柱、稳定门槛、重置、长时有限状态和胜利流程。浏览器测试另见 `tests/browser-check.py`；它需要外部已有 Playwright 与 Chromium，项目不会自动安装浏览器。测试证据在 `evidence/`。

- `src/physics.js`：三维物理和计分，独立于 UI。
- `src/render.js`：真正的 Cocos Graphics 绘制。
- `src/input.js`：键盘/触摸/取消释放。
- `src/main.js`：Cocos Component 游戏循环、状态与音效。
- `tools/`：固定引擎重建、静态构建和本地服务。
- `engine/`：已验证的官方引擎编译产物和官方 MIT 夹具。

`window.__waterToy` 保留可检查的引擎版本、场景、Graphics 组件及物理世界，用于浏览器核验；没有“自动获胜”或强制计分功能。桌面和移动 Chromium 已按保存证据验证；其他浏览器、iOS 真机、低端设备性能、离线 PWA、原生封装和 Creator 编辑器导入尚未验证。
