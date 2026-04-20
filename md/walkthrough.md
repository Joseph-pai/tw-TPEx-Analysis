# 股價顯示修復完成報告

已成功修復 6205 等股票在分析時顯示昨日價格而非今日最新價格的問題。

## 變更內容

### 1. 修正日期篩選邏輯
在 `index.html` 中，原本的結束時間（`endTs`）計算為當日凌晨 `00:00:00`，導致收盤時間（如 `13:30`）的數據點被過濾掉。
- **修改前**：`const endTs = new Date(endDate).getTime() / 1000;`
- **修改後**：`const endTs = (new Date(endDate).getTime() + 86400000) / 1000;` (展延 24 小時，確保包含當天所有數據)。

### 2. 修正數據來源標籤錯誤
修復了一個邏輯錯誤：當從 Yahoo Finance 成功獲取數據時，標籤卻被錯誤設定為 `'TWSE'`（這也是為什麼截圖顯示 TWSE 而非 Yahoo 的原因）。
- **更新後**：標籤將正確顯示為 `'Yahoo Finance'`。

## 執行紀錄

- **備份**：已將原版文件備份至 [index.html_20260420_2316](file:///Users/joseph/Downloads/tw-TPEx-Analysis-main%202/index.html_20260420_2316)。
- **GitHub 推送**：已將代碼推送到 [tw-TPEx-Analysis](https://github.com/Joseph-pai/tw-TPEx-Analysis) 倉庫的 `main` 分支。
- **部署**：Netlify 應會自動觸發重新部署。

## 驗證建議
請重新整理網頁並分析 6205。
- **現價**：應顯示為最新收盤價（如 $81）。
- **資料來源**：應顯示為 `Yahoo Finance + FinMind (上市公司)`。

---

> [!NOTE]
> 依照您的規定，請指示是否要 **保留** 或 **刪除** 本次生成的 `.md` 檔案（Plan 與 Task）。
