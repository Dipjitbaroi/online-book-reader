// Global variables
let allBooks = [];
let filteredBooks = [];
let currentPage = 1;
let booksPerPage = 32;
let currentApiPage = 1;
let totalApiPages = 1;
let isLoading = false;
let currentGenre = '';
let currentSearch = '';
let wishlist = [];
let lastPage = 'home';
let searchTimeout = null;

// API Configuration
const API_BASE_URL = 'https://gutendex.com/books/';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let booksCache = new Map();

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Online Book Reader...');
    
    // Load data from localStorage
    loadWishlist();
    loadPreferences();
    
    // Fetch initial books
    await fetchBooks();
    
    // Update UI
    updateGenreFilter();
    restoreFilterState();
    
    // Apply initial filters if any
    if (currentSearch || currentGenre) {
        filterBooks();
    }
    
    console.log('Application initialized successfully!');
}

/**
 * Load wishlist from localStorage
 */
function loadWishlist() {
    try {
        const saved = localStorage.getItem('bookWishlist');
        if (saved) {
            wishlist = JSON.parse(saved);
            console.log(`Loaded ${wishlist.length} books from wishlist`);
        }
    } catch (error) {
        console.error('Error loading wishlist:', error);
        wishlist = [];
    }
}

/**
 * Save wishlist to localStorage
 */
function saveWishlist() {
    try {
        localStorage.setItem('bookWishlist', JSON.stringify(wishlist));
        console.log('Wishlist saved successfully');
    } catch (error) {
        console.error('Error saving wishlist:', error);
    }
}

/**
 * Load search and filter preferences
 */
function loadPreferences() {
    try {
        const savedSearch = localStorage.getItem('lastSearch');
        const savedGenre = localStorage.getItem('lastGenre');
        const savedPageSize = localStorage.getItem('booksPerPage');
        
        if (savedSearch) {
            currentSearch = savedSearch;
        }
        
        if (savedGenre) {
            currentGenre = savedGenre;
        }
        
        if (savedPageSize) {
            booksPerPage = parseInt(savedPageSize);
        }
        
        console.log('Preferences loaded');
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

/**
 * Save search and filter preferences
 */
function savePreferences() {
    try {
        localStorage.setItem('lastSearch', currentSearch);
        localStorage.setItem('lastGenre', currentGenre);
        localStorage.setItem('booksPerPage', booksPerPage.toString());
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

/**
 * Restore filter state in UI
 */
function restoreFilterState() {
    const searchInput = document.getElementById('search-input');
    const genreFilter = document.getElementById('genre-filter');
    const pageSelect = document.getElementById('page-select');
    
    if (searchInput && currentSearch) {
        searchInput.value = currentSearch;
    }
    
    if (genreFilter && currentGenre) {
        genreFilter.value = currentGenre;
    }
    
    if (pageSelect) {
        pageSelect.value = booksPerPage.toString();
    }
}

/**
 * Fetch books from API with caching
 */
async function fetchBooks() {
    if (isLoading) return;
    
    const cacheKey = `books_page_${currentApiPage}`;
    const cached = booksCache.get(cacheKey);
    
    // Check if we have valid cached data
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('Using cached data for page', currentApiPage);
        
        if (currentApiPage === 1) {
            allBooks = cached.data.results;
        } else {
            allBooks = [...allBooks, ...cached.data.results];
        }
        
        totalApiPages = Math.ceil(cached.data.count / 32);
        filterBooks();
        return;
    }
    
    isLoading = true;
    showLoading(true);

    try {
        console.log('Fetching books from API, page:', currentApiPage);
        
        const response = await fetch(`${API_BASE_URL}?page=${currentApiPage}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache the response
        booksCache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
        
        if (currentApiPage === 1) {
            allBooks = data.results;
        } else {
            allBooks = [...allBooks, ...data.results];
        }
        
        totalApiPages = Math.ceil(data.count / 32);
        
        console.log(`Loaded ${data.results.length} books. Total: ${allBooks.length}`);
        
        filterBooks();
        
    } catch (error) {
        console.error('Error fetching books:', error);
        showError('Failed to load books. Please check your connection and try again.');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    const booksGrid = document.getElementById('books-grid');
    const noResults = document.getElementById('no-results');
    const pagination = document.getElementById('pagination');

    if (show) {
        loading.style.display = 'block';
        booksGrid.style.display = 'none';
        noResults.style.display = 'none';
        pagination.style.display = 'none';
    } else {
        loading.style.display = 'none';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `<p style="color: #ff6b6b;">❌ ${message}</p>`;
    loading.style.display = 'block';
}

/**
 * Update genre filter options
 */
function updateGenreFilter() {
    const genres = new Set();
    
    allBooks.forEach(book => {
        book.subjects.forEach(subject => {
            // Clean up the genre name
            const cleanGenre = subject.split(' -- ')[0].trim();
            if (cleanGenre.length < 50 && cleanGenre.length > 0) {
                genres.add(cleanGenre);
            }
        });
    });

    const genreFilter = document.getElementById('genre-filter');
    const currentValue = genreFilter.value;
    
    // Clear existing options except "All Genres"
    genreFilter.innerHTML = '<option value="">All Genres</option>';
    
    // Sort genres alphabetically and add them
    Array.from(genres).sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
    
    // Restore selected value
    genreFilter.value = currentValue;
    
    console.log(`Updated genre filter with ${genres.size} genres`);
}

/**
 * Filter books based on search and genre
 */
function filterBooks() {
    const searchTerm = currentSearch.toLowerCase().trim();
    
    filteredBooks = allBooks.filter(book => {
        // Search filter
        const matchesSearch = !searchTerm || 
            book.title.toLowerCase().includes(searchTerm) ||
            book.authors.some(author => 
                author.name.toLowerCase().includes(searchTerm)
            );
        
        // Genre filter
        const matchesGenre = !currentGenre || 
            book.subjects.some(subject => 
                subject.toLowerCase().startsWith(currentGenre.toLowerCase())
            );
        
        return matchesSearch && matchesGenre;
    });

    console.log(`Filtered to ${filteredBooks.length} books`);
    
    currentPage = 1;
    displayBooks();
    updatePagination();
    savePreferences();
}

/**
 * Display books in the grid
 */
function displayBooks() {
    const grid = document.getElementById('books-grid');
    const noResults = document.getElementById('no-results');
    const pagination = document.getElementById('pagination');
    
    const startIndex = (currentPage - 1) * booksPerPage;
    const endIndex = startIndex + booksPerPage;
    const booksToShow = filteredBooks.slice(startIndex, endIndex);

    if (booksToShow.length === 0) {
        grid.style.display = 'none';
        pagination.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';
    grid.style.display = 'grid';
    pagination.style.display = 'flex';

    grid.innerHTML = booksToShow.map((book, index) => {
        const author = book.authors.length > 0 ? book.authors[0].name : 'Unknown Author';
        const genre = book.subjects.length > 0 ? 
            book.subjects[0].split(' -- ')[0] : 'General';
        const coverImage = book.formats['image/jpeg'] || 
            'https://via.placeholder.com/300x400/667eea/ffffff?text=No+Cover';
        const isWishlisted = wishlist.some(w => w.id === book.id);

        return `
            <div class="book-card" 
                 style="animation-delay: ${index * 0.1}s" 
                 onclick="showBookDetail(${book.id})"
                 role="button"
                 tabindex="0"
                 onkeypress="handleCardKeyPress(event, ${book.id})"
                 aria-label="View details for ${book.title}">
                <img src="${coverImage}" 
                     alt="Cover of ${book.title}" 
                     class="book-image" 
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x400/667eea/ffffff?text=No+Cover'">
                <div class="book-info">
                    <h3 class="book-title">${escapeHtml(book.title)}</h3>
                    <p class="book-author">by ${escapeHtml(author)}</p>
                    <span class="book-genre" title="${escapeHtml(genre)}">${escapeHtml(genre)}</span>
                    <div class="book-actions">
                        <button class="read-btn" 
                                onclick="event.stopPropagation(); showBookDetail(${book.id})"
                                aria-label="Read more about ${book.title}">
                            Read More
                        </button>
                        <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                                onclick="event.stopPropagation(); toggleWishlist(${book.id})" 
                                title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
                                aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">
                            ${isWishlisted ? '♥' : '♡'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Handle keyboard navigation for book cards
 */
function handleCardKeyPress(event, bookId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showBookDetail(bookId);
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update pagination controls
 */
function updatePagination() {
    const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    let paginationHTML = `
        <button class="pagination-btn" 
                onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}
                aria-label="Previous page">
            ← Previous
        </button>
    `;

    // Calculate page range to show
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // First page and ellipsis
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span>...</span>`;
        }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                    onclick="changePage(${i})"
                    aria-label="Page ${i}"
                    ${i === currentPage ? 'aria-current="page"' : ''}>
                ${i}
            </button>
        `;
    }

    // Last page and ellipsis
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span>...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    paginationHTML += `
        <button class="pagination-btn" 
                onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}
                aria-label="Next page">
            Next →
        </button>
    `;

    pagination.innerHTML = paginationHTML;
}

/**
 * Change to a specific page
 */
function changePage(page) {
    const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
    if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        displayBooks();
        updatePagination();
        
        // Smooth scroll to top
        window.scrollTo({ 
            top: 0, 
            behavior: 'smooth' 
        });
        
        console.log(`Changed to page ${page}`);
    }
}

/**
 * Handle search input with debouncing
 */
function handleSearch() {
    const searchValue = document.getElementById('search-input').value;
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Debounce search for better performance
    searchTimeout = setTimeout(() => {
        currentSearch = searchValue;
        filterBooks();
        console.log('Search performed:', currentSearch);
    }, 300);
}

/**
 * Handle genre filter change
 */
function handleGenreFilter() {
    currentGenre = document.getElementById('genre-filter').value;
    filterBooks();
    console.log('Genre filter changed:', currentGenre);
}

/**
 * Handle page size selection
 */
function handlePageSelect() {
    booksPerPage = parseInt(document.getElementById('page-select').value);
    currentPage = 1;
    displayBooks();
    updatePagination();
    savePreferences();
    console.log('Page size changed:', booksPerPage);
}

/**
 * Toggle book in wishlist
 */
function toggleWishlist(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) {
        console.error('Book not found:', bookId);
        return;
    }

    const existingIndex = wishlist.findIndex(w => w.id === bookId);
    
    if (existingIndex >= 0) {
        wishlist.splice(existingIndex, 1);
        console.log('Removed from wishlist:', book.title);
    } else {
        wishlist.push(book);
        console.log('Added to wishlist:', book.title);
    }
    
    saveWishlist();
    
    // Update the current view
    const currentPageElement = document.querySelector('.page.active');
    if (currentPageElement.id === 'home-page') {
        displayBooks();
    } else if (currentPageElement.id === 'wishlist-page') {
        displayWishlist();
    } else if (currentPageElement.id === 'book-detail-page') {
        // Update wishlist button in detail view
        updateBookDetailWishlistButton(bookId);
    }
}

/**
 * Update wishlist button in book detail view
 */
function updateBookDetailWishlistButton(bookId) {
    const isWishlisted = wishlist.some(w => w.id === bookId);
    const wishlistBtn = document.querySelector('.book-detail .wishlist-btn');
    
    if (wishlistBtn) {
        wishlistBtn.innerHTML = isWishlisted ? '❤️' : '🤍';
        wishlistBtn.className = `wishlist-btn ${isWishlisted ? 'active' : ''}`;
        wishlistBtn.title = isWishlisted ? 'Remove from wishlist' : 'Add to wishlist';
    }
}

/**
 * Show specific page
 */
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected page
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update active nav link
    const activeLink = document.querySelector(`[onclick*="showPage('${pageName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    if (pageName === 'wishlist') {
        displayWishlist();
    }

    lastPage = pageName;
    console.log('Showing page:', pageName);
}

/**
 * Display wishlist page
 */
function displayWishlist() {
    const grid = document.getElementById('wishlist-grid');
    const emptyMessage = document.getElementById('wishlist-empty');

    if (wishlist.length === 0) {
        emptyMessage.style.display = 'block';
        grid.innerHTML = '';
        return;
    }

    emptyMessage.style.display = 'none';

    grid.innerHTML = wishlist.map((book, index) => {
        const author = book.authors.length > 0 ? book.authors[0].name : 'Unknown Author';
        const genre = book.subjects.length > 0 ? 
            book.subjects[0].split(' -- ')[0] : 'General';
        const coverImage = book.formats['image/jpeg'] || 
            'https://via.placeholder.com/300x400/667eea/ffffff?text=No+Cover';

        return `
            <div class="book-card" 
                 style="animation-delay: ${index * 0.1}s" 
                 onclick="showBookDetail(${book.id})"
                 role="button"
                 tabindex="0"
                 onkeypress="handleCardKeyPress(event, ${book.id})"
                 aria-label="View details for ${book.title}">
                <img src="${coverImage}" 
                     alt="Cover of ${book.title}" 
                     class="book-image" 
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/300x400/667eea/ffffff?text=No+Cover'">
                <div class="book-info">
                    <h3 class="book-title">${escapeHtml(book.title)}</h3>
                    <p class="book-author">by ${escapeHtml(author)}</p>
                    <span class="book-genre" title="${escapeHtml(genre)}">${escapeHtml(genre)}</span>
                    <div class="book-actions">
                        <button class="read-btn" 
                                onclick="event.stopPropagation(); showBookDetail(${book.id})"
                                aria-label="Read more about ${book.title}">
                            Read More
                        </button>
                        <button class="wishlist-btn active" 
                                onclick="event.stopPropagation(); toggleWishlist(${book.id})" 
                                title="Remove from wishlist"
                                aria-label="Remove from wishlist">
                            ♥
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    console.log(`Displayed ${wishlist.length} books in wishlist`);
}

/**
 * Show book detail page
 */
function showBookDetail(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) {
        console.error('Book not found:', bookId);
        return;
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show book detail page
    document.getElementById('book-detail-page').classList.add('active');

    const author = book.authors.length > 0 ? book.authors[0].name : 'Unknown Author';
    const authorDetails = book.authors.length > 0 && book.authors[0].birth_year ? 
        ` (${book.authors[0].birth_year}${book.authors[0].death_year ? `-${book.authors[0].death_year}` : ''})` : '';
    
    const coverImage = book.formats['image/jpeg'] || 
        'https://via.placeholder.com/300x400/667eea/ffffff?text=No+Cover';
    const summary = book.summaries && book.summaries.length > 0 ? 
        book.summaries[0] : 'No summary available for this book.';
    const isWishlisted = wishlist.some(w => w.id === book.id);

    // Prepare download links
    const downloadFormats = [
        { key: 'text/html', label: 'Read Online (HTML)', primary: true },
        { key: 'application/epub+zip', label: 'EPUB' },
        { key: 'application/x-mobipocket-ebook', label: 'Kindle' },
        { key: 'text/plain; charset=us-ascii', label: 'Plain Text' },
    ];

    const availableDownloads = downloadFormats
        .filter(format => book.formats[format.key])
        .map(format => 
            `<a href="${book.formats[format.key]}" target="_blank" 
                ${format.primary ? 'class="read-btn" style="text-decoration: none;"' : ''}
                aria-label="Download ${format.label}">
                ${format.label}
             </a>`
        ).join('');

    document.getElementById('book-detail-content').innerHTML = `
        <div class="book-detail-content">
            <img src="${coverImage}" 
                 alt="Cover of ${book.title}" 
                 class="book-detail-image"
                 onerror="this.src='https://via.placeholder.com/300x400/667eea/ffffff?text=No+Cover'">
            <div class="book-detail-info">
                <h1>${escapeHtml(book.title)}</h1>
                <p><strong>Author:</strong> ${escapeHtml(author)}${authorDetails}</p>
                <p><strong>Book ID:</strong> ${book.id}</p>
                <p><strong>Language:</strong> ${book.languages.join(', ').toUpperCase()}</p>
                <p><strong>Download Count:</strong> ${book.download_count.toLocaleString()}</p>
                <p><strong>Genres:</strong> ${book.subjects.slice(0, 5).map(s => escapeHtml(s.split(' -- ')[0])).join(', ')}</p>
                <p><strong>Copyright:</strong> ${book.copyright ? 'Yes' : 'No (Public Domain)'}</p>
                
                <div class="book-actions-detail">
                    <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                            onclick="toggleWishlist(${book.id})" 
                            style="font-size: 2rem;"
                            title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
                            aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">
                        ${isWishlisted ? '♥' : '♡'}
                    </button>
                    ${availableDownloads}
                </div>

                ${book.subjects.length > 5 ? `
                    <div class="download-links">
                        <h4>All Subjects:</h4>
                        <p>${book.subjects.map(s => escapeHtml(s)).join(', ')}</p>
                    </div>
                ` : ''}

                <div class="book-summary">
                    <h3>Summary</h3>
                    <p>${escapeHtml(summary)}</p>
                </div>
            </div>
        </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log('Showing book detail:', book.title);
}

/**
 * Go back to previous page
 */
function goBack() {
    showPage(lastPage);
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[onclick*="showPage('${lastPage}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    console.log('Going back to:', lastPage);
}

/**
 * Load more books if needed (infinite scroll could be added here)
 */
async function loadMoreBooks() {
    if (currentApiPage < totalApiPages && !isLoading) {
        currentApiPage++;
        await fetchBooks();
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
    // Escape key to go back
    if (event.key === 'Escape') {
        const currentPageElement = document.querySelector('.page.active');
        if (currentPageElement && currentPageElement.id === 'book-detail-page') {
            goBack();
        }
    }
    
    // Ctrl/Cmd + F to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keydown', handleKeyboardShortcuts);

// Error handling for global errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Expose some functions to global scope for onclick handlers
window.showPage = showPage;
window.showBookDetail = showBookDetail;
window.toggleWishlist = toggleWishlist;
window.changePage = changePage;
window.handleSearch = handleSearch;
window.handleGenreFilter = handleGenreFilter;
window.handlePageSelect = handlePageSelect;
window.goBack = goBack;
window.handleCardKeyPress = handleCardKeyPress;

console.log('Online Book Reader script loaded successfully!');