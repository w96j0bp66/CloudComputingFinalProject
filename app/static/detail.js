const API_URL = ""; 
let ws = null;
let currentItemId = null;
let currentUser = localStorage.getItem("userEmail") || "訪客";
let currentUserId = localStorage.getItem("userId"); // 取得登入者的 ID
let isAdmin = localStorage.getItem("isAdmin") === 'true';
let currentItemData = null; // 暫存商品資料供編輯使用

// --- UI 工具函式 ---
function showToast(message, type = 'primary') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        // 修改：改為正上方置中
        toastContainer.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
        toastContainer.style.zIndex = '1070';
        document.body.appendChild(toastContainer);
    }

    // 修改：清空舊的 Toast
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

// --- 確認視窗工具 (與 script.js 保持一致) ---
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
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    const modal = new bootstrap.Modal(modalEl);
    newBtn.onclick = () => {
        modal.hide();
        onConfirm();
    };
    
    modal.show();
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. 從網址取得 id 參數 (例如 detail.html?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');

    if (!itemId) {
        showToast("無效的商品連結", "error");
        location.href = "/";
        return;
    }

    currentItemId = itemId;
    loadItemDetail(itemId);
});

async function loadItemDetail(id) {
    try {
        const res = await fetch(`${API_URL}/items/${id}`);
        if (!res.ok) throw new Error("找不到該商品");
        
        const item = await res.json();
        currentItemData = item; // 存起來
        document.getElementById("detail-img").src = item.image_url;
        document.getElementById("detail-title").innerText = item.title;
        document.getElementById("detail-price").innerText = `$${item.price}`;
        document.getElementById("detail-category").innerText = item.category;
        document.getElementById("detail-desc").innerText = item.description || "賣家未提供描述";
        // 顯示暱稱，若無則顯示匿名
        document.getElementById("detail-owner").innerText = item.owner_nickname || "匿名";

        // --- 狀態處理 ---
        if (item.status === "sold") {
            document.getElementById("detail-status").style.display = "inline-block";
            document.getElementById("contact-btn").disabled = true;
            document.getElementById("contact-btn").innerText = "已售出";
            document.getElementById("btn-toggle-status").innerText = "重新上架";
        } else {
            document.getElementById("detail-status").style.display = "none";
            document.getElementById("btn-toggle-status").innerText = "標示為已售出";
        }
        
        // --- 權限判斷 (是否為賣家本人) ---
        // 注意：localStorage 存的是字串，item.owner_id 是數字，需轉型比較。管理員也有權限。
        if ((currentUserId && parseInt(currentUserId) === item.owner_id) || isAdmin) {
            document.getElementById("owner-actions").style.display = "block";
            document.getElementById("contact-btn").style.display = "none"; // 自己不用聯絡自己
        }

        // 綁定當前狀態給全域變數，供 toggle 使用
        currentItemStatus = item.status;

        document.getElementById("detail-container").style.display = "flex";
    } catch (e) {
        showToast("讀取失敗: " + e.message, "error");
        location.href = "/";
    }
}

let currentItemStatus = "on_sale";

// 切換商品狀態 (上架/已售出)
async function toggleStatus() {
    const actionText = currentItemStatus === 'sold' ? "重新上架" : "標示為已售出";
    
    showConfirmModal("確認操作", `確定要將此商品${actionText}嗎？`, async () => {
        const newStatus = (currentItemStatus === "on_sale") ? "sold" : "on_sale";
        const formData = new FormData();
        formData.append("status", newStatus);

        try {
            const res = await fetch(`${API_URL}/items/${currentItemId}/status`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: formData
            });
            if (res.ok) {
                showToast("狀態更新成功！", "success");
                location.reload();
            } else {
                showToast("更新失敗", "error");
            }
        } catch (e) { console.error(e); showToast("系統錯誤", "error"); }
    });
}

// 刪除商品
async function deleteItem() {
    showConfirmModal("刪除商品", "確定要刪除這個商品嗎？此動作無法復原。", async () => {
        try {
            const res = await fetch(`${API_URL}/items/${currentItemId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
            });
            if (res.ok) {
                showToast("商品已刪除", "success");
                location.href = "/";
            } else {
                showToast("刪除失敗", "error");
            }
        } catch (e) { console.error(e); showToast("系統錯誤", "error"); }
    });
}

// --- 編輯商品功能 ---
function openEditModal() {
    if (!currentItemData) return;
    
    document.getElementById("editTitle").value = currentItemData.title;
    document.getElementById("editPrice").value = currentItemData.price;
    document.getElementById("editCategory").value = currentItemData.category;
    document.getElementById("editDesc").value = currentItemData.description || "";
    
    new bootstrap.Modal(document.getElementById('editModal')).show();
}

async function submitEdit() {
    const data = {
        title: document.getElementById("editTitle").value,
        price: parseFloat(document.getElementById("editPrice").value),
        category: document.getElementById("editCategory").value,
        description: document.getElementById("editDesc").value
    };

    try {
        const res = await fetch(`${API_URL}/items/${currentItemId}`, {
            method: "PUT",
            headers: { 
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast("修改成功！", "success");
            location.reload();
        } else {
            showToast("修改失敗", "error");
        }
    } catch (e) { console.error(e); }
}

// --- 聊天室功能 ---
function openChat() {
    console.log("嘗試開啟聊天室..."); // 除錯訊息
    const token = localStorage.getItem("token");
    if (!token) {
        showToast("請先登入才能使用聊天功能！", "error");
        return;
    }
    
    try {
        // 確保 Modal 元素存在
        const modalEl = document.getElementById('chatModal');
        if (!modalEl) throw new Error("Chat Modal element not found");

        // 強制使用 new Modal 確保顯示 (有時候 getOrCreateInstance 在某些狀態下會怪怪的)
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (e) { console.error(e); }

    const roomId = `${currentItemId}-${currentUserId}`;
    // 載入歷史訊息
    loadChatHistory(roomId);

    // 如果尚未連線，建立 WebSocket 連線
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        // 使用 item_id 作為房間 ID，簡單實作該商品的公開聊天室
        // 修改：使用 {item_id}-{buyer_id} 作為一對一聊天室 ID
        // 如果我是買家，ID 就是 {itemId}-{myUserId}
        // 如果我是賣家，這裡通常不會被點擊(因為按鈕隱藏)，但邏輯上賣家是從列表進入
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}/${currentUser}`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            appendMessage(data.sender, data.message || data.content);
        };

        ws.onclose = () => {
            console.log("Chat disconnected");
        };
    }
}

async function loadChatHistory(roomId) {
    try {
        console.log(`載入歷史訊息: /chat/${roomId}`);
        const res = await fetch(`${API_URL}/chat/${roomId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
            const messages = await res.json();
            const chatBox = document.getElementById("chat-box");
            chatBox.innerHTML = ""; // 清空舊訊息
            let allMessagesHtml = "";
            messages.forEach(msg => {
                const isSelf = msg.sender === currentUser;
                allMessagesHtml += `
                    <div class="message-sender ${isSelf ? 'text-end' : ''}">${msg.sender}</div>
                    <div class="d-flex ${isSelf ? 'justify-content-end' : ''}">
                        <div class="message ${isSelf ? 'self' : 'other'}">${msg.content}</div>
                    </div>`;
            });
            chatBox.innerHTML = allMessagesHtml;
            setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 300);
        } else if (res.status === 401) {
            document.getElementById("chat-box").innerHTML = '<p class="text-center text-danger mt-3">無法載入訊息，請重新登入</p>';
        }
    } catch (e) { console.error("載入歷史訊息失敗", e); }
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
    const chatBox = document.getElementById("chatBox") || document.getElementById("chat-box");
    const isSelf = sender === currentUser;
    const html = `
        <div class="message-sender ${isSelf ? 'text-end' : ''}">${sender}</div>
        <div class="d-flex ${isSelf ? 'justify-content-end' : ''}">
            <div class="message ${isSelf ? 'self' : 'other'}">${message}</div>
        </div>
    `;
    chatBox.innerHTML += html;
    chatBox.scrollTop = chatBox.scrollHeight; // 捲動到底部
}