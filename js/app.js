/**
 * NewsHub Pro - Main Application
 * Advanced news aggregator with modern features
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

function init() {
    setupEventListeners();
    initDarkMode();
    loadNews();
    setupScrollMonitoring();
    NewsHubUtils.StorageUtils.clearExpired();
}

function setupEventListeners() {
    DOM.retryBtn.addEventListener('click', () => {
        hideError();
        loadNews();
    });

    DOM.refreshBtn.addEventListener('click', () => {
        State.currentPage = 1;
        loadNews(true);
    });

    DOM.darkModeToggle.addEventListener('click', toggleDarkMode);

    DOM.searchInput.addEventListener('input', handleSearch);
    DOM.mobileSearchInput.addEventListener('input', handleSearch);

    DOM.mobileSearchBtn.addEventListener('click', toggleMobileSearch);
    DOM.categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            selectCategory(category);
        });
    });

    DOM.backToTopBtn.addEventListener('click', scrollToTop);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
}

function initDarkMode() {
    if (State.darkMode) {
        document.documentElement.classList.add('dark');
        DOM.themeIcon.className = 'fas fa-sun text-xl';
    }
}

function toggleDarkMode() {
    State.darkMode = !State.darkMode;
    document.documentElement.classList.toggle('dark');
    
    if (State.darkMode) {
        DOM.themeIcon.className = 'fas fa-sun text-xl';
    } else {
        DOM.themeIcon.className = 'fas fa-moon text-xl';
    }
    
    localStorage.setItem('dark_mode', State.darkMode);
    
    showToast(State.darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'success');
}

async function loadNews(forceRefresh = false) {
    showLoading();
    
    try {

        if (!forceRefresh) {
            const cached = NewsHubUtils.StorageUtils.getWithExpiry('news_cache');
            if (cached) {
                State.articles = cached;
                filterAndDisplayArticles();
                showToast('Loaded from cache', 'success');
                
              
                fetchNewsInBackground();
                return;
            }
        }
        
        
        const data = await fetchNewsWithRetry();
        State.articles = data.articles;
        
  
        NewsHubUtils.StorageUtils.setWithExpiry(
            'news_cache', 
            State.articles, 
            NewsHubUtils.API_CONFIG.CACHE_DURATION
        );
        
        filterAndDisplayArticles();
        hideLoading();
        
    } catch (error) {
        console.error('Error loading news:', error);
        State.error = error.message;
        showError(error.message);
        hideLoading();
    }
}

async function fetchNewsWithRetry(retries = NewsHubUtils.API_CONFIG.MAX_RETRIES) {
    try {
        const response = await fetch(NewsHubUtils.API_CONFIG.FULL_URL, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => 
                setTimeout(resolve, NewsHubUtils.API_CONFIG.RETRY_DELAY)
            );
            return fetchNewsWithRetry(retries - 1);
        }
        throw error;
    }
}

function fetchNewsInBackground() {
    fetchNewsWithRetry()
        .then(data => {
            State.articles = data.articles;
            NewsHubUtils.StorageUtils.setWithExpiry(
                'news_cache', 
                State.articles, 
                NewsHubUtils.API_CONFIG.CACHE_DURATION
            );
        })
        .catch(err => console.error('Background fetch failed:', err));
}

function filterAndDisplayArticles() {
    let filtered = State.articles;
    
    if (State.currentCategory !== 'all') {
        filtered = filtered.filter(article => 
            article.category?.toLowerCase() === State.currentCategory
        );
    }

    if (State.searchTerm) {
        const term = State.searchTerm.toLowerCase();
        filtered = filtered.filter(article => 
            article.title.toLowerCase().includes(term) ||
            article.summary.toLowerCase().includes(term) ||
            article.source?.name.toLowerCase().includes(term)
        );
    }
    
    State.filteredArticles = filtered;

    displayArticles();

    DOM.articleCount.textContent = `${State.filteredArticles.length} articles`;

    updateHeroSection();
}

function displayArticles() {
    if (State.filteredArticles.length === 0) {
        showNoResults();
        return;
    }
    
    DOM.newsContainer.innerHTML = '';
    DOM.skeletonLoader.style.display = 'none';

    State.filteredArticles.forEach((article, index) => {
        const card = createArticleCard(article, index);
        DOM.newsContainer.appendChild(card);
    });
}

function createArticleCard(article, index) {
    const isFeatured = index === 0 && State.currentCategory === 'all';
    const isBookmarked = State.bookmarks.some(bm => bm.url === article.url);
    
    const card = document.createElement('div');
    card.className = `news-card ${isFeatured ? 'featured' : ''} fade-in-up`;
    card.style.animationDelay = `${index * 0.1}s`;
    

    const title = NewsHubUtils.SecurityUtils.sanitizeHtml(article.title);
    const summary = NewsHubUtils.SecurityUtils.sanitizeHtml(article.summary || 'No summary available');
    const url = NewsHubUtils.SecurityUtils.sanitizeUrl(article.url);
    const imageUrl = article.image || 'https://via.placeholder.com/400x225?text=No+Image';
    const source = NewsHubUtils.SecurityUtils.sanitizeHtml(article.source?.name || 'Unknown');
    const publishedAt = NewsHubUtils.DateUtils.formatDate(article.publishedAt);
    const readTime = NewsHubUtils.DateUtils.getReadTime(summary);
    
    card.innerHTML = `
        <div class="card-image-wrapper">
            <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x225?text=Image+Unavailable'">
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
            <div class="share-menu">
                <button class="share-btn facebook" title="Share on Facebook">
                    <i class="fab fa-facebook-f"></i>
                </button>
                <button class="share-btn twitter" title="Share on Twitter">
                    <i class="fab fa-twitter"></i>
                </button>
                <button class="share-btn whatsapp" title="Share on WhatsApp">
                    <i class="fab fa-whatsapp"></i>
                </button>
            </div>
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
    const bookmarkBtn = card.querySelector('.bookmark-btn');
    bookmarkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(article, bookmarkBtn);
    });
    
    const shareButtons = card.querySelectorAll('.share-btn');
    shareButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleShare(e, article);
        });
    });
    
    return card;
}

function updateHeroSection() {
    if (State.filteredArticles.length > 0 && State.currentCategory === 'all') {
        const heroArticle = State.filteredArticles[0];
        
        DOM.heroTitle.textContent = heroArticle.title;
        DOM.heroSummary.textContent = heroArticle.summary || 'No summary available';
        DOM.heroLink.href = heroArticle.url;
        
        DOM.heroSection.style.display = 'block';
        DOM.heroSection.classList.add('fade-in-up');
    } else {
        DOM.heroSection.style.display = 'none';
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
        button.classList.add('bookmark-animate');
        setTimeout(() => button.classList.remove('bookmark-animate'), 500);
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
    DOM.mobileSearch.classList.toggle('hidden');
    if (!DOM.mobileSearch.classList.contains('hidden')) {
        DOM.mobileSearchInput.focus();
    }
}

function selectCategory(category) {

    DOM.categoryBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    State.currentCategory = category;
    State.searchTerm = '';
    DOM.searchInput.value = '';
    DOM.mobileSearchInput.value = '';
    State.currentPage = 1;
    
    filterAndDisplayArticles();
}

function showLoading() {
    State.isLoading = true;
    DOM.loadingOverlay.style.display = 'flex';
    DOM.skeletonLoader.style.display = 'grid';
    DOM.newsContainer.style.display = 'none';
    DOM.errorContainer.style.display = 'none';
}

function hideLoading() {
    State.isLoading = false;
    setTimeout(() => {
        DOM.loadingOverlay.style.display = 'none';
    }, 300);
}

function showError(message) {
    DOM.errorContainer.style.display = 'block';
    DOM.errorMessage.textContent = message || 'Failed to load news. Please try again.';
    DOM.skeletonLoader.style.display = 'none';
    DOM.newsContainer.style.display = 'none';
}

function hideError() {
    DOM.errorContainer.style.display = 'none';
}

function showNoResults() {
    DOM.newsContainer.innerHTML = `
        <div class="no-results">
            <i class="fas fa-newspaper"></i>
            <h3>No articles found</h3>
            <p>Try adjusting your search or selecting a different category.</p>
        </div>
    `;
    DOM.skeletonLoader.style.display = 'none';
}

function handleScroll() {
    if (window.scrollY > 300) {
        DOM.backToTopBtn.style.opacity = '1';
        DOM.backToTopBtn.style.visibility = 'visible';
    } else {
        DOM.backToTopBtn.style.opacity = '0';
        DOM.backToTopBtn.style.visibility = 'hidden';
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
        
        if (currentScroll > lastScroll && currentScroll > 100) {

            document.querySelector('header').style.transform = 'translateY(-100%)';
        } else {

            document.querySelector('header').style.transform = 'translateY(0)';
        }
        
        lastScroll = currentScroll;
    });
}

function handleShare(event, article) {
    const platform = event.currentTarget.classList[1]; 
    const title = encodeURIComponent(article.title);
    const url = encodeURIComponent(article.url);
    const text = encodeURIComponent(`${article.title} - Check this out!`);
    
    let shareUrl = '';
    
    switch(platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${text}%20${url}`;
            break;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
            break;
    }
    
    window.open(shareUrl, '_blank', 'width=550,height=400');
    showToast(`Shared on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, 'success');
}

function showToast(message, type = 'success') {

    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    setTimeout(init, 500);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}
