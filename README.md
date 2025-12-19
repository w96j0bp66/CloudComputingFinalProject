# 校園二手交易平台 (Campus Second-hand Market)

這是一個基於 FastAPI 和 MySQL 的校園二手交易平台，專為校園場景設計。支援使用者註冊、商品刊登、分類搜尋、以及買賣雙方的一對一即時聊天功能。專案採用 Docker 容器化部署，方便快速建置與執行。

## 功能特色

### 使用者系統
*   **身分驗證**: 支援 JWT 註冊與登入。
*   **個人中心**: 可修改暱稱、管理個人刊登的商品。
*   **權限控管**: 僅賣家本人可修改或刪除自己的商品。

### 商品交易
*   **商品刊登**: 支援圖片上傳、分類選擇（書籍、3C、生活用品等）。
*   **瀏覽與搜尋**: 支援關鍵字搜尋、分類篩選、分頁瀏覽。
*   **狀態管理**: 賣家可將商品標示為「已售出」或「重新上架」。
*   **自動維護**: 系統每日自動清理「已售出超過 7 天」的商品，保持平台整潔。

### 即時通訊
*   **一對一聊天**: 買賣雙方專屬聊天室 (WebSocket)。
*   **歷史紀錄**: 對話內容永久保存 (MySQL)。
*   **未讀通知**: 導覽列與列表顯示未讀訊息紅點。

### 管理員系統
*   **超級管理員**: 系統啟動時自動建立預設管理員帳號。
*   **後台權限**: 管理員可強制刪除任何違規商品。

### 介面設計
*   **現代化 UI**: 採用 Bootstrap 5，搭配校園深藍配色與 SVG 圖示。
*   **互動體驗**: 使用 Toast 通知取代傳統彈窗、Modal 確認視窗、載入動畫。
*   **RWD 響應式**: 支援手機與電腦瀏覽。

## 技術堆疊

*   **後端**: FastAPI (Python 3.9)
*   **資料庫**: MySQL 8.0
*   **ORM**: SQLAlchemy
*   **即時通訊**: WebSockets
*   **前端**: HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5
*   **容器化**: Docker, Docker Compose

## 快速開始

### 前置需求

請確保您的電腦已安裝以下軟體：
*   [Docker](https://www.docker.com/get-started)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### 安裝與執行

1.  **複製專案**
    ```bash
    git clone https://github.com/w96j0bp66/CloudComputingFinalProject.git
    cd campus-market
    ```

2.  **設定環境變數**
    在專案根目錄建立 `.env` 檔案，並填入以下內容：
    ```env
    # 資料庫設定
    MYSQL_DATABASE=campus_market
    MYSQL_USER=campus_user
    MYSQL_PASSWORD=campus_pass
    MYSQL_ROOT_PASSWORD=root_pass
    
    # JWT 設定 (請產生一個強密碼)
    SECRET_KEY=your_secret_key_here
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=30

    # 管理員設定
    ADMIN_EMAIL=admin@campus.com
    ADMIN_PASSWORD=admin123
    ```

3.  **啟動服務**
    使用 Docker Compose 建置並啟動容器：
    ```bash
    docker-compose up -d --build
    ```

4.  **瀏覽網站**
    服務啟動後，請打開瀏覽器存取：
    *   **首頁**: http://localhost:8000
    *   **API 文件**: http://localhost:8000/docs

### 預設帳號

系統首次啟動會自動建立管理員帳號：
*   **Email**: `admin@campus.com`
*   **密碼**: `admin123`

### 停止服務

```bash
docker-compose down
```

## 專案結構

```
.
├── app/
│   ├── main.py          # 程式進入點、API 路由、WebSocket 管理
│   ├── models.py        # 資料庫模型 (User, Item, Message, ChatParticipant)
│   ├── schemas.py       # Pydantic 資料驗證模型
│   ├── crud.py          # 資料庫操作邏輯
│   └── static/          # 前端靜態檔案 (HTML, CSS, JS, Images(本地測試用))
├── docker-compose.yml   # Docker 服務編排
├── Dockerfile           # 後端映像檔定義
└── requirements.txt     # Python 套件依賴
```
    *   註冊與登入 (JWT 身分驗證)。
    *   個人資料管理 (修改暱稱)。
    *   個人商品管理 (查看我刊登的商品)。
*   **商品交易**
    *   刊登商品 (支援圖片上傳)。
    *   瀏覽商品列表 (支援分頁、關鍵字搜尋、分類篩選)。
    *   商品詳情頁面。
    *   賣家管理功能 (編輯商品資訊、刪除商品、標示已售出/重新上架)。
    *   權限控管 (僅賣家本人可修改自己的商品)。
*   **即時通訊**
    *   買賣雙方一對一即時聊天室 (WebSocket)。
    *   聊天歷史紀錄保存 (MySQL)。
    *   未讀訊息紅點通知。
*   **介面設計**
    *   RWD 響應式網頁設計 (Bootstrap 5)。
    *   校園風格 UI 主題 (學院深藍配色)。
    *   直覺的操作體驗 (Modal 視窗、載入動畫)。

## 技術堆疊

*   **後端框架**: FastAPI (Python 3.9)
*   **資料庫**: MySQL 8.0
*   **ORM**: SQLAlchemy
*   **即時通訊**: WebSockets
*   **前端**: HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5
*   **容器化**: Docker, Docker Compose
