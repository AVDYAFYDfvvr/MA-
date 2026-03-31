import { db, timestamp } from './firebase.js';
import { currentUser, userRole, authInitialized } from './auth.js';
import { formatPrice, formatDate, showNotification } from './utils.js';
import { 
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { seedDatabase } from './seed.js';

// Текущий редактируемый товар
let editingProductId = null;

// Проверка прав администратора с ожиданием
function checkAdminAccess() {
    console.log('Checking admin access. Auth initialized:', authInitialized, 'User role:', userRole);
    
    if (!authInitialized) {
        // Если авторизация еще не инициализирована, ждем
        setTimeout(checkAdminAccess, 100);
        return false;
    }
    
    if (!currentUser) {
        console.log('No user, redirecting to login');
        window.location.href = 'login.html';
        return false;
    }
    
    if (userRole !== 'admin') {
        console.log('User is not admin, redirecting to index');
        showNotification('У вас нет доступа к админ-панели', 'error');
        window.location.href = 'index.html';
        return false;
    }
    
    console.log('Admin access granted');
    // Загружаем данные после подтверждения прав
    initializeAdminPanel();
    return true;
}

// Инициализация админ-панели
async function initializeAdminPanel() {
    console.log('Initializing admin panel');
    await loadCategoriesForForm();
    await loadProducts();
    setupAdminTabs();
    
    // Обработчики форм
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', saveProduct);
    }
    
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', addCategory);
    }
    
    // Кнопка добавления товара
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            editingProductId = null;
            const form = document.getElementById('product-form');
            if (form) {
                form.reset();
                form.style.display = 'block';
            }
        });
    }
    
    // Кнопка отмены
    const cancelBtn = document.getElementById('cancel-product-form');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const form = document.getElementById('product-form');
            if (form) form.style.display = 'none';
            editingProductId = null;
        });
    }
    
    // Кнопка добавления тестовых данных
    const seedBtn = document.getElementById('seed-database-btn');
    if (seedBtn) {
        seedBtn.addEventListener('click', seedDatabase);
    }
}

// Загрузка категорий для формы
async function loadCategoriesForForm() {
    try {
        const snapshot = await getDocs(collection(db, 'categories'));
        const select = document.getElementById('product-category');
        
        if (!select) return;
        
        select.innerHTML = '<option value="">Выберите категорию</option>';
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.data().name;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

// Управление товарами
async function loadProducts() {
    try {
        const snapshot = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
        const container = document.getElementById('products-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            container.appendChild(createProductAdminElement(product));
        });
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

function createProductAdminElement(product) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div>
            <strong>${product.name}</strong><br>
            Цена: ${formatPrice(product.price)}<br>
            Категория: ${product.category}<br>
            В наличии: ${product.stock || 0}
        </div>
        <div class="item-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.editProduct('${product.id}')">Редактировать</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteProduct('${product.id}')">Удалить</button>
        </div>
    `;
    return div;
}

// Редактирование товара
window.editProduct = async (productId) => {
    editingProductId = productId;
    
    try {
        const productDoc = await getDoc(doc(db, 'products', productId));
        if (productDoc.exists()) {
            const product = productDoc.data();
            
            const nameInput = document.getElementById('product-name');
            const descInput = document.getElementById('product-description');
            const priceInput = document.getElementById('product-price');
            const categorySelect = document.getElementById('product-category');
            const imageInput = document.getElementById('product-image');
            const stockInput = document.getElementById('product-stock');
            const tagsInput = document.getElementById('product-tags');
            
            if (nameInput) nameInput.value = product.name || '';
            if (descInput) descInput.value = product.description || '';
            if (priceInput) priceInput.value = product.price || '';
            if (categorySelect) categorySelect.value = product.category || '';
            if (imageInput) imageInput.value = product.imageUrl || '';
            if (stockInput) stockInput.value = product.stock || '';
            if (tagsInput) tagsInput.value = (product.tags || []).join(', ');
            
            const form = document.getElementById('product-form');
            if (form) {
                form.style.display = 'block';
                form.scrollIntoView({ behavior: 'smooth' });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
    }
};

// Удаление товара
window.deleteProduct = async (productId) => {
    if (!confirm('Удалить этот товар?')) return;
    
    try {
        await deleteDoc(doc(db, 'products', productId));
        await loadProducts();
        showNotification('Товар удален', 'success');
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        showNotification('Ошибка при удалении товара', 'error');
    }
};

// Сохранение товара
async function saveProduct(e) {
    e.preventDefault();
    
    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const category = document.getElementById('product-category').value;
    const imageUrl = document.getElementById('product-image').value;
    const stock = parseInt(document.getElementById('product-stock').value);
    const tagsInput = document.getElementById('product-tags').value;
    
    // Создаем поисковые ключевые слова
    const searchKeywords = [
        ...name.toLowerCase().split(' '),
        ...description.toLowerCase().split(' '),
        ...category.toLowerCase().split(' ')
    ].filter(word => word.length > 2);
    
    const productData = {
        name,
        description,
        price,
        category,
        imageUrl,
        stock,
        tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag),
        searchKeywords,
        ratingAvg: 0,
        ratingCount: 0,
        updatedAt: timestamp()
    };
    
    try {
        if (editingProductId) {
            // Обновление существующего товара
            await updateDoc(doc(db, 'products', editingProductId), productData);
            showNotification('Товар обновлен', 'success');
        } else {
            // Создание нового товара
            productData.createdAt = timestamp();
            productData.createdBy = currentUser.uid;
            await addDoc(collection(db, 'products'), productData);
            showNotification('Товар добавлен', 'success');
        }
        
        // Сброс формы
        const form = document.getElementById('product-form');
        if (form) {
            form.reset();
            form.style.display = 'none';
        }
        editingProductId = null;
        
        // Перезагрузка списка
        await loadProducts();
        
    } catch (error) {
        console.error('Ошибка сохранения товара:', error);
        showNotification('Ошибка при сохранении товара', 'error');
    }
}

// Управление категориями
async function loadCategories() {
    try {
        const snapshot = await getDocs(collection(db, 'categories'));
        const container = document.getElementById('categories-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const category = { id: doc.id, ...doc.data() };
            container.appendChild(createCategoryAdminElement(category));
        });
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

function createCategoryAdminElement(category) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div>
            <strong>${category.name}</strong>
        </div>
        <div class="item-actions">
            <button class="btn btn-danger btn-sm" onclick="window.deleteCategory('${category.id}')">Удалить</button>
        </div>
    `;
    return div;
}

// Добавление категории
async function addCategory(e) {
    e.preventDefault();
    
    const name = document.getElementById('category-name').value;
    
    try {
        await addDoc(collection(db, 'categories'), {
            name,
            createdAt: timestamp()
        });
        
        const input = document.getElementById('category-name');
        if (input) input.value = '';
        
        await loadCategories();
        await loadCategoriesForForm();
        
        showNotification('Категория добавлена', 'success');
    } catch (error) {
        console.error('Ошибка добавления категории:', error);
        showNotification('Ошибка при добавлении категории', 'error');
    }
}

// Удаление категории
window.deleteCategory = async (categoryId) => {
    if (!confirm('Удалить эту категорию?')) return;
    
    try {
        await deleteDoc(doc(db, 'categories', categoryId));
        await loadCategories();
        await loadCategoriesForForm();
        showNotification('Категория удалена', 'success');
    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        showNotification('Ошибка при удалении категории', 'error');
    }
};

// Управление заказами
async function loadOrders() {
    try {
        const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
        const container = document.getElementById('orders-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            container.appendChild(createOrderAdminElement(order));
        });
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

function createOrderAdminElement(order) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div>
            <strong>Заказ #${order.id.slice(0, 8)}</strong><br>
            Пользователь: ${order.userName}<br>
            Сумма: ${formatPrice(order.totalAmount)}<br>
            Статус: ${order.status}<br>
            Дата: ${formatDate(order.createdAt)}
        </div>
        <div class="item-actions">
            <select class="order-status-select" data-order-id="${order.id}">
                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Ожидает обработки</option>
                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>В обработке</option>
                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Отправлен</option>
                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Доставлен</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Отменен</option>
            </select>
        </div>
    `;
    
    // Добавляем обработчик изменения статуса
    const select = div.querySelector('.order-status-select');
    select.addEventListener('change', async (e) => {
        await updateOrderStatus(order.id, e.target.value);
    });
    
    return div;
}

// Обновление статуса заказа
async function updateOrderStatus(orderId, newStatus) {
    try {
        await updateDoc(doc(db, 'orders', orderId), {
            status: newStatus,
            updatedAt: timestamp()
        });
        showNotification('Статус заказа обновлен', 'success');
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showNotification('Ошибка при обновлении статуса', 'error');
    }
}

// Управление пользователями
async function loadUsers() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const container = document.getElementById('users-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            container.appendChild(createUserAdminElement(user));
        });
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}

function createUserAdminElement(user) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div>
            <strong>${user.displayName || 'Без имени'}</strong><br>
            Email: ${user.email}<br>
            Роль: ${user.role || 'user'}<br>
            Телефон: ${user.phone || 'не указан'}<br>
            Город: ${user.city || 'не указан'}<br>
            Регистрация: ${formatDate(user.createdAt)}
        </div>
        <div class="item-actions">
            <select class="user-role-select" data-user-id="${user.id}">
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
            </select>
        </div>
    `;
    
    const select = div.querySelector('.user-role-select');
    select.addEventListener('change', async (e) => {
        await updateUserRole(user.id, e.target.value);
    });
    
    return div;
}

// Обновление роли пользователя
async function updateUserRole(userId, newRole) {
    try {
        await updateDoc(doc(db, 'users', userId), {
            role: newRole,
            updatedAt: timestamp()
        });
        showNotification('Роль пользователя обновлена', 'success');
    } catch (error) {
        console.error('Ошибка обновления роли:', error);
        showNotification('Ошибка при обновлении роли', 'error');
    }
}

// Модерация отзывов
async function loadReviews() {
    try {
        const snapshot = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
        const container = document.getElementById('reviews-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const review = { id: doc.id, ...doc.data() };
            container.appendChild(createReviewAdminElement(review));
        });
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
    }
}

function createReviewAdminElement(review) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
        <div>
            <strong>${review.userName}</strong> оставил отзыв на товар<br>
            <strong>${review.productName}</strong><br>
            Оценка: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}<br>
            Комментарий: ${review.comment}<br>
            Статус: ${review.status}<br>
            Дата: ${formatDate(review.createdAt)}
        </div>
        <div class="item-actions">
            <button class="btn btn-${review.status === 'active' ? 'warning' : 'success'} btn-sm" 
                    onclick="window.toggleReviewStatus('${review.id}', '${review.status}')">
                ${review.status === 'active' ? 'Скрыть' : 'Показать'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteReview('${review.id}')">Удалить</button>
        </div>
    `;
    return div;
}

// Изменение статуса отзыва
window.toggleReviewStatus = async (reviewId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
    
    try {
        await updateDoc(doc(db, 'reviews', reviewId), {
            status: newStatus
        });
        await loadReviews();
        showNotification('Статус отзыва обновлен', 'success');
    } catch (error) {
        console.error('Ошибка обновления статуса отзыва:', error);
        showNotification('Ошибка при обновлении статуса', 'error');
    }
};

// Удаление отзыва (для админа)
window.deleteReview = async (reviewId) => {
    if (!confirm('Удалить этот отзыв?')) return;
    
    try {
        await deleteDoc(doc(db, 'reviews', reviewId));
        await loadReviews();
        showNotification('Отзыв удален', 'success');
    } catch (error) {
        console.error('Ошибка удаления отзыва:', error);
        showNotification('Ошибка при удалении отзыва', 'error');
    }
};

// Загрузка статистики
async function loadStats() {
    try {
        // Количество товаров
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productsCount = productsSnapshot.size;
        
        // Количество пользователей
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersCount = usersSnapshot.size;
        
        // Количество заказов
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const ordersCount = ordersSnapshot.size;
        
        // Общая выручка
        let totalRevenue = 0;
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.status === 'delivered') {
                totalRevenue += order.totalAmount || 0;
            }
        });
        
        const container = document.getElementById('stats-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="stat-card">
                <h3>Товаров</h3>
                <div class="stat-value">${productsCount}</div>
            </div>
            <div class="stat-card">
                <h3>Пользователей</h3>
                <div class="stat-value">${usersCount}</div>
            </div>
            <div class="stat-card">
                <h3>Заказов</h3>
                <div class="stat-value">${ordersCount}</div>
            </div>
            <div class="stat-card">
                <h3>Выручка</h3>
                <div class="stat-value">${formatPrice(totalRevenue)}</div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Настройка вкладок админки
function setupAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Убираем активный класс у всех вкладок
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Показываем соответствующее содержимое
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.admin-tabs + .tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Загружаем данные для вкладки
            switch(tabId) {
                case 'products':
                    loadProducts();
                    break;
                case 'categories':
                    loadCategories();
                    break;
                case 'orders':
                    loadOrders();
                    break;
                case 'users':
                    loadUsers();
                    break;
                case 'reviews':
                    loadReviews();
                    break;
                case 'stats':
                    loadStats();
                    break;
            }
        });
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin page loaded, checking access...');
    // Начинаем проверку прав доступа
    setTimeout(checkAdminAccess, 100);
});