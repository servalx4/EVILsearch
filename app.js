const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('results');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const tabButtons = document.querySelectorAll('.tab-button');

let currentTab = 'web';

// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        currentTab = button.dataset.tab;

        // Update placeholder
        if (currentTab === 'images') {
            searchInput.placeholder = 'Search for evil images...';
        } else {
            searchInput.placeholder = 'Search the depths of the internet...';
        }

        // Clear results
        resultsContainer.innerHTML = '';
        errorElement.style.display = 'none';
    });
});

searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const query = searchInput.value.trim();
    if (!query) return;

    // Clear previous results and errors
    resultsContainer.innerHTML = '';
    errorElement.style.display = 'none';
    errorElement.textContent = '';

    // Show loading with random evil message
    const loadingText = loadingElement.querySelector('p');
    if (loadingText) {
        loadingText.textContent = getRandomLoadingMessage(currentTab);
    }
    loadingElement.style.display = 'block';

    try {
        const response = await fetch('http://localhost:3000/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                type: currentTab
            }),
        });

        loadingElement.style.display = 'none';

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const results = await response.json();

        if (results.length === 0) {
            showError('No results found. The darkness is empty today...');
            return;
        }

        if (currentTab === 'images') {
            displayImageResults(results);
        } else {
            displayWebResults(results);
        }
    } catch (error) {
        loadingElement.style.display = 'none';
        showError('Failed to perform search. The evil servers might be down...');
        console.error('Search error:', error);
    }
});

function displayWebResults(results) {
    resultsContainer.innerHTML = '';
    resultsContainer.className = 'results';

    results.forEach((result) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        const title = document.createElement('h2');
        title.className = 'result-title';
        const link = document.createElement('a');
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = result.title;
        title.appendChild(link);

        const url = document.createElement('div');
        url.className = 'result-url';
        url.textContent = result.url;

        const description = document.createElement('p');
        description.className = 'result-description';
        description.textContent = result.description;

        resultItem.appendChild(title);
        resultItem.appendChild(url);
        resultItem.appendChild(description);

        resultsContainer.appendChild(resultItem);
    });
}

function displayImageResults(results) {
    resultsContainer.innerHTML = '';
    resultsContainer.className = 'image-grid';

    const overlayTypes = ['fire', 'shadow', 'thunder'];

    results.forEach((result) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';

        // Randomly assign overlay type
        const randomOverlay = overlayTypes[Math.floor(Math.random() * overlayTypes.length)];
        imageItem.classList.add(`overlay-${randomOverlay}`);

        const img = document.createElement('img');
        img.src = result.imageUrl;
        img.alt = result.title;
        img.loading = 'lazy';

        // Handle image load errors
        img.onerror = () => {
            imageItem.style.display = 'none';
        };

        const title = document.createElement('div');
        title.className = 'image-title';
        title.textContent = result.title;

        if (result.source) {
            const source = document.createElement('div');
            source.className = 'image-source';
            source.textContent = result.source;
            imageItem.appendChild(source);
        }

        imageItem.appendChild(img);
        imageItem.appendChild(title);

        // Click to open in new tab
        imageItem.addEventListener('click', () => {
            window.open(result.imageUrl, '_blank');
        });

        resultsContainer.appendChild(imageItem);
    });
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function getRandomLoadingMessage(tab) {
    const webPhrases = [
        'Summoning results from the dark web...',
        'Consulting with the digital demons...',
        'Harvesting data from the void...',
        'Awakening the algorithm...',
        'Piercing through the firewall of reality...',
        'Descending into the digital abyss...',
        'Channeling the dark net...',
    ];

    const imagePhrases = [
        'Extracting cursed images from the void...',
        'Summoning forbidden visuals...',
        'Conjuring dark imagery from the shadows...',
        'Harvesting evil pixels...',
        'Downloading nightmares...',
        'Materializing sinister visions...',
        'Awakening the dark gallery...',
    ];

    const phrases = tab === 'images' ? imagePhrases : webPhrases;
    return phrases[Math.floor(Math.random() * phrases.length)];
}
