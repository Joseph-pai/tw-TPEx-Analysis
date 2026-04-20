# 修正股價獲取非最新值問題

此計畫旨在解決股票分析中「現價」顯示為昨日收盤價而非今日最新收盤價的問題。

## 原因分析

經過分析 `index.html` 中的程式碼，發現問題出在資料篩選邏輯：

```javascript
const endTs = new Date(endDate).getTime() / 1000;
const filteredData = allTimestamps.map((ts, i) => ({ ts, close: allCloses[i] }))
    .filter(d => d.ts >= startTs && d.ts <= endTs && d.close);
```

1. `endDate` 預設為今日（例如 `2026-04-20`）。
2. `new Date('2026-04-20').getTime()` 會產生該日凌晨 `00:00:00` 的時間戳。
3. Yahoo Finance 等來源提供的當日股價數據，其時間戳通常是交易收盤時間（如 `13:30:00`）。
4. 因為 `13:30:00` 大於 `00:00:00`，條件 `d.ts <= endTs` 會將今日的最新數據排除在外。
5. 因此程式取到的「最後一筆」數據變成了昨日的收盤價。

## 擬議變更

### [Component Name]

#### [MODIFY] [index.html](file:///Users/joseph/Downloads/tw-TPEx-Analysis-main%202/index.html)

修改 `endTs` 的計算方式，使其包含整天的時間：

```javascript
// 修改前
const endTs = new Date(endDate).getTime() / 1000;

// 修改後 (方案 A：加入 23 小時 59 分 59 秒)
const endTs = new Date(endDate + 'T23:59:59').getTime() / 1000;
```

或者使用更穩健的方式：

```javascript
// 方案 B：取得次日凌晨，即為今日的截止
const endTs = (new Date(endDate).getTime() + 86400000) / 1000;
```

考慮到瀏覽器相容性與字串格式，方案 B 較為穩定。

## 執行步驟

1. **備份文件**：依照規則，將 `index.html` 備份為 `index.html_20260420_2310`。
2. **修改代碼**：更新 `index.html` 第 4550 行附近。
3. **通知用戶**：請用戶重新整理頁面測試。

## 驗證計畫

### 手動驗證
- 請用戶搜尋股票 `6205`。
- 確認「現價」是否顯示為 $81 元。
- 確認「期間漲跌」是否同步更新。
