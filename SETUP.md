# Typhoon Watch 升级版配置

## 新增功能

### 1. JMA 东京雨云雷达
不需要 API Key。

页面直接读取：
- `targetTimes_N1.json`：当前/历史雷达时刻
- `targetTimes_N2.json`：未来 1 小时 Nowcast
- JMA `surf/hrpns` PNG tiles

地图右上角：
- `雷达 ON/OFF`
- `东京`：一键定位东京
- 时间滑块：`现在 / +30m / +60m`

### 2. 羽田 / 成田机场异常航班
前端不会保存第三方航班 API 密钥。

架构：

GitHub Pages
→ Cloudflare Worker
→ AeroDataBox / RapidAPI
→ HND / NRT 航班状态

监测：
- Delayed
- Canceled / CanceledUncertain
- Diverted

---

# Cloudflare Worker 配置

## A. 注册 AeroDataBox RapidAPI
订阅 AeroDataBox 后取得 `X-RapidAPI-Key`。

不要把 Key 写进 `index.html` 或 `config.js`。

## B. 安装 Wrangler

```powershell
npm install -g wrangler
wrangler login
```

如果没有 Node.js，请先安装 Node.js LTS。

## C. 创建 Worker 目录

例如：

```powershell
mkdir typhoon-airport-api
cd typhoon-airport-api
```

复制本项目：
- `worker.js`
- 把 `wrangler.toml.example` 复制为 `wrangler.toml`

```powershell
copy ..\worker.js .\worker.js
copy ..\wrangler.toml.example .\wrangler.toml
```

## D. 保存密钥

```powershell
wrangler secret put AERODATABOX_KEY
```

终端要求输入时，粘贴 RapidAPI Key。

## E. 部署

```powershell
wrangler deploy
```

成功后得到类似：

```text
https://typhoon-airport-api.<你的子域>.workers.dev
```

测试：

```text
https://typhoon-airport-api.<你的子域>.workers.dev/api/airports
```

如果成功会返回 JSON。

## F. 配置 GitHub Pages

修改 `config.js`：

```javascript
window.TYPHOON_CONFIG = {
  airportApiUrl: "https://typhoon-airport-api.<你的子域>.workers.dev/api/airports"
};
```

然后把下面文件上传到 GitHub 仓库根目录：

- `index.html`
- `config.js`

提交后等 GitHub Pages 自动部署。

---

# API 用量注意

机场 FIDS 是付费航班数据接口。Worker 已有共享缓存，所有访问者共用同一份缓存。

`wrangler.toml`：

```toml
CACHE_SECONDS = "1800"
```

代表最多每 30 分钟重新访问一次航班提供商。

如果只使用免费额度测试，建议：

```toml
CACHE_SECONDS = "18000"
```

即约 5 小时缓存。

如果需要真正有意义的机场延误监测，建议使用更高额度并把缓存改为 10～30 分钟。

最终航班状态仍以航空公司、羽田机场、成田机场官方发布为准。
