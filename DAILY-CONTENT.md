# 每日自動更新：部署與限制

## 狀態

2026-11-20：經使用者授權，已在正式 Supabase 套用 daily_content_update migration。三張新表均啟用 RLS，匿名無讀取權限；非管理員 authenticated 角色讀不到設定與草稿。設定 enabled=false，尚無執行紀錄及遊戲草稿。安全顧問未新增此功能相關警示。

此版本為第一階段，預設暫停。沒有呼叫付費 AI、搜尋、圖片 API，也沒有新訂閱。

目前活動只沿用 web_activity_candidates 快取，沒有自動觸發 refresh-web-candidates（尚未確認該 Edge Function 的實作、成本及伺服器端驗證）。因此未完成每日主動搜尋全台新公告。來源缺少明確場次、地點、親子適用證據、報名狀態時不建立草稿；可為零筆。未涵蓋所有民間來源。

遊戲使用 8 個人工撰寫原創模板，不隨機拼接、不使用 AI；全部用完或重複即停止。年齡沿用原站 age 選項索引，不是實際歲數。排序優先補充資料較少的年齡類別。相似玩法採文字三字片段比對，仍需管理員人工確認語意與安全。

活動依現有縣市筆數排序，但本階段只處理快取，不保證未收錄縣市能被找到。任何草稿皆不自動發布。

## 啟用前必要步驟

1. 審查開發分支／PR。資料庫變更已套用；前端與工作流程仍在開發分支。
2. `supabase/daily-content-update.sql` 已經授權並套用，請勿重複執行。預設 enabled=false。
3. GitHub repository → Settings → Secrets and variables → Actions 新增 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。金鑰只能放 Secrets，不能放前端或 repository；不要將金鑰傳送到聊天。
4. 合併 PR 至 main，確認 GitHub Pages 部署成功。workflow 必須在 default branch 才會排程。
5. 管理後台 → 每日自動更新 → 將兩種數量先設 1 → 開啟 → Actions 手動執行。檢查草稿及執行紀錄後才提高數量。

仍需要 GitHub Secrets 才能完成正式端到端測試、啟用排程。尚未驗證正式寫入、手機瀏覽器實際操作與原站完整回歸；不得視為全部驗收通過。

## 使用

- 活動：既有活動雲端草稿（admin/ai-import.html），編輯、刪除、人工核對後送審，在原管理後台發布。
- 遊戲：每日自動更新（admin/daily-content.html），編輯 JSON／儲存／刪除／送審，送審後到原管理後台發布。無圖片亦可保存。
- 管理頁列最近 10 次紀錄，資料庫保留 90 日。失敗詳情亦見 GitHub Actions logs。
- 暫停：取消「開啟每日更新」並儲存；或在 Actions 停用 workflow。若已開始寫入，暫停會等待交易完成。
- 立即執行：連結到 GitHub Actions 的 Run workflow，需要 GitHub repository 權限。

## 資源與失敗處理

- UTC 00:00 = 台灣 08:00；GitHub 可能延遲或略過排程，不保證準點。依實際執行的台灣日期限一次。
- 自動／手動共用日期主鍵鎖及 concurrency；失敗亦占當日額度，不無限重試。
- 每類 0～5 筆；候選最多 200 筆；既有活動／遊戲／兩種草稿各最多 1000 筆，超過停止，避免不完整去重。
- 最多 35 次 HTTP 請求，每次 15 秒逾時，零自動重試；工作最多 5 分鐘。正常約 8 次 REST 請求；不下載外部公告或圖片。
- Supabase transaction 一次寫入最多 10 筆草稿與一筆結果，不碰公開內容。當日鎖殘留 running 表示中斷，請查看 Actions；不自動重新取得鎖。
- 無法從目前程式自動查詢帳號剩餘免費額度。遇到服務錯誤即停，不升級。請確認 GitHub / Supabase 帳號方案與 spend cap；固定低用量不能保證帳號其他服務不超額。
- 缺 Secrets / 資料庫中斷時可能無法寫入雲端錯誤，Actions logs 仍記錄失敗。

## 驗證

`node --test tests/*.test.mjs`：台灣日期邊界、重命名重複、缺資料拒絕。
可選 SQL 整合：安裝 PGlite 後執行 `node tests/sql-check.mjs`，或以 PGLITE_MODULE 指定已安裝模組。本機隔離資料庫已驗證預設停用、每日鎖、完成交易、重送阻擋與一般會員 RLS；不會建立正式測試內容。
