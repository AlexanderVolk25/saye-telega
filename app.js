// Telegram Web App API
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Global state
let state = {
    user: null,
    isAdmin: false,
    currentPlan: null,
    plans: { vless: {}, mtproto: {} }
};

// API Base URL
const API_URL = 'http://109.120.187.94/api'; // Твой бэкенд на сервере

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Получаем initData от Telegram
        const initData = tg.initData;
        
        if (!initData) {
            showError('Откройте приложение через Telegram');
            return;
        }

        // Аутентификация
        const authResponse = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });

        if (!authResponse.ok) {
            showError('Ошибка аутентификации');
            return;
        }

        const authData = await authResponse.json();
        state.user = authData.user;
        state.isAdmin = authData.is_admin;

        // Загружаем тарифы
        const plansResponse = await fetch(`${API_URL}/plans`);
        const plansData = await plansResponse.json();
        state.plans = plansData;

        // Отображаем интерфейс
        initInterface();
        
        hideLoading();
        showScreen('main-menu');

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Ошибка загрузки');
    }
});

function initInterface() {
    // Загружаем списки тарифов
    loadVlessPlans();
    loadMTProtoPlans();

    // Показываем кнопку админа
    if (state.isAdmin) {
        document.getElementById('admin-button').classList.remove('hidden');
    }

    // Настройка MainButton
    tg.MainButton.setText('Готово');
    tg.MainButton.onClick(() => {
        tg.close();
    });
}

// ========== NAVIGATION ==========
function showScreen(screenId) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });

    // Показываем нужный
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
    }

    // Загружаем данные для экранов
    if (screenId === 'my-proxy') {
        loadMyProxy();
    } else if (screenId === 'admin-panel') {
        loadAdminStats();
    } else if (screenId === 'admin-pending') {
        loadPendingPayments();
    }
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    tg.showAlert(message);
}

// ========== PLANS ==========
function loadVlessPlans() {
    const container = document.getElementById('vless-plans-list');
    container.innerHTML = '';

    for (const [planId, plan] of Object.entries(state.plans.vless)) {
        const planCard = document.createElement('div');
        planCard.className = 'plan-card';
        planCard.innerHTML = `
            <div class="plan-header">
                <h3>📅 ${plan.name}</h3>
                <div class="plan-price">${plan.price} ₽</div>
            </div>
            <div class="plan-details">
                <div class="plan-detail">
                    <span>📆 Срок:</span>
                    <span>${plan.days} ${getDaysText(plan.days)}</span>
                </div>
                <div class="plan-detail">
                    <span>🔌 Порт:</span>
                    <span>${plan.port}</span>
                </div>
            </div>
            <button class="btn-primary btn-full" onclick="selectPlan('vless', '${planId}')">
                Выбрать
            </button>
        `;
        container.appendChild(planCard);
    }
}

function loadMTProtoPlans() {
    const container = document.getElementById('mtproto-plans-list');
    container.innerHTML = '';

    for (const [planId, plan] of Object.entries(state.plans.mtproto)) {
        const planCard = document.createElement('div');
        planCard.className = 'plan-card';
        planCard.innerHTML = `
            <div class="plan-header">
                <h3>📅 ${plan.name}</h3>
                <div class="plan-price">${plan.price} ₽</div>
            </div>
            <div class="plan-details">
                <div class="plan-detail">
                    <span>📆 Срок:</span>
                    <span>${plan.days} ${getDaysText(plan.days)}</span>
                </div>
                <div class="plan-detail">
                    <span>🔌 Порт:</span>
                    <span>${plan.port}</span>
                </div>
            </div>
            <button class="btn-primary btn-full" onclick="selectPlan('mtproto', '${planId}')">
                Выбрать
            </button>
        `;
        container.appendChild(planCard);
    }
}

function getDaysText(days) {
    if (days === 1) return 'день';
    if (days < 5) return 'дня';
    return 'дней';
}

function selectPlan(planType, planId) {
    const plan = planType === 'vless' ? state.plans.vless[planId] : state.plans.mtproto[planId];
    
    state.currentPlan = {
        type: planType,
        id: planId,
        data: plan
    };

    document.getElementById('payment-type').textContent = planType === 'vless' ? 'Vless' : 'MTProto';
    document.getElementById('payment-plan').textContent = plan.name;
    document.getElementById('payment-price').textContent = `${plan.price} ₽`;

    showScreen('payment-screen');
}

function backToPlan() {
    if (state.currentPlan) {
        showScreen(state.currentPlan.type === 'vless' ? 'vless-plans' : 'mtproto-plans');
    } else {
        showScreen('main-menu');
    }
}

// ========== PAYMENT ==========
async function sendReceipt() {
    if (!state.currentPlan) return;

    try {
        tg.showConfirm('Вы оплатили заказ?', async (confirmed) => {
            if (!confirmed) return;

            const response = await fetch(`${API_URL}/payment/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initData: tg.initData,
                    plan_type: state.currentPlan.type,
                    plan_id: state.currentPlan.id
                })
            });

            if (!response.ok) {
                showError('Ошибка создания заявки');
                return;
            }

            tg.showAlert('✅ Заявка отправлена! Администратор проверит оплату в течение 5-15 минут.', () => {
                showScreen('my-proxy');
            });
        });
    } catch (error) {
        console.error('Payment error:', error);
        showError('Ошибка отправки заявки');
    }
}

// ========== MY PROXY ==========
async function loadMyProxy() {
    const container = document.getElementById('proxy-content');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`${API_URL}/user/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });

        const data = await response.json();

        if (data.has_pending) {
            container.innerHTML = `
                <div class="proxy-card pending">
                    <h3>⏳ Заявка обрабатывается</h3>
                    <p>Администратор проверит чек и выдаст прокси в ближайшее время.</p>
                    <div class="pending-info">
                        <div class="info-row">
                            <span>План:</span>
                            <strong>${data.pending.plan_id}</strong>
                        </div>
                        <div class="info-row">
                            <span>Сумма:</span>
                            <strong>${data.pending.price} ₽</strong>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';

        // Vless прокси
        if (data.vless) {
            html += `
                <div class="proxy-card">
                    <div class="proxy-header">
                        <h3>🚀 Vless прокси</h3>
                        <span class="status active">Активен</span>
                    </div>
                    <div class="proxy-link">
                        <input type="text" value="${data.vless.link}" readonly onclick="copyToClipboard(this.value)">
                        <button onclick="copyToClipboard('${data.vless.link}')">📋</button>
                    </div>
                    <div class="proxy-info">
                        <div class="info-row">
                            <span>📆 Действует до:</span>
                            <strong>${data.vless.expiry}</strong>
                        </div>
                        <div class="info-row">
                            <span>⏰ Осталось дней:</span>
                            <strong>${data.vless.days_left}</strong>
                        </div>
                        <div class="info-row">
                            <span>🔌 Порт:</span>
                            <strong>${data.vless.port}</strong>
                        </div>
                    </div>
                    <button class="btn-primary btn-full" onclick="showScreen('vless-plans')">
                        🔄 Продлить
                    </button>
                </div>
            `;
        }

        // MTProto прокси
        if (data.mtproto && data.mtproto.length > 0) {
            data.mtproto.forEach(proxy => {
                html += `
                    <div class="proxy-card">
                        <div class="proxy-header">
                            <h3>📡 MTProto прокси</h3>
                            <span class="status active">Активен</span>
                        </div>
                        <div class="proxy-link">
                            <input type="text" value="${proxy.link}" readonly onclick="copyToClipboard(this.value)">
                            <button onclick="copyToClipboard('${proxy.link}')">📋</button>
                        </div>
                        <div class="proxy-info">
                            <div class="info-row">
                                <span>📆 Действует до:</span>
                                <strong>${new Date(proxy.expiry).toLocaleDateString('ru-RU')}</strong>
                            </div>
                            <div class="info-row">
                                <span>⏰ Осталось дней:</span>
                                <strong>${proxy.days_left}</strong>
                            </div>
                            <div class="info-row">
                                <span>🔌 Порт:</span>
                                <strong>${proxy.port}</strong>
                            </div>
                        </div>
                        <button class="btn-primary btn-full" onclick="showScreen('mtproto-plans')">
                            🔄 Продлить
                        </button>
                    </div>
                `;
            });
        }

        if (!html) {
            html = `
                <div class="empty-state">
                    <p class="empty-icon">📭</p>
                    <h3>У вас нет активного прокси</h3>
                    <p>Выберите тип и тариф, чтобы получить прокси</p>
                    <button class="btn-primary" onclick="showScreen('main-menu')">
                        🛒 Купить прокси
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('Load proxy error:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки данных</div>';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        tg.showAlert('✅ Скопировано в буфер обмена');
    }).catch(() => {
        tg.showAlert('❌ Ошибка копирования');
    });
}

// ========== PING TEST ==========
async function pingTest() {
    tg.showAlert('🌍 Проверяю пинг до сервера...');

    try {
        const response = await fetch(`${API_URL}/ping`);
        const data = await response.json();

        if (data.success) {
            tg.showAlert(
                `🌍 Результат теста пинга\n\n` +
                `📍 Сервер: Хельсинки, Финляндия\n` +
                `📡 Средний пинг: ${data.avg_ping} мс\n` +
                `📊 Потеря пакетов: ${data.packet_loss}%`
            );
        } else {
            tg.showAlert('❌ Сервер не отвечает');
        }
    } catch (error) {
        console.error('Ping error:', error);
        tg.showAlert('❌ Ошибка при проверке пинга');
    }
}

// ========== ADMIN FUNCTIONS ==========
async function loadAdminStats() {
    if (!state.isAdmin) return;

    const container = document.getElementById('admin-stats-content');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });

        const data = await response.json();
        const stats = data.stats;
        const system = data.system;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📡</div>
                    <div class="stat-content">
                        <div class="stat-label">MTProto</div>
                        <div class="stat-value">${stats.mtproto_active} / ${stats.mtproto_total}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🚀</div>
                    <div class="stat-content">
                        <div class="stat-label">Vless</div>
                        <div class="stat-value">${stats.vless_active} / ${stats.vless_total}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📋</div>
                    <div class="stat-content">
                        <div class="stat-label">Заявки</div>
                        <div class="stat-value">${stats.pending}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💻</div>
                    <div class="stat-content">
                        <div class="stat-label">CPU</div>
                        <div class="stat-value">${system.cpu}%</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🧠</div>
                    <div class="stat-content">
                        <div class="stat-label">RAM</div>
                        <div class="stat-value">${system.ram_percent}%</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💾</div>
                    <div class="stat-content">
                        <div class="stat-label">Диск</div>
                        <div class="stat-value">${system.disk_percent}%</div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Load admin stats error:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки статистики</div>';
    }
}

async function loadPendingPayments() {
    if (!state.isAdmin) return;

    const container = document.getElementById('pending-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`${API_URL}/admin/pending`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });

        const data = await response.json();

        if (data.pending.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p class="empty-icon">📭</p>
                    <h3>Нет заявок</h3>
                </div>
            `;
            return;
        }

        let html = '';
        data.pending.forEach(payment => {
            html += `
                <div class="payment-card">
                    <div class="payment-header">
                        <strong>@${payment.username}</strong>
                        <span class="payment-id">#${payment.id}</span>
                    </div>
                    <div class="payment-details">
                        <div class="detail-row">
                            <span>ID пользователя:</span>
                            <strong>${payment.user_id}</strong>
                        </div>
                        <div class="detail-row">
                            <span>План:</span>
                            <strong>${payment.plan_id}</strong>
                        </div>
                        <div class="detail-row">
                            <span>Сумма:</span>
                            <strong>${payment.price} ₽</strong>
                        </div>
                    </div>
                    <div class="payment-actions">
                        <button class="btn-success" onclick="approvePayment(${payment.user_id}, '${payment.plan_id}')">
                            ✅ Подтвердить
                        </button>
                        <button class="btn-danger" onclick="rejectPayment(${payment.user_id})">
                            ❌ Отклонить
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Load pending error:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки заявок</div>';
    }
}

async function approvePayment(userId, planId) {
    try {
        const response = await fetch(`${API_URL}/admin/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                initData: tg.initData,
                user_id: userId,
                plan_id: planId
            })
        });

        if (response.ok) {
            tg.showAlert('✅ Заявка подтверждена', () => {
                loadPendingPayments();
            });
        } else {
            showError('Ошибка подтверждения');
        }
    } catch (error) {
        console.error('Approve error:', error);
        showError('Ошибка подтверждения');
    }
}

async function rejectPayment(userId) {
    tg.showConfirm('Отклонить заявку?', async (confirmed) => {
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/admin/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initData: tg.initData,
                    user_id: userId
                })
            });

            if (response.ok) {
                tg.showAlert('❌ Заявка отклонена', () => {
                    loadPendingPayments();
                });
            } else {
                showError('Ошибка отклонения');
            }
        } catch (error) {
            console.error('Reject error:', error);
            showError('Ошибка отклонения');
        }
    });
}

function showAdminUsers() {
    tg.showAlert('Функция в разработке');
}

function showSystemStats() {
    tg.showAlert('Функция в разработке');
}
