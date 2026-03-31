import { db } from './firebase.js';
import { collection, getDocs, query, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentUser, userRole } from './auth.js';

// Форматирование даты
export function formatDate(timestamp) {
    if (!timestamp) return 'Н/Д';
    if (!timestamp.toDate) return new Date(timestamp).toLocaleString('ru-RU');
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Форматирование цены
export function formatPrice(price) {
    if (price === undefined || price === null) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Отображение рейтинга звездами
export function renderRating(rating) {
    if (!rating) rating = 0;
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '★';
    }
    if (halfStar) {
        stars += '½';
    }
    while (stars.length < 5) {
        stars += '☆';
    }
    
    return stars;
}

// Класс для пагинации
export class Paginator {
    constructor(collectionName, itemsPerPage = 10) {
        this.collectionName = collectionName;
        this.itemsPerPage = itemsPerPage;
        this.lastDoc = null;
        this.hasMore = true;
    }

    async loadNextPage(filters = []) {
        if (!this.hasMore) return [];
        
        let q = query(collection(db, this.collectionName), limit(this.itemsPerPage));
        
        if (this.lastDoc) {
            q = query(q, startAfter(this.lastDoc));
        }
        
        // Применяем фильтры
        filters.forEach(filter => {
            q = query(q, ...filter);
        });
        
        try {
            const snapshot = await getDocs(q);
            this.lastDoc = snapshot.docs[snapshot.docs.length - 1];
            this.hasMore = snapshot.docs.length === this.itemsPerPage;
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Ошибка пагинации:', error);
            return [];
        }
    }

    reset() {
        this.lastDoc = null;
        this.hasMore = true;
    }
}

// Защита админских маршрутов
export function requireAdmin() {
    if (userRole !== 'admin') {
        showNotification('У вас нет доступа к этой странице', 'error');
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Защита авторизованных маршрутов
export function requireAuth() {
    if (!currentUser) {
        showNotification('Необходимо войти в систему', 'warning');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Показ уведомлений
export function showNotification(message, type = 'info') {
    // Удаляем предыдущее уведомление, если есть
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }
    
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Добавляем стили
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: white;
        color: #1f2937;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#6366f1'};
        font-weight: 500;
    `;
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    }, 3000);
}

// Дебаунс для поиска
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Добавляем анимацию для скрытия
const slideOutStyle = document.createElement('style');
slideOutStyle.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(slideOutStyle);