import { db, timestamp } from './firebase.js';
import { currentUser, authInitialized } from './auth.js';
import { formatPrice, formatDate, showNotification } from './utils.js';
import { 
    doc, 
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let userData = null;

// Загрузка данных профиля
async function loadProfile() {
    if (!currentUser) {
        if (authInitialized) {
            window.location.href = 'login.html';
        }
        return;
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
            renderProfile();
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showNotification('Ошибка при загрузке профиля', 'error');
    }
}

// Отрисовка профиля
function renderProfile() {
    // Заполняем форму профиля
    const displayNameInput = document.getElementById('displayName');
    const phoneInput = document.getElementById('phone');
    const cityInput = document.getElementById('city');
    const addressInput = document.getElementById('address');
    const notificationsEmail = document.getElementById('notificationsEmail');
    const notificationsOrder = document.getElementById('notificationsOrder');
    
    if (displayNameInput) displayNameInput.value = userData.displayName || '';
    if (phoneInput) phoneInput.value = userData.phone || '';
    if (cityInput) cityInput.value = userData.city || '';
    if (addressInput) addressInput.value = userData.address || '';
    
    if (userData.preferences) {
        if (notificationsEmail) notificationsEmail.checked = userData.preferences.notificationsEmail || false;
        if (notificationsOrder) notificationsOrder.checked = userData.preferences.notificationsOrder || false;
    }
    
    // Загружаем заказы
    loadOrders();
    
    // Загружаем отзывы пользователя
    loadUserReviews();
}

// Сохранение профиля
async function saveProfile(e) {
    e.preventDefault();
    
    try {
        const updatedData = {
            displayName: document.getElementById('displayName').value,
            phone: document.getElementById('phone').value,
            city: document.getElementById('city').value,
            address: document.getElementById('address').value,
            preferences: {
                notificationsEmail: document.getElementById('notificationsEmail').checked,
                notificationsOrder: document.getElementById('notificationsOrder').checked
            },
            updatedAt: timestamp()
        };
        
        await updateDoc(doc(db, 'users', currentUser.uid), updatedData);
        
        showNotification('Профиль успешно обновлен', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения профиля:', error);
        showNotification('Ошибка при сохранении профиля', 'error');
    }
}

// Загрузка заказов
async function loadOrders() {
    try {
        const ordersQuery = query(
            collection(db, 'orders'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(ordersQuery);
        const container = document.getElementById('orders-list');
        
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>У вас пока нет заказов</p>
                    <a href="index.html" class="btn btn-primary">Перейти к покупкам</a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            container.appendChild(createOrderElement(order));
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        showNotification('Ошибка при загрузке заказов', 'error');
    }
}

// Создание элемента заказа
function createOrderElement(order) {
    const div = document.createElement('div');
    div.className = 'order-card';
    
    // Определяем класс статуса
    const statusClass = `status-${order.status}`;
    
    // Получаем текст статуса
    const statusText = getStatusText(order.status);
    
    // Создаем HTML для товаров в заказе
    const itemsHtml = order.items.map(item => `
        <div class="order-item">
            <div class="order-item-info">
                <img src="${item.imageUrl || 'https://via.placeholder.com/50'}" alt="${item.productName}" class="order-item-image">
                <div>
                    <div class="order-item-name">${item.productName}</div>
                    <div class="order-item-price">${formatPrice(item.price)} × ${item.quantity}</div>
                </div>
            </div>
            <div class="order-item-total">${formatPrice(item.total)}</div>
        </div>
    `).join('');
    
    div.innerHTML = `
        <div class="order-header">
            <div class="order-id">
                <strong>Заказ #${order.id.slice(0, 8)}</strong>
                <span class="order-date">${formatDate(order.createdAt)}</span>
            </div>
            <div class="order-status ${statusClass}">${statusText}</div>
        </div>
        <div class="order-items">
            ${itemsHtml}
        </div>
        <div class="order-footer">
            <div class="order-total">
                <span>Итого:</span>
                <strong>${formatPrice(order.totalAmount)}</strong>
            </div>
        </div>
    `;
    
    return div;
}

// Получение текста статуса
function getStatusText(status) {
    const statuses = {
        'pending': 'Ожидает обработки',
        'processing': 'В обработке',
        'shipped': 'Отправлен',
        'delivered': 'Доставлен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

// Загрузка отзывов пользователя
async function loadUserReviews() {
    try {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(reviewsQuery);
        const container = document.getElementById('user-reviews-list');
        
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Вы еще не оставляли отзывов</p>
                    <a href="index.html" class="btn btn-primary">Посмотреть товары</a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const review = { id: doc.id, ...doc.data() };
            container.appendChild(createUserReviewElement(review));
        });
        
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
        showNotification('Ошибка при загрузке отзывов', 'error');
    }
}

// Создание элемента отзыва пользователя
function createUserReviewElement(review) {
    const div = document.createElement('div');
    div.className = 'user-review-card';
    
    // Создаем звезды рейтинга
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    
    div.innerHTML = `
        <div class="user-review-header">
            <div>
                <a href="product.html?id=${review.productId}" class="review-product-link">
                    <strong>${review.productName}</strong>
                </a>
                <div class="user-review-rating">${stars}</div>
            </div>
            <div class="user-review-date">${formatDate(review.createdAt)}</div>
        </div>
        <div class="user-review-comment">${review.comment}</div>
        <div class="user-review-actions">
            <button class="btn btn-danger btn-sm" onclick="window.deleteUserReview('${review.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
                Удалить отзыв
            </button>
        </div>
    `;
    
    return div;
}

// Удаление отзыва пользователя
window.deleteUserReview = async (reviewId) => {
    if (!confirm('Вы уверены, что хотите удалить этот отзыв?')) return;
    
    try {
        await deleteDoc(doc(db, 'reviews', reviewId));
        await loadUserReviews();
        showNotification('Отзыв успешно удален', 'success');
    } catch (error) {
        console.error('Ошибка удаления отзыва:', error);
        showNotification('Ошибка при удалении отзыва', 'error');
    }
};

// Переключение вкладок
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    
    // Если пользователь уже авторизован, загружаем профиль
    if (currentUser) {
        loadProfile();
    }
    
    // Ждем инициализацию авторизации
    const checkInterval = setInterval(() => {
        if (authInitialized) {
            clearInterval(checkInterval);
            if (currentUser) {
                loadProfile();
            } else {
                window.location.href = 'login.html';
            }
        }
    }, 100);
    
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }
});