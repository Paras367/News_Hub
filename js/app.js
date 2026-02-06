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

function init() {
    if (!localStorage.getItem('cache_fixed_v3')) {
        localStorage.removeItem('news_cache');
        localStorage.setItem('cache_fixed_v3', 'true');
    }
    
    setupEventListeners();
    initDarkMode();
    loadNews();
    setupScrollMonitoring();
    
    if (NewsHubUtils?.StorageUtils?.clearExpired) {
        NewsHubUtils.StorageUtils.clearExpired();
    }
}

function setupEventListeners() {
    if (DOM.retryBtn) {
        DOM.retryBtn.addEventListener('click', () => {
            hideError();
            loadNews();
        });
    }
    
    if (DOM.refreshBtn) {
        DOM.refreshBtn.addEventListener('click', () => {
            State.currentPage = 1;
            loadNews(true);
        });
    }
    
    if (DOM.darkModeToggle) {
        DOM.darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', handleSearch);
    }
    if (DOM.mobileSearchInput) {
        DOM.mobileSearchInput.addEventListener('input', handleSearch);
    }
    
    if (DOM.mobileSearchBtn) {
        DOM.mobileSearchBtn.addEventListener('click', toggleMobileSearch);
    }
    
    if (DOM.categoryBtns) {
        DOM.categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                selectCategory(category);
            });
        });
    }
    
    if (DOM.backToTopBtn) {
        DOM.backToTopBtn.addEventListener('click', scrollToTop);
    }
    
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = newsletterForm.querySelector('.newsletter-input');
            const email = emailInput?.value.trim();
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                showToast('📧 Please enter a valid email address', 'error');
                emailInput?.focus();
                return;
            }
            
            const subscribers = JSON.parse(localStorage.getItem('nh_subscribers') || '[]');
            if (subscribers.includes(email)) {
                showToast('✅ You\'re already subscribed!', 'success');
                return;
            }
            
            subscribers.push(email);
            localStorage.setItem('nh_subscribers', JSON.stringify(subscribers));
            
            const btn = newsletterForm.querySelector('.newsletter-btn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Subscribed!';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            
            setTimeout(() => {
                emailInput.value = '';
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                showToast('🎉 Thank you for subscribing to NewsHub Pro!', 'success');
            }, 2500);
        });
    }
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
}

function initDarkMode() {
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
    showToast(State.darkMode ? '🌙 Dark mode enabled' : '☀️ Light mode enabled', 'success');
}

async function loadNews(forceRefresh = false) {
    showLoading();
    
    try {
        if (!forceRefresh && typeof NewsHubUtils !== 'undefined' && NewsHubUtils.StorageUtils) {
            const cached = NewsHubUtils.StorageUtils.getWithExpiry('news_cache');
            
            if (Array.isArray(cached) && cached.length > 0 && cached[0].title) {
                State.articles = cached;
                filterAndDisplayArticles();
                showToast('⚡ Loaded from cache', 'success');
                setTimeout(fetchNewsInBackground, 1000);
                hideLoading();
                return;
            }
        }
        
        const data = await fetchNewsWithRetry();
        
        if (!data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
            throw new Error('API returned no valid articles');
        }
        
        State.articles = data.articles;
        
        if (typeof NewsHubUtils !== 'undefined' && NewsHubUtils.StorageUtils) {
            NewsHubUtils.StorageUtils.setWithExpiry('news_cache', State.articles, NewsHubUtils.API_CONFIG.CACHE_DURATION);
        }
        
        filterAndDisplayArticles();
        hideLoading();
        showToast('✨ Latest news loaded', 'success');
        
    } catch (error) {
        State.error = error.message || 'Unknown error occurred';
        
        if (typeof NewsHubUtils !== 'undefined' && NewsHubUtils.StorageUtils) {
            const emergencyCache = NewsHubUtils.StorageUtils.getWithExpiry('news_cache');
            if (Array.isArray(emergencyCache) && emergencyCache.length > 0) {
                State.articles = emergencyCache;
                filterAndDisplayArticles();
                hideLoading();
                showToast('⚠️ Showing cached news (network issue)', 'warning');
                return;
            }
        }
        
        showError(State.error);
        hideLoading();
    }
}

async function fetchNewsWithRetry(retries = NewsHubUtils?.API_CONFIG?.MAX_RETRIES || 3) {
    try {
        const response = await fetch(NewsHubUtils?.API_CONFIG?.FULL_URL || 'https://news-aggregator-api.dhimanparas605.workers.dev/', {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, NewsHubUtils?.API_CONFIG?.RETRY_DELAY || 2000));
            return fetchNewsWithRetry(retries - 1);
        }
        throw error;
    }
}

function fetchNewsInBackground() {
    fetchNewsWithRetry()
        .then(data => {
            if (data.articles && data.articles.length > 0) {
                State.articles = data.articles;
                if (NewsHubUtils?.StorageUtils?.setWithExpiry) {
                    NewsHubUtils.StorageUtils.setWithExpiry('news_cache', State.articles, NewsHubUtils.API_CONFIG.CACHE_DURATION);
                }
            }
        })
        .catch(err => console.error('Background fetch failed:', err));
}

function filterAndDisplayArticles() {
    let filtered = [...State.articles];
    
    if (State.currentCategory !== 'all') {
        filtered = filtered.filter(article => article.category?.toLowerCase() === State.currentCategory);
    }
    
    if (State.searchTerm) {
        const term = State.searchTerm.toLowerCase();
        filtered = filtered.filter(article => 
            article.title?.toLowerCase().includes(term) ||
            article.summary?.toLowerCase().includes(term) ||
            article.source?.name?.toLowerCase().includes(term)
        );
    }
    
    State.filteredArticles = filtered;
    
    displayArticles();
    
    if (DOM.articleCount) {
        DOM.articleCount.textContent = `${State.filteredArticles.length} articles`;
    }
    
    updateHeroSection();
}

function displayArticles() {
    if (State.filteredArticles.length === 0) {
        showNoResults();
        return;
    }
    
    if (DOM.skeletonLoader) {
        DOM.skeletonLoader.style.display = 'none';
    }
    
    if (DOM.newsContainer) {
        DOM.newsContainer.innerHTML = '';
        DOM.newsContainer.style.display = 'grid';
    }
    
    State.filteredArticles.forEach((article, index) => {
        const card = createArticleCard(article, index);
        if (DOM.newsContainer && card) {
            DOM.newsContainer.appendChild(card);
        }
    });
}

function createArticleCard(article, index) {
    try {
        const isFeatured = index === 0 && State.currentCategory === 'all';
        const isBookmarked = State.bookmarks.some(bm => bm.url === article.url);
        
        const title = (NewsHubUtils?.SecurityUtils?.sanitizeHtml(article.title) || 'No title').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        const summary = (NewsHubUtils?.SecurityUtils?.sanitizeHtml(article.summary || 'No summary available') || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        let url = article.url || '#';
        try {
            url = new URL(url).href;
        } catch {
            url = '#';
        }
        
       let imageUrl = article.image;
if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '' || !imageUrl.trim().match(/^https?:\/\//i)) {
    imageUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjI1IiB2aWV3Qm94PSIwIDAgNDAwIDIyNSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2NjY2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
} else {
    try {
        imageUrl = new URL(imageUrl.trim()).href;
    } catch {
        imageUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjI1IiB2aWV3Qm94PSIwIDAgNDAwIDIyNSI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2NjY2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
    }
}
        
        const source = NewsHubUtils?.SecurityUtils?.sanitizeHtml(article.source?.name || 'Unknown') || 'Unknown';
        const publishedAt = NewsHubUtils?.DateUtils?.formatDate(article.publishedAt) || 'Unknown date';
        const readTime = NewsHubUtils?.DateUtils?.getReadTime(summary) || 'Unknown read time';
        
        const card = document.createElement('div');
        card.className = `news-card ${isFeatured ? 'featured' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;
        
        const badgeHtml = isFeatured ? 
            '<div class="absolute top-3 left-3"><span class="badge badge-breaking"><i class="fas fa-bolt mr-1"></i>BREAKING</span></div>' : 
            '';
        
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${imageUrl}" alt="${title}" loading="lazy">
                <div class="image-overlay">
                    <span class="source">
                        <i class="fas fa-circle-dot"></i>
                        ${source}
                    </span>
                </div>
                ${badgeHtml}
            </div>
            <div class="card-content">
                <h3>${title}</h3>
                <p>${summary}</p>
                <div class="card-meta">
                    <div class="card-meta-left">
                        <span><i class="far fa-clock"></i>${publishedAt}</span>
                        <span><i class="far fa-clock"></i>${readTime}</span>
                    </div>
                    <div class="card-meta-right">
                        <button class="action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-url="${url}">
                            <i class="fas fa-${isBookmarked ? 'bookmark' : 'bookmark'}"></i>
                        </button>
                    </div>
                </div>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="read-more-btn">
                    Read Full Story <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        `;
        
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
        console.error('Card creation failed:', error);
        return null;
    }
}

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

function toggleBookmark(article, button) {
    const isBookmarked = State.bookmarks.some(bm => bm.url === article.url);
    
    if (isBookmarked) {
        State.bookmarks = State.bookmarks.filter(bm => bm.url !== article.url);
        button.classList.remove('bookmarked');
        button.innerHTML = '<i class="fas fa-bookmark"></i>';
        showToast('Removed from bookmarks', 'success');
    } else {
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
    
    localStorage.setItem('news_bookmarks', JSON.stringify(State.bookmarks));
}

function handleSearch(e) {
    State.searchTerm = e.target.value.trim();
    State.currentPage = 1;
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
}

function hideLoading() {
    State.isLoading = false;
    
    setTimeout(() => {
        if (DOM.loadingOverlay) {
            DOM.loadingOverlay.style.display = 'none';
        }
    }, 300);
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
}

function hideError() {
    if (DOM.errorContainer) {
        DOM.errorContainer.style.display = 'none';
    }
}

function showNoResults() {
    if (DOM.newsContainer) {
        DOM.newsContainer.innerHTML = `
            <div class="no-results col-span-full">
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
}

function handleScroll() {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupScrollMonitoring() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        
        const header = document.querySelector('header');
        if (header) {
            if (currentScroll > lastScroll && currentScroll > 100) {
                header.style.transform = 'translateY(-100%)';
            } else {
                header.style.transform = 'translateY(0)';
            }
        }
        
        lastScroll = currentScroll;
    });
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'success' ? 'white' : '#fee',
        color: type === 'success' ? '#1e293b' : '#dc2626',
        padding: '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transform: 'translateX(400px)',
        opacity: '0',
        transition: 'all 0.3s ease',
        zIndex: '1000',
        borderLeft: type === 'success' ? '4px solid #10b981' : '4px solid #ef4444'
    });
    
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="font-size: 1.25rem;"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 100);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3300);
}

function handleResize() {
    const width = window.innerWidth;
    if (width < 768) {
        State.articlesPerPage = 6;
    } else if (width < 1024) {
        State.articlesPerPage = 9;
    } else {
        State.articlesPerPage = 12;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 300);
});

if (typeof NewsHubUtils === 'undefined') {
    window.NewsHubUtils = {
        API_CONFIG: {
            FULL_URL: 'https://news-aggregator-api.dhimanparas605.workers.dev/',
            CACHE_DURATION: 300000,
            MAX_RETRIES: 3,
            RETRY_DELAY: 2000
        },
        SecurityUtils: {
            sanitizeHtml: (text) => {
                if (!text) return '';
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            },
            sanitizeUrl: (url) => {
                if (!url) return '#';
                url = url.trim().replace(/\s+/g, '%20');
                try {
                    return new URL(url).href;
                } catch {
                    return '#';
                }
            }
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
                const item = { value: value, expiry: Date.now() + ttl };
                localStorage.setItem(key, JSON.stringify(item));
            },
            getWithExpiry: (key) => {
                const itemStr = localStorage.getItem(key);
                if (!itemStr) return null;
                try {
                    const item = JSON.parse(itemStr);
                    if (Date.now() > item.expiry) {
                        localStorage.removeItem(key);
                        return null;
                    }
                    return item.value;
                } catch (e) {
                    return null;
                }
            },
            clearExpired: () => {
                Object.keys(localStorage).forEach(key => {
                    const itemStr = localStorage.getItem(key);
                    try {
                        const item = JSON.parse(itemStr);
                        if (item.expiry && Date.now() > item.expiry) {
                            localStorage.removeItem(key);
                        }
                    } catch {
                    }
                });
            }
        }
    };
}
