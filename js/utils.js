/**
 * NewsHub Pro - Utility Functions
 */
const API_CONFIG = (() => {
    const parts = [
        'aHR0cHM6Ly9uZXdzLWFnZ3JlZ2F0b3ItYXBp',  
        'LmRoaW1hbnBhcmFzNjA1LndvcmtlcnMuZGV2Lw=='  
    ];
    

    const decode = (str) => {
        try {
            return atob(str);
        } catch (e) {
            console.error('Base64 decode error:', e);
            return '';
        }
    };
    
    const url = decode(parts[0]) + decode(parts[1]);
    
    console.log('🔧 API URL decoded:', url);
    
    return {
        BASE_URL: url,
        ENDPOINT: '',
        FULL_URL: url,
        CACHE_DURATION: 5 * 60 * 1000,  
        MAX_RETRIES: 3,
        RETRY_DELAY: 2000
    };
})();

const SecurityUtils = {
    sanitizeHtml: function(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    
   
    sanitizeUrl: function(url) {
        if (!url) return '#';
        url = url.trim().replace(/\s+/g, '%20');
        try {
            const parsed = new URL(url);
            return parsed.href;
        } catch {
            return '#';
        }
    }
};

// ========================================
// DATE UTILITIES
// ========================================
const DateUtils = {
    // Format date to readable string
    formatDate: function(dateString) {
        if (!dateString) return 'Unknown date';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch (e) {
            console.error('Date format error:', e);
            return 'Unknown date';
        }
    },
    
    // Get time to read (based on word count)
    getReadTime: function(text) {
        if (!text) return 'Unknown read time';
        const wordsPerMinute = 200;
        const wordCount = text.trim().split(/\s+/).length;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return minutes === 1 ? '1 min read' : `${minutes} min read`;
    }
};

// ========================================
// STORAGE UTILITIES
// ========================================
const StorageUtils = {
    // Save to localStorage with expiration
    setWithExpiry: function(key, value, ttl) {
        const now = new Date();
        const item = {
            value: value,
            expiry: now.getTime() + ttl,
        };
        localStorage.setItem(key, JSON.stringify(item));
    },
    
    // Get from localStorage with expiration check
    getWithExpiry: function(key) {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;
        
        try {
            const item = JSON.parse(itemStr);
            const now = new Date();
            
            if (now.getTime() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            
            return item.value;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },
    

    clearExpired: function() {
        Object.keys(localStorage).forEach(key => {
            const itemStr = localStorage.getItem(key);
            try {
                const item = JSON.parse(itemStr);
                if (item.expiry && new Date().getTime() > item.expiry) {
                    localStorage.removeItem(key);
                }
            } catch {
            }
        });
    }
};

const Utils = {
    API_CONFIG,
    SecurityUtils,
    DateUtils,
    StorageUtils
};


window.NewsHubUtils = Utils;

console.log('✅ NewsHubUtils loaded successfully');
