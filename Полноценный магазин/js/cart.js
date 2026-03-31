import { db, timestamp } from './firebase.js';
import { currentUser, authInitialized } from './auth.js';
import { formatPrice } from './utils.js';
import { 
    doc, 
    getDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    collection,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Загрузка корзины
export async function loadCart() {
    if (!currentUser) {
        // Если пользователь не авторизован, но auth уже инициализирован - редирект
        if (authInitialized) {
            window.location.href = 'login.html';
        }
        return;
    }
    
    try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        const container = document.getElementById('cart-container');
        const emptyCart = document.getElementById('empty-cart');
        const itemsContainer = document.getElementById('cart-items');
        const totalElement = document.getElementById('cart-total');
        
        if (!cartDoc.exists() || !cartDoc.data().items?.length) {
            if (container) container.style.display = 'none';
            if (emptyCart) emptyCart.style.display = 'block';
            if (totalElement) totalElement.textContent = formatPrice(0);
            return;
        }
        
        if (container) container.style.display = 'grid';
        if (emptyCart) emptyCart.style.display = 'none';
        
        const cartData = cartDoc.data();
        
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            cartData.items.forEach((item, index) => {
                const itemElement = createCartItemElement(item, index);
                itemsContainer.appendChild(itemElement);
            });
        }
        
        if (totalElement) {
            totalElement.textContent = formatPrice(cartData.totalAmount || 0);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки корзины:', error);
    }
}

// Создание элемента корзины
function createCartItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
        <img src="${item.imageUrl || 'https://via.placeholder.com/100'}" alt="${item.productName}" class="cart-item-image">
        <div class="cart-item-details">
            <h3>${item.productName}</h3>
            <p class="cart-item-price">${formatPrice(item.price)}</p>
            <div class="cart-item-quantity">
                <button class="quantity-btn" data-index="${index}" data-action="decrease">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" data-index="${index}" data-action="increase">+</button>
            </div>
        </div>
        <div class="cart-item-total">
            <p>${formatPrice(item.total)}</p>
            <button class="btn btn-danger btn-sm" data-index="${index}" data-action="remove">Удалить</button>
        </div>
    `;
    
    // Добавляем обработчики
    const quantityBtns = div.querySelectorAll('.quantity-btn');
    quantityBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            const action = btn.dataset.action;
            updateQuantity(index, action);
        });
    });
    
    const removeBtn = div.querySelector('[data-action="remove"]');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(removeBtn.dataset.index);
        removeItem(index);
    });
    
    return div;
}

// Обновление количества
async function updateQuantity(index, action) {
    try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        if (!cartDoc.exists()) return;
        
        const cartData = cartDoc.data();
        const items = [...cartData.items];
        
        if (action === 'increase') {
            items[index].quantity += 1;
        } else if (action === 'decrease') {
            if (items[index].quantity > 1) {
                items[index].quantity -= 1;
            } else {
                // Если количество становится 0, удаляем товар
                items.splice(index, 1);
            }
        }
        
        // Пересчитываем total для каждого товара
        items.forEach(item => {
            item.total = item.price * item.quantity;
        });
        
        const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
        
        if (items.length === 0) {
            // Если корзина пуста, удаляем документ
            await deleteDoc(cartRef);
        } else {
            await updateDoc(cartRef, {
                items,
                totalAmount,
                updatedAt: timestamp()
            });
        }
        
        // Перезагружаем корзину
        await loadCart();
        
        // Обновляем счетчик
        updateCartCount();
        
    } catch (error) {
        console.error('Ошибка обновления количества:', error);
        alert('Ошибка при обновлении корзины');
    }
}

// Удаление товара из корзины
async function removeItem(index) {
    try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        if (!cartDoc.exists()) return;
        
        const cartData = cartDoc.data();
        const items = cartData.items.filter((_, i) => i !== index);
        
        const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
        
        if (items.length === 0) {
            // Если корзина пуста, удаляем документ
            await deleteDoc(cartRef);
        } else {
            await updateDoc(cartRef, {
                items,
                totalAmount,
                updatedAt: timestamp()
            });
        }
        
        // Перезагружаем корзину
        await loadCart();
        
        // Обновляем счетчик
        updateCartCount();
        
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        alert('Ошибка при удалении товара');
    }
}

// Очистка корзины
async function clearCart() {
    if (!confirm('Вы уверены, что хотите очистить корзину?')) return;
    
    try {
        await deleteDoc(doc(db, 'carts', currentUser.uid));
        await loadCart();
        updateCartCount();
    } catch (error) {
        console.error('Ошибка очистки корзины:', error);
        alert('Ошибка при очистке корзины');
    }
}

// Оформление заказа
async function checkout() {
    try {
        const cartRef = doc(db, 'carts', currentUser.uid);
        const cartDoc = await getDoc(cartRef);
        
        if (!cartDoc.exists() || !cartDoc.data().items?.length) {
            alert('Корзина пуста');
            return;
        }
        
        const cartData = cartDoc.data();
        
        // Получаем данные пользователя
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : { displayName: currentUser.email };
        
        // Создаем заказ
        const orderData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: userData.displayName || currentUser.email,
            items: cartData.items,
            totalAmount: cartData.totalAmount,
            status: 'pending',
            createdAt: timestamp(),
            updatedAt: timestamp()
        };
        
        await addDoc(collection(db, 'orders'), orderData);
        
        // Очищаем корзину
        await deleteDoc(cartRef);
        
        alert('Заказ успешно оформлен!');
        window.location.href = 'profile.html';
        
    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        alert('Ошибка при оформлении заказа');
    }
}

// Обновление счетчика корзины
async function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (!cartCount || !currentUser) return;
    
    try {
        const cartDoc = await getDoc(doc(db, 'carts', currentUser.uid));
        const count = cartDoc.exists() ? cartDoc.data().items?.length || 0 : 0;
        cartCount.textContent = count;
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Пытаемся загрузить корзину, если пользователь уже авторизован
    if (currentUser) {
        loadCart();
    }
    
    // Подписываемся на изменения авторизации
    const checkInterval = setInterval(() => {
        if (authInitialized) {
            clearInterval(checkInterval);
            if (currentUser) {
                loadCart();
            } else {
                // Если авторизация инициализирована и пользователя нет - редирект
                window.location.href = 'login.html';
            }
        }
    }, 100);
    
    // Обработчик оформления заказа
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }
    
    // Обработчик очистки корзины
    const clearBtn = document.getElementById('clear-cart-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCart);
    }
});