import { db, timestamp } from './firebase.js';
import { currentUser, userRole } from './auth.js';
import { formatPrice, renderRating, formatDate } from './utils.js';
import { 
    doc, 
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentProduct = null;
let unsubscribeProduct = null;
let unsubscribeReviews = null;

// Получение ID товара из URL
function getProductId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Загрузка информации о товаре
async function loadProduct() {
    const productId = getProductId();
    if (!productId) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const productDoc = await getDoc(doc(db, 'products', productId));
        if (!productDoc.exists()) {
            window.location.href = 'index.html';
            return;
        }
        
        currentProduct = { id: productDoc.id, ...productDoc.data() };
        renderProduct();
        
        // Подписываемся на обновления товара (для админа или если товар в реальном времени)
        setupProductRealtime();
        
        // Загружаем отзывы
        await loadReviews();
        
        // Загружаем похожие товары
        await loadSimilarProducts();
        
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
    }
}

// Отрисовка товара
function renderProduct() {
    const container = document.getElementById('product-detail');
    
    container.innerHTML = `
        <div class="product-detail-grid">
            <div>
                <img src="${currentProduct.imageUrl || 'https://via.placeholder.com/500'}" alt="${currentProduct.name}" class="detail-image">
            </div>
            <div class="detail-info">
                <h1>${currentProduct.name}</h1>
                <div class="detail-price">${formatPrice(currentProduct.price)}</div>
                <div class="product-rating">${renderRating(currentProduct.ratingAvg || 0)} (${currentProduct.ratingCount || 0} отзывов)</div>
                <div class="detail-description">${currentProduct.description}</div>
                <div class="detail-meta">
                    <p><strong>Категория:</strong> ${currentProduct.category}</p>
                    <p><strong>Теги:</strong> ${(currentProduct.tags || []).join(', ')}</p>
                    <p><strong>В наличии:</strong> ${currentProduct.stock || 0} шт.</p>
                    <p><strong>Добавлено:</strong> ${formatDate(currentProduct.createdAt)}</p>
                </div>
                <button class="btn btn-primary" id="add-to-cart-btn">Добавить в корзину</button>
                ${userRole === 'admin' ? `
                    <button class="btn btn-secondary" id="edit-product-btn">Редактировать</button>
                    <button class="btn btn-danger" id="delete-product-btn">Удалить</button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Обработчики
    document.getElementById('add-to-cart-btn').addEventListener('click', addToCart);
    
    if (userRole === 'admin') {
        const editBtn = document.getElementById('edit-product-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                window.location.href = `admin.html?edit=${currentProduct.id}`;
            });
        }
        
        const deleteBtn = document.getElementById('delete-product-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteProduct);
        }
    }
}

// Добавление в корзину
async function addToCart() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        const product = {
            id: currentProduct.id,
            name: currentProduct.name,
            price: currentProduct.price,
            imageUrl: currentProduct.imageUrl
        };
        
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
        
        alert('Товар добавлен в корзину');
    } catch (error) {
        console.error('Ошибка добавления в корзину:', error);
        alert('Ошибка при добавлении в корзину');
    }
}

// Удаление товара (для админа)
async function deleteProduct() {
    if (userRole !== 'admin') return;
    
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
    
    try {
        await deleteDoc(doc(db, 'products', currentProduct.id));
        alert('Товар удален');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        alert('Ошибка при удалении товара');
    }
}

// Загрузка отзывов
async function loadReviews() {
    const reviewsQuery = query(
        collection(db, 'reviews'),
        where('productId', '==', currentProduct.id),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
    );
    
    // Подписываемся на обновления отзывов
    unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
        const container = document.getElementById('reviews-container');
        container.innerHTML = '';
        
        snapshot.forEach(doc => {
            const review = { id: doc.id, ...doc.data() };
            container.appendChild(createReviewElement(review));
        });
        
        // Показываем форму добавления отзыва для авторизованных пользователей
        const addReviewForm = document.getElementById('add-review-form');
        if (addReviewForm) {
            addReviewForm.style.display = currentUser ? 'block' : 'none';
        }
    });
}

// Создание элемента отзыва
function createReviewElement(review) {
    const div = document.createElement('div');
    div.className = 'review-card';
    div.innerHTML = `
        <div class="review-header">
            <span class="review-author">${review.userName}</span>
            <span class="review-rating">${renderRating(review.rating)}</span>
            <span class="review-date">${formatDate(review.createdAt)}</span>
        </div>
        <div class="review-comment">${review.comment}</div>
        ${(currentUser && (currentUser.uid === review.userId || userRole === 'admin')) ? `
            <div class="review-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteReview('${review.id}')">Удалить</button>
            </div>
        ` : ''}
    `;
    return div;
}

// Удаление отзыва
window.deleteReview = async (reviewId) => {
    if (!currentUser) return;
    
    try {
        const reviewRef = doc(db, 'reviews', reviewId);
        const reviewDoc = await getDoc(reviewRef);
        
        if (!reviewDoc.exists()) return;
        
        const reviewData = reviewDoc.data();
        
        // Проверяем права
        if (reviewData.userId !== currentUser.uid && userRole !== 'admin') {
            alert('У вас нет прав на удаление этого отзыва');
            return;
        }
        
        if (userRole === 'admin') {
            // Админ может полностью удалить или скрыть
            await updateDoc(reviewRef, { status: 'hidden' });
        } else {
            // Пользователь может удалить свой отзыв
            await deleteDoc(reviewRef);
        }
        
        // Обновляем рейтинг товара
        await updateProductRating();
        
    } catch (error) {
        console.error('Ошибка удаления отзыва:', error);
        alert('Ошибка при удалении отзыва');
    }
};

// Добавление отзыва
document.addEventListener('DOMContentLoaded', () => {
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!currentUser) {
                window.location.href = 'login.html';
                return;
            }
            
            const rating = parseInt(document.getElementById('review-rating').value);
            const comment = document.getElementById('review-comment').value;
            
            try {
                await addDoc(collection(db, 'reviews'), {
                    productId: currentProduct.id,
                    productName: currentProduct.name,
                    userId: currentUser.uid,
                    userName: currentUser.displayName || currentUser.email,
                    rating,
                    comment,
                    status: 'active',
                    createdAt: timestamp(),
                    updatedAt: timestamp()
                });
                
                // Обновляем рейтинг товара
                await updateProductRating();
                
                // Очищаем форму
                document.getElementById('review-comment').value = '';
                alert('Отзыв добавлен');
                
            } catch (error) {
                console.error('Ошибка добавления отзыва:', error);
                alert('Ошибка при добавлении отзыва');
            }
        });
    }
});

// Обновление рейтинга товара
async function updateProductRating() {
    try {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('productId', '==', currentProduct.id),
            where('status', '==', 'active')
        );
        
        const snapshot = await getDocs(reviewsQuery);
        
        if (snapshot.empty) {
            await updateDoc(doc(db, 'products', currentProduct.id), {
                ratingAvg: 0,
                ratingCount: 0
            });
            return;
        }
        
        let totalRating = 0;
        snapshot.forEach(doc => {
            totalRating += doc.data().rating;
        });
        
        const avgRating = totalRating / snapshot.size;
        
        await updateDoc(doc(db, 'products', currentProduct.id), {
            ratingAvg: avgRating,
            ratingCount: snapshot.size
        });
        
    } catch (error) {
        console.error('Ошибка обновления рейтинга:', error);
    }
}

// Загрузка похожих товаров
async function loadSimilarProducts() {
    try {
        const similarQuery = query(
            collection(db, 'products'),
            where('category', '==', currentProduct.category),
            where('__name__', '!=', currentProduct.id),
            limit(4)
        );
        
        const snapshot = await getDocs(similarQuery);
        const container = document.getElementById('similar-products-container');
        
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            container.appendChild(createSimilarProductCard(product));
        });
        
    } catch (error) {
        console.error('Ошибка загрузки похожих товаров:', error);
    }
}

// Создание карточки похожего товара
function createSimilarProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => window.location.href = `product.html?id=${product.id}`;
    
    card.innerHTML = `
        <img src="${product.imageUrl || 'https://via.placeholder.com/300'}" alt="${product.name}" class="product-image">
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <div class="product-price">${formatPrice(product.price)}</div>
            <div class="product-rating">${renderRating(product.ratingAvg || 0)}</div>
        </div>
    `;
    
    return card;
}

// Real-time обновления товара
function setupProductRealtime() {
    if (userRole !== 'admin') return;
    
    unsubscribeProduct = onSnapshot(doc(db, 'products', currentProduct.id), (doc) => {
        if (doc.exists()) {
            currentProduct = { id: doc.id, ...doc.data() };
            renderProduct();
        }
    });
}

// Очистка подписок
window.addEventListener('beforeunload', () => {
    if (unsubscribeProduct) unsubscribeProduct();
    if (unsubscribeReviews) unsubscribeReviews();
});

// Инициализация
document.addEventListener('DOMContentLoaded', loadProduct);