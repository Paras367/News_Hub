
const API_CONFIG = (() => {

    const parts = [
        'aHR0cHM6Ly9uZXdzLWFnZ3JlZ2F0b3ItYXBp',
        'LmRoaW1hbnBhcmFzNjA1LndvcmtlcnMuZGV2Lw=='
    ];
    

    const decode = (str) => atob(str);
    const url = decode(parts[0]) + decode(parts[1]);
    
    return {
        BASE_URL: url,
        ENDPOINT: '',
        FULL_URL: url,
        CACHE_DURATION: 5 * 60 * 1000, 
        MAX_RETRIES: 3,
        RETRY_DELAY: 2000
    };
})();

const StringUtils = {
    caesarCipher: (str, shift = 3) => {
        return str.replace(/[a-z]/gi, char => {
            const code = char.charCodeAt(0);
            const base = char === char.toUpperCase() ? 65 : 97;
            return String.fromCharCode(((code - base + shift) % 26) + base);
        });
    },
    reverse: (str) => str.split('').reverse().join(''),
    clean: (str) => str.trim().replace(/\s+/g, ' ')
};


const DateUtils = {
    formatDate: (dateString) => {
        if (!dateString) return 'Unknown date';
        
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
    },
 
    getReadTime: (text) => {
        const wordsPerMinute = 200;
        const wordCount = text.trim().split(/\s+/).length;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return minutes === 1 ? '1 min read' : `${minutes} min read`;
    },
    formatTimestamp: (timestamp) => {
        return new Date(timestamp).toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};


const SecurityUtils = {

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
        try {
            const parsed = new URL(url);
            return parsed.href;
        } catch {
            return '#';
        }
    },

    removeScripts: (html) => {
        return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
};

const StorageUtils = {
    setWithExpiry: (key, value, ttl) => {
        const now = new Date();
        const item = {
            value: value,
            expiry: now.getTime() + ttl,
        };
        localStorage.setItem(key, JSON.stringify(item));
    },

    getWithExpiry: (key) => {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;
        
        const item = JSON.parse(itemStr);
        const now = new Date();
        
        if (now.getTime() > item.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        
        return item.value;
    },

    clearExpired: () => {
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

const ArrayUtils = {
 
    shuffle: (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },
    

    groupBy: (array, key) => {
        return array.reduce((result, item) => {
            const groupKey = item[key] || 'unknown';
            if (!result[groupKey]) {
                result[groupKey] = [];
            }
            result[groupKey].push(item);
            return result;
        }, {});
    },
    

    uniqueBy: (array, key) => {
        return [...new Map(array.map(item => [item[key], item])).values()];
    }
};


const NumberUtils = {
    formatLargeNumber: (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },
    
 
    randomInRange: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};


const Utils = {
    API_CONFIG,
    StringUtils,
    DateUtils,
    SecurityUtils,
    StorageUtils,
    ArrayUtils,
    NumberUtils
};

window.NewsHubUtils = Utils;
