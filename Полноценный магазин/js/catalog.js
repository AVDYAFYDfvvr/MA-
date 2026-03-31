import { db, timestamp } from './firebase.js';
import { currentUser, userRole } from './auth.js';
import { formatPrice, renderRating, debounce } from './utils.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs,
    onSnapshot,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    limit,
    startAfter
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Состояние каталога
let currentFilters = {
    category: '',
    search: '',
    sort: 'createdAt-desc'
};

let lastDoc = null;
let hasMore = true;
let unsubscribe = null;

// Загрузка категорий для фильтра
async function loadCategories() {
    try {
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const select = document.getElementById('category-filter');
        
        if (!select) return;
        
        // Очищаем и добавляем опцию "Все категории"
        select.innerHTML = '<option value="">Все категории</option>';
        
        categoriesSnapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.data().name;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

// Построение запроса на основе фильтров
function buildQuery() {
    const constraints = [];
    
    if (currentFilters.category) {
        constraints.push(where('category', '==', currentFilters.category));
    }
    
    if (currentFilters.search) {
        // Используем поиск по ключевым словам
        const searchLower = currentFilters.search.toLowerCase();
        constraints.push(where('searchKeywords', 'array-contains', searchLower));
    }
    
    // Сортировка
    const [sortField, sortOrder] = currentFilters.sort.split('-');
    constraints.push(orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc'));
    
    // Пагинация
    constraints.push(limit(10));
    
    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }
    
    return query(collection(db, 'products'), ...constraints);
}

// Загрузка товаров
async function loadProducts(reset = false) {
    if (reset) {
        lastDoc = null;
        hasMore = true;
        const container = document.getElementById('products-container');
        if (container) container.innerHTML = '';
    }
    
    if (!hasMore) return;
    
    try {
        const q = buildQuery();
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            hasMore = false;
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMore = snapshot.docs.length === 10;
        
        const container = document.getElementById('products-container');
        if (!container) return;
        
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            container.appendChild(createProductCard(product));
        });
        
        // Показываем/скрываем кнопку "Показать еще"
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = hasMore ? 'block' : 'none';
        }
        
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

// Создание карточки товара
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => window.location.href = `product.html?id=${product.id}`;
    
    card.innerHTML = `
        <img src="${product.imageUrl || 'https://via.placeholder.com/300'}" alt="${product.name}" class="product-image">
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <div class="product-price">${formatPrice(product.price)}</div>
            <div class="product-rating">${renderRating(product.ratingAvg || 0)} (${product.ratingCount || 0})</div>
            <button class="add-to-cart-btn" data-product-id="${product.id}" onclick="event.stopPropagation()">В корзину</button>
        </div>
    `;
    
    // Обработчик добавления в корзину
    const addBtn = card.querySelector('.add-to-cart-btn');
    addBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await addToCart(product);
    });
    
    return card;
}

// Добавление в корзину
async function addToCart(product) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        if (cartDoc.exists()) {
            const cartData = cartDoc.data();
            const items = [...(cartData.items || [])];
            
            const existingItem = items.find(item => item.productId === product.id);
            
            if (existingItem) {
                existingItem.quantity += 1;
                existingItem.total = existingItem.price * existingItem.quantity;
            } else {
                items.push({
                    productId: product.id,
                    productName: product.name,
                    price: product.price,
                    quantity: 1,
                    imageUrl: product.imageUrl,
                    total: product.price
                });
            }
            
            const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
            
            await updateDoc(cartRef, {
                items,
                totalAmount,
                updatedAt: timestamp()
            });
        } else {
            await setDoc(cartRef, {
                uid: currentUser.uid,
                items: [{
                    productId: product.id,
                    productName: product.name,
                    price: product.price,
                    quantity: 1,
                    imageUrl: product.imageUrl,
                    total: product.price
                }],
                totalAmount: product.price,
                updatedAt: timestamp()
            });
        }
        
        // Обновляем счетчик корзины
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            const currentCount = parseInt(cartCount.textContent) || 0;
            cartCount.textContent = currentCount + 1;
        }
        
        alert('Товар добавлен в корзину');
    } catch (error) {
        console.error('Ошибка добавления в корзину:', error);
        alert('Ошибка при добавлении в корзину');
    }
}

// Настройка real-time обновлений для админа
function setupRealtimeUpdates() {
    if (userRole !== 'admin') return;
    
    unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' || change.type === 'modified') {
                console.log('Каталог обновлен');
                // Перезагружаем каталог
                loadProducts(true);
            }
        });
    });
}

// Инициализация каталога
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts(true);
    
    // Ждем загрузку пользователя для real-time обновлений
    setTimeout(() => {
        setupRealtimeUpdates();
    }, 500);
    
    // Обработчики фильтров с debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            currentFilters.search = e.target.value;
            loadProducts(true);
        }, 500));
    }
    
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentFilters.category = e.target.value;
            loadProducts(true);
        });
    }
    
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            currentFilters.sort = e.target.value;
            loadProducts(true);
        });
    }
    
    // Кнопка "Показать еще"
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => loadProducts(false));
    }
});