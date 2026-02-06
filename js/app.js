/**
 * NewsHub Pro - Main Application
 */


const State = {
    articles: [],
    filteredArticles: [],
    currentPage: 1,
    articlesPerPage: 12,
    currentCategory: 'all',
    searchTerm: '',
    bookmarks: JSON.parse(localStorage.getItem('news_bookmarks') || '[]'),
    darkMode: localStorage.getItem('dark_mode') === 'true',
    isLoading: true,
    error: null
};

const DOM = {
    newsContainer: document.getElementById('news-container'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    errorContainer: document.getElementById('error-container'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    searchInput: document.getElementById('search-input'),
    mobileSearchBtn: document.getElementById('mobile-search-btn'),
    mobileSearch: document.getElementById('mobile-search'),
    mobileSearchInput: document.getElementById('mobile-search-input'),
    categoryBtns: document.querySelectorAll('.category-btn'),
    articleCount: document.getElementById('article-count'),
    heroSection: document.getElementById('hero-section'),
    heroTitle: document.getElementById('hero-title'),
    heroSummary: document.getElementById('hero-summary'),
    heroLink: document.getElementById('hero-link'),
    backToTopBtn: document.getElementById('back-to-top'),
    loadingOverlay: document.getElementById('loading-overlay')
};

// ========================================
// DEBUG: Log DOM elements
// ========================================
console.log('🔍 DOM Elements:', {
    newsContainer: DOM.newsContainer,
    skeletonLoader: DOM.skeletonLoader,
    errorContainer: DOM.errorContainer
});

// ========================================
// INITIALIZATION
// ========================================
function init() {
    console.log('🚀 NewsHub Pro Initializing...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize dark mode
    initDarkMode();
    
    // Load news
    loadNews();
    
    // Setup scroll monitoring
    setupScrollMonitoring();
    
    // Clear expired cache
    if (NewsHubUtils?.StorageUtils?.clearExpired) {
        NewsHubUtils.StorageUtils.clearExpired();
    }
    
    console.log('✅ NewsHub Pro Initialized');
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    console.log('🔌 Setting up event listeners...');
    
    // Retry button
    if (DOM.retryBtn) {
        DOM.retryBtn.addEventListener('click', () => {
            console.log('🔄 Retry button clicked');
            hideError();
            loadNews();
        });
    }
    
    // Refresh button
    if (DOM.refreshBtn) {
        DOM.refreshBtn.addEventListener('click', () => {
            console.log('⟳ Refresh button clicked');
            State.currentPage = 1;
            loadNews(true);
        });
    }
    
    // Dark mode toggle
    if (DOM.darkModeToggle) {
        DOM.darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Search input
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', handleSearch);
    }
    if (DOM.mobileSearchInput) {
        DOM.mobileSearchInput.addEventListener('input', handleSearch);
    }
    
    // Mobile search toggle
    if (DOM.mobileSearchBtn) {
        DOM.mobileSearchBtn.addEventListener('click', toggleMobileSearch);
    }
    
    // Category buttons
    if (DOM.categoryBtns) {
        DOM.categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                console.log('🏷️ Category selected:', category);
                selectCategory(category);
            });
        });
    }
    
    // Back to top button
    if (DOM.backToTopBtn) {
        DOM.backToTopBtn.addEventListener('click', scrollToTop);
    }
    
    // Window scroll
    window.addEventListener('scroll', handleScroll);
    
    // Window resize
    window.addEventListener('resize', handleResize);
}

// ========================================
// DARK MODE
// ========================================
function initDarkMode() {
    console.log('🌙 Initializing dark mode:', State.darkMode);
    if (State.darkMode) {
        document.documentElement.classList.add('dark');
        if (DOM.themeIcon) {
            DOM.themeIcon.className = 'fas fa-sun text-xl';
        }
    }
}

function toggleDarkMode() {
    State.darkMode = !State.darkMode;
    document.documentElement.classList.toggle('dark');
    
    if (DOM.themeIcon) {
        if (State.darkMode) {
            DOM.themeIcon.className = 'fas fa-sun text-xl';
        } else {
            DOM.themeIcon.className = 'fas fa-moon text-xl';
        }
    }
    
    localStorage.setItem('dark_mode', State.darkMode);
    showToast(State.darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'success');
}

// ========================================
// NEWS LOADING
// ========================================
async function loadNews(forceRefresh = false) {
    console.log('📡 Loading news... (forceRefresh:', forceRefresh, ')');
    showLoading();
    
    try {
        // Check cache first
        if (!forceRefresh) {
            const cached = NewsHubUtils?.StorageUtils?.getWithExpiry?.('news_cache');
            if (cached && cached.length > 0) {
                console.log('💾 Loaded from cache:', cached.length, 'articles');
                State.articles = cached;
                filterAndDisplayArticles();
                showToast('Loaded from cache', 'success');
                
                // Refresh in background
                fetchNewsInBackground();
                return;
            }
        }
        
        // Fetch fresh data
        console.log('🌐 Fetching fresh data from:', NewsHubUtils?.API_CONFIG?.FULL_URL);
        const data = await fetchNewsWithRetry();
        
        console.log('✅ Data received:', data);
        
        if (!data.articles || data.articles.length === 0) {
            throw new Error('No articles returned from API');
        }
        
        State.articles = data.articles;
        console.log('📚 Total articles:', State.articles.length);
        
        // Cache the data
        if (NewsHubUtils?.StorageUtils?.setWithExpiry) {
            NewsHubUtils.StorageUtils.setWithExpiry(
                'news_cache', 
                State.articles, 
                NewsHubUtils.API_CONFIG.CACHE_DURATION
            );
        }
        
        filterAndDisplayArticles();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error loading news:', error);
        State.error = error.message;
        showError(error.message);
        hideLoading();
    }
}

async function fetchNewsWithRetry(retries = NewsHubUtils?.API_CONFIG?.MAX_RETRIES || 3) {
    try {
        const response = await fetch(NewsHubUtils?.API_CONFIG?.FULL_URL || 'https://news-aggregator-api.dhimanparas605.workers.dev/', {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ API Response:', data);
        return data;
        
    } catch (error) {
        console.error('❌ Fetch error (attempt', NewsHubUtils?.API_CONFIG?.MAX_RETRIES - retries + 1, '):', error.message);
        
        if (retries > 0) {
            const delay = NewsHubUtils?.API_CONFIG?.RETRY_DELAY || 2000;
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchNewsWithRetry(retries - 1);
        }
        throw error;
    }
}

function fetchNewsInBackground() {
    console.log('🔄 Fetching news in background...');
    fetchNewsWithRetry()
        .then(data => {
            if (data.articles && data.articles.length > 0) {
                State.articles = data.articles;
                if (NewsHubUtils?.StorageUtils?.setWithExpiry) {
                    NewsHubUtils.StorageUtils.setWithExpiry(
                        'news_cache', 
                        State.articles, 
                        NewsHubUtils.API_CONFIG.CACHE_DURATION
                    );
                }
                console.log('✅ Background fetch successful');
            }
        })
        .catch(err => console.error('❌ Background fetch failed:', err));
}

// ========================================
// FILTERING & DISPLAY
// ========================================
function filterAndDisplayArticles() {
    console.log('FilterWhere articles...');
    
    // Filter by category
    let filtered = [...State.articles];
    console.log('📋 Articles before filtering:', filtered.length);
    
    if (State.currentCategory !== 'all') {
        filtered = filtered.filter(article => 
            article.category?.toLowerCase() === State.currentCategory
        );
    }
    
    // Filter by search term
    if (State.searchTerm) {
        const term = State.searchTerm.toLowerCase();
        filtered = filtered.filter(article => 
            article.title?.toLowerCase().includes(term) ||
            article.summary?.toLowerCase().includes(term) ||
            article.source?.name?.toLowerCase().includes(term)
        );
    }
    
    State.filteredArticles = filtered;
    console.log('✅ Articles after filtering:', State.filteredArticles.length);
    
    // Display articles
    displayArticles();
    
    // Update article count
    if (DOM.articleCount) {
        DOM.articleCount.textContent = `${State.filteredArticles.length} articles`;
    }
    
    // Show/hide hero section
    updateHeroSection();
}

function displayArticles() {
    console.log('📺 Displaying articles...', State.filteredArticles.length);
    
    if (State.filteredArticles.length === 0) {
        console.log('⚠️ No articles to display');
        showNoResults();
        return;
    }
    
    // Hide skeleton loader
    if (DOM.skeletonLoader) {
        DOM.skeletonLoader.style.display = 'none';
        console.log('👻 Skeleton loader hidden');
    }
    
    // Clear news container
    if (DOM.newsContainer) {
        DOM.newsContainer.innerHTML = '';
        DOM.newsContainer.style.display = 'grid';
        console.log('🧹 News container cleared');
    }
    
    // Create article cards
    State.filteredArticles.forEach((article, index) => {
        try {
            const card = createArticleCard(article, index);
            if (DOM.newsContainer && card) {
                DOM.newsContainer.appendChild(card);
            }
        } catch (error) {
            console.error('❌ Error creating card for article', index, ':', error);
        }
    });
    
    console.log('✅ Articles displayed successfully');
}

function createArticleCard(article, index) {
    try {
        const isFeatured = index === 0 && State.currentCategory === 'all';
        const isBookmarked = State.bookmarks.some(bm => bm.url === article.url);
        
        // Sanitize data
        const title = NewsHubUtils?.SecurityUtils?.sanitizeHtml(article.title) || 'No title';
        const summary = NewsHubUtils?.SecurityUtils?.sanitizeHtml(article.summary || 'No summary available');
        const url = NewsHubUtils?.SecurityUtils?.sanitizeUrl(article.url) || '#';
        
        // Fix image URL (remove spaces, handle null)
        let imageUrl = article.image;
        if (!imageUrl || imageUrl.trim() === '') {
            imageUrl = 'https://via.placeholder.com/400x225?text=No+Image';
        } else {
            // Remove spaces and trim
            imageUrl = imageUrl.trim().replace(/\s+/g, '%20');
        }
        
        const source = NewsHubUtils?.SecurityUtils?.sanitizeHtml(article.source?.name || 'Unknown');
        const publishedAt = NewsHubUtils?.DateUtils?.formatDate(article.publishedAt) || 'Unknown date';
        const readTime = NewsHubUtils?.DateUtils?.getReadTime(summary) || 'Unknown read time';
        
        // Create card element
        const card = document.createElement('div');
        card.className = `news-card ${isFeatured ? 'featured' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x225?text=Image+Error'">
                <div class="image-overlay">
                    <span class="source">
                        <i class="fas fa-circle-dot"></i>
                        ${source}
                    </span>
                </div>
                ${isFeatured ? `
                    <div class="absolute top-3 left-3">
                        <span class="badge badge-breaking">
                            <i class="fas fa-bolt mr-1"></i>
                            BREAKING
                        </span>
                    </div>
                ` : ''}
            </div>
            <div class="card-content">
                <h3>${title}</h3>
                <p>${summary}</p>
                <div class="card-meta">
                    <div class="card-meta-left">
                        <span>
                            <i class="far fa-clock"></i>
                            ${publishedAt}
                        </span>
                        <span>
                            <i class="far fa-clock"></i>
                            ${readTime}
                        </span>
                    </div>
                    <div class="card-meta-right">
                        <button class="action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
                                title="${isBookmarked ? 'Remove bookmark' : 'Bookmark article'}"
                                data-url="${url}">
                            <i class="fas ${isBookmarked ? 'fa-bookmark' : 'fa-bookmark'}"></i>
                        </button>
                    </div>
                </div>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-btn">
                    Read Full Story
                    <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        `;
        
        // Add event listeners
        const bookmarkBtn = card.querySelector('.bookmark-btn');
        if (bookmarkBtn) {
            bookmarkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleBookmark(article, bookmarkBtn);
            });
        }
        
        return card;
        
    } catch (error) {
        console.error('❌ Error in createArticleCard:', error);
        return null;
    }
}

// ========================================
// HERO SECTION
// ========================================
function updateHeroSection() {
    if (State.filteredArticles.length > 0 && State.currentCategory === 'all') {
        const heroArticle = State.filteredArticles[0];
        
        if (DOM.heroTitle) DOM.heroTitle.textContent = heroArticle.title || 'No title';
        if (DOM.heroSummary) DOM.heroSummary.textContent = heroArticle.summary || 'No summary available';
        if (DOM.heroLink) DOM.heroLink.href = heroArticle.url || '#';
        
        if (DOM.heroSection) {
            DOM.heroSection.style.display = 'block';
        }
    } else {
        if (DOM.heroSection) {
            DOM.heroSection.style.display = 'none';
        }
    }
}

// ========================================
// BOOKMARKS
// ========================================
function toggleBookmark(article, button) {
    const isBookmarked = State.bookmarks.some(bm => bm.url === article.url);
    
    if (isBookmarked) {
        // Remove bookmark
        State.bookmarks = State.bookmarks.filter(bm => bm.url !== article.url);
        button.classList.remove('bookmarked');
        button.innerHTML = '<i class="fas fa-bookmark"></i>';
        showToast('Removed from bookmarks', 'success');
    } else {
        // Add bookmark
        State.bookmarks.push({
            title: article.title,
            url: article.url,
            source: article.source?.name,
            bookmarkedAt: new Date().toISOString()
        });
        button.classList.add('bookmarked');
        button.innerHTML = '<i class="fas fa-bookmark"></i>';
        showToast('Added to bookmarks', 'success');
    }
    
    // Save to localStorage
    localStorage.setItem('news_bookmarks', JSON.stringify(State.bookmarks));
}

// ========================================
// SEARCH & CATEGORIES
// ========================================
function handleSearch(e) {
    State.searchTerm = e.target.value.trim();
    State.currentPage = 1;
    console.log('🔍 Search term:', State.searchTerm);
    filterAndDisplayArticles();
}

function toggleMobileSearch() {
    if (DOM.mobileSearch) {
        DOM.mobileSearch.classList.toggle('hidden');
        if (!DOM.mobileSearch.classList.contains('hidden') && DOM.mobileSearchInput) {
            DOM.mobileSearchInput.focus();
        }
    }
}

function selectCategory(category) {
    console.log('🏷️ Selecting category:', category);
    
    // Update active button
    if (DOM.categoryBtns) {
        DOM.categoryBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
    }
    
    State.currentCategory = category;
    State.searchTerm = '';
    if (DOM.searchInput) DOM.searchInput.value = '';
    if (DOM.mobileSearchInput) DOM.mobileSearchInput.value = '';
    State.currentPage = 1;
    
    filterAndDisplayArticles();
}

// ========================================
// UI STATES
// ========================================
function showLoading() {
    State.isLoading = true;
    
    if (DOM.loadingOverlay) {
        DOM.loadingOverlay.style.display = 'flex';
    }
    
    if (DOM.skeletonLoader) {
        DOM.skeletonLoader.style.display = 'grid';
    }
    
    if (DOM.newsContainer) {
        DOM.newsContainer.style.display = 'none';
    }
    
    if (DOM.errorContainer) {
        DOM.errorContainer.style.display = 'none';
    }
    
    console.log('⏳ Loading state activated');
}

function hideLoading() {
    State.isLoading = false;
    
    setTimeout(() => {
        if (DOM.loadingOverlay) {
            DOM.loadingOverlay.style.display = 'none';
        }
    }, 300);
    
    console.log('✅ Loading state deactivated');
}

function showError(message) {
    if (DOM.errorContainer) {
        DOM.errorContainer.style.display = 'block';
    }
    
    if (DOM.errorMessage) {
        DOM.errorMessage.textContent = message || 'Failed to load news. Please try again.';
    }
    
    if (DOM.skeletonLoader) {
        DOM.skeletonLoader.style.display = 'none';
    }
    
    if (DOM.newsContainer) {
        DOM.newsContainer.style.display = 'none';
    }
    
    console.log('❌ Error displayed:', message);
}

function hideError() {
    if (DOM.errorContainer) {
        DOM.errorContainer.style.display = 'none';
    }
}

function showNoResults() {
    if (DOM.newsContainer) {
        DOM.newsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-newspaper text-6xl text-gray-400 dark:text-gray-600 mb-4"></i>
                <h3 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">No articles found</h3>
                <p class="text-gray-600 dark:text-gray-400">Try adjusting your search or selecting a different category.</p>
            </div>
        `;
        DOM.newsContainer.style.display = 'grid';
    }
    
    if (DOM.skeletonLoader) {
        DOM.skeletonLoader.style.display = 'none';
    }
    
    console.log('⚠️ No results shown');
}

// ========================================
// SCROLL HANDLING
// ========================================
function handleScroll() {
    // Back to top button
    if (DOM.backToTopBtn) {
        if (window.scrollY > 300) {
            DOM.backToTopBtn.style.opacity = '1';
            DOM.backToTopBtn.style.visibility = 'visible';
        } else {
            DOM.backToTopBtn.style.opacity = '0';
            DOM.backToTopBtn.style.visibility = 'hidden';
        }
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function setupScrollMonitoring() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        
        const header = document.querySelector('header');
        if (header) {
            if (currentScroll > lastScroll && currentScroll > 100) {
                // Scrolling down
                header.style.transform = 'translateY(-100%)';
            } else {
                // Scrolling up
                header.style.transform = 'translateY(0)';
            }
        }
        
        lastScroll = currentScroll;
    });
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.background = type === 'success' ? 'white' : '#fee';
    toast.style.color = type === 'success' ? '#1e293b' : '#dc2626';
    toast.style.padding = '16px 24px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.transform = 'translateX(400px)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';
    toast.style.zIndex = '1000';
    toast.style.borderLeft = type === 'success' ? '4px solid #10b981' : '4px solid #ef4444';
    
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="font-size: 1.25rem;"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 100);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3300);
}

// ========================================
// RESPONSIVE HANDLING
// ========================================
function handleResize() {
    // Adjust grid columns based on screen width
    const width = window.innerWidth;
    if (width < 768) {
        State.articlesPerPage = 6;
    } else if (width < 1024) {
        State.articlesPerPage = 9;
    } else {
        State.articlesPerPage = 12;
    }
}

// ========================================
// INITIALIZE APP
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    // Small delay for better UX
    setTimeout(init, 300);
});

// ========================================
// FALLBACK: If NewsHubUtils is not available
// ========================================
if (typeof NewsHubUtils === 'undefined') {
    console.warn('⚠️ NewsHubUtils not found, creating fallback...');
    
    window.NewsHubUtils = {
        API_CONFIG: {
            FULL_URL: 'https://news-aggregator-api.dhimanparas605.workers.dev/',
            CACHE_DURATION: 300000,
            MAX_RETRIES: 3,
            RETRY_DELAY: 2000
        },
        SecurityUtils: {
            sanitizeHtml: (text) => text || '',
            sanitizeUrl: (url) => url || '#'
        },
        DateUtils: {
            formatDate: (date) => {
                if (!date) return 'Unknown date';
                const d = new Date(date);
                const diffMins = Math.floor((new Date() - d) / 60000);
                if (diffMins < 60) return `${diffMins}m ago`;
                const diffHours = Math.floor(diffMins / 60);
                if (diffHours < 24) return `${diffHours}h ago`;
                return d.toLocaleDateString();
            },
            getReadTime: (text) => {
                const words = text?.trim().split(/\s+/).length || 0;
                const mins = Math.ceil(words / 200);
                return mins === 1 ? '1 min read' : `${mins} min read`;
            }
        },
        StorageUtils: {
            setWithExpiry: (key, value, ttl) => {
                const item = {
                    value: value,
                    expiry: Date.now() + ttl
                };
                localStorage.setItem(key, JSON.stringify(item));
            },
            getWithExpiry: (key) => {
                const itemStr = localStorage.getItem(key);
                if (!itemStr) return null;
                const item = JSON.parse(itemStr);
                if (Date.now() > item.expiry) {
                    localStorage.removeItem(key);
                    return null;
                }
                return item.value;
            },
            clearExpired: () => {
                Object.keys(localStorage).forEach(key => {
                    try {
                        const item = JSON.parse(localStorage.getItem(key));
                        if (item.expiry && Date.now() > item.expiry) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                  
                    }
                });
            }
        }
    };
    
    console.log('✅ Fallback NewsHubUtils created');
}
