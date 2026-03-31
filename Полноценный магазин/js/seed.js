import { db, timestamp } from './firebase.js';
import { collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Тестовые товары
const products = [
    {
        name: "Вязаный свитер ручной работы",
        description: "Теплый и уютный свитер из натуральной шерсти. Ручная вязка, уникальный дизайн. Идеально подходит для холодной погоды.",
        price: 4500,
        category: "Одежда",
        imageUrl: "https://kniti.ru/wp-content/uploads/2025/09/file_24577.jpg",
        stock: 5,
        tags: ["свитер", "шерсть", "ручная работа", "зима"],
        ratingAvg: 4.5,
        ratingCount: 12
    },
    {
        name: "Керамическая кружка с росписью",
        description: "Уникальная кружка ручной работы. Каждая кружка расписывается вручную, поэтому вы получаете уникальное изделие.",
        price: 1200,
        category: "Посуда",
        imageUrl: "https://uzala-ceramics.ru/wp-content/uploads/2025/03/cesarki-na-kruzhke-scaled.jpg",
        stock: 15,
        tags: ["кружка", "керамика", "посуда", "ручная работа"],
        ratingAvg: 4.8,
        ratingCount: 8
    },
    {
        name: "Деревянная разделочная доска",
        description: "Экологичная разделочная доска из массива дуба. Ручная работа, покрыта пищевым маслом.",
        price: 2500,
        category: "Кухня",
        imageUrl: "https://ir.ozone.ru/s3/multimedia-w/6784429172.jpg",
        stock: 8,
        tags: ["доска", "дерево", "кухня", "дуб"],
        ratingAvg: 5,
        ratingCount: 5
    },
    {
        name: "Шерстяной плед",
        description: "Мягкий и теплый плед ручной работы. Идеально подходит для уютных вечеров.",
        price: 3800,
        category: "Декор",
        imageUrl: "https://ir.ozone.ru/s3/multimedia-1-7/7921744099.jpg",
        stock: 6,
        tags: ["плед", "шерсть", "декор", "уют"],
        ratingAvg: 4.7,
        ratingCount: 9
    },
    {
        name: "Кожаный кошелек",
        description: "Стильный кошелек из натуральной кожи. Ручная работа, прочные швы.",
        price: 3200,
        category: "Аксессуары",
        imageUrl: "https://sumki.guru/wp-content/uploads/2019/02/271248553_w640_h640_wallet_gato_ne__urtle_blue.jpg",
        stock: 10,
        tags: ["кошелек", "кожа", "аксессуар"],
        ratingAvg: 4.3,
        ratingCount: 7
    },
    {
        name: "Мыло ручной работы",
        description: "Натуральное мыло с эфирными маслами. Без парабенов и искусственных красителей.",
        price: 350,
        category: "Косметика",
        imageUrl: "https://ir.ozone.ru/s3/multimedia-1-2/7087324970.jpg",
        stock: 25,
        tags: ["мыло", "косметика", "натуральное"],
        ratingAvg: 4.9,
        ratingCount: 15
    },
    {
        name: "Свеча ароматическая",
        description: "Свеча из натурального соевого воска с ароматом лаванды. Ручная работа.",
        price: 800,
        category: "Декор",
        imageUrl: "https://ir.ozone.ru/s3/multimedia-a/c1000/6680264014.jpg",
        stock: 12,
        tags: ["свеча", "аромат", "декор"],
        ratingAvg: 4.6,
        ratingCount: 11
    },
    {
        name: "Сумка шоппер",
        description: "Экологичная сумка из натурального хлопка. Ручная печать, прочные швы.",
        price: 1500,
        category: "Аксессуары",
        imageUrl: "https://ir-3.ozone.ru/s3/multimedia-0/wc1000/6343035720.jpg",
        stock: 20,
        tags: ["сумка", "шоппер", "эко"],
        ratingAvg: 4.4,
        ratingCount: 6
    },
    {
        name: "Ваза керамическая",
        description: "Стильная керамическая ваза ручной работы. Уникальная глазурь.",
        price: 2800,
        category: "Декор",
        imageUrl: "https://levadnajadecor.com/wp-content/uploads/2023/01/img_9578aw-scaled.jpg",
        stock: 4,
        tags: ["ваза", "керамика", "декор"],
        ratingAvg: 4.8,
        ratingCount: 4
    },
    {
        name: "Шарф вязаный",
        description: "Теплый вязаный шарф из мягкой шерсти. Ручная работа, оригинальный узор.",
        price: 2200,
        category: "Одежда",
        imageUrl: "https://cs1.livemaster.ru/storage/51/a2/60e7ab92a16241fcf3da19f141m4--aksessuary-chistosherstyanoj-sharf-teplyj-podarok.jpg",
        stock: 7,
        tags: ["шарф", "шерсть", "зима"],
        ratingAvg: 4.7,
        ratingCount: 8
    }
];

// Категории
const categories = [
    "Одежда",
    "Посуда", 
    "Кухня",
    "Декор",
    "Аксессуары",
    "Косметика"
];

// Функция для проверки существования товара по имени
async function productExists(productName) {
    const q = query(collection(db, 'products'), where('name', '==', productName));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

// Добавление тестовых данных
export async function seedDatabase(force = false) {
    console.log('Начинаем добавление тестовых данных...');
    
    try {
        // Добавляем категории (всегда добавляем, если их нет)
        for (const categoryName of categories) {
            const categoryQuery = query(collection(db, 'categories'), where('name', '==', categoryName));
            const categorySnapshot = await getDocs(categoryQuery);
            
            if (categorySnapshot.empty) {
                await addDoc(collection(db, 'categories'), {
                    name: categoryName,
                    createdAt: timestamp()
                });
                console.log(`Категория "${categoryName}" добавлена`);
            }
        }
        
        // Добавляем товары
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const product of products) {
            // Проверяем, существует ли уже такой товар
            const exists = await productExists(product.name);
            
            if (!exists || force) {
                // Создаем поисковые ключевые слова
                const searchKeywords = [
                    ...product.name.toLowerCase().split(' '),
                    ...product.description.toLowerCase().split(' '),
                    ...product.category.toLowerCase().split(' ')
                ].filter(word => word.length > 2);
                
                const productData = {
                    ...product,
                    searchKeywords,
                    createdAt: timestamp(),
                    updatedAt: timestamp()
                };
                
                await addDoc(collection(db, 'products'), productData);
                console.log(`✅ Товар "${product.name}" добавлен`);
                addedCount++;
            } else {
                console.log(`⏭️ Товар "${product.name}" уже существует, пропускаем`);
                skippedCount++;
            }
        }
        
        console.log('📊 Статистика:');
        console.log(`   Добавлено: ${addedCount}`);
        console.log(`   Пропущено: ${skippedCount}`);
        console.log(`   Всего товаров в базе: ${products.length}`);
        
        if (addedCount > 0) {
            alert(`✅ Добавлено ${addedCount} новых товаров!\n🔄 Обновите страницу, чтобы увидеть их.`);
        } else {
            alert(`ℹ️ Все товары уже есть в базе. Хотите добавить принудительно? Нажмите кнопку "Принудительно добавить все".`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при добавлении тестовых данных:', error);
        alert('❌ Ошибка при добавлении тестовых данных: ' + error.message);
    }
}

// Функция для принудительного добавления всех товаров (даже если они уже есть)
export async function forceSeedDatabase() {
    console.log('🔴 Принудительное добавление всех товаров...');
    
    try {
        // Добавляем товары принудительно
        for (const product of products) {
            // Создаем поисковые ключевые слова
            const searchKeywords = [
                ...product.name.toLowerCase().split(' '),
                ...product.description.toLowerCase().split(' '),
                ...product.category.toLowerCase().split(' ')
            ].filter(word => word.length > 2);
            
            const productData = {
                ...product,
                searchKeywords,
                createdAt: timestamp(),
                updatedAt: timestamp()
            };
            
            await addDoc(collection(db, 'products'), productData);
            console.log(`✅ Товар "${product.name}" добавлен`);
        }
        
        console.log(`✅ Принудительно добавлено ${products.length} товаров!`);
        alert(`✅ Принудительно добавлено ${products.length} товаров!\n🔄 Обновите страницу.`);
        
    } catch (error) {
        console.error('❌ Ошибка при принудительном добавлении:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}

// Добавляем кнопки для добавления тестовых данных в админку
if (window.location.pathname.includes('admin.html')) {
    setTimeout(() => {
        const statsTab = document.getElementById('stats-tab');
        if (statsTab) {
            // Создаем контейнер для кнопок
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.marginTop = '20px';
            
            // Кнопка для обычного добавления
            const seedButton = document.createElement('button');
            seedButton.className = 'btn btn-primary';
            seedButton.textContent = '➕ Добавить недостающие товары';
            seedButton.onclick = () => seedDatabase(false);
            
            // Кнопка для принудительного добавления
            const forceButton = document.createElement('button');
            forceButton.className = 'btn btn-danger';
            forceButton.textContent = '⚠️ Принудительно добавить все товары';
            forceButton.onclick = () => {
                if (confirm('Это создаст дубликаты товаров! Вы уверены?')) {
                    forceSeedDatabase();
                }
            };
            
            buttonContainer.appendChild(seedButton);
            buttonContainer.appendChild(forceButton);
            statsTab.appendChild(buttonContainer);
        }
    }, 1000);
}