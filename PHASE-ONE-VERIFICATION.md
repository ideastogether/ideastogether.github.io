# 日常共玩改版第一階段

2026-11-25（台灣時間）。正式程式庫：ideastogether/ideastogether.github.io。
原工作區 joyunliu/ideas-together 的 index.html 已是轉址頁，故本次修改正式程式庫。

## 開發前盤點與沿用

| 功能 | 現況與處理 |
| --- | --- |
| 靜態網站與部署 | 原生 HTML/CSS/JavaScript、hash router、GitHub Pages；沿用，不加入框架或付費服務。 |
| 會員與投稿 | Supabase Auth、profiles、投稿精靈、本機草稿、投稿審核；沿用。 |
| 遊戲資料 | 原有 age、materials、tags、how、photos、duration_label；14 個已發布遊戲。沿用材料與時間，未重新建表。 |
| 收藏、按讚、玩過 | favs、likes、played 與本人資料讀取、彙總 RPC；沿用。 |
| 遊戲搜尋 | 年齡、材料、標籤、關鍵字、收藏與排序已存在；增加發展能力篩選及搜尋。原材料篩選保留「部分符合並優先少缺料」語意，介面加以說明。 |
| 詳細頁 | 保留圖片、玩法步驟、互動、分享、留言與送審流程；選填資訊有值才顯示。 |
| 親子活動 | 搜尋、日曆、官方匯入、雲端草稿、審核、活動管理、過期封存與封存紀錄已存在；保留。已有個人報名標記，並非本站報名或收款。 |
| 後台 | 待審遊戲及活動集中管理、回報、會員、GA4 七日摘要入口已存在；不重建。 |
| 既有自動化 | daily-content.html、遊戲雲端草稿、GitHub Actions、設定與執行紀錄已存在；本次不啟用或修改排程。 |
| 第二階段 | 批次遊戲匯入、批次標籤、排程發布、Threads 草稿等仍待後續規劃；本次未開發。 |

## 第一階段行為

- 品牌定位與首頁主標更新；今天玩什麼／家裡有什麼入口、情境捷徑、每日推薦、居家遊戲先呈現，近期活動移至下半部。
- 每日推薦以台灣日期及固定 ID 排序從 approved 遊戲輪替；不呼叫 AI、不新增排程、無寫入。
- 條件式推薦採交集：實際孩子年齡須達遊戲最低年齡（保留舊 age 索引相容）、時間以已標示區間上限判斷、情境符合標籤、選擇材料後必須全部材料齊全。
- 勾選「只用家裡有的材料」但未選材料時僅推薦免材料遊戲；不限材料時不用勾選。時間未標示者不會進入有限時間結果，不從玩法推測。
- 最多三個不同遊戲，重新推薦優先未顯示過的候選；資料少時可能重複，介面有提示。無結果不放寬條件或產生遊戲。
- 能力篩選選項來自已發布資料。目前舊資料尚未補能力，顯示清楚提示；不虛構能力標記。
- 投稿新增七項選填資訊；保留原送審與編輯後重新審核。舊資料不要求補齊。

## 正式資料庫變更與驗證

已經透過 Supabase apply_migration 套用 everyday_play_optional_fields。
SQL 保存在 supabase/everyday-play-fields.sql；只 ADD COLUMN IF NOT EXISTS：
abilities text[]、difficulty text、players text、simple_how text、advanced_how text、parent_tips text、safety_notes text。
所有欄位 nullable；不更新舊資料、不變更既有欄位、資料權限或會員。
套用後 14 個 approved 遊戲完整保留，新欄位皆為 NULL，games RLS 仍啟用。

已在正式資料庫的回滾交易內測試：
- anon 可讀 14 個公開遊戲及新增欄位，非公開遊戲 0。
- authenticated 使用無擁有權的測試 JWT claims，嘗試更新 games 影響 0 列；讀取收藏、讚、玩過、管理員雲端草稿皆 0。
- 沒有建立測試會員或正式投稿。交易皆 rollback。

安全顧問前後相同：content_view_events RLS 無 policy（該表透過既有 RPC 寫入）、部分既有 SECURITY DEFINER 函式可執行、外洩密碼保護未啟用。這些是既有提示，不代表本次新增漏洞；本次沒有改 Auth 設定或擴大權限。
參考：[函式存取檢查](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)、[密碼保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。

## 驗證方式與限制

- `npm test`：包含現有每日更新測試及新增推薦規則測試，共 8 項。
- `tests/phase-one-browser.cjs`：Playwright Chromium，1440、390、320px。使用正式 14 個公開遊戲的唯讀快照與隔離 API 回應；登入身分及補充資料為本機測試 fixture，絕不寫入正式資料庫。
- 測試首頁順序與寬度、推薦／重選／無結果、材料、列表篩選及清除、詳細頁互動入口、未登入提示、能力篩選、選填欄位隱藏、HTML escaping、會員投稿精靈及送審 payload。
- inline script 語法檢查、`git diff --check`。
- 本機重現：先開 `python -m http.server 4173`；將 Supabase SDK 2.45.4 存至 `/tmp/ideastogether-supabase.js`，設定 `GAME_SNAPSHOT` 為公開遊戲唯讀 JSON 快照；執行 `node tests/phase-one-browser.cjs`。需 Playwright 與 Chromium（預設 /usr/bin/chromium，可用 CHROME_PATH 覆寫）。

**尚未部署。** 環境網路白名單未允許 ideastogether.github.io 及 impuxatitpghslleasma.supabase.co，CONNECT 回應 403；request_changes 回覆「The published configuration does not allow this network access.」。
因此本機瀏覽器的真實 Supabase API 連線、正式登入／互動寫入、正式後台及正式活動端到端操作尚未完成，不能將隔離測試視為完整正式驗收。
需由環境擁有者在設定開放上述兩個網域；依使用者要求，完成實際連線與會員回歸驗收後，才合併／部署至既有 GitHub Pages。
