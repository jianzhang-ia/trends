// =============================================================================
// Trend Alert - Frontend Application
// =============================================================================

const DATA_URL = 'data/alerts.json';
const ITEMS_PER_PAGE = 20;

// State
let allTopics = [];
let filteredTopics = [];
let currentPage = 1;
let currentFilter = 'all';
let currentSort = 'trending';
let searchQuery = '';

// DOM Elements
const topicsList = document.getElementById('topicsList');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadMoreCount = document.getElementById('loadMoreCount');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const filterPills = document.getElementById('filterPills');

// Stats elements
const statScanned = document.getElementById('statScanned');
const statTopics = document.getElementById('statTopics');
const statTrending = document.getElementById('statTrending');
const statNew = document.getElementById('statNew');
const lastUpdated = document.getElementById('lastUpdated');

// =============================================================================
// Theme Toggle
// =============================================================================
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.theme = savedTheme;

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.dataset.theme;
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('theme', next);
    });
}

// =============================================================================
// Data Loading
// =============================================================================
async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Update stats
        updateStats(data.stats);

        // Generate filter pills dynamically
        generateFilterPills(data.stats.by_type || {});

        // Store topics
        allTopics = data.topics || [];

        // Update last updated
        if (data.generated_at) {
            const date = new Date(data.generated_at);
            lastUpdated.textContent = formatDate(date);
        }

        // Initial render
        applyFilters();

    } catch (error) {
        console.error('Error loading data:', error);
        showError('Unable to load data. Please run the backend pipeline first.');
    }
}

function generateFilterPills(byType) {
    // Sort by count descending, but keep "Other" at the end
    const sorted = Object.entries(byType)
        .sort((a, b) => {
            if (a[0] === 'Other') return 1;
            if (b[0] === 'Other') return -1;
            return b[1] - a[1];
        });

    // Build pills HTML
    let html = '<button class="filter-pill active" data-filter="all">All</button>';
    for (const [type, count] of sorted) {
        html += `<button class="filter-pill" data-filter="${type}">${type} <span style="opacity: 0.7; font-size: 0.75em; margin-left: 2px;">${count}</span></button>`;
    }

    filterPills.innerHTML = html;
}

function updateStats(stats) {
    statScanned.textContent = formatNumber(stats.screened_items || 0);
    statTopics.textContent = formatNumber(stats.total_topics || 0);
    statTrending.textContent = formatNumber(stats.trending_topics || 0);
    statNew.textContent = formatNumber(stats.new_policies || 0);
}

function showError(message) {
    topicsList.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">⚠️</span>
            <p class="empty-text">${message}</p>
        </div>
    `;
}

// =============================================================================
// Filtering & Sorting
// =============================================================================
function applyFilters() {
    // Filter by type
    let topics = allTopics;

    if (currentFilter !== 'all') {
        topics = topics.filter(t => t.policy_type === currentFilter);
    }

    // Filter by search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        topics = topics.filter(t => {
            const labelMatch = t.label.toLowerCase().includes(query);
            const entityMatch = t.key_entities.some(e =>
                e.toLowerCase().includes(query)
            );
            return labelMatch || entityMatch;
        });
    }

    // Sort
    if (currentSort === 'trending') {
        topics.sort((a, b) => b.article_count - a.article_count);
    } else if (currentSort === 'recent') {
        topics.sort((a, b) => {
            const dateA = a.latest_date || '';
            const dateB = b.latest_date || '';
            return dateB.localeCompare(dateA);
        });
    }

    filteredTopics = topics;
    currentPage = 1;

    renderTopics();
}

// =============================================================================
// Rendering
// =============================================================================
function renderTopics() {
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const topicsToShow = filteredTopics.slice(0, endIndex);
    const hasMore = endIndex < filteredTopics.length;

    if (topicsToShow.length === 0) {
        topicsList.innerHTML = '';
        emptyState.style.display = 'block';
        loadMoreContainer.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';

    topicsList.innerHTML = topicsToShow.map(topic => renderTopicCard(topic)).join('');

    // Update load more
    if (hasMore) {
        loadMoreContainer.style.display = 'block';
        const remaining = filteredTopics.length - endIndex;
        loadMoreCount.textContent = `(${remaining} more)`;
    } else {
        loadMoreContainer.style.display = 'none';
    }

    // Add click handlers for expand
    document.querySelectorAll('.topic-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't toggle if clicking a link or show-more button
            if (e.target.closest('a')) return;
            if (e.target.closest('.show-more-btn')) return;
            card.classList.toggle('expanded');
        });
    });
}

function renderTopicCard(topic) {
    const badges = [];

    if (topic.is_trending) {
        badges.push('<span class="badge badge-trending"><svg class="sf-icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.3.9.7 1.8 1.5 2.8z"/></svg> Trending</span>');
    }

    if (topic.is_new_policy) {
        badges.push('<span class="badge badge-new"><svg class="sf-icon" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> New</span>');
    }

    if (topic.policy_type) {
        badges.push(`<span class="badge badge-type" data-type="${topic.policy_type}">${topic.policy_type}</span>`);
    }

    const entities = topic.key_entities.slice(0, 5)
        .filter(e => e && e.length > 1)  // Filter out single chars
        .map(e => `<span class="entity-tag">${escapeHtml(e)}</span>`)
        .join('');

    const visibleCount = 5;
    const articles = topic.articles.map((a, index) => `
        <div class="article-item ${index >= visibleCount ? 'hidden' : ''}">
            <a href="${escapeHtml(a.url)}" class="article-title" target="_blank" rel="noopener">
                ${escapeHtml(a.title)}
            </a>
            <div class="article-meta">
                ${escapeHtml(a.source)} • ${formatDate(new Date(a.date))}
            </div>
            ${a.summary ? `
                <div class="article-summary">
                    <strong>Why flagged:</strong> ${escapeHtml(a.summary)}
                </div>
            ` : ''}
        </div>
    `).join('');

    return `
        <div class="topic-card ${topic.is_new_policy ? 'new-policy' : ''}" data-type="${topic.policy_type || ''}">
            <div class="topic-header">
                <div class="topic-badges">${badges.join('')}</div>
                <div class="article-count">
                    <strong>${topic.article_count}</strong> articles
                </div>
            </div>
            <h3 class="topic-title">${escapeHtml(topic.label)}</h3>
            <div class="topic-meta">
                Latest: ${formatDate(new Date(topic.latest_date))}
            </div>
            <div class="topic-entities">${entities}</div>
            <button class="expand-toggle">
                <svg class="sf-icon" viewBox="0 0 24 24" style="width:1em;height:1em"><path d="m6 9 6 6 6-6"/></svg> View ${topic.article_count} articles
            </button>
            <div class="topic-articles">
                <div class="topic-articles-inner">
                    ${articles}
                    ${topic.articles.length > visibleCount ? `
                        <div class="show-more-wrapper">
                            <button class="show-more-btn">
                                + ${topic.articles.length - visibleCount} more articles
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// =============================================================================
// Event Handlers
// =============================================================================
function initEventHandlers() {
    // Filter pills
    filterPills.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill')) {
            // Update active state
            filterPills.querySelectorAll('.filter-pill').forEach(pill => {
                pill.classList.remove('active');
            });
            e.target.classList.add('active');

            // Apply filter
            currentFilter = e.target.dataset.filter;
            applyFilters();
        }
    });

    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            applyFilters();
        });
    });

    // Search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.trim();
            applyFilters();
        }, 300);
    });

    // Load more
    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        renderTopics();
    });

    // Show more articles button delegate
    topicsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('show-more-btn')) {
            e.stopPropagation(); // prevent card collapse
            const wrapper = e.target.closest('.show-more-wrapper');
            const card = wrapper.closest('.topic-card');

            // Show all hidden articles in this card
            card.querySelectorAll('.article-item.hidden').forEach(el => {
                el.classList.remove('hidden');
            });

            // Remove the button
            wrapper.remove();
        }
    });
}

// =============================================================================
// Utilities
// =============================================================================
function formatNumber(num) {
    return num.toLocaleString();
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '--';

    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================================================
// Initialize
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventHandlers();
    loadData();
});
