    const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';
    const OPEN_LIBRARY_API = 'https://openlibrary.org/api/books';
    const OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json';
    const GOOGLE_BOOKS_VIEWER_API = 'https://www.google.com/books/jsapi.js';
    const MAX_RESULTS = 20;

    // DOM Elements
    const currentlyReadingShelf = document.getElementById('currentlyReading');
    const wantToReadShelf = document.getElementById('wantToRead');
    const recommendedBooks = document.getElementById('recommendedBooks');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const genreFilter = document.getElementById('genreFilter');

    // library shelves
    let library = {
        currentlyReading: [],
        wantToRead: [],
        completed: []
    };

    document.addEventListener('DOMContentLoaded', function() {
    
        // adding click event listener to search button
        searchButton.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent form submission
            const query = searchInput.value.trim();
            const genre = genreFilter.value;
            if (query || genre) {
                searchBooks(query, genre);
            }
        });
    
        // Adding form submit event listener (for pressing Enter)
        if (searchInput.form) {
            searchInput.form.addEventListener('submit', function(e) {
                e.preventDefault();
                const query = searchInput.value.trim();
                const genre = genreFilter.value;
                if (query || genre) {
                    searchBooks(query, genre);
                }
            });
        }
    
        // Adding change event listener to genre filter
        genreFilter.addEventListener('change', function() {
            const query = searchInput.value.trim();
            const genre = genreFilter.value;
            if (query || genre) {
                searchBooks(query, genre);
            }
        });
    });

    // book search with genre filtering and better error handling
    async function searchBooks(query, genre = '') {
        try {
            console.log('Searching for:', { query, genre });
            
            const recommendedBooks = document.getElementById('recommendedBooks');
            recommendedBooks.innerHTML = '<div class="book-card loading">Searching...</div>'.repeat(4);
    
            // Construct Google Books URL
            const googleUrl = new URL(GOOGLE_BOOKS_API_URL);
            googleUrl.searchParams.append('q', `${query}${genre ? '+subject:' + genre : ''}`);
            googleUrl.searchParams.append('maxResults', '10');
            googleUrl.searchParams.append('fields', 'items(id,volumeInfo(title,authors,description,categories,imageLinks,pageCount,publishedDate))');
    
            // Construct Open Library URL
            const openLibraryUrl = `${OPEN_LIBRARY_SEARCH}?q=${encodeURIComponent(query)}${genre ? '+subject:' + encodeURIComponent(genre) : ''}&limit=10`;
    
            // both fetch requests with proper error handling
            const googleBooksRequest = fetch(googleUrl.toString())
                .then(response => {
                    if (!response.ok) throw new Error(`Google Books API: ${response.status}`);
                    return response.json();
                })
                .catch(error => {
                    console.error('Google Books API error:', error);
                    return { items: [] }; // Return empty result on error
                });
    
            const openLibraryRequest = fetch(openLibraryUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Open Library API: ${response.status}`);
                    return response.json();
                })
                .catch(error => {
                    console.error('Open Library API error:', error);
                    return { docs: [] }; // Return empty result on error
                });
    
            // wait for both requests
            const [googleData, openLibraryData] = await Promise.all([
                googleBooksRequest,
                openLibraryRequest
            ]);
    
            recommendedBooks.innerHTML = '';
            let combinedBooks = [];
    
            // processing Google Books results
            if (googleData.items && Array.isArray(googleData.items)) {
                const googleBooks = googleData.items
                    .filter(book => book?.volumeInfo?.title)
                    .map(book => ({
                        ...processBookData(book),
                        source: 'google'
                    }))
                    .filter(book => book !== null);
                combinedBooks = [...combinedBooks, ...googleBooks];
            }
    
            // processing Open Library results
            if (openLibraryData.docs && Array.isArray(openLibraryData.docs)) {
                const openLibraryBooks = openLibraryData.docs
                    .filter(book => book?.title)
                    .map(book => ({
                        ...processOpenLibraryBook(book),
                        source: 'openLibrary'
                    }))
                    .filter(book => book !== null);
                combinedBooks = [...combinedBooks, ...openLibraryBooks];
            }
    
            // displaying results
            if (combinedBooks.length > 0) {
                combinedBooks.slice(0, MAX_RESULTS).forEach(book => {
                    const card = createBookCard(book, 'recommended');
                    recommendedBooks.appendChild(card);
                });
            } else {
                recommendedBooks.innerHTML = '<p>No books found. Try different search terms.</p>';
            }
    
        } catch (error) {
            console.error('Search error:', error);
            recommendedBooks.innerHTML = `<p>Error searching books: ${error.message}</p>`;
        }
    }
    
    // helper function to validate search input
    function validateSearchInput(query) {
        return query.trim().length > 0;
    }

    async function searchOpenLibrary(query) {
        try {
            const response = await fetch(`${OPEN_LIBRARY_SEARCH}?q=${encodeURIComponent(query)}&fields=key,title,author_name,cover_i,ia,lending_identifier_s&limit=20`);
            const data = await response.json();
            return data.docs;
        } catch (error) {
            console.error('Error searching Open Library:', error);
            return [];
        }
    }

    // processing raw book data from API
    function processBookData(bookData) {
        try {
            const volumeInfo = bookData.volumeInfo || {};
            return {
                id: bookData.id || `google-${Date.now()}`,
                volumeInfo: {
                    title: typeof volumeInfo.title === 'string' ? volumeInfo.title : 'Unknown Title',
                    authors: Array.isArray(volumeInfo.authors) ? volumeInfo.authors : ['Unknown Author'],
                    description: typeof volumeInfo.description === 'string' ? volumeInfo.description : 'No description available',
                    categories: Array.isArray(volumeInfo.categories) ? volumeInfo.categories : [],
                    imageLinks: volumeInfo.imageLinks || {},
                    pageCount: typeof volumeInfo.pageCount === 'number' ? volumeInfo.pageCount : 0,
                    publishedDate: typeof volumeInfo.publishedDate === 'string' ? volumeInfo.publishedDate : 'Unknown Date',
                    previewLink: volumeInfo.previewLink || null
                }
            };
        } catch (error) {
            console.error('Error processing book data:', error);
            return null;
        }
    }

    function processOpenLibraryBook(book) {
        if (!book || !book.title) return null;
        
        return {
            id: book.key ? book.key.replace('/works/', '') : `ol-${Date.now()}`,
            volumeInfo: {
                title: book.title,
                authors: book.author_name || ['Unknown Author'],
                description: book.description || 'No description available',
                imageLinks: {
                    thumbnail: book.cover_i 
                        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                        : '/api/placeholder/200/250'
                },
                categories: book.subject || [],
                internetArchiveId: book.ia ? book.ia[0] : null,
                openLibraryUrl: book.key ? `https://openlibrary.org${book.key}` : null,
                previewLink: book.key ? `https://openlibrary.org${book.key}` : null,
                publishedDate: book.first_publish_year ? book.first_publish_year.toString() : 'Unknown'
            }
        };
    }

    // creating book card element with error handling for missing data
    function createBookCard(book, shelf) {
        const card = document.createElement('div');
        card.className = 'book-card';
        
        const cover = book.volumeInfo?.imageLinks?.thumbnail || '/api/placeholder/200/250';
        const title = book.volumeInfo?.title || 'Unknown Title';
        const authors = Array.isArray(book.volumeInfo?.authors) 
            ? book.volumeInfo.authors.join(', ') 
            : 'Unknown Author';
        const description = book.volumeInfo?.description || 'No description available';
        
        // Add data attributes for debugging
        card.setAttribute('data-source', book.source || 'google');
        card.setAttribute('data-id', book.id);
    
        card.innerHTML = `
            <img src="${cover}" alt="${title}" class="book-cover" onerror="this.src='/api/placeholder/200/250'">
            <div class="source-badge" style="position: absolute; top: 10px; right: 10px; background: ${book.source === 'openLibrary' ? '#4CAF50' : '#2196F3'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                ${book.source === 'openLibrary' ? 'Open Library' : 'Google Books'}
            </div>
            <h3>${title}</h3>
            <p class="authors">${authors}</p>
            <p class="description">${description.substring(0, 150)}${description.length > 150 ? '...' : ''}</p>
            ${book.volumeInfo.categories?.length ? `<p class="categories">Genre: ${book.volumeInfo.categories.join(', ')}</p>` : ''}
            ${shelf === 'currentlyReading' ? `
                <div class="progress-bar">
                    <div class="progress" style="width: ${book.progress || 0}%"></div>
                </div>
                <div class="button-group">
                    <button onclick="updateProgress('${book.id}')">Update Progress</button>
                    <button onclick="openReader('${book.id}')">Continue Reading</button>
                    <button onclick="removeFromLibrary('${book.id}', '${shelf}')" style="background-color: #ff4444;">Remove Book</button>
                </div>
            ` : shelf === 'wantToRead' ? `
                <div class="button-group">
                    <button onclick="moveBook('${book.id}', '${shelf}', 'currentlyReading')">Start Reading</button>
                    <button onclick="removeFromLibrary('${book.id}', '${shelf}')" style="background-color: #ff4444;">Remove Book</button>
                </div>
            ` : `
                <button onclick="addToLibrary('${book.id}', 'wantToRead', '${book.source || 'google'}')">Add to Want to Read</button>
            `}
        `;
        
        return card;
    }
    
    // Adding book to library
    function addToLibrary(bookId, shelf, source) {
        let bookElement;
        if (source === 'openLibrary') {
            bookElement = Array.from(recommendedBooks.children)
                .find(card => card.getAttribute('data-id') === bookId && card.getAttribute('data-source') === 'openLibrary');
        } else {
            bookElement = Array.from(recommendedBooks.children)
                .find(card => card.querySelector('button').onclick.toString().includes(bookId));
        }
        
        if (bookElement) {
            const book = {
                id: bookId,
                source: source,
                volumeInfo: {
                    title: bookElement.querySelector('h3').textContent,
                    authors: [bookElement.querySelector('.authors').textContent],
                    imageLinks: {
                        thumbnail: bookElement.querySelector('img').src
                    },
                    description: bookElement.querySelector('.description').textContent
                },
                progress: 0
            };
    
            library[shelf].push(book);
            saveLibrary();
            updateUI();
            
            // Show feedback
            const button = bookElement.querySelector('button');
            button.textContent = 'Added to Library';
            button.disabled = true;
        }
    }

    // load library from localStorage
    function loadLibrary() {
        const savedLibrary = localStorage.getItem('library');
        if (savedLibrary) {
            try {
                library = JSON.parse(savedLibrary);
                updateUI();
            } catch (error) {
                console.error('Error loading library:', error);
                localStorage.removeItem('library'); // Clear corrupted data
            }
        }
    }

    // saving library to localStorage
    function saveLibrary() {
        try {
            localStorage.setItem('library', JSON.stringify(library));
        } catch (error) {
            console.error('Error saving library:', error);
        }
    }

    // Updating UI with current library state
    function updateUI() {
        currentlyReadingShelf.innerHTML = '';
        wantToReadShelf.innerHTML = '';
        
        library.currentlyReading.forEach(book => {
            currentlyReadingShelf.appendChild(createBookCard(book, 'currentlyReading'));
        });
        
        library.wantToRead.forEach(book => {
            wantToReadShelf.appendChild(createBookCard(book, 'wantToRead'));
        });
    }

    // Test the API connection on load
    window.addEventListener('load', () => {
        // Test search with a simple query
        searchBooks('harry potter');
    });

    loadLibrary();

    // helper function to find book in library
    function findBookInLibrary(bookId) {
        return library.currentlyReading.find(book => book.id === bookId) ||
               library.wantToRead.find(book => book.id === bookId);
    }

    // Move book between shelves with reading initialization
    function moveBook(bookId, fromShelf, toShelf) {
        const bookIndex = library[fromShelf].findIndex(book => book.id === bookId);
        if (bookIndex !== -1) {
            const book = library[fromShelf][bookIndex];
            library[fromShelf].splice(bookIndex, 1);
            library[toShelf].push(book);
            
            // Initialize reading session if moving to currentlyReading
            if (toShelf === 'currentlyReading') {
                book.progress = book.progress || 0;
                book.lastRead = new Date().toISOString();
                openReader(bookId);
            }
            
            saveLibrary();
            updateUI();
        }
    }

    async function getBookPageCount(bookId, source) {
        try {
            if (source === 'google') {
                const response = await fetch(`${GOOGLE_BOOKS_API_URL}/${bookId}`);
                if (!response.ok) throw new Error('Failed to fetch book details');
                const data = await response.json();
                return data.volumeInfo?.pageCount || null;
            } else if (source === 'openLibrary') {
                const response = await fetch(`https://openlibrary.org/works/${bookId}.json`);
                if (!response.ok) throw new Error('Failed to fetch book details');
                const data = await response.json();
                // Open Library stores page count in different editions
                const editions = await fetch(`https://openlibrary.org/works/${bookId}/editions.json`);
                const editionsData = await editions.json();
                // Try to find page count in any edition
                const pageCount = editionsData.entries?.find(e => e.number_of_pages)?.number_of_pages;
                return pageCount || null;
            }
            return null;
        } catch (error) {
            console.error('Error fetching book details:', error);
            return null;
        }
    }
    

    // Update progress with reading time tracking
    function updateProgress(bookId) {
        const book = library.currentlyReading.find(book => book.id === bookId);
        if (book) {
            const currentProgress = book.progress || 0;
            const newProgress = prompt(`Current reading progress: ${currentProgress}%\nEnter new progress (0-100):`, currentProgress);
            
            if (newProgress !== null && !isNaN(newProgress)) {
                const progress = Math.min(100, Math.max(0, parseInt(newProgress)));
                book.progress = progress;
                book.lastUpdated = new Date().toISOString();
                
                // Move to completed if 100%
                if (progress === 100) {
                    if (confirm('Congratulations on finishing the book! Move it to completed shelf?')) {
                        moveBook(bookId, 'currentlyReading', 'completed');
                    }
                }
                
                saveLibrary();
                updateUI();
            }
        }
    }

// initialize Google Books API
let viewer = null;

// loading Google Books API
function loadGoogleBooksAPI() {
    return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.books) {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = GOOGLE_BOOKS_VIEWER_API;
            script.onload = () => {
                google.books.load();
                google.books.setOnLoadCallback(() => resolve());
            };
            script.onerror = reject;
            document.head.appendChild(script);
        }
    });
}

//openReader function
async function openReader(bookId) {
    const book = findBookInLibrary(bookId);
    if (!book) return;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'reader-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    // reader container
    const reader = document.createElement('div');
    reader.className = 'reader-container';
    reader.style.cssText = `
        background: white;
        width: 95%;
        height: 95%;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
    `;

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'reader-close-button';
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 20px;
        z-index: 1001;
    `;
    closeButton.onclick = () => modal.remove();

    reader.appendChild(closeButton);

    try {
        if (book.source === 'openLibrary') {
            if (book.volumeInfo.internetArchiveId) {
                // Create Internet Archive BookReader iframe
                const iframe = document.createElement('iframe');
                iframe.style.cssText = `
                    width: 100%;
                    height: 100%;
                    border: none;
                `;
                iframe.src = `https://archive.org/embed/${book.volumeInfo.internetArchiveId}`;
                reader.appendChild(iframe);
            } else {
                // Construct correct Open Library URL
                // The ID needs to be properly formatted as a works ID
                const openLibraryUrl = `https://openlibrary.org/works/${book.id}`;
                
                // Create view interface
                const previewInterface = document.createElement('div');
                previewInterface.style.cssText = `
                    padding: 20px;
                    text-align: center;
                    max-width: 600px;
                    margin: 0 auto;
                `;
                previewInterface.innerHTML = `
                    <h2>${book.volumeInfo.title}</h2>
                    <p>This book is available on Open Library.</p>
                    <button onclick="window.open('${openLibraryUrl}', '_blank')" 
                            style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">
                        View on Open Library
                    </button>
                    <p style="margin-top: 20px; color: #666;">Note: You may need to create a free Open Library account to access the full content.</p>
                `;
                reader.appendChild(previewInterface);

                // Also try to fetch additional book details from Open Library API
                fetch(`https://openlibrary.org/works/${book.id}.json`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.description) {
                            const descriptionDiv = document.createElement('div');
                            descriptionDiv.style.cssText = `
                                padding: 20px;
                                margin-top: 20px;
                                text-align: left;
                                max-height: 300px;
                                overflow-y: auto;
                                border-top: 1px solid #eee;
                            `;
                            descriptionDiv.innerHTML = `
                                <h3>Book Description</h3>
                                <p>${typeof data.description === 'object' ? data.description.value : data.description}</p>
                            `;
                            previewInterface.appendChild(descriptionDiv);
                        }
                    })
                    .catch(error => console.error('Error fetching book details:', error));
            }
        } else {
            // Handle Google Books preview as before
            const previewInterface = document.createElement('div');
            previewInterface.style.cssText = `
                padding: 20px;
                text-align: center;
            `;
            previewInterface.innerHTML = `
                <h2>${book.volumeInfo.title}</h2>
                <p>This book is available through Google Books.</p>
                <button onclick="window.open('${book.volumeInfo.previewLink || `https://books.google.com/books?id=${book.id}`}', '_blank')" 
                        style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">
                    View on Google Books
                </button>
            `;
            reader.appendChild(previewInterface);
        }
    } catch (error) {
        console.error('Error loading reader:', error);
        reader.innerHTML += `
            <div style="padding: 20px; text-align: center;">
                <h3>Error</h3>
                <p>Unable to load book preview. Please try again later.</p>
                <p>Error details: ${error.message}</p>
            </div>
        `;
    }

    modal.appendChild(reader);
    document.body.appendChild(modal);
}

function removeFromLibrary(bookId, shelf) {
    // Confirm before removing
    if (confirm(`Are you sure you want to remove this book from your ${shelf.replace(/([A-Z])/g, ' $1').toLowerCase()} list?`)) {
        // Find the book index in the specified shelf
        const bookIndex = library[shelf].findIndex(book => book.id === bookId);
        
        if (bookIndex !== -1) {
            // Remove the book from the array
            library[shelf].splice(bookIndex, 1);
            
            // Save the updated library
            saveLibrary();
            
            // Update the UI
            updateUI();
        }
    }
}
