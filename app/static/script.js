const API_URL = ""; 
let token = localStorage.getItem("token");
let userEmail = localStorage.getItem("userEmail");
let ws = null;
let currentChatRoomId = null;
let currentPage = 1;
const itemsPerPage = 8; // 每頁顯示 8 筆 (2列 x 4行)
let currentProfilePage = 1;

// --- UI 工具函式 ---
function showToast(message, type = 'primary') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        // 修改：改為正上方置中 (top-0 start-50 translate-middle-x)
        toastContainer.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
        toastContainer.style.zIndex = '1070'; // 確保在 Navbar 之上
        document.body.appendChild(toastContainer);
    }

    // 修改：清空舊的 Toast，只顯示最新的一個
    toastContainer.innerHTML = '';

    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'error' ? 'text-bg-danger' : (type === 'success' ? 'text-bg-success' : 'text-bg-primary');
    
    // 使用 SVG 圖示取代 Emoji
    const iconError = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-exclamation-circle-fill me-2" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>`;
    const iconSuccess = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check-circle-fill me-2" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>`;
    const iconInfo = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-info-circle-fill me-2" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>`;
    
    const icon = type === 'error' ? iconError : (type === 'success' ? iconSuccess : iconInfo);
    const title = type === 'error' ? '發生錯誤' : (type === 'success' ? '操作成功' : '系統提示');
    
    const html = `
        <div id="${toastId}" class="toast ${bgClass} border-0 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4000">
            <div class="d-flex">
                <div class="toast-body">
                    <strong class="fs-5 d-flex align-items-center mb-1">${icon} ${title}</strong>
                    <div class="fs-6">${message}</div>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', html);
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// --- 錯誤訊息格式化工具 ---
function formatError(err) {
    if (!err) return "未知錯誤";
    // 如果是簡單字串
    if (typeof err.detail === 'string') return err.detail;
    // 如果是 Pydantic 驗證錯誤 (陣列)
    if (Array.isArray(err.detail)) {
        return err.detail.map(e => {
            // 取得欄位名稱 (例如 body -> price)
            const field = e.loc[e.loc.length - 1];
            return `• <b>${field}</b>: ${e.msg}`;
        }).join('<br>');
    }
    return JSON.stringify(err);
}

// --- 確認視窗工具 (取代原生 confirm) ---
function showConfirmModal(title, message, onConfirm) {
    let modalEl = document.getElementById('globalConfirmModal');
    if (!modalEl) {
        const html = `
        <div class="modal fade" id="globalConfirmModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content shadow-lg border-0" style="border-radius: 16px;">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title fw-bold" id="globalConfirmTitle">確認</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body py-4 fs-6 text-secondary" id="globalConfirmBody"></div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary rounded-pill px-4" id="globalConfirmBtn">確定</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById('globalConfirmModal');
    }

    document.getElementById('globalConfirmTitle').innerText = title;
    document.getElementById('globalConfirmBody').innerText = message;
    
    const confirmBtn = document.getElementById('globalConfirmBtn');
    // 複製按鈕以移除舊的事件監聽器
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    const modal = new bootstrap.Modal(modalEl);
    newBtn.onclick = () => {
        modal.hide();
        onConfirm();
    };
    
    modal.show();
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
    checkLoginStatus();
    loadItems();
});

async function checkLoginStatus() {
    if (token) {
        document.getElementById("guest-nav").style.display = "none";
        document.getElementById("user-nav").style.display = "block";
        
        // 修改：嘗試取得使用者詳細資料以顯示暱稱
        try {
            const res = await fetch(`${API_URL}/users/me`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                document.getElementById("user-email").innerText = user.nickname;
            } else {
                // 如果失敗 (例如 Token 過期)，顯示 Email 作為備案
                document.getElementById("user-email").innerText = userEmail;
            }
        } catch (e) {
            document.getElementById("user-email").innerText = userEmail;
        }
    } else {
        document.getElementById("guest-nav").style.display = "block";
        document.getElementById("user-nav").style.display = "none";
    }
}

function showModal(id) {
    new bootstrap.Modal(document.getElementById(id)).show();
}

// 1. 註冊
async function register() {
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPass").value;
    const nickname = document.getElementById("regNick").value;

    try {
        const res = await fetch(`${API_URL}/users/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, nickname })
        });
        if (res.ok) {
            showToast("註冊成功！請登入", "success");
            location.reload();
        } else {
            const err = await res.json();
            showToast("註冊失敗:<br>" + formatError(err), "error");
        }
    } catch (e) { showToast("系統錯誤: " + e, "error"); }
}

// --- 5. 聊天功能 (整合版) ---

// 開啟聊天列表
async function openChatList() {
    if (!token) return showToast("請先登入", "error");
    
    const modal = new bootstrap.Modal(document.getElementById('chatListModal'));
    modal.show();
    
    const container = document.getElementById("chat-list-container");
    container.innerHTML = '<p class="text-center text-muted">載入中...</p>';

    try {
        const res = await fetch(`${API_URL}/users/chats`, { // This needs to be protected
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const conversations = await res.json();
            container.innerHTML = "";
            if (conversations.length === 0) {
                container.innerHTML = '<p class="text-center text-muted">目前沒有聊天紀錄</p>';
                return;
            }
            
            let totalUnread = 0;
            conversations.forEach(conv => {
                totalUnread += conv.unread_count;
                const unreadBadge = conv.unread_count > 0 ? `<span class="badge bg-danger rounded-pill ms-auto">${conv.unread_count}</span>` : '';
                const html = `
                    <a href="#" class="list-group-item list-group-item-action d-flex align-items-center" onclick="openChatRoom('${conv.room_id}', '${conv.item_title} - ${conv.counterpart_nickname}')">
                        <img src="${conv.item_image_url}" class="rounded me-3" style="width: 50px; height: 50px; object-fit: cover;">
                        <div>
                            <div class="fw-bold">${conv.item_title}</div>
                            <small class="text-muted">與 ${conv.counterpart_nickname} (${conv.role})</small>
                        </div>
                        ${unreadBadge}
                    </a>
                `;
                container.innerHTML += html;
            });

            // 更新導覽列上的總未讀數
            const globalBadge = document.getElementById('chat-notification-badge');
            if (totalUnread > 0) {
                globalBadge.innerText = totalUnread > 9 ? '9+' : totalUnread;
                globalBadge.style.display = 'block';
            } else {
                globalBadge.style.display = 'none';
            }
        } else {
            if (res.status === 401) {
                showToast("登入已過期，請重新登入", "error");
                logout();
                return;
            }
            container.innerHTML = '<p class="text-center text-danger">載入失敗</p>';
        }
    } catch (e) { console.error(e); }
}

// 開啟特定聊天室
function openChatRoom(roomId, title) {
    // 如果是從列表點擊，先關閉列表 Modal
    const listModalEl = document.getElementById('chatListModal');
    if (listModalEl && listModalEl.classList.contains('show')) {
        bootstrap.Modal.getInstance(listModalEl).hide();
    }

    currentChatRoomId = roomId;
    document.getElementById("chatTitle").innerText = `💬 ${title}`;
    
    const modal = new bootstrap.Modal(document.getElementById('chatModal'));
    modal.show(); // 修正：補上這行，讓視窗真正彈出來
    loadChatHistory(roomId);
    connectWebSocket(roomId);
}

async function loadChatHistory(roomId) {

    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    try {
        const res = await fetch(`${API_URL}/chat/${roomId}`, {
            headers: { "Authorization": `Bearer ${token}` } // 加上 token 才能更新已讀
        });
        if (res.ok) {
            const messages = await res.json();
            let allMessagesHtml = "";
            messages.forEach(msg => {
                const isSelf = msg.sender === userEmail;
                allMessagesHtml += `<div class="message-sender ${isSelf?'text-end':''}">${msg.sender}</div>
                                    <div class="d-flex ${isSelf?'justify-content-end':''}"><div class="message ${isSelf?'self':'other'}">${msg.content}</div></div>`;
            });
            chatBox.innerHTML = allMessagesHtml;
            // 確保 DOM 更新後再捲動
            setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 300);
        } else if (res.status === 401) {
            chatBox.innerHTML = '<p class="text-center text-danger mt-3">無法載入訊息，請重新登入</p>';
        }

    } catch (e) { console.error(e); }
}

function connectWebSocket(roomId) {
    if (ws) ws.close(); // 關閉舊連線
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // roomId 現在已經是完整的字串 (例如 "5-10")，直接使用
    const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}/${userEmail}`;
    
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {

        const data = JSON.parse(event.data);
        appendMessage(data.sender, data.message || data.content);
    };
}

function sendMessage() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (message && ws) {
        ws.send(message);
        input.value = "";
    }
}

function appendMessage(sender, message) {
    const chatBox = document.getElementById("chat-box");
    const isSelf = sender === userEmail;
    const html = `<div class="message-sender ${isSelf?'text-end':''}">${sender}</div>
                  <div class="d-flex ${isSelf?'justify-content-end':''}"><div class="message ${isSelf?'self':'other'}">${message}</div></div>`;
    chatBox.innerHTML += html;
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 2. 登入
async function login() {
    const formData = new FormData();
    formData.append("username", document.getElementById("loginEmail").value);
    formData.append("password", document.getElementById("loginPass").value);

    try {
        const res = await fetch(`${API_URL}/token`, { method: "POST", body: formData });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("userId", data.user_id); // 儲存 User ID 以便比對權限
            localStorage.setItem("isAdmin", data.is_admin); // 儲存管理員狀態
            localStorage.setItem("userEmail", document.getElementById("loginEmail").value);
            location.reload();
        } else {
            showToast("登入失敗，請檢查帳號密碼", "error");
        }
    } catch (e) { showToast("錯誤: " + e, "error"); }
}

function logout() {
    showConfirmModal("登出確認", "確定要登出嗎？", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userId");
        localStorage.removeItem("isAdmin");
        location.href = "/";
    });
}

// 3. 載入商品
async function loadItems(page = 1) {
    currentPage = page;
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return; // 防止在沒有搜尋框的頁面報錯
    
    const search = searchInput.value.trim();
    const category = document.getElementById("searchCategory").value;

    // 計算 skip 與 limit
    const skip = (page - 1) * itemsPerPage;
    let url = `${API_URL}/items/?skip=${skip}&limit=${itemsPerPage}`;
    
    // 使用 encodeURIComponent 確保中文參數正確傳遞
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;

    const container = document.getElementById("items-container");
    // 加入載入中提示，讓使用者知道系統正在篩選
    container.innerHTML = '<div class="col-12 text-center mt-5"><div class="spinner-border text-primary" role="status"></div></div>';

    try {
        const res = await fetch(url);
        const items = await res.json();
        
        container.innerHTML = "";
        
        if (items.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted mt-5">找不到符合條件的商品</div>';
            renderPagination(0); // 清空或更新分頁按鈕
            return;
        }
    
    const currentUserId = localStorage.getItem("userId");
    const isAdmin = localStorage.getItem("isAdmin") === 'true';

    items.forEach(item => {
        // 判斷狀態顯示
        const isSold = item.status === "sold";
        const statusBadge = isSold ? '<span class="badge bg-secondary position-absolute top-0 end-0 m-2">已售出</span>' : '';
        const cardClass = isSold ? 'item-card h-100 sold-item' : 'item-card h-100';
        
        // 判斷是否為擁有者，若是則顯示操作按鈕
        let ownerControls = "";
        if ((currentUserId && parseInt(currentUserId) === item.owner_id) || isAdmin) {
            ownerControls = `
                <div class="mt-3 pt-2 border-top" onclick="event.stopPropagation()">
                    <button class="btn btn-sm ${isSold ? 'btn-outline-warning' : 'btn-outline-success'} w-100 mb-1" onclick="toggleItemStatus(${item.id}, '${item.status}')">
                        ${isSold ? '重新上架' : '標示已售出'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger w-100" onclick="deleteItemFromList(${item.id})">刪除</button>
                </div>
            `;
        }

        const html = `
            <div class="col-md-3 mb-4">
                <div class="card ${cardClass}" onclick="location.href='/static/detail.html?id=${item.id}'">
                    ${statusBadge}
                    <img src="${item.image_url}" class="card-img-top" alt="${item.title}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${item.title}</h5>
                        <p class="card-text text-danger">$${item.price}</p>
                        <p class="card-text"><small class="text-muted">${item.category}</small> ${isSold ? '(已售出)' : ''}</p>
                        <div class="mt-auto">
                            ${ownerControls}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    // 渲染分頁按鈕
    renderPagination(items.length);

    } catch (e) { console.error(e); container.innerHTML = '<p class="text-center text-danger">載入失敗</p>'; }
}

// 4. 刊登商品
async function postItem() {
    if (!token) return showToast("請先登入", "error");

    const formData = new FormData();
    formData.append("title", document.getElementById("postTitle").value);
    formData.append("price", document.getElementById("postPrice").value);
    formData.append("category", document.getElementById("postCategory").value);
    formData.append("description", document.getElementById("postDesc").value);
    formData.append("file", document.getElementById("postFile").files[0]);

    try {
        const res = await fetch(`${API_URL}/items/`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });
        if (res.ok) {
            showToast("刊登成功！", "success");
            location.reload();
        } else {
            const err = await res.json();
            showToast("刊登失敗:<br>" + formatError(err), "error");
        }
    } catch (e) { showToast("系統錯誤: " + e, "error"); }
}

// --- 6. 列表頁的商品操作 (新增) ---

async function toggleItemStatus(id, currentStatus) {
    const actionText = currentStatus === 'sold' ? "重新上架" : "標示為已售出";
    
    showConfirmModal("確認操作", `確定要將此商品${actionText}嗎？`, async () => {
        const newStatus = (currentStatus === "on_sale") ? "sold" : "on_sale";
        const formData = new FormData();
        formData.append("status", newStatus);

        try {
            const res = await fetch(`${API_URL}/items/${id}/status`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                // 判斷是在個人頁面還是主頁面，呼叫對應的重新載入函式
                if (document.getElementById('my-items-container')) {
                    loadProfile(currentProfilePage);
                } else {
                    loadItems(currentPage); 
                }
                showToast("狀態已更新", "success");
            } else {
                showToast("更新失敗", "error");
            }
        } catch (e) { console.error(e); showToast("系統錯誤", "error"); }
    });
}

// --- 9. 分頁渲染 (新增) ---
function renderPagination(currentCount) {
    const container = document.getElementById("pagination-container");
    if (!container) return;

    // 如果是第一頁且沒有資料，就不顯示分頁
    if (currentPage === 1 && currentCount === 0) {
        container.innerHTML = "";
        return;
    }

    const html = `
        <nav aria-label="Page navigation">
            <ul class="pagination justify-content-center">
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <button class="page-link" onclick="loadItems(${currentPage - 1})">上一頁</button>
                </li>
                <li class="page-item disabled">
                    <span class="page-link fw-bold text-dark">第 ${currentPage} 頁</span>
                </li>
                <li class="page-item ${currentCount < itemsPerPage ? 'disabled' : ''}">
                    <button class="page-link" onclick="loadItems(${currentPage + 1})">下一頁</button>
                </li>
            </ul>
        </nav>
    `;
    container.innerHTML = html;
}

async function deleteItemFromList(id) {
    showConfirmModal("刪除商品", "確定要刪除這個商品嗎？此動作無法復原。", async () => {
        try {
            const res = await fetch(`${API_URL}/items/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                if (document.getElementById('my-items-container')) {
                    loadProfile(currentProfilePage);
                } else {
                    loadItems(currentPage);
                }
                showToast("商品已刪除", "success");
            } else {
                showToast("刪除失敗", "error");
            }
        } catch (e) { console.error(e); showToast("系統錯誤", "error"); }
    });
}

// --- 7. 個人頁面功能 (新增) ---

async function loadProfile(page = 1) {
    currentProfilePage = page;
    if (!token) {
        showToast("請先登入", "error");
        location.href = "/";
        return;
    }

    // 1. 載入使用者資訊
    try {
        const res = await fetch(`${API_URL}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const user = await res.json();
            // 檢查元素是否存在 (因為 script.js 被多個頁面共用)
            if (document.getElementById("profile-email")) {
                document.getElementById("profile-email").innerText = user.email;
                document.getElementById("profile-nickname").innerText = user.nickname;
                document.getElementById("profile-id").innerText = user.id;
            }
        }
    } catch (e) { console.error("載入使用者資訊失敗", e); }

    // 2. 載入我的商品
    const container = document.getElementById("my-items-container");
    if (!container) return; // 如果不在 profile 頁面，就停止執行

    try {
        const userId = localStorage.getItem("userId");
        // 計算 skip 與 limit
        const skip = (page - 1) * itemsPerPage;
        const res = await fetch(`${API_URL}/items/?owner_id=${userId}&skip=${skip}&limit=${itemsPerPage}`);
        const items = await res.json();
        
        container.innerHTML = "";
        if (items.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted mt-4">您尚未刊登任何商品</div>';
            renderProfilePagination(0);
            return;
        }

        items.forEach(item => {
            const isSold = item.status === "sold";
            const statusBadge = isSold ? '<span class="badge bg-secondary position-absolute top-0 end-0 m-2">已售出</span>' : '';
            const cardClass = isSold ? 'item-card h-100 sold-item' : 'item-card h-100';

            const html = `
                <div class="col-md-6 mb-4">
                    <div class="card ${cardClass}" onclick="location.href='/static/detail.html?id=${item.id}'">
                        ${statusBadge}
                        <div class="row g-0">
                            <div class="col-4">
                                <img src="${item.image_url}" class="img-fluid rounded-start h-100" style="object-fit: cover;" alt="${item.title}">
                            </div>
                            <div class="col-8">
                                <div class="card-body d-flex flex-column h-100">
                                    <h5 class="card-title text-truncate">${item.title}</h5>
                                    <p class="card-text text-danger fw-bold">$${item.price}</p>
                                    <div class="mt-auto pt-2 border-top" onclick="event.stopPropagation()">
                                        <button class="btn btn-sm ${isSold ? 'btn-outline-warning' : 'btn-outline-success'} me-1" onclick="toggleItemStatus(${item.id}, '${item.status}')">
                                            ${isSold ? '上架' : '售出'}
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteItemFromList(${item.id})">刪除</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

        // 渲染個人頁面分頁
        renderProfilePagination(items.length);

    } catch (e) { console.error("載入個人商品失敗", e); }
}

function renderProfilePagination(currentCount) {
    const container = document.getElementById("profile-pagination-container");
    if (!container) return;

    // 如果是第一頁且沒有資料，就不顯示分頁
    if (currentProfilePage === 1 && currentCount === 0) {
        container.innerHTML = "";
        return;
    }

    const html = `
        <nav aria-label="Page navigation">
            <ul class="pagination justify-content-center">
                <li class="page-item ${currentProfilePage === 1 ? 'disabled' : ''}">
                    <button class="page-link" onclick="loadProfile(${currentProfilePage - 1})">上一頁</button>
                </li>
                <li class="page-item disabled">
                    <span class="page-link fw-bold text-dark">第 ${currentProfilePage} 頁</span>
                </li>
                <li class="page-item ${currentCount < itemsPerPage ? 'disabled' : ''}">
                    <button class="page-link" onclick="loadProfile(${currentProfilePage + 1})">下一頁</button>
                </li>
            </ul>
        </nav>
    `;
    container.innerHTML = html;
}

// --- 8. 修改個人檔案 (新增) ---

function openEditProfileModal() {
    const currentNickname = document.getElementById("profile-nickname").innerText;
    document.getElementById("editNickname").value = currentNickname;
    new bootstrap.Modal(document.getElementById('editProfileModal')).show();
}

async function submitEditProfile() {
    const newNickname = document.getElementById("editNickname").value;
    if (!newNickname) return showToast("暱稱不能為空", "error");

    try {
        const res = await fetch(`${API_URL}/users/me`, {
            method: "PUT",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nickname: newNickname })
        });
        if (res.ok) {
            showToast("修改成功！", "success");
            location.reload();
        } else {
            showToast("修改失敗", "error");
        }
    } catch (e) { console.error(e); }
}