import { auth, db, timestamp } from './firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    setDoc,
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Состояние пользователя
export let currentUser = null;
export let userRole = null;
export let authInitialized = false; // Флаг, что авторизация инициализирована

// Функция для обновления UI
function updateAuthUI() {
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');
    const adminLink = document.getElementById('admin-link');
    const cartCount = document.getElementById('cart-count');
    
    if (currentUser) {
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';
        if (adminLink && userRole === 'admin') adminLink.style.display = 'block';
        if (cartCount) loadCartCount();
    } else {
        if (loginLink) loginLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (cartCount) cartCount.textContent = '0';
    }
}

// Загрузка количества товаров в корзине
async function loadCartCount() {
    if (!currentUser) return;
    
    try {
        const cartDoc = await getDoc(doc(db, 'carts', currentUser.uid));
        if (cartDoc.exists()) {
            const items = cartDoc.data().items || [];
            const cartCount = document.getElementById('cart-count');
            if (cartCount) cartCount.textContent = items.length;
        } else {
            const cartCount = document.getElementById('cart-count');
            if (cartCount) cartCount.textContent = '0';
        }
    } catch (error) {
        console.error('Ошибка загрузки корзины:', error);
    }
}

// Наблюдатель за состоянием аутентификации
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? user.email : 'logged out');
    currentUser = user;
    
    if (user) {
        try {
            // Получаем роль пользователя из Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                userRole = userDoc.data().role || 'user';
                // Обновляем время последнего входа
                await updateDoc(doc(db, 'users', user.uid), {
                    lastLogin: timestamp()
                });
            } else {
                // Если документа нет, создаем его
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    displayName: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    role: 'user',
                    phone: '',
                    city: '',
                    address: '',
                    preferences: {
                        notificationsEmail: true,
                        notificationsOrder: true
                    },
                    createdAt: timestamp(),
                    updatedAt: timestamp(),
                    lastLogin: timestamp()
                });
                userRole = 'user';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    } else {
        userRole = null;
    }
    
    // Устанавливаем флаг, что авторизация инициализирована
    authInitialized = true;
    
    // Обновляем UI
    updateAuthUI();
    
    // Проверяем авторизацию для текущей страницы
    checkAuth();
});

// Вход
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

// Регистрация
export async function register(name, email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Создаем документ пользователя в Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            displayName: name,
            email: email,
            role: 'user',
            phone: '',
            city: '',
            address: '',
            preferences: {
                notificationsEmail: true,
                notificationsOrder: true
            },
            createdAt: timestamp(),
            updatedAt: timestamp(),
            lastLogin: timestamp()
        });
        
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Register error:', error);
        return { success: false, error: error.message };
    }
}

// Выход
export async function logout() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// Проверка авторизации для страниц
export function checkAuth() {
    // Если авторизация еще не инициализирована, не проверяем
    if (!authInitialized) {
        console.log('Auth not initialized yet, skipping check');
        return false;
    }
    
    const currentPath = window.location.pathname;
    const protectedPages = ['/cart.html', '/profile.html', '/admin.html'];
    const authPages = ['/login.html'];
    
    // Получаем имя файла из пути
    const currentFile = currentPath.split('/').pop() || 'index.html';
    
    console.log('Checking auth for:', currentFile, 'User:', currentUser ? 'logged in' : 'logged out');
    
    // Проверяем, нужно ли защищать страницу
    const isProtected = protectedPages.some(page => currentFile === page.substring(1));
    const isAuthPage = authPages.some(page => currentFile === page.substring(1));
    
    if (isProtected && !currentUser) {
        console.log('Redirecting to login - protected page');
        window.location.href = 'login.html';
        return true;
    }
    
    if (isAuthPage && currentUser) {
        console.log('Redirecting to index - already logged in');
        window.location.href = 'index.html';
        return true;
    }
    
    // Проверяем права админа для admin.html
    if (currentFile === 'admin.html' && userRole !== 'admin') {
        console.log('Redirecting to index - not admin');
        window.location.href = 'index.html';
        return true;
    }
    
    return true;
}

// Инициализация событий
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, auth initialized:', authInitialized);
    
    // Обработчик выхода
    const logoutBtn = document.getElementById('logout-link');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const result = await logout();
            if (result.success) {
                window.location.href = 'index.html';
            }
        });
    }
    
    // Обработчики для страницы входа/регистрации
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const result = await login(email, password);
            if (result.success) {
                // Не делаем редирект сразу, даем время обновиться состоянию
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } else {
                document.getElementById('login-error').textContent = result.error;
            }
        });
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            
            if (password !== confirm) {
                document.getElementById('register-error').textContent = 'Пароли не совпадают';
                return;
            }
            
            const result = await register(name, email, password);
            if (result.success) {
                // Не делаем редирект сразу, даем время обновиться состоянию
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } else {
                document.getElementById('register-error').textContent = result.error;
            }
        });
    }
    
    // Переключение между формами входа и регистрации
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    
    if (loginTab && registerTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            document.getElementById('login-form').classList.add('active');
            document.getElementById('register-form').classList.remove('active');
        });
        
        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            document.getElementById('register-form').classList.add('active');
            document.getElementById('login-form').classList.remove('active');
        });
    }
});