// Explore TMA - Main Application

// API Configuration
const API_URL = 'https://explore-backend-camelot770.amvera.io/api';

// API Helper
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg?.initData || '',
                ...options.headers
            }
        });
        return await response.json();
    } catch (err) {
        console.error('API Error:', err);
        return null;
    }
}

// Sync with server
async function syncWithServer() {
    if (!tg?.initData) return;
    
    try {
        // Login/register
        const result = await apiRequest('/auth/login', { method: 'POST' });
        if (result?.user) {
            state.myCode = result.user.partnerCode;
            state.isConnected = result.user.isConnected;
            state.points = result.user.points || state.points;
            state.streak = result.user.streak || state.streak;
            
            if (result.partner) {
                state.partnerName = result.partner.firstName;
            }
            
            saveState();
            updateUI();
        }
    } catch (err) {
        console.error('Sync error:', err);
    }
}

// Sync progress to server
async function syncProgress() {
    if (!tg?.initData) return;
    
    apiRequest('/sync/progress', {
        method: 'POST',
        body: JSON.stringify({
            likedIdeas: state.likedIdeas,
            dislikedIdeas: state.dislikedIdeas,
            triedIdeas: state.triedIdeas,
            answeredQuestions: state.answeredQuestions,
            completedChallenges: state.completedChallenges,
            points: state.points
        })
    });
}

// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    
    // Apply Telegram theme
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#1a1a2e');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#aaaaaa');
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#16213e');
}

// State
let state = {
    streak: 0,
    points: 0,
    likedIdeas: [],
    dislikedIdeas: [],
    triedIdeas: [],
    answeredQuestions: [],
    completedChallenges: [],
    unlockedAchievements: [],
    currentCategory: 'all',
    currentQuestionLevel: 'easy',
    currentQuestion: null,
    currentCardIndex: 0,
    filteredIdeas: [],
    lastActiveDate: null,
    // Partner
    myCode: null,
    partnerCode: null,
    isConnected: false,
    // Truth or Dare
    todLevel: 'mild',
    todCurrentPlayer: 1,
    todScores: { player1: 0, player2: 0 },
    // Planner
    plannedDates: [],
    completedDates: [],
    // Roulette
    rouletteType: 'ideas',
    // Coupons
    myCoupons: [],
    receivedCoupons: [],
    usedCoupons: [],
    // Album
    memories: [],
    relationshipStart: null
};

// Load state from localStorage
function loadState() {
    const saved = localStorage.getItem('exploreState');
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
    }
    checkStreak();
    
    // Sync with server after loading local state
    syncWithServer();
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('exploreState', JSON.stringify(state));
}

// Check and update streak
function checkStreak() {
    const today = new Date().toDateString();
    const lastActive = state.lastActiveDate;
    
    if (lastActive) {
        const lastDate = new Date(lastActive);
        const daysDiff = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 1) {
            state.streak = 0;
        } else if (daysDiff === 1) {
            state.streak++;
        }
    }
    
    state.lastActiveDate = today;
    saveState();
}

// Navigation
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    if (tabId === 'ideas') {
        initCardStack();
    } else if (tabId === 'games') {
        renderGames();
    }
}

// Initialize navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

// Update UI
function updateUI() {
    // Home stats
    document.getElementById('streakCount').textContent = state.streak;
    document.getElementById('likedCount').textContent = state.likedIdeas.length;
    document.getElementById('triedCount').textContent = state.triedIdeas.length;
    document.getElementById('questionsCount').textContent = state.answeredQuestions.length;
    
    // Profile stats
    document.getElementById('pStreak').textContent = state.streak;
    document.getElementById('pPoints').textContent = state.points;
    document.getElementById('pAchievements').textContent = state.unlockedAchievements.length;
    
    // Questions progress
    document.getElementById('answeredCount').textContent = state.answeredQuestions.length;
    document.getElementById('totalQuestions').textContent = questions.length;
    
    // User name from Telegram
    if (tg?.initDataUnsafe?.user?.first_name) {
        document.getElementById('userName').textContent = tg.initDataUnsafe.user.first_name;
    }
    
    renderAchievements();
}

// === CARD STACK (IDEAS) ===

function initCardStack() {
    filterIdeas();
    renderCards();
}

function filterIdeas() {
    if (state.currentCategory === 'all') {
        state.filteredIdeas = ideas.filter(idea => 
            !state.likedIdeas.includes(idea.id) && !state.dislikedIdeas.includes(idea.id)
        );
    } else {
        state.filteredIdeas = ideas.filter(idea => 
            idea.category === state.currentCategory &&
            !state.likedIdeas.includes(idea.id) && !state.dislikedIdeas.includes(idea.id)
        );
    }
    state.currentCardIndex = 0;
}

function renderCards() {
    const stack = document.getElementById('cardStack');
    stack.innerHTML = '';
    
    if (state.filteredIdeas.length === 0) {
        stack.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <p>Вы просмотрели все идеи в этой категории!</p>
            </div>
        `;
        return;
    }
    
    // Show up to 3 cards
    const cardsToShow = state.filteredIdeas.slice(0, 3).reverse();
    
    cardsToShow.forEach((idea, index) => {
        const card = createIdeaCard(idea, index === cardsToShow.length - 1);
        stack.appendChild(card);
    });
}

function createIdeaCard(idea, isTop) {
    const card = document.createElement('div');
    card.className = 'idea-card';
    card.dataset.id = idea.id;
    
    const cat = categories[idea.category];
    const difficultyStars = '⭐'.repeat(idea.difficulty);
    
    card.innerHTML = `
        <div class="card-category">
            <span>${cat.icon}</span>
            <span>${cat.name}</span>
        </div>
        <div class="card-title">${idea.title}</div>
        <div class="card-description">${idea.description}</div>
        <div class="card-meta">
            <div class="meta-item">
                <span>⏱️</span>
                <span>${idea.duration}</span>
            </div>
            <div class="meta-item">
                <span>${difficultyStars}</span>
            </div>
        </div>
        ${idea.tips ? `
        <div class="card-tips">
            <div class="card-tips-title">💡 Советы</div>
            <div class="card-tips-list">${idea.tips.join(' • ')}</div>
        </div>
        ` : ''}
    `;
    
    if (isTop) {
        setupCardGestures(card);
    }
    
    return card;
}

function setupCardGestures(card) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    
    card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        card.classList.add('swiping');
    });
    
    card.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX - startX;
        currentY = e.touches[0].clientY - startY;
        card.style.transform = `translateX(${currentX}px) translateY(${currentY}px) rotate(${currentX * 0.05}deg)`;
    });
    
    card.addEventListener('touchend', () => {
        card.classList.remove('swiping');
        
        if (Math.abs(currentX) > 100) {
            swipeCard(currentX > 0 ? 'right' : 'left');
        } else if (currentY < -100) {
            swipeCard('up');
        } else {
            card.style.transform = '';
        }
        
        currentX = 0;
        currentY = 0;
    });
}

function swipeCard(direction) {
    const currentIdea = state.filteredIdeas[0];
    if (!currentIdea) return;
    
    const card = document.querySelector('.idea-card:last-child');
    if (!card) return;
    
    // Animate card off screen
    let transform = '';
    if (direction === 'left') {
        transform = 'translateX(-150%) rotate(-30deg)';
        state.dislikedIdeas.push(currentIdea.id);
    } else if (direction === 'right') {
        transform = 'translateX(150%) rotate(30deg)';
        state.likedIdeas.push(currentIdea.id);
        state.points += 5;
        checkAchievements();
        if (tg) tg.HapticFeedback?.impactOccurred('light');
    } else if (direction === 'up') {
        transform = 'translateY(-150%)';
        state.likedIdeas.push(currentIdea.id);
        state.triedIdeas.push(currentIdea.id);
        state.points += 20;
        checkAchievements();
        if (tg) tg.HapticFeedback?.impactOccurred('medium');
    }
    
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = transform;
    
    setTimeout(() => {
        state.filteredIdeas.shift();
        renderCards();
        saveState();
        updateUI();
    }, 300);
}

// Category filter
document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentCategory = btn.dataset.category;
        initCardStack();
    });
});

// === QUESTIONS ===

function getNewQuestion() {
    const levelQuestions = questions.filter(q => 
        q.level === state.currentQuestionLevel && 
        !state.answeredQuestions.includes(q.id)
    );
    
    if (levelQuestions.length === 0) {
        document.getElementById('questionText').textContent = 'Вы ответили на все вопросы этого уровня! 🎉';
        document.getElementById('questionCategory').textContent = '';
        state.currentQuestion = null;
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * levelQuestions.length);
    state.currentQuestion = levelQuestions[randomIndex];
    
    const level = questionLevels[state.currentQuestion.level];
    document.getElementById('questionLevel').textContent = `${level.icon} ${level.name}`;
    document.getElementById('questionText').textContent = state.currentQuestion.text;
    document.getElementById('questionCategory').textContent = '';
    
    if (tg) tg.HapticFeedback?.impactOccurred('light');
}

function markAnswered() {
    if (!state.currentQuestion) {
        getNewQuestion();
        return;
    }
    
    state.answeredQuestions.push(state.currentQuestion.id);
    state.points += 10;
    checkAchievements();
    saveState();
    updateUI();
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
    
    getNewQuestion();
}

// Question level selector
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentQuestionLevel = btn.dataset.level;
        getNewQuestion();
    });
});

// === GAMES ===

function renderGames() {
    const list = document.getElementById('gamesList');
    list.innerHTML = games.map(game => `
        <div class="game-card" onclick="showGameDetail('${game.id}')">
            <div class="game-icon">${game.icon}</div>
            <div class="game-info">
                <h3>${game.title}</h3>
                <p>${game.description}</p>
            </div>
            <div class="game-meta">
                <div>⏱️ ${game.duration}</div>
            </div>
        </div>
    `).join('');
}

function showGameDetail(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    
    document.getElementById('gameTitle').textContent = `${game.icon} ${game.title}`;
    document.getElementById('gameContent').innerHTML = `
        <div class="game-desc">${game.description}</div>
        <div class="game-section">
            <div class="section-title">📋 Инструкция</div>
            ${game.instructions.map((inst, i) => `
                <div class="instruction-item">
                    <div class="instruction-num">${i + 1}</div>
                    <div class="instruction-text">${inst}</div>
                </div>
            `).join('')}
        </div>
        ${game.variations ? `
        <div class="game-section">
            <div class="section-title">🎨 Вариации</div>
            <div class="game-variations">
                ${game.variations.map(v => `<div class="variation-item">• ${v}</div>`).join('')}
            </div>
        </div>
        ` : ''}
    `;
    
    showModal('gameModal');
}

// === MODALS ===

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    if (tg) tg.HapticFeedback?.impactOccurred('light');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Close modal on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// === CHALLENGES ===

function showChallenges() {
    renderChallenges('daily');
    showModal('challengesModal');
}

function renderChallenges(duration) {
    const list = document.getElementById('challengesList');
    const challengeData = challenges[duration];
    
    list.innerHTML = challengeData.map(ch => {
        const isCompleted = state.completedChallenges.includes(ch.id);
        return `
            <div class="challenge-card ${isCompleted ? 'completed' : ''}">
                <div class="challenge-header">
                    <span class="challenge-icon">${ch.icon}</span>
                    <span class="challenge-title">${ch.title}</span>
                </div>
                <div class="challenge-desc">${ch.description}</div>
                <div class="challenge-reward">
                    <span class="reward-points">+${ch.reward} очков</span>
                    ${isCompleted ? '<span>✅</span>' : `<button onclick="completeChallenge('${ch.id}', ${ch.reward})">Выполнить</button>`}
                </div>
            </div>
        `;
    }).join('');
}

function completeChallenge(id, reward) {
    if (state.completedChallenges.includes(id)) return;
    
    state.completedChallenges.push(id);
    state.points += reward;
    checkAchievements();
    saveState();
    updateUI();
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
    
    // Re-render current tab
    const activeTab = document.querySelector('.ch-tab.active');
    if (activeTab) {
        renderChallenges(activeTab.dataset.duration);
    }
}

// Challenge tabs
document.querySelectorAll('.ch-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.ch-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderChallenges(tab.dataset.duration);
    });
});

// === POSITIONS ===

function showPositions() {
    renderPositions('all');
    showModal('positionsModal');
}

function renderPositions(difficulty) {
    const list = document.getElementById('positionsList');
    const positions = ideas.filter(i => i.category === 'positions');
    
    const filtered = difficulty === 'all' 
        ? positions 
        : positions.filter(p => p.difficulty === parseInt(difficulty));
    
    list.innerHTML = filtered.map(pos => `
        <div class="position-card">
            <div class="position-header">
                <span class="position-title">${pos.title}</span>
                <span class="position-difficulty">${'⭐'.repeat(pos.difficulty)}</span>
            </div>
            <div class="position-desc">${pos.description}</div>
            <div class="position-tags">
                ${pos.tags.map(tag => `<span class="position-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

// Difficulty filter
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPositions(btn.dataset.diff);
    });
});

// === LEARN (ARTICLES) ===

function showLearn() {
    renderArticles();
    showModal('learnModal');
}

function renderArticles() {
    const list = document.getElementById('articlesList');
    list.innerHTML = articles.map(article => `
        <div class="article-card" onclick="showArticleDetail('${article.id}')">
            <div class="article-header">
                <span class="article-icon">${article.icon}</span>
                <div>
                    <div class="article-title">${article.title}</div>
                    <div class="article-subtitle">${article.subtitle}</div>
                </div>
            </div>
            <div class="article-meta">
                <span>📖 ${article.readTime} мин</span>
            </div>
        </div>
    `).join('');
}

function showArticleDetail(articleId) {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;
    
    document.getElementById('articleTitle').textContent = `${article.icon} ${article.title}`;
    document.getElementById('articleContent').innerHTML = article.content.map(section => `
        <div class="article-section">
            ${section.title ? `<div class="section-title">${section.title}</div>` : ''}
            <div class="section-text">${section.text}</div>
            ${section.tips ? `
                <div class="section-tips">
                    ${section.tips.map(tip => `<div class="tip-item">${tip}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    closeModal('learnModal');
    showModal('articleModal');
}

// === ACHIEVEMENTS ===

function renderAchievements() {
    const grid = document.getElementById('achievementsList');
    grid.innerHTML = achievements.slice(0, 8).map(ach => {
        const isUnlocked = state.unlockedAchievements.includes(ach.id);
        return `
            <div class="achievement ${isUnlocked ? 'unlocked' : ''}">
                <div class="achievement-icon">${ach.icon}</div>
                <div class="achievement-title">${ach.title}</div>
            </div>
        `;
    }).join('');
}

function checkAchievements() {
    const checks = [
        { id: 'first_like', condition: state.likedIdeas.length >= 1 },
        { id: '10_likes', condition: state.likedIdeas.length >= 10 },
        { id: '50_likes', condition: state.likedIdeas.length >= 50 },
        { id: 'first_try', condition: state.triedIdeas.length >= 1 },
        { id: '10_tries', condition: state.triedIdeas.length >= 10 },
        { id: 'streak_3', condition: state.streak >= 3 },
        { id: 'streak_7', condition: state.streak >= 7 },
        { id: 'streak_30', condition: state.streak >= 30 },
        { id: 'first_question', condition: state.answeredQuestions.length >= 1 },
        { id: '25_questions', condition: state.answeredQuestions.length >= 25 },
        { id: '100_questions', condition: state.answeredQuestions.length >= 100 }
    ];
    
    checks.forEach(check => {
        if (check.condition && !state.unlockedAchievements.includes(check.id)) {
            state.unlockedAchievements.push(check.id);
            const ach = achievements.find(a => a.id === check.id);
            if (ach) {
                state.points += ach.points;
                if (tg) {
                    tg.HapticFeedback?.notificationOccurred('success');
                    tg.showAlert(`🏆 Новое достижение: ${ach.title}!`);
                }
            }
        }
    });
}

// === PROFILE ACTIONS ===

function shareApp() {
    if (tg) {
        tg.openTelegramLink('https://t.me/share/url?url=https://t.me/ExploreAppBot&text=Explore 🔥 - приложение для пар!');
    }
}

function resetProgress() {
    if (confirm('Вы уверены? Весь прогресс будет сброшен.')) {
        state = {
            streak: 0,
            points: 0,
            likedIdeas: [],
            dislikedIdeas: [],
            triedIdeas: [],
            answeredQuestions: [],
            completedChallenges: [],
            unlockedAchievements: [],
            currentCategory: 'all',
            currentQuestionLevel: 'easy',
            currentQuestion: null,
            currentCardIndex: 0,
            filteredIdeas: [],
            lastActiveDate: new Date().toDateString()
        };
        saveState();
        updateUI();
        initCardStack();
        if (tg) tg.HapticFeedback?.notificationOccurred('warning');
    }
}

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateUI();
    initCardStack();
    renderGames();
    generatePartnerCode();
    
    // Get first question ready
    getNewQuestion();
});

// === PARTNER CONNECTION ===

function generatePartnerCode() {
    if (!state.myCode) {
        // Generate 6-digit code
        state.myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        saveState();
    }
    document.getElementById('myPartnerCode').textContent = state.myCode;
    updatePartnerStatus();
}

function showPartnerModal() {
    document.getElementById('myPartnerCode').textContent = state.myCode;
    updatePartnerStatus();
    showModal('partnerModal');
}

function copyPartnerCode() {
    navigator.clipboard.writeText(state.myCode).then(() => {
        if (tg) tg.showAlert('Код скопирован!');
        else alert('Код скопирован!');
    });
}

function sharePartnerCode() {
    const text = `🔥 Присоединяйся ко мне в Explore!\n\nМой код: ${state.myCode}\n\nОткрой приложение и введи этот код для связи!`;
    if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/ExploreAppBot&text=${encodeURIComponent(text)}`);
    } else {
        navigator.share?.({ text }) || alert(text);
    }
}

async function connectPartner() {
    const code = document.getElementById('partnerCodeInput').value.toUpperCase().trim();
    
    if (code.length !== 6) {
        if (tg) tg.showAlert('Код должен содержать 6 символов');
        return;
    }
    
    if (code === state.myCode) {
        if (tg) tg.showAlert('Нельзя подключиться к себе!');
        return;
    }
    
    // Connect via API
    const result = await apiRequest('/partners/connect', {
        method: 'POST',
        body: JSON.stringify({ code })
    });
    
    if (result?.success) {
        state.partnerCode = code;
        state.isConnected = true;
        state.partnerName = result.partner?.firstName || 'Партнёр';
        saveState();
        
        updatePartnerStatus();
        if (tg) {
            tg.HapticFeedback?.notificationOccurred('success');
            tg.showAlert('🎉 Партнёр подключен!');
        }
        
        updateUI();
    } else {
        if (tg) tg.showAlert(result?.error || 'Не удалось подключиться');
    }
}

function updatePartnerStatus() {
    const statusEl = document.getElementById('partnerStatus');
    
    if (state.isConnected) {
        statusEl.textContent = `💕 Связан с: ${state.partnerName || state.partnerCode}`;
        statusEl.classList.add('connected');
    } else {
        statusEl.textContent = 'Нет партнёра';
        statusEl.classList.remove('connected');
    }
}

// === ROULETTE ===

let isSpinning = false;

function showRoulette() {
    showModal('rouletteModal');
}

// Roulette type selector
document.querySelectorAll('.roulette-type').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.roulette-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.rouletteType = btn.dataset.type;
        document.getElementById('rouletteResult').classList.remove('show');
    });
});

function spinRoulette() {
    if (isSpinning) return;
    
    isSpinning = true;
    const spinBtn = document.getElementById('spinBtn');
    const wheel = document.getElementById('rouletteWheel');
    const result = document.getElementById('rouletteResult');
    
    spinBtn.disabled = true;
    result.classList.remove('show');
    
    // Random rotation
    const rotation = 1800 + Math.random() * 1800; // 5-10 full rotations
    wheel.style.transform = `rotate(${rotation}deg)`;
    
    if (tg) tg.HapticFeedback?.impactOccurred('medium');
    
    setTimeout(() => {
        // Get random result based on type
        let item;
        switch(state.rouletteType) {
            case 'ideas':
                item = ideas[Math.floor(Math.random() * ideas.length)];
                result.innerHTML = `
                    <h3>${categories[item.category]?.icon || '💡'} ${item.title}</h3>
                    <p>${item.description}</p>
                `;
                break;
            case 'positions':
                const positions = ideas.filter(i => i.category === 'positions');
                item = positions[Math.floor(Math.random() * positions.length)];
                result.innerHTML = `
                    <h3>🔥 ${item.title}</h3>
                    <p>${item.description}</p>
                    <p style="margin-top: 8px; color: var(--explore-primary);">${'⭐'.repeat(item.difficulty)} • ${item.duration}</p>
                `;
                break;
            case 'questions':
                item = questions[Math.floor(Math.random() * questions.length)];
                result.innerHTML = `
                    <h3>${questionLevels[item.level].icon} Вопрос</h3>
                    <p>${item.text}</p>
                `;
                break;
            case 'games':
                item = games[Math.floor(Math.random() * games.length)];
                result.innerHTML = `
                    <h3>${item.icon} ${item.title}</h3>
                    <p>${item.description}</p>
                `;
                break;
        }
        
        result.classList.add('show');
        isSpinning = false;
        spinBtn.disabled = false;
        
        if (tg) tg.HapticFeedback?.notificationOccurred('success');
    }, 4000);
}

// === TRUTH OR DARE ===

function showTruthOrDare() {
    updateTodUI();
    showModal('todModal');
}

// ToD Level selector
document.querySelectorAll('.tod-level').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tod-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.todLevel = btn.dataset.level;
    });
});

function updateTodUI() {
    // Update player highlight
    document.getElementById('player1').classList.toggle('active', state.todCurrentPlayer === 1);
    document.getElementById('player2').classList.toggle('active', state.todCurrentPlayer === 2);
    
    // Update scores
    document.getElementById('score1').textContent = state.todScores.player1;
    document.getElementById('score2').textContent = state.todScores.player2;
}

function getTruth() {
    const truths = truthQuestions[state.todLevel];
    const truth = truths[Math.floor(Math.random() * truths.length)];
    
    document.getElementById('todType').textContent = '🗣️ ПРАВДА';
    document.getElementById('todText').textContent = truth;
    
    if (tg) tg.HapticFeedback?.impactOccurred('light');
}

function getDare() {
    const dares = dareActions[state.todLevel];
    const dare = dares[Math.floor(Math.random() * dares.length)];
    
    document.getElementById('todType').textContent = '⚡ ДЕЙСТВИЕ';
    document.getElementById('todText').textContent = dare;
    
    if (tg) tg.HapticFeedback?.impactOccurred('medium');
}

function skipTod() {
    // Skipping costs a point
    if (state.todCurrentPlayer === 1) {
        state.todScores.player1 = Math.max(0, state.todScores.player1 - 1);
    } else {
        state.todScores.player2 = Math.max(0, state.todScores.player2 - 1);
    }
    
    nextTodPlayer();
    resetTodCard();
    saveState();
}

function completeTod() {
    // Completing earns points
    if (state.todCurrentPlayer === 1) {
        state.todScores.player1 += 1;
    } else {
        state.todScores.player2 += 1;
    }
    
    state.points += 5;
    
    nextTodPlayer();
    resetTodCard();
    saveState();
    updateUI();
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
}

function nextTodPlayer() {
    state.todCurrentPlayer = state.todCurrentPlayer === 1 ? 2 : 1;
    updateTodUI();
}

function resetTodCard() {
    document.getElementById('todType').textContent = 'Выберите: Правда или Действие';
    document.getElementById('todText').textContent = `Ход игрока ${state.todCurrentPlayer}`;
}

// === PLANNER ===

function showPlanner() {
    renderPlanner('upcoming');
    populateIdeaSelect();
    showModal('plannerModal');
}

// Planner tabs
document.querySelectorAll('.planner-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.planner-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderPlanner(tab.dataset.tab);
    });
});

function renderPlanner(tabType) {
    const list = document.getElementById('plannerList');
    const dates = tabType === 'upcoming' ? state.plannedDates : state.completedDates;
    
    if (dates.length === 0) {
        list.innerHTML = `
            <div class="empty-planner">
                <div class="empty-planner-icon">${tabType === 'upcoming' ? '📅' : '📜'}</div>
                <p>${tabType === 'upcoming' ? 'Нет запланированных свиданий' : 'История пуста'}</p>
            </div>
        `;
        return;
    }
    
    // Sort by date
    const sorted = [...dates].sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
    
    list.innerHTML = sorted.map((date, index) => {
        const idea = date.ideaId ? ideas.find(i => i.id === date.ideaId) : null;
        const dateObj = new Date(date.date);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
        
        return `
            <div class="date-card ${tabType === 'history' ? 'completed' : ''}">
                <div class="date-header">
                    <div class="date-datetime">
                        <span class="date-date">${formattedDate}</span>
                        <span class="date-time">${date.time || ''}</span>
                    </div>
                    <div class="date-actions">
                        ${tabType === 'upcoming' ? `
                            <button class="date-action-btn" onclick="completeDate(${index})">✅</button>
                            <button class="date-action-btn" onclick="deleteDate(${index})">🗑️</button>
                        ` : ''}
                    </div>
                </div>
                ${idea ? `
                    <div class="date-idea">
                        <span class="date-idea-icon">${categories[idea.category]?.icon || '💡'}</span>
                        <span class="date-idea-title">${idea.title}</span>
                    </div>
                ` : ''}
                ${date.note ? `<div class="date-note">${date.note}</div>` : ''}
            </div>
        `;
    }).join('');
}

function showAddDate() {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('dateInput').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('timeInput').value = '19:00';
    document.getElementById('noteInput').value = '';
    document.getElementById('ideaSelect').value = '';
    
    showModal('addDateModal');
}

function populateIdeaSelect() {
    const select = document.getElementById('ideaSelect');
    const romanticIdeas = ideas.filter(i => ['romance', 'adventure'].includes(i.category));
    
    select.innerHTML = '<option value="">Выберите идею...</option>' + 
        romanticIdeas.map(idea => `
            <option value="${idea.id}">${categories[idea.category]?.icon || ''} ${idea.title}</option>
        `).join('');
}

function saveDate() {
    const date = document.getElementById('dateInput').value;
    const time = document.getElementById('timeInput').value;
    const ideaId = document.getElementById('ideaSelect').value || null;
    const note = document.getElementById('noteInput').value.trim();
    
    if (!date) {
        if (tg) tg.showAlert('Выберите дату');
        return;
    }
    
    state.plannedDates.push({
        id: Date.now(),
        date,
        time,
        ideaId,
        note,
        createdAt: new Date().toISOString()
    });
    
    saveState();
    closeModal('addDateModal');
    renderPlanner('upcoming');
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
}

function completeDate(index) {
    const date = state.plannedDates[index];
    state.completedDates.push({
        ...date,
        completedAt: new Date().toISOString()
    });
    state.plannedDates.splice(index, 1);
    state.points += 25;
    
    saveState();
    renderPlanner('upcoming');
    updateUI();
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
}

function deleteDate(index) {
    if (confirm('Удалить это свидание?')) {
        state.plannedDates.splice(index, 1);
        saveState();
        renderPlanner('upcoming');
    }
}

// === COUPONS ===

let selectedCouponIcon = '💆';
let currentCouponTab = 'my';

function showCoupons() {
    renderCoupons('my');
    showModal('couponsModal');
}

// Coupon tabs
document.querySelectorAll('.coupon-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.coupon-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentCouponTab = tab.dataset.tab;
        renderCoupons(tab.dataset.tab);
    });
});

function renderCoupons(tabType) {
    const list = document.getElementById('couponsList');
    let coupons;
    
    switch(tabType) {
        case 'my':
            coupons = state.myCoupons;
            break;
        case 'received':
            coupons = state.receivedCoupons;
            break;
        case 'used':
            coupons = state.usedCoupons;
            break;
    }
    
    if (coupons.length === 0) {
        list.innerHTML = `
            <div class="empty-planner">
                <div class="empty-planner-icon">🎫</div>
                <p>${tabType === 'my' ? 'Создайте первый купон для партнёра!' : tabType === 'received' ? 'Пока нет полученных купонов' : 'Нет использованных купонов'}</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = coupons.map((coupon, index) => `
        <div class="coupon-card ${tabType === 'used' ? 'used' : ''}">
            <div class="coupon-icon">${coupon.icon}</div>
            <div class="coupon-info">
                <div class="coupon-title">${coupon.title}</div>
                <div class="coupon-desc">${coupon.desc}</div>
                <div class="coupon-meta">
                    ${coupon.expiry ? `<span>⏰ До ${formatDate(coupon.expiry)}</span>` : ''}
                    <span>📅 ${formatDate(coupon.createdAt)}</span>
                </div>
            </div>
            ${tabType !== 'used' ? `
            <div class="coupon-actions">
                ${tabType === 'received' ? `
                    <button class="coupon-action-btn use" onclick="useCoupon(${index})">✨ Использовать</button>
                ` : `
                    <button class="coupon-action-btn share" onclick="shareCoupon(${index})">📤</button>
                `}
            </div>
            ` : ''}
        </div>
    `).join('');
}

function showCreateCoupon() {
    renderCouponTemplates();
    updateCouponPreview();
    showModal('createCouponModal');
}

function renderCouponTemplates() {
    const grid = document.getElementById('couponTemplates');
    grid.innerHTML = couponTemplates.map((tmpl, index) => `
        <button class="template-btn" onclick="selectTemplate(${index})">
            <div class="template-icon">${tmpl.icon}</div>
            <div class="template-title">${tmpl.title}</div>
        </button>
    `).join('');
}

function selectTemplate(index) {
    const tmpl = couponTemplates[index];
    document.getElementById('couponTitle').value = tmpl.title;
    document.getElementById('couponDesc').value = tmpl.desc;
    selectedCouponIcon = tmpl.icon;
    
    // Update icon selector
    document.querySelectorAll('.icon-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.icon === tmpl.icon);
    });
    
    // Highlight selected template
    document.querySelectorAll('.template-btn').forEach((btn, i) => {
        btn.classList.toggle('selected', i === index);
    });
    
    updateCouponPreview();
    if (tg) tg.HapticFeedback?.impactOccurred('light');
}

// Icon selector
document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCouponIcon = btn.dataset.icon;
        updateCouponPreview();
    });
});

// Update preview on input
document.getElementById('couponTitle')?.addEventListener('input', updateCouponPreview);
document.getElementById('couponDesc')?.addEventListener('input', updateCouponPreview);

function updateCouponPreview() {
    const title = document.getElementById('couponTitle')?.value || 'Название купона';
    const desc = document.getElementById('couponDesc')?.value || 'Описание купона';
    
    const preview = document.getElementById('couponPreview');
    if (preview) {
        preview.innerHTML = `
            <div class="coupon-icon">${selectedCouponIcon}</div>
            <div class="coupon-info">
                <div class="coupon-title">${title}</div>
                <div class="coupon-desc">${desc}</div>
            </div>
        `;
    }
}

function saveCoupon() {
    const title = document.getElementById('couponTitle').value.trim();
    const desc = document.getElementById('couponDesc').value.trim();
    const expiry = document.getElementById('couponExpiry').value;
    
    if (!title) {
        if (tg) tg.showAlert('Введите название купона');
        return;
    }
    
    const coupon = {
        id: Date.now(),
        icon: selectedCouponIcon,
        title,
        desc,
        expiry: expiry || null,
        createdAt: new Date().toISOString()
    };
    
    state.myCoupons.push(coupon);
    state.points += 15;
    saveState();
    updateUI();
    
    closeModal('createCouponModal');
    renderCoupons('my');
    
    if (tg) {
        tg.HapticFeedback?.notificationOccurred('success');
        tg.showAlert('🎁 Купон создан! Отправьте его партнёру.');
    }
}

function shareCoupon(index) {
    const coupon = state.myCoupons[index];
    const text = `🎁 Тебе купон от меня!\n\n${coupon.icon} ${coupon.title}\n${coupon.desc}\n\n💕 Открой в Explore, чтобы использовать!`;
    
    if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/ExploreAppBot&text=${encodeURIComponent(text)}`);
    } else {
        navigator.share?.({ text }) || alert(text);
    }
    
    // Simulate sending - in real app would sync with partner
    state.receivedCoupons.push({...coupon, receivedAt: new Date().toISOString()});
    saveState();
}

function useCoupon(index) {
    const coupon = state.receivedCoupons[index];
    
    if (confirm(`Использовать купон "${coupon.title}"?`)) {
        state.usedCoupons.push({
            ...coupon,
            usedAt: new Date().toISOString()
        });
        state.receivedCoupons.splice(index, 1);
        state.points += 10;
        
        saveState();
        renderCoupons('received');
        updateUI();
        
        if (tg) {
            tg.HapticFeedback?.notificationOccurred('success');
            tg.showAlert('✨ Купон использован! Покажите партнёру.');
        }
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// === ALBUM ===

let selectedMemoryType = 'photo';
let selectedMood = '😍';
let selectedPhotoData = null;

function showAlbum() {
    updateAlbumStats();
    renderAlbum('all');
    showModal('albumModal');
}

function updateAlbumStats() {
    document.getElementById('albumCount').textContent = state.memories.length;
    
    // Calculate days together
    if (state.relationshipStart) {
        const start = new Date(state.relationshipStart);
        const now = new Date();
        const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        document.getElementById('albumDays').textContent = days;
    } else if (state.memories.length > 0) {
        // Use earliest memory as start
        const earliest = state.memories.reduce((min, m) => 
            new Date(m.date) < new Date(min.date) ? m : min
        );
        const days = Math.floor((new Date() - new Date(earliest.date)) / (1000 * 60 * 60 * 24));
        document.getElementById('albumDays').textContent = days;
    }
}

// Album filter
document.querySelectorAll('.album-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.album-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAlbum(btn.dataset.filter);
    });
});

function renderAlbum(filter) {
    const timeline = document.getElementById('albumTimeline');
    
    let memories = [...state.memories];
    if (filter !== 'all') {
        memories = memories.filter(m => m.type === filter);
    }
    
    // Sort by date descending
    memories.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (memories.length === 0) {
        timeline.innerHTML = `
            <div class="empty-album">
                <div class="empty-album-icon">📸</div>
                <p>Начните создавать воспоминания вместе!</p>
            </div>
        `;
        return;
    }
    
    timeline.innerHTML = memories.map((memory, index) => {
        const typeInfo = memoryTypes[memory.type] || memoryTypes.photo;
        const dateObj = new Date(memory.date);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        });
        
        return `
            <div class="memory-card" onclick="viewMemory(${index}, '${filter}')">
                <div class="memory-date">${formattedDate}</div>
                ${memory.photo ? `<img class="memory-photo" src="${memory.photo}" alt="">` : ''}
                <div class="memory-header">
                    <span class="memory-type-icon">${typeInfo.icon}</span>
                    <span class="memory-title">${memory.title}</span>
                    <span class="memory-mood">${memory.mood}</span>
                </div>
                ${memory.desc ? `<div class="memory-desc">${memory.desc}</div>` : ''}
            </div>
        `;
    }).join('');
}

function showAddMemory() {
    // Reset form
    document.getElementById('memoryDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('memoryTitle').value = '';
    document.getElementById('memoryDesc').value = '';
    selectedPhotoData = null;
    document.getElementById('photoPreviewImg').style.display = 'none';
    document.getElementById('photoPlaceholder').style.display = 'flex';
    
    selectedMemoryType = 'photo';
    selectedMood = '😍';
    
    document.querySelectorAll('.memory-type').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'photo');
    });
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mood === '😍');
    });
    
    showModal('addMemoryModal');
}

// Memory type selector
document.querySelectorAll('.memory-type').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.memory-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMemoryType = btn.dataset.type;
        
        // Show/hide photo upload based on type
        const photoGroup = document.getElementById('photoUploadGroup');
        if (photoGroup) {
            photoGroup.style.display = selectedMemoryType === 'photo' ? 'block' : 'none';
        }
    });
});

// Mood selector
document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMood = btn.dataset.mood;
        if (tg) tg.HapticFeedback?.impactOccurred('light');
    });
});

function previewPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedPhotoData = e.target.result;
            document.getElementById('photoPreviewImg').src = selectedPhotoData;
            document.getElementById('photoPreviewImg').style.display = 'block';
            document.getElementById('photoPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveMemory() {
    const date = document.getElementById('memoryDate').value;
    const title = document.getElementById('memoryTitle').value.trim();
    const desc = document.getElementById('memoryDesc').value.trim();
    
    if (!title) {
        if (tg) tg.showAlert('Введите название');
        return;
    }
    
    const memory = {
        id: Date.now(),
        type: selectedMemoryType,
        date,
        title,
        desc,
        mood: selectedMood,
        photo: selectedPhotoData,
        createdAt: new Date().toISOString()
    };
    
    state.memories.push(memory);
    state.points += 20;
    saveState();
    updateUI();
    
    closeModal('addMemoryModal');
    updateAlbumStats();
    renderAlbum('all');
    
    if (tg) tg.HapticFeedback?.notificationOccurred('success');
}

function viewMemory(index, filter) {
    let memories = [...state.memories];
    if (filter !== 'all') {
        memories = memories.filter(m => m.type === filter);
    }
    memories.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const memory = memories[index];
    if (!memory) return;
    
    const typeInfo = memoryTypes[memory.type] || memoryTypes.photo;
    const dateObj = new Date(memory.date);
    const formattedDate = dateObj.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
    });
    
    document.getElementById('viewMemoryTitle').textContent = `${memory.mood} ${memory.title}`;
    document.getElementById('viewMemoryContent').innerHTML = `
        ${memory.photo ? `<img class="view-memory-photo" src="${memory.photo}" alt="">` : ''}
        <div class="view-memory-meta">
            <span class="view-memory-date">📅 ${formattedDate}</span>
            <span class="view-memory-type">${typeInfo.icon} ${typeInfo.name}</span>
        </div>
        ${memory.desc ? `<div class="view-memory-desc">${memory.desc}</div>` : ''}
        <div class="view-memory-actions">
            <button class="btn-secondary" onclick="deleteMemory(${memory.id})">🗑️ Удалить</button>
            <button class="btn-primary" onclick="closeModal('viewMemoryModal')">✨ Закрыть</button>
        </div>
    `;
    
    showModal('viewMemoryModal');
}

function deleteMemory(id) {
    if (confirm('Удалить это воспоминание?')) {
        state.memories = state.memories.filter(m => m.id !== id);
        saveState();
        closeModal('viewMemoryModal');
        updateAlbumStats();
        renderAlbum('all');
        
        if (tg) tg.HapticFeedback?.notificationOccurred('warning');
    }
}
