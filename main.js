// version 1208

// Global variables
let allBusinesses = [];
let filteredBusinesses = [];
let businessesWithDistance = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';
let userLocation = null;
let inDetailView = false;
let currentBusinessSlug = null;
let directoryMap = null; // Map for the directory view
let directoryMarkers = []; // Markers for the directory map

// Load business data when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners for filters
    document.getElementById('searchInput').addEventListener('input', handleFilterChange);
    document.getElementById('locationInput').addEventListener('input', handleFilterChange);
    document.getElementById('categoryFilter').addEventListener('change', handleFilterChange);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    // View toggle buttons
    document.getElementById('cardViewBtn').addEventListener('click', function() {
        setViewMode('card');
    });
    document.getElementById('listViewBtn').addEventListener('click', function() {
        setViewMode('list');
    });
    document.getElementById('mapViewBtn').addEventListener('click', function() {
        setViewMode('map');
    });
    
    // Location sorting
    document.getElementById('myLocationSelect').addEventListener('change', updateUserLocation);
    document.getElementById('useCurrentLocation').addEventListener('click', getCurrentLocation);

    // Add Directory/BTCMap toggle handlers
    document.getElementById('directoryBtn').addEventListener('click', function() {
        switchViewMode('directory');
    });
    document.getElementById('btcMapBtn').addEventListener('click', function() {
        switchViewMode('btcmap');
    });

    // Load businesses from JSON
    loadBusinessesFromJSON();

    // Add click handlers for sortable columns
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            handleSort(column);
        });
    });
    
    // Force alphabetical sort on page load
    setTimeout(() => {
        // Reset sort first to ensure ascending order
        currentSortColumn = null;
        currentSortDirection = 'asc';
        handleSort('name');
    }, 1000);
    
  
});



// Function to switch between Directory and BTCMap views
function switchViewMode(mode) {
    // Update UI buttons
    const directoryBtn = document.getElementById('directoryBtn');
    const btcMapBtn = document.getElementById('btcMapBtn');
    
    // Update content visibility
    const directoryContent = document.getElementById('directoryContent');
    const mapContent = document.getElementById('mapContent');

    if (mode === 'directory') {
        // Update active state
        directoryBtn.classList.add('active');
        btcMapBtn.classList.remove('active');
        
        // Show directory content, hide map content
        directoryContent.style.display = 'block';
        mapContent.style.display = 'none';
        
        // Update current mode
        currentViewMode = 'directory';
        
        // When returning to directory view, ensure we're showing the listing
        if (inDetailView) {
            // Show the listing instead of the detail view
            document.getElementById('businessListing').style.display = 'block';
            document.getElementById('businessDetail').style.display = 'none';
            
            // Update URL to remove business slug
            const url = new URL(window.location.href);
            url.searchParams.delete('business');
            window.history.pushState({}, '', url);
            
            // Update state
            inDetailView = false;
            currentBusinessSlug = null;
            
            // Update filter status
            updateFilterStatus();
        }
    } else {
        // Update active state
        directoryBtn.classList.remove('active');
        btcMapBtn.classList.add('active');
        
        // Hide directory content, show map content with placeholder
        directoryContent.style.display = 'none';
        mapContent.style.display = 'block';
        
        // Update current mode
        currentViewMode = 'btcmap';
        
        // Show placeholder message for BTCMap
        const mapContentDiv = document.getElementById('mapContent');
        mapContentDiv.innerHTML = `
            <div class="alert alert-info m-4" role="alert">
                <h4 class="alert-heading">Coming Soon!</h4>
                <p>BTCMap integration is currently under development. This feature will provide an interactive map of Bitcoin-accepting businesses worldwide.</p>
                <hr>
                <p class="mb-0">Please check back later for updates.</p>
            </div>
        `;
    }
}

// Generate a slug from a string (for URL-friendly identifiers)
function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Ensure all businesses have slugs
function ensureBusinessSlugs(businesses) {
    // First pass: generate slugs for businesses without them
    businesses.forEach(business => {
        if (!business.slug) {
            business.slug = generateSlug(business.name);
        }
    });

    // Second pass: handle duplicate slugs by adding a suffix
    const slugCounts = {};
    businesses.forEach(business => {
        if (!slugCounts[business.slug]) {
            slugCounts[business.slug] = 1;
        } else {
            // Duplicate slug found, append a number
            const originalSlug = business.slug;
            slugCounts[originalSlug]++;
            business.slug = `${originalSlug}-${slugCounts[originalSlug]}`;
        }
    });

    return businesses;
}

// Normalize category data structure for each business
function normalizeCategoryData(businesses) {
    return businesses.map(business => {
        // Create a copy of the business object
        const normalizedBusiness = {...business};
        
        // Handle different category formats and ensure a consistent array structure
        if (business.categories && Array.isArray(business.categories)) {
            // Already in the right format
            normalizedBusiness.categories = business.categories;
        } else if (business.category) {
            // Convert single category string to array
            normalizedBusiness.categories = [business.category];
            // Keep the original category field for backward compatibility
            normalizedBusiness.category = business.category;
        } else {
            // No category information found
            normalizedBusiness.categories = ['Uncategorized'];
            normalizedBusiness.category = 'Uncategorized';
        }
        
        return normalizedBusiness;
    });
}

// Load businesses from JSON file
async function loadBusinessesFromJSON() {
    // Show loading spinner
    document.getElementById('loadingSpinner').style.display = 'flex';
    document.getElementById('businessListing').style.display = 'none';

    // Define fallback demo data in case JSON loading fails
    const demoBusinesses = [
        {
            id: 1,
            name: "Dirtmoving and landscaping",
            slug: "dirtmoving-and-landscaping",
            logoUrl: "",
            categories: ["Services", "Landscaping", "Construction"],
            category: "Services", // For backward compatibility
            country: "US",
            region: "MN",
            city: "Minneapolis",
            owner: "John Smith",
            website: "dirtmovers.com",
            phone: "",
            email: "",
            description: "Dirt moving and landscaping services that accept Bitcoin payments.",
            socialMedia: {
                twitter: "dirtmoversBTC",
                telegram: "dirtmovers",
                signal: "+1-555-123-4567",
                nostr: "npub1abcdef123456789abcdef123456789abcdef123456789abcdef123456789"
            },
            paymentMethods: {
                onchain: true,
                lightning: false
            },
            lastVerified: "2025-02-15T14:30:00"
        },
        {
            id: 2,
            name: "Ethical tree care",
            slug: "ethical-tree-care",
            logoUrl: "",
            categories: ["Services", "Landscaping", "Arborist"],
            category: "Services", // For backward compatibility
            country: "US",
            region: "MN",
            city: "Cloquet",
            owner: "Kyle",
            website: "",
            phone: "3201234567",
            email: "",
            description: "Tree care services accepting Bitcoin as payment.",
            socialMedia: {
                twitter: "ethicaltreecare",
                mastodon: "@ethicaltreecare@bitcoiner.social",
                discord: "ethicaltreecare#1234",
                telegram: "ethicaltreecare"
            },
            paymentMethods: {
                onchain: true,
                lightning: true
            },
            lastVerified: "2025-03-05T09:45:00"
        },
        {
            id: 3,
            categories: ["Food & Dining", "Restaurant", "Coffee Shop"],
            category: "Restaurant", // For backward compatibility
            city: "",
            country: "Global",
            description: "Online coffee subscription service with global shipping.",
            email: "hello@coffeehouse.com",
            lastVerified: "",
            logoUrl: "",
            name: "Coffee house and breakfast",
            owner: "",
            paymentMethods: {
                onchain: false,
                lightning: true
            },
            phone: "",
            region: "",
            slug: "coffee-house-and-breakfast",
            socialMedia: {},
            website: "coffeehouse.com"
        }
    ];

    try {
        // Add cache-busting parameter to prevent caching
        const cacheBuster = '?v=' + new Date().getTime();

        // Load businesses data
        const response = await fetch('businessData.json' + cacheBuster);
        if (!response.ok) {
            throw new Error('Failed to load businesses data');
        }
        
        const businesses = await response.json();
        console.log("Successfully loaded", businesses.length, "businesses from JSON");
        
        // Normalize category data
        let normalizedBusinesses = normalizeCategoryData(businesses);
        
        // Ensure all businesses have slugs
        normalizedBusinesses = ensureBusinessSlugs(normalizedBusinesses);
        
        // Assign coordinates based on locationData.json
        allBusinesses = await assignCoordinates(normalizedBusinesses);
        
        filteredBusinesses = [...allBusinesses];

        // Find the most recent verification date
        findMostRecentVerification();

        // Populate filter options
        populateFilterOptions();

        // Sort businesses alphabetically by name
        sortBusinesses('name', 'asc');

        // Display all businesses
        displayBusinesses(filteredBusinesses);

        // Update data info
        updateDataInfo();

        // Hide loading spinner, show business listing
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('businessListing').style.display = 'block';

        // Check URL for business slug parameter
        checkUrlForBusinessSlug();
    } catch (error) {
        console.error('Error loading businesses:', error);
        
        // Use demo data if JSON fetch fails
        console.log("Using demo data instead");
        
        // Normalize and process demo data
        let normalizedDemoBusinesses = normalizeCategoryData(demoBusinesses);
        normalizedDemoBusinesses = ensureBusinessSlugs(normalizedDemoBusinesses);
        allBusinesses = await assignCoordinates(normalizedDemoBusinesses);
        
        filteredBusinesses = [...allBusinesses];
        
        // Find the most recent verification date
        findMostRecentVerification();

        // Populate filter options
        populateFilterOptions();

        // Display all businesses
        displayBusinesses(filteredBusinesses);
        
        // Update data info
        updateDataInfo();

        // Hide loading spinner, show business listing
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('businessListing').style.display = 'block';
        
        // Show message about using demo data
        updateStatusMessage('Using demo data - JSON file could not be loaded.', 'warning');
    }
}

// Check if business is global/online
function isGlobalOrOnline(business) {
    // Add debugging for a small number of businesses to avoid flooding the console
    if (Math.random() < 0.05) { // Only log ~5% of calls to avoid console spam
        const isGlobal = business.isGlobalOrOnline || false;
        const hasGlobalCategory = business.categories && business.categories.includes('Global/Online');
        console.log(`isGlobalOrOnline check for ${business.name}:`);
        console.log(`  business.isGlobalOrOnline: ${isGlobal}`);
        console.log(`  Has 'Global/Online' category: ${hasGlobalCategory}`);
        console.log(`  Result: ${isGlobal || hasGlobalCategory}`);
    }
    
    return business.isGlobalOrOnline || 
           (business.categories && business.categories.includes('Global/Online'));
}

// Helper function to normalize location strings
function normalizeLocationString(str) {
    if (!str) return '';
    // First, convert to lowercase and handle special cases
    str = str.toLowerCase()
        .replace(/\./g, '') // Remove periods
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
    
    // Special handling for "st." prefix (both with and without period)
    if (str.startsWith('st ')) {
        str = 'st ' + str.substring(3);
    }
    
    return str;
}

// Function to assign coordinates to businesses
async function assignCoordinates(businesses) {
    try {
        // Add cache-busting parameter to prevent caching
        const cacheBuster = '?v=' + new Date().getTime();
        
        // Load location data
        const response = await fetch('locationData.json' + cacheBuster);
        const locationData = await response.json();
        
        return businesses.map(business => {
            // Create a copy of the business object
            const businessWithCoords = {...business};
            
            // If business already has coordinates, use them
            if (businessWithCoords.coordinates) {
                return businessWithCoords;
            }
            
            // Check if business is global/online (but don't exit early)
            if (isGlobalOrOnline(business)) {
                businessWithCoords.isGlobalOrOnline = true;
                // Continue processing to assign coordinates if location info is available
            }
            
            // Check if business has location information
            if (!hasLocationInfo(business)) {
                businessWithCoords.hasNoLocationInfo = true;
                return businessWithCoords;
            }
            
            let coordinates = null;
            let locationType = null;
            let locationKey = null;

            // Find all matching locations
            const matchingLocations = locationData.locations.filter(loc => {
                // Try to match city + region + country first
                if (business.city && business.region && business.country &&
                    normalizeLocationString(loc.city) === normalizeLocationString(business.city) &&
                    normalizeLocationString(loc.region) === normalizeLocationString(business.region) &&
                    normalizeLocationString(loc.country) === normalizeLocationString(business.country)) {
                    return true;
                }
                // Try to match city + region
                if (business.city && business.region &&
                    normalizeLocationString(loc.city) === normalizeLocationString(business.city) &&
                    normalizeLocationString(loc.region) === normalizeLocationString(business.region)) {
                    return true;
                }
                // Try to match region + country
                if (business.region && business.country &&
                    normalizeLocationString(loc.region) === normalizeLocationString(business.region) &&
                    normalizeLocationString(loc.country) === normalizeLocationString(business.country)) {
                    return true;
                }
                // Try to match region only
                if (business.region && normalizeLocationString(loc.region) === normalizeLocationString(business.region)) {
                    return true;
                }
                // Try to match country only
                if (business.country && normalizeLocationString(loc.country) === normalizeLocationString(business.country)) {
                    return true;
                }
                return false;
            });

            // Select the most specific match
            let location = null;
            if (matchingLocations.length > 0) {
                // Sort matches by specificity (city > region > country)
                matchingLocations.sort((a, b) => {
                    // First, check if we have an exact city match
                    if (business.city) {
                        const aCityMatch = normalizeLocationString(a.city) === normalizeLocationString(business.city);
                        const bCityMatch = normalizeLocationString(b.city) === normalizeLocationString(business.city);
                        if (aCityMatch && !bCityMatch) return -1;
                        if (!aCityMatch && bCityMatch) return 1;
                    }
                    
                    // Then check for region match
                    if (business.region) {
                        const aRegionMatch = normalizeLocationString(a.region) === normalizeLocationString(business.region);
                        const bRegionMatch = normalizeLocationString(b.region) === normalizeLocationString(business.region);
                        if (aRegionMatch && !bRegionMatch) return -1;
                        if (!aRegionMatch && bRegionMatch) return 1;
                    }
                    
                    // Finally, check for country match
                    if (business.country) {
                        const aCountryMatch = normalizeLocationString(a.country) === normalizeLocationString(business.country);
                        const bCountryMatch = normalizeLocationString(b.country) === normalizeLocationString(business.country);
                        if (aCountryMatch && !bCountryMatch) return -1;
                        if (!aCountryMatch && bCountryMatch) return 1;
                    }
                    
                    // If all else is equal, prefer entries with more specific information
                    // For region-level matches, prefer entries without a city field
                    if (!business.city) {
                        if (!a.city && b.city) return -1;
                        if (a.city && !b.city) return 1;
                    }
                    
                    const aSpecificity = (a.city ? 3 : 0) + (a.region ? 2 : 0) + (a.country ? 1 : 0);
                    const bSpecificity = (b.city ? 3 : 0) + (b.region ? 2 : 0) + (b.country ? 1 : 0);
                    return bSpecificity - aSpecificity;
                });
                
                location = matchingLocations[0];
                locationType = location.city ? 'city' : (location.region ? 'region' : 'country');
            }

            if (location) {
                coordinates = {
                    lat: location.lat,
                    lng: location.lng
                };
                locationKey = `${location.city || ''}${location.city ? ', ' : ''}${location.region || ''}${location.region ? ', ' : ''}${location.country || ''}`;
            }

            // If coordinates found, assign them
            if (coordinates) {
                businessWithCoords.coordinates = coordinates;
                businessWithCoords.locationType = locationType;
                businessWithCoords.locationKey = locationKey;
                // Mark as approximate if not city-level
                if (locationType !== 'city') {
                    businessWithCoords.hasApproximateLocation = true;
                }
            } else {
                businessWithCoords.locationNotFound = true;
            }

            return businessWithCoords;
        });
    } catch (error) {
        console.error('Error assigning coordinates:', error);
        return businesses;
    }
}

// Find the most recent verification date among all businesses
function findMostRecentVerification() {
    mostRecentVerification = null;

    allBusinesses.forEach(business => {
        if (business.lastVerified) {
            const verificationDate = new Date(business.lastVerified);

            if (!isNaN(verificationDate)) {
                if (!mostRecentVerification || verificationDate > mostRecentVerification) {
                    mostRecentVerification = verificationDate;
                }
            }
        }
    });
}

// Update data info text
function updateDataInfo() {
    const dataInfoEl = document.getElementById('dataInfo');
    const totalBusinesses = allBusinesses.length;
    
    if (mostRecentVerification) {
        dataInfoEl.textContent = `Directory last updated: ${formatDate(mostRecentVerification)} • ${totalBusinesses} businesses`;
    } else {
        dataInfoEl.textContent = `${totalBusinesses} businesses`;
    }
}

// Check URL for business slug parameter
function checkUrlForBusinessSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    const businessSlug = urlParams.get('business');

    if (businessSlug) {
        // Try to find the business with this slug
        const business = allBusinesses.find(b => b.slug === businessSlug);
        if (business) {
            showBusinessDetail(business.slug);
        }
    }
}

// Populate filter options with category counts
function populateFilterOptions() {
    // Extract all unique categories and count occurrences
    const categoryCounts = {};
    const allCategories = new Set();
    
    allBusinesses.forEach(business => {
        if (business.categories && Array.isArray(business.categories)) {
            business.categories.forEach(category => {
                if (category) {
                    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                    allCategories.add(category);
                }
            });
        } else if (business.category) {
            categoryCounts[business.category] = (categoryCounts[business.category] || 0) + 1;
            allCategories.add(business.category);
        } else {
            categoryCounts["Uncategorized"] = (categoryCounts["Uncategorized"] || 0) + 1;
            allCategories.add("Uncategorized");
        }
    });
    
    // Calculate total number of businesses (for "All Categories" option)
    const totalBusinesses = allBusinesses.length;
    
    // Populate the directory category filter dropdown
    const categoryFilter = document.getElementById('categoryFilter');
    
    // Clear existing options except the first one
    while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
    }
    
    // Update "All Categories" option with count
    categoryFilter.options[0].textContent = `All Categories (${totalBusinesses})`;

    // Sort all categories alphabetically
    Array.from(allCategories).sort().forEach(category => {
        const count = categoryCounts[category];
        const optElement = document.createElement('option');
        optElement.value = category;
        optElement.textContent = `${category} (${count})`;
        categoryFilter.appendChild(optElement);
    });
    
 

    // Sort all categories alphabetically
    Array.from(allCategories).sort().forEach(category => {
        const count = categoryCounts[category];
        const optElement = document.createElement('option');
        optElement.value = category;
        optElement.textContent = `${category} (${count})`;
      
    });
}

// Handle filter changes
function handleFilterChange() {
    // Save current location state before applying filters
    const hadUserLocation = userLocation !== null;
    
    // Apply filters to get updated list
    const newFilteredBusinesses = applyFilters();
    filteredBusinesses = newFilteredBusinesses;
    
    // Update the displayed businesses in list view
    displayBusinesses(filteredBusinesses);
    
    // Always return to the listing view when filters change
    if (inDetailView) {
        showListView();
    }
    
    // Update filter status
    updateFilterStatus();
    
    // Re-apply distance calculations if needed
    if (userLocation) {
        calculateDistances();
        sortBusinessesByDistance();
        displayBusinesses(filteredBusinesses);
    }
}

// Update filter status message
function updateFilterStatus() {
    const statusEl = document.getElementById('filterStatus');
    const totalBusinesses = allBusinesses.length;
    const filteredCount = filteredBusinesses.length;
    
    // Get the current active filters
    const searchTerm = document.getElementById('searchInput').value;
    const locationTerm = document.getElementById('locationInput').value;
    const category = document.getElementById('categoryFilter').value;
    const hasLocationSort = userLocation !== null;
    
    // Check if any filter is active
    const hasActiveFilter = searchTerm || locationTerm || category || hasLocationSort;
    
    // Only show status if filters are being used
    if (!hasActiveFilter) {
        statusEl.innerHTML = '';
        return;
    }
    
    // Create status message for active filters
    let statusHTML = '';
    if (filteredCount === totalBusinesses) {
        statusHTML = `<span class="filter-status">Showing all ${totalBusinesses} businesses</span>`;
    } else {
        statusHTML = `<span class="filter-status">Showing ${filteredCount} of ${totalBusinesses} businesses</span>`;
    }
    
    // Add details about which filters are active
    const activeFilters = [];
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    if (locationTerm) activeFilters.push(`Location: "${locationTerm}"`);
    if (category) activeFilters.push(`Category: <strong style="color: #f7931a;">${category}</strong>`);
    
    if (hasLocationSort) {
        const locationName = document.getElementById('myLocationSelect').value ? 
            document.getElementById('myLocationSelect').options[document.getElementById('myLocationSelect').selectedIndex].text : 
            'current location';
        activeFilters.push(`Sorted by distance from ${locationName}`);
    }
    
    if (activeFilters.length > 0) {
        statusHTML += `<div class="mt-1 small text-muted">Filters: ${activeFilters.join(' • ')}</div>`;
    }
    
    statusEl.innerHTML = statusHTML;
}

// Apply current filters and return filtered businesses
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const locationTerms = document.getElementById('locationInput').value.toLowerCase().split(/[\s,]+/).filter(term => term.length > 0);
    const categoryFilter = document.getElementById('categoryFilter').value;

    return allBusinesses.filter(business => {
        // Check if category filter matches any of the business's categories
        let matchesCategory = !categoryFilter; // If no category filter, all businesses match
        
        if (categoryFilter && business.categories && Array.isArray(business.categories)) {
            // Check if any of the business's categories match the selected filter
            matchesCategory = business.categories.includes(categoryFilter);
        } else if (categoryFilter && business.category) {
            // Fall back to single category field for backward compatibility
            matchesCategory = business.category === categoryFilter;
        }

        // Check if search term appears in any business field
        const matchesSearch = !searchTerm || 
            (business.name && business.name.toLowerCase().includes(searchTerm)) ||
            (business.categories && business.categories.some(cat => cat.toLowerCase().includes(searchTerm))) ||
            (business.owner && business.owner.toLowerCase().includes(searchTerm)) ||
            (business.website && business.website.toLowerCase().includes(searchTerm)) ||
            (business.phone && business.phone.toLowerCase().includes(searchTerm)) ||
            (business.email && business.email.toLowerCase().includes(searchTerm)) ||
            (business.description && business.description.toLowerCase().includes(searchTerm));

        // Check if location matches
        let matchesLocation = locationTerms.length === 0;
        
        if (locationTerms.length > 0) {
            // Create a combined location string to search in
            const locationString = [
                business.city || '',
                business.region || '',
                business.country || ''
            ].join(' ').toLowerCase();
            
            // Check if ALL location terms are in the location string
            matchesLocation = locationTerms.every(term => locationString.includes(term));
        }

        return matchesCategory && matchesSearch && matchesLocation;
    });
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('locationInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('myLocationSelect').value = '';
    
    // Reset location data
    userLocation = null;
    businessesWithDistance = [];
    
    // Reset filtered businesses to show all
    filteredBusinesses = [...allBusinesses];
    
    // Update the display for current view mode
    displayBusinesses(filteredBusinesses);
    
    // Update filter status to show all businesses
    updateFilterStatus();
    
    // Hide status message
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.style.display = 'none';

    // If we're in map view, reset the map to show all businesses
    const mapView = document.getElementById('mapView');
    if (mapView.style.display === 'block' && directoryMap) {
        // Get businesses with location data
        const businessesWithLocation = filteredBusinesses.filter(business => 
            (business.latitude && business.longitude) || 
            (business.coordinates && business.coordinates.lat && business.coordinates.lng)
        );
        
        // Clear existing markers
        directoryMarkers.forEach(marker => marker.remove());
        directoryMarkers = [];
        
        // Add new markers for all businesses
        addDirectoryMapMarkers(businessesWithLocation);
        
        // Reset the map view to fit all markers
        if (businessesWithLocation.length > 0) {
            fitDirectoryMapToBounds();
        } else {
            // If no businesses with location, reset to default view
            directoryMap.setView([20, 0], 2);
        }
    }
}

// Update user location from dropdown
function updateUserLocation() {
    const locationSelect = document.getElementById('myLocationSelect');
    const locationValue = locationSelect.value;
    
    if (!locationValue) {
        userLocation = null;
        // Hide status message when location is cleared
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.style.display = 'none';
        
        // If map exists, fit to bounds of all markers
        if (directoryMap) {
            fitDirectoryMapToBounds();
        }
        return;
    }
    
    // Get coordinates from the selected option
    const [lat, lng] = locationValue.split(',').map(Number);
    userLocation = { lat, lng };
    
    // Get location name
    const locationName = locationSelect.options[locationSelect.selectedIndex].text;
    
    // Calculate distances and sort businesses immediately
    calculateDistances();
    sortBusinessesByDistance();
    
    // Update display
    displayBusinesses(filteredBusinesses);
    
    // If map exists, update the view regardless of current view mode
    if (directoryMap) {
        directoryMap.setView([lat, lng], 10);
    }
    
    // Display status message
    updateStatusMessage(`Businesses sorted by distance from ${locationName}`);
    
    // Update filter status
    updateFilterStatus();
}

// Sort businesses by distance handler

// Get current user location
function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    updateStatusMessage('Getting your current location...');
    
    navigator.geolocation.getCurrentPosition(
        // Success
        function(position) {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // Clear the dropdown selection
            document.getElementById('myLocationSelect').value = '';
            
            // Calculate distances and sort
            calculateDistances();
            sortBusinessesByDistance();
            
            // If map exists, update the view regardless of current view mode
            if (directoryMap) {
                directoryMap.setView([userLocation.lat, userLocation.lng], 10);
            }
            
            // Update UI
            updateStatusMessage(`Using your current location (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`);
            displayBusinesses(filteredBusinesses);
            updateFilterStatus();
        },
        // Error
        function(error) {
            let errorMessage = 'Unable to retrieve your location. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Location access was denied.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'The request to get location timed out.';
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            
            updateStatusMessage(errorMessage, 'warning');
        },
        // Options
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

// Calculate distances for all businesses
function calculateDistances() {
    if (!userLocation) return;
    
    console.log("Starting distance calculations...");
    
    // Add distance to each business
    businessesWithDistance = filteredBusinesses.map(business => {
        // Clone the business object to avoid modifying the original
        const businessWithDist = {...business};
        
        // Log Global/Online businesses with location info
        if (business.isGlobalOrOnline && hasLocationInfo(business)) {
            console.log(`Global/Online business with location: ${business.name}`);
            console.log(`  Location: ${business.city || ''}, ${business.region || ''}, ${business.country || ''}`);
            console.log(`  Has coordinates: ${business.coordinates && business.coordinates.lat ? 'Yes' : 'No'}`);
            if (business.coordinates) {
                console.log(`  Coordinates: ${business.coordinates.lat}, ${business.coordinates.lng}`);
            }
        }
        
        // Preserve the Global/Online flag if it exists
        if (business.isGlobalOrOnline) {
            businessWithDist.isGlobalOrOnline = true;
        }
        
        // Skip if business has no location info or location not found in our database
        if (business.hasNoLocationInfo || business.locationNotFound) {
            return businessWithDist;
        }
        
        // Skip if business doesn't have coordinates
        if (!business.coordinates || !business.coordinates.lat || !business.coordinates.lng) {
            return businessWithDist;
        }
        
        // Calculate distance using Haversine formula
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            business.coordinates.lat, business.coordinates.lng
        );
        
        // Add distance to the business object
        businessWithDist.distance = distance;
        
        // Log when we calculate distance for Global/Online businesses
        if (business.isGlobalOrOnline) {
            console.log(`  Distance calculated for Global/Online business: ${distance.toFixed(2)} km`);
        }
        
        return businessWithDist;
    });
    
    // Replace filtered businesses with the ones that have distances
    filteredBusinesses = businessesWithDistance;
    
    // Log summary
    const globalOnlineWithDistance = filteredBusinesses.filter(b => 
        b.isGlobalOrOnline && b.distance !== undefined).length;
    console.log(`Total Global/Online businesses with distance: ${globalOnlineWithDistance}`);
}

// Sort businesses by distance
function sortBusinessesByDistance() {
    if (!userLocation || filteredBusinesses.length === 0) return;
    
    // Sort by distance (businesses without distance will be at the end)
    filteredBusinesses.sort((a, b) => {
        // Global/Online businesses with distance data should be sorted by distance
        if (a.isGlobalOrOnline && b.isGlobalOrOnline) {
            // If both have distance, sort by distance
            if (a.distance !== undefined && b.distance !== undefined) {
                return a.distance - b.distance;
            }
            // If only one has distance, prioritize the one with distance
            if (a.distance !== undefined) return -1;
            if (b.distance !== undefined) return 1;
            // If neither has distance, keep order
            return 0;
        }
        
        // Global/Online businesses without distance should be at the end
        if (a.isGlobalOrOnline && !a.distance) return 1;
        if (b.isGlobalOrOnline && !b.distance) return -1;
        
        // Global/Online businesses with distance should be mixed with regular businesses
        // based on their distance
        
        // Businesses with location not found should be after those with coordinates
        if (a.locationNotFound && b.locationNotFound) return 0;
        if (a.locationNotFound) return 1;
        if (b.locationNotFound) return -1;
        
        // Businesses with no location info should be after those with coordinates
        if (a.hasNoLocationInfo && b.hasNoLocationInfo) return 0;
        if (a.hasNoLocationInfo) return 1;
        if (b.hasNoLocationInfo) return -1;
        
        // If neither has a distance, sort alphabetically by name
        if (a.distance === undefined && b.distance === undefined) {
            return (a.name || '').localeCompare(b.name || '');
        }
        
        // If only one has a distance, the one with distance comes first
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        
        // Otherwise, sort by distance
        return a.distance - b.distance;
    });
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
}

// Convert degrees to radians
function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Format distance for display
function formatDistance(km) {
    if (km === undefined) return '';
    
    // Convert to miles
    const miles = km * 0.621371;
    
    // Format based on distance
    if (km < 1) {
        return `${Math.round(km * 1000)}m / ${Math.round(miles * 5280)}ft`;
    } else if (km < 10) {
        return `${km.toFixed(1)}km / ${miles.toFixed(1)}mi`;
    } else {
        return `${Math.round(km)}km / ${Math.round(miles)}mi`;
    }
}

// Update status message
function updateStatusMessage(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `alert alert-${type} mt-2`;
    statusMessage.style.display = 'block';
    
    // Only auto-hide for non-distance related messages
    if (!message.includes('sorted by distance from') && !message.includes('Location set to')) {
        // Use longer timeout for category filter success messages
        const timeout = message.includes('Filtered by category:') ? 8000 : 5000;
        setTimeout(() => {
            // Save current scroll position before hiding the message
            const scrollPos = window.scrollY;
            
            // Hide the message
            statusMessage.style.display = 'none';
            
            // Restore scroll position after the DOM has updated
            setTimeout(() => {
                window.scrollTo({
                    top: scrollPos,
                    behavior: 'auto' // Use 'auto' to avoid another smooth scroll animation
                });
            }, 10);
        }, timeout);
    }
}

// Set view mode (card or list)
function setViewMode(mode) {
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const mapViewBtn = document.getElementById('mapViewBtn');
    const cardView = document.getElementById('cardView');
    const listView = document.getElementById('listView');
    const mapView = document.getElementById('mapView');

    // First hide all views
    cardView.style.display = 'none';
    listView.style.display = 'none';
    mapView.style.display = 'none';
    
    // Reset all buttons
    cardViewBtn.classList.remove('active');
    listViewBtn.classList.remove('active');
    mapViewBtn.classList.remove('active');
    
    // Show the selected view
    if (mode === 'card') {
        cardViewBtn.classList.add('active');
        cardView.style.display = 'block';
    } else if (mode === 'list') {
        listViewBtn.classList.add('active');
        listView.style.display = 'block';
    } else if (mode === 'map') {
        mapViewBtn.classList.add('active');
        mapView.style.display = 'block';
        
        // Initialize or refresh the directory map
        setTimeout(() => {
            if (!directoryMap) {
                // Initialize map on first view
                initDirectoryMap();
            }
            
            // Refresh existing map
            directoryMap.invalidateSize();
            
            // Get businesses with location data
            const businessesWithLocation = filteredBusinesses.filter(business => 
                (business.latitude && business.longitude) || 
                (business.coordinates && business.coordinates.lat && business.coordinates.lng)
            );
            
            // Update markers on the map
            addDirectoryMapMarkers(businessesWithLocation);
            
            // If user location is set, zoom to that area
            if (userLocation) {
                directoryMap.setView([userLocation.lat, userLocation.lng], 10);
            } else {
                // Otherwise show all businesses
                fitDirectoryMapToBounds();
            }
        }, 100);
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    if (isNaN(date)) return 'Invalid date';

    // Format: March 11, 2025
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Check if a business has location information
function hasLocationInfo(business) {
    return business.city || business.region || business.country;
}

// Get location display text for a business
function getLocationDisplay(business) {
    let locationString = '';
    
    // Add location information if available
    if (hasLocationInfo(business)) {
        const locationParts = [];
        if (business.city) locationParts.push(business.city);
        if (business.region) locationParts.push(business.region);
        if (business.country) locationParts.push(business.country);
        locationString = locationParts.join(', ');
    }
    
    // Add Global/Online status if applicable
    if (isGlobalOrOnline(business)) {
        if (locationString) {
            locationString += ' • ';
        }
        locationString += '<span class="text-dark">Global/Online</span>';
    } else if (!locationString) {
        locationString = '<em>No location information available</em>';
    }
    
    return locationString;
}

// Generate HTML for category badges
function getCategoryBadgesHTML(categories) {
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
        return '<span class="category-badge" onclick="return filterByCategory(\'Uncategorized\', event)">Uncategorized</span>';
    }
    
    // Sort categories alphabetically
    const sortedCategories = [...categories].sort();
    
    return sortedCategories.map(category => 
        `<span class="category-badge" onclick="return filterByCategory('${category.replace(/'/g, "\\'")}', event)">${category}</span>`
    ).join(' ');
}

// New function to filter by a category when a badge is clicked
function filterByCategory(category, event) {
    // Get the event object properly
    event = event || window.event;
    
    // Make sure the event doesn't propagate to parent elements
    if (event) {
        event.stopPropagation();
    }
    
    // Update the category dropdown
    const categoryFilter = document.getElementById('categoryFilter');
    
    // Find the option with this category
    for (let i = 0; i < categoryFilter.options.length; i++) {
        if (categoryFilter.options[i].value === category) {
            categoryFilter.selectedIndex = i;
            break;
        }
    }
    
    // Apply the filter while preserving location settings
    handleFilterChange();
    
    // If in detail view, return to list view to see the filtered results
    if (inDetailView) {
        showListView();
        
        // Scroll the filter section into view with a slight delay to ensure it works after the message appears
        setTimeout(() => {
            document.querySelector('.filter-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    } else {
        // Only show success message when not in detail view
        updateStatusMessage(`Filtered by category: ${category}`, 'success');
        
        // Scroll the filter section into view with a slight delay
        setTimeout(() => {
            document.querySelector('.filter-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
    
    // Return false to prevent default behavior
    return false;
}

// Display businesses in the selected view
function displayBusinesses(businesses) {
    const businessList = document.getElementById('businessList');
    const businessListTable = document.getElementById('businessListTable');
    const noResults = document.getElementById('noResults');
    const distanceColumn = document.querySelector('.distance-column');

    // Ensure businesses are sorted by name by default if no sorting is applied
    if (!currentSortColumn) {
        businesses.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Show/hide distance column based on user location
    if (userLocation) {
        distanceColumn.style.display = 'table-cell';
    } else {
        distanceColumn.style.display = 'none';
    }

    // Clear current lists
    businessList.innerHTML = '';
    businessListTable.innerHTML = '';

    if (businesses.length === 0) {
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';

    // Add businesses to both views
    businesses.forEach(business => {
        // Get location display text
        const locationDisplay = getLocationDisplay(business);
        
        // Distance badge HTML based on business type and location
        let distanceBadgeHtml = '';
        
        // Generate distance badge if the business has distance data, regardless of Global/Online status
        if (business.distance !== undefined) {
            if (business.hasApproximateLocation) {
                // Approximate distance badge
                distanceBadgeHtml = `<div class="distance-badge" title="Coordinates: ${business.coordinates.lat.toFixed(4)}, ${business.coordinates.lng.toFixed(4)} (based on ${business.locationType})" style="background-color: #fff3cd; color: #664d03;">
                    <i class="bi bi-geo-alt me-1"></i>${formatDistance(business.distance)} (approx.)
                    <!-- distance debugging
                    <div class="small text-muted mt-1">
                        Using: ${business.coordinates.lat.toFixed(4)}, ${business.coordinates.lng.toFixed(4)}
                        <br>Location Type: ${business.locationType}
                    </div>
                    -->
                </div>`;
            } else {
                // Regular distance badge
                distanceBadgeHtml = `<div class="distance-badge" title="Coordinates: ${business.coordinates.lat.toFixed(4)}, ${business.coordinates.lng.toFixed(4)} (based on ${business.locationType})" >
                    <i class="bi bi-geo-alt me-1"></i>${formatDistance(business.distance)}
                    <!-- distance debugging
                    <div class="small text-muted mt-1">
                        Using: ${business.coordinates.lat.toFixed(4)}, ${business.coordinates.lng.toFixed(4)}
                        <br>Location Type: ${business.locationType}
                    </div>
                    -->
                </div>`;
            }
            
            // Add Global/Online label to the badge if applicable
            if (business.isGlobalOrOnline && !distanceBadgeHtml.includes('Global/Online')) {
                const badgeParts = distanceBadgeHtml.split('</div>');
                if (badgeParts.length >= 2) {
                    // Add Global/Online info inside the html comment for debugging
                    const indexToInsert = badgeParts[badgeParts.length - 2].indexOf('<!-- distance debugging');
                    if (indexToInsert !== -1) {
                        const before = badgeParts[badgeParts.length - 2].substring(0, indexToInsert + 22); // +22 to include the comment
                        const after = badgeParts[badgeParts.length - 2].substring(indexToInsert + 22);
                        badgeParts[badgeParts.length - 2] = before + `
                        <div class="small text-muted mt-1">
                            <i class="bi bi-globe2 me-1"></i>Global/Online business with physical location
                        </div>
                        ` + after;
                    }
                    distanceBadgeHtml = badgeParts.join('</div>');
                }
            }
        }
        // No badge for businesses without distance data
        
        // Normalize and sort categories
        let categories = [];
        if (business.categories && Array.isArray(business.categories)) {
            categories = [...business.categories].filter(category => category).sort();
        } else if (business.category) {
            categories = [business.category];
        } else {
            categories = ['Uncategorized'];
        }
        
        // Get category badges
        const categoriesHTML = `<div class="categories-container">${getCategoryBadgesHTML(categories)}</div>`;
        
        // Card view
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4 mb-4';
        
        // Add location-sorting-active class if distance is available and not approximate
        const cardClasses = (business.distance !== undefined) ? 
            'card business-card h-100 location-sorting-active' : 'card business-card h-100';

        card.innerHTML = `
            <div class="${cardClasses}" onclick="showBusinessDetail('${business.slug}')">
                <div class="card-body">
                    <h5 class="card-title">${business.name}</h5>
                    <p class="card-text ${isGlobalOrOnline(business) ? 'text-dark' : 'text-muted'}">
                        ${locationDisplay}
                    </p>
                    ${categoriesHTML}
                    ${distanceBadgeHtml}
                </div>
            </div>
        `;
        businessList.appendChild(card);

        // List view
        const row = document.createElement('tr');
        row.className = (business.distance !== undefined) ? 
            'business-list-item location-sorting-active' : 'business-list-item';
        row.onclick = function() { showBusinessDetail(business.slug); };
        
        // Use location display without distance badge
        let locationWithDistance = '';
        
        // Add location information if available
        if (hasLocationInfo(business)) {
            const locationParts = [];
            if (business.city) locationParts.push(business.city);
            if (business.region) locationParts.push(business.region);
            if (business.country) locationParts.push(business.country);
            locationWithDistance = locationParts.join(', ');
        }
        
        // Add Global/Online status if applicable
        if (isGlobalOrOnline(business)) {
            if (locationWithDistance) {
                locationWithDistance += ' • ';
            }
            locationWithDistance += '<span class="text-dark">Global/Online</span>';
        } else if (!locationWithDistance) {
            locationWithDistance = '<em>No location information available</em>';
        }

        // Create website/social column content
        let websiteSocialContent = '';
        if (business.website) {
            const websiteUrl = business.website.startsWith('http') ? business.website : `https://${business.website}`;
            websiteSocialContent += `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="social-link" title="Website: ${business.website}">
                <img src="images/icons/websiteIcon.svg" alt="Website" style="width: 16px; height: 16px;">
            </a>`;
        }
        
        // Add social media icons if available
        if (business.socialMedia && Object.keys(business.socialMedia).length > 0) {
            Object.entries(business.socialMedia).forEach(([platform, value]) => {
                if (value) {
                    const platformName = getPlatformName(platform);
                    if (platform.toLowerCase() === 'nostr') {
                        websiteSocialContent += `
                            <a href="${getSocialUrl(platform, value)}" target="_blank" rel="noopener noreferrer" class="social-link" title="${platformName}: ${value}">
                                <img src="images/icons/nostr_logo_blk.svg" alt="Nostr" style="width: 16px; height: 16px;">
                            </a>
                        `;
                    } else if (platform.toLowerCase() === 'matrix') {
                        websiteSocialContent += `
                            <a href="${getSocialUrl(platform, value)}" target="_blank" rel="noopener noreferrer" class="social-link" title="${platformName}: ${value}">
                                <img src="images/icons/matrixIcon.svg" alt="Matrix" style="width: 16px; height: 16px;">
                            </a>
                        `;
                    } else {
                        websiteSocialContent += `
                            <a href="${getSocialUrl(platform, value)}" target="_blank" rel="noopener noreferrer" class="social-link" title="${platformName}: ${value}">
                                <i class="bi ${getSocialMediaIcon(platform)}"></i>
                            </a>
                        `;
                    }
                }
            });
        }

        // Create row HTML with conditional distance column
        let rowHTML = `
            <td>${business.name}</td>
            <td>${categoriesHTML}</td>
            <td class="${isGlobalOrOnline(business) ? 'text-dark' : ''}">${locationWithDistance}</td>
            ${userLocation ? `<td class="distance-column">${distanceBadgeHtml || ''}</td>` : ''}
            <td class="text-start ps-0" style="white-space: nowrap;">${websiteSocialContent || '<em>Not available</em>'}</td>
        `;

        row.innerHTML = rowHTML;
        businessListTable.appendChild(row);
    });

    // After displaying businesses, if we're in list view and have a current sort,
    // update the header styles
    if (currentSortColumn) {
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.sort === currentSortColumn) {
                header.classList.add(`sort-${currentSortDirection}`);
            }
        });
    }
}

// Get social media icon
function getSocialMediaIcon(platform) {
    const icons = {
        'twitter': 'bi-twitter-x',
        'facebook': 'bi-facebook',
        'instagram': 'bi-instagram',
        'linkedin': 'bi-linkedin',
        'youtube': 'bi-youtube',
        'telegram': 'bi-telegram',
        'signal': 'bi-chat-dots-fill',
        'whatsapp': 'bi-whatsapp',
        'discord': 'bi-discord',
        'reddit': 'bi-reddit',
        'github': 'bi-github',
        'mastodon': 'bi-mastodon',
        'nostr': 'bi-key-fill',
        'matrix': 'bi-chat-square-text-fill',
        'keet': 'bi-chat-fill'
    };
    
    return icons[platform.toLowerCase()] || 'bi-link-45deg';
}

// Get friendly platform name
function getPlatformName(platform) {
    const names = {
        'twitter': 'Twitter',
        'facebook': 'Facebook',
        'instagram': 'Instagram',
        'linkedin': 'LinkedIn',
        'youtube': 'YouTube',
        'telegram': 'Telegram',
        'signal': 'Signal',
        'whatsapp': 'WhatsApp',
        'discord': 'Discord',
        'reddit': 'Reddit',
        'github': 'GitHub',
        'mastodon': 'Mastodon',
        'nostr': 'Nostr',
        'matrix': 'Matrix',
        'keet': 'Keet'
    };
    
    return names[platform.toLowerCase()] || platform;
}

// Get URL for social platform
function getSocialUrl(platform, value) {
    // Check if value is already a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }
    
    switch(platform.toLowerCase()) {
        case 'facebook':
            return `https://facebook.com/${value}`;
        case 'instagram':
            return `https://instagram.com/${value.replace('@', '')}`;
        case 'linkedin':
            return `https://linkedin.com/in/${value}`;
        case 'youtube':
            return `https://youtube.com/${value}`;
        case 'telegram':
            return value.startsWith('http') ? value : `https://t.me/${value}`;
        case 'signal':
            return `signal://${value}`;
        case 'whatsapp':
            return `https://wa.me/${value.replace(/[+\s-]/g, '')}`;
        case 'discord':
            return `#`;
        case 'reddit':
            return `https://reddit.com/user/${value}`;
        case 'github':
            return `https://github.com/${value}`;
        case 'mastodon':
            if (value.includes('@')) {
                const parts = value.split('@');
                if (parts.length === 3) {
                    return `https://${parts[2]}/@${parts[1]}`;
                }
            }
            return `#`;
        case 'nostr':
            return `https://njump.me/${value}`;
        case 'twitter':
            return `https://twitter.com/${value.replace('@', '')}`;
        case 'matrix':
            return value; // Use the Matrix URL directly from the JSON file
        default:
            return `#`;
    }
}

// Generate shareable URL for a business
function generateShareableUrl(businessSlug) {
    // Get the base URL (without any parameters)
    const url = new URL(window.location.href);
    url.search = ''; // Clear any existing parameters

    // Add the business slug parameter
    url.searchParams.set('business', businessSlug);

    return url.href;
}

// Copy share link to clipboard
function copyShareLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');

    // Show success message
    const copySuccess = document.getElementById('copySuccess');
    copySuccess.style.display = 'inline';

    // Hide success message after 2 seconds
    setTimeout(() => {
        copySuccess.style.display = 'none';
    }, 2000);
}

// Show business detail view
function showBusinessDetail(businessSlug) {
    // Try to find the business in filtered results first
    let business = filteredBusinesses.find(b => b.slug === businessSlug);
    
    // If not found in filtered results but there is a valid slug, 
    // look in all businesses (for direct links)
    if (!business && businessSlug) {
        business = allBusinesses.find(b => b.slug === businessSlug);
        
        // If found in all businesses but not in filtered,
        // clear filters to ensure the business is visible
        if (business) {
            clearFilters();
        }
    }
    
    if (!business) return;
    
    // Log debug information for Global/Online businesses with location data
    if (business.isGlobalOrOnline && hasLocationInfo(business)) {
        console.log(`Detail view: Global/Online business with location: ${business.name}`);
        console.log(`  Location: ${business.city || ''}, ${business.region || ''}, ${business.country || ''}`);
        console.log(`  Has coordinates: ${business.coordinates && business.coordinates.lat ? 'Yes' : 'No'}`);
        if (business.coordinates) {
            console.log(`  Coordinates: ${business.coordinates.lat}, ${business.coordinates.lng}`);
        }
        console.log(`  Distance: ${business.distance !== undefined ? business.distance.toFixed(2) + ' km' : 'undefined'}`);
    }
    
    // Set current business
    currentBusinessSlug = businessSlug;
    inDetailView = true;

    // Handle logo display
    const logoContainer = document.getElementById('businessLogo');
    if (business.logoUrl) {
        // Create image with error handling
        const img = new Image();
        img.alt = `${business.name} logo`;
        
        // Handle loading errors - hide container if image fails to load
        img.onerror = function() {
            logoContainer.style.display = 'none';
        };
        
        // Set display and add image to container on successful load
        img.onload = function() {
            logoContainer.style.display = 'flex';
            logoContainer.appendChild(img);
        };
        
        // Clear previous content and start loading
        logoContainer.innerHTML = '';
        img.src = business.logoUrl;
    } else {
        logoContainer.style.display = 'none';
    }

    // Populate detail fields
    document.getElementById('detailName').textContent = business.name;
    
    // Display categories as badges
    const categoriesContainer = document.getElementById('detailCategories');
    if (business.categories && Array.isArray(business.categories) && business.categories.length > 0) {
        categoriesContainer.innerHTML = getCategoryBadgesHTML(business.categories);
    } else if (business.category) {
        // Fallback to single category
        categoriesContainer.innerHTML = `<span class="category-badge" onclick="return filterByCategory('${business.category.replace(/'/g, "\\'")}', event)">${business.category}</span>`;
    } else {
        // No categories
        categoriesContainer.innerHTML = '<span class="category-badge" onclick="return filterByCategory(\'Uncategorized\', event)">Uncategorized</span>';
    }

    // Handle location display based on business type
    const locationEl = document.getElementById('detailLocation');
    let locationString = '';
    
    // Add location information if available
    if (hasLocationInfo(business)) {
        const locationParts = [];
        if (business.city) locationParts.push(business.city);
        if (business.region) locationParts.push(business.region);
        if (business.country) locationParts.push(business.country);
        locationString = locationParts.join(', ');
    }
    
    // Add Global/Online status if applicable
    if (isGlobalOrOnline(business)) {
        if (locationString) {
            locationString += ' • ';
        }
        locationString += '<span class="text-dark">Global/Online</span>';
    } else if (!locationString) {
        locationString = '<em>No location information available</em>';
    }
    
    // Add distance info if available
    if (business.hasApproximateLocation && business.distance !== undefined) {
        locationString += ` <span class="distance-badge ms-2" title="Coordinates: ${business.coordinates.lat.toFixed(4)}, ${business.coordinates.lng.toFixed(4)} (based on ${business.locationType})" style="background-color: #fff3cd; color: #664d03;">
            <i class="bi bi-geo-alt-fill me-1"></i>${formatDistance(business.distance)} (approximate)
        </span>`;
    } else if (business.distance !== undefined) {
        locationString += ` <span class="distance-badge ms-2" title="Coordinates: ${business.coordinates.lat.toFixed(4)}, ${business.coordinates.lng.toFixed(4)} (based on ${business.locationType})">
            <i class="bi bi-geo-alt-fill me-1"></i>${formatDistance(business.distance)} from you
        </span>`;
    } else if (business.distanceUnavailable) {
        locationString += ` <span class="distance-badge ms-2" style="background-color: #f8f9fa; color: #6c757d;">
            <i class="bi bi-question-circle me-1"></i>Unable to calculate distance
        </span>`;
    }
    
    locationEl.innerHTML = locationString;

    if (business.website) {
        const websiteUrl = business.website.startsWith('http') ? business.website : `https://${business.website}`;
        document.getElementById('detailWebsite').innerHTML = `<a href="${websiteUrl}" target="_blank">${business.website}</a>`;
    } else {
        document.getElementById('detailWebsite').textContent = 'Not available';
    }

    document.getElementById('detailPhone').textContent = business.phone || 'Not available';
    document.getElementById('detailOwner').textContent = business.owner || 'Not specified';
    document.getElementById('detailEmail').innerHTML = business.email ? 
        `<a href="mailto:${business.email}">${business.email}</a>` : 'Not available';
    document.getElementById('detailDescription').textContent = business.description || 'No description available';

    // Payment methods
    const paymentMethodsEl = document.getElementById('detailPaymentMethods');
    paymentMethodsEl.innerHTML = '';

    if (business.paymentMethods) {
        if (business.paymentMethods.onchain) {
            const onchainBadge = document.createElement('span');
            onchainBadge.className = 'payment-badge onchain-badge';
            onchainBadge.textContent = 'Bitcoin Onchain';
            paymentMethodsEl.appendChild(onchainBadge);
        }

        if (business.paymentMethods.lightning) {
            const lightningBadge = document.createElement('span');
            lightningBadge.className = 'payment-badge lightning-badge';
            lightningBadge.textContent = 'Lightning Network';
            paymentMethodsEl.appendChild(lightningBadge);
        }
        
        if (business.paymentMethods.ecash) {
            const ecashBadge = document.createElement('span');
            ecashBadge.className = 'payment-badge ecash-badge';
            ecashBadge.textContent = 'eCash';
            paymentMethodsEl.appendChild(ecashBadge);
        }
        
        if (business.paymentMethods.fedi) {
            const fediBadge = document.createElement('span');
            fediBadge.className = 'payment-badge fedi-badge';
            fediBadge.textContent = 'Fedi';
            paymentMethodsEl.appendChild(fediBadge);
        }
        
        if (business.paymentMethods.liquid) {
            const liquidBadge = document.createElement('span');
            liquidBadge.className = 'payment-badge liquid-badge';
            liquidBadge.textContent = 'Liquid BTC';
            paymentMethodsEl.appendChild(liquidBadge);
        }
        
        if (!business.paymentMethods.onchain && !business.paymentMethods.lightning && 
            !business.paymentMethods.ecash && !business.paymentMethods.fedi && 
            !business.paymentMethods.liquid) {
            paymentMethodsEl.textContent = 'Not specified';
        }
    } else {
        paymentMethodsEl.textContent = 'Not specified';
    }

    // Social media icons
    const socialLinks = document.getElementById('socialLinks');
    socialLinks.innerHTML = '';
    
    if (business.socialMedia && Object.keys(business.socialMedia).length > 0) {
        // Add social media icons
        Object.entries(business.socialMedia).forEach(([platform, value]) => {
            if (value) {
                const link = document.createElement('a');
                link.href = getSocialUrl(platform, value);
                link.className = 'social-link';
                if (platform.toLowerCase() !== 'signal' && platform.toLowerCase() !== 'nostr') {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                }
                
                const platformName = getPlatformName(platform);
                
                if (platform.toLowerCase() === 'nostr') {
                    link.innerHTML = `
                        <img src="images/icons/nostr_logo_blk.svg" alt="Nostr" style="width: 16px; height: 16px;">
                        <div class="social-tooltip">${platformName}: ${value}</div>
                    `;
                } else if (platform.toLowerCase() === 'matrix') {
                    link.innerHTML = `
                        <img src="images/icons/matrixIcon.svg" alt="Matrix" style="width: 16px; height: 16px;">
                        <div class="social-tooltip">${platformName}: ${value}</div>
                    `;
                } else {
                    link.innerHTML = `
                        <i class="bi ${getSocialMediaIcon(platform)}"></i>
                        <div class="social-tooltip">${platformName}: ${value}</div>
                    `;
                }
                
                socialLinks.appendChild(link);
            }
        });
        
        // Show the links as flex
        socialLinks.style.display = 'flex';
    } else {
        // Show message when no social media is available
        socialLinks.innerHTML = '<p class="text-muted fst-italic">No social media accounts available</p>';
        socialLinks.style.display = 'block';
    }

// Last verified
const lastVerifiedEl = document.getElementById('detailLastVerified');
lastVerifiedEl.textContent = business.lastVerified ? 
`Last verified: ${formatDate(business.lastVerified)}` : '';

// Submitted by
const submittedByEl = document.getElementById('detailSubmittedBy');
submittedByEl.textContent = business.submittedBy ? 
`Submitted by: ${business.submittedBy}` : '';



    // Set shareable link
    const shareLink = document.getElementById('shareLink');
    shareLink.value = generateShareableUrl(business.slug);

    // Update URL without reloading the page
    const url = new URL(window.location.href);
    url.searchParams.set('business', business.slug);
    window.history.pushState({}, '', url);

    // Switch views
    document.getElementById('businessListing').style.display = 'none';
    document.getElementById('businessDetail').style.display = 'block';
    
    // Clear any filter warning messages
    document.getElementById('filterStatus').innerHTML = '';
    
    // Hide any status messages when viewing business details
    document.getElementById('statusMessage').style.display = 'none';
    
    // Scroll to a position just above the business details box
    window.scrollTo({
        top: document.querySelector('#businessDetail').offsetTop - 20,
        behavior: 'smooth'
    });
}

// Show list view
function showListView() {
    // Update URL to remove business slug
    const url = new URL(window.location.href);
    url.searchParams.delete('business');
    window.history.pushState({}, '', url);
    
    // Reset current business
    currentBusinessSlug = null;
    inDetailView = false;

    // Show listing and hide detail
    document.getElementById('businessDetail').style.display = 'none';
    document.getElementById('businessListing').style.display = 'block';
    
    // Update filter status for list view
    updateFilterStatus();
}

// Function to handle sorting
function handleSort(column) {
    // If clicking the same column, toggle direction
    if (column === currentSortColumn) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    // Update header styles
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sort === column) {
            header.classList.add(`sort-${currentSortDirection}`);
        }
    });

    // Sort the businesses
    sortBusinesses(column, currentSortDirection);
}

// Function to sort businesses
function sortBusinesses(column, direction) {
    const multiplier = direction === 'asc' ? 1 : -1;

    filteredBusinesses.sort((a, b) => {
        switch (column) {
            case 'name':
                return multiplier * a.name.localeCompare(b.name);
            
            case 'categories':
                const catA = a.categories ? a.categories[0] || '' : '';
                const catB = b.categories ? b.categories[0] || '' : '';
                return multiplier * catA.localeCompare(catB);
            
            case 'location':
                // Sort by location string
                const locA = getLocationString(a);
                const locB = getLocationString(b);
                return multiplier * locA.localeCompare(locB);
            
            case 'distance':
                // If we have user location and distances, sort by distance
                if (userLocation) {
                    // Handle different cases for distance sorting
                    if (a.distance === undefined && b.distance === undefined) {
                        return 0;
                    }
                    if (a.distance === undefined) return 1;
                    if (b.distance === undefined) return -1;
                    return multiplier * (a.distance - b.distance);
                }
                return 0;
            
            case 'owner':
                const ownerA = a.owner || '';
                const ownerB = b.owner || '';
                return multiplier * ownerA.localeCompare(ownerB);
            
            default:
                return 0;
        }
    });

    // Redisplay the sorted businesses
    displayBusinesses(filteredBusinesses);
}

// Helper function to get location string for sorting
function getLocationString(business) {
    if (isGlobalOrOnline(business)) {
        return 'zzz'; // Make global/online businesses appear last when sorting by location
    }
    
    let parts = [];
    if (business.city) parts.push(business.city);
    if (business.region) parts.push(business.region);
    if (business.country) parts.push(business.country);
    return parts.join(', ') || 'zzz';
}


// Show business details when marker is clicked
function showDirectoryMapBusinessDetail(businessId) {
    console.log('Showing business detail for ID:', businessId);
    
    // Find the business in our data
    let business = null;
    
    // First try direct match
    business = allBusinesses.find(b => b.id === businessId);
    
    // If not found, try string comparison
    if (!business) {
        business = allBusinesses.find(b => b.id && b.id.toString() === businessId);
    }
    
    // If still not found, try numeric comparison
    if (!business && !isNaN(businessId)) {
        const numericId = Number(businessId);
        business = allBusinesses.find(b => b.id === numericId);
    }
    
    if (!business) {
        console.error('Business not found with ID:', businessId);
        console.log('Available business IDs:', allBusinesses.map(b => b.id));
        return;
    }
    
    console.log('Found business:', business.name);
    
    // Find and highlight the business in the directory list
    const businessItem = document.querySelector(`#directoryMapBusinessList tr[data-id="${businessId}"]`);
    if (businessItem) {
        // Remove highlight from all items
        document.querySelectorAll('#directoryMapBusinessList tr').forEach(item => 
            item.classList.remove('selected')
        );
        
        // Add highlight to this item
        businessItem.classList.add('selected');
        
        // Scroll to the item
        businessItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Find the marker for this business and highlight it
    directoryMarkers.forEach(marker => {
        // Remove highlight from all markers
        if (marker._icon) {
            marker._icon.classList.remove('marker-selected');
        }
        
        // Compare IDs as strings to avoid type issues
        const markerBusinessId = marker.options.businessId ? marker.options.businessId.toString() : '';
        const currentBusinessId = businessId ? businessId.toString() : '';
        
        // Add highlight to this marker
        if (markerBusinessId === currentBusinessId && marker._icon) {
            console.log('Highlighting marker for business ID:', businessId);
            marker._icon.classList.add('marker-selected');
            
            // Center map on this marker
            directoryMap.setView(marker.getLatLng(), Math.max(directoryMap.getZoom(), 12));
        }
    });
    
    // Show business details in the map detail panel
    const detailPanel = document.getElementById('directoryMapBusinessDetail');
    
    // Fill in details
    document.getElementById('directoryMapDetailName').textContent = business.name;
    document.getElementById('directoryMapDetailCategories').innerHTML = getCategoryBadgesHTML(business.categories);
    document.getElementById('directoryMapDetailLocation').innerHTML = getLocationDisplay(business);
    
    // Website
    const websiteContainer = document.getElementById('directoryMapDetailWebsite');
    if (business.website) {
        websiteContainer.innerHTML = `<a href="${business.website}" target="_blank" rel="noopener noreferrer">${business.website}</a>`;
    } else {
        websiteContainer.textContent = 'Not available';
    }
    
    // Description
    const descriptionContainer = document.getElementById('directoryMapDetailDescription');
    if (business.description) {
        descriptionContainer.textContent = business.description;
    } else {
        descriptionContainer.innerHTML = '<em>No description available</em>';
    }
    
    // Payment methods
    const paymentContainer = document.getElementById('directoryMapDetailPaymentMethods');
    paymentContainer.innerHTML = '';
    
    if (business.paymentMethods) {
        if (business.paymentMethods.onchain) {
            const badge = document.createElement('span');
            badge.className = 'payment-badge onchain-badge';
            badge.textContent = 'Bitcoin Onchain';
            paymentContainer.appendChild(badge);
        }
        
        if (business.paymentMethods.lightning) {
            const badge = document.createElement('span');
            badge.className = 'payment-badge lightning-badge';
            badge.textContent = 'Lightning Network';
            paymentContainer.appendChild(badge);
        }
        
        if (!business.paymentMethods.onchain && !business.paymentMethods.lightning) {
            paymentContainer.textContent = 'Not specified';
        }
    } else {
        paymentContainer.textContent = 'Not specified';
    }
    
    // Social media
    const socialContainer = document.getElementById('directoryMapDetailSocial');
    socialContainer.innerHTML = '';
    
    if (business.socialMedia && Object.keys(business.socialMedia).length > 0) {
        Object.entries(business.socialMedia).forEach(([platform, value]) => {
            if (value) {
                const link = document.createElement('a');
                link.href = getSocialUrl(platform, value);
                link.className = 'social-link';
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                
                link.innerHTML = `
                    <i class="bi ${getSocialMediaIcon(platform)}"></i>
                    <div class="social-tooltip">${getPlatformName(platform)}: ${value}</div>
                `;
                
                socialContainer.appendChild(link);
            }
        });
    } else {
        socialContainer.innerHTML = '<p class="text-muted fst-italic">No social media accounts available</p>';
    }
    
    // Show detail panel
    detailPanel.style.display = 'block';
    
    // Set up close button if not already
    document.getElementById('closeDirectoryMapDetail').onclick = function() {
        detailPanel.style.display = 'none';
        
        // Remove marker highlights
        document.querySelectorAll('.marker-selected').forEach(el => 
            el.classList.remove('marker-selected')
        );
        
        // Remove list item highlights
        document.querySelectorAll('#directoryMapBusinessList tr.selected').forEach(item => 
            item.classList.remove('selected')
        );
    };
}

// Initialize the directory map
function initDirectoryMap() {
    // Make sure map container is visible
    document.getElementById('mapView').style.display = 'block';
    
    // Initialize map
    directoryMap = L.map('directoryMap').setView([0, 0], 2);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(directoryMap);
    
    // Add scale control
    L.control.scale().addTo(directoryMap);
    
    // Force map to resize properly after a short delay
    setTimeout(() => {
        directoryMap.invalidateSize();
    }, 100);
}

// Add business markers to the directory map
function addDirectoryMapMarkers(businesses) {
    // Clear existing markers
    if (directoryMarkers) {
        directoryMarkers.forEach(marker => directoryMap.removeLayer(marker));
    }
    directoryMarkers = [];
    
    // Check if we have businesses to display
    if (!businesses || businesses.length === 0) {
        // Show a message on the map
        const noLocationDiv = document.createElement('div');
        noLocationDiv.className = 'no-locations-message';
        noLocationDiv.innerHTML = '<h4>No businesses with location data</h4><p>No businesses in the current filter have location information</p>';
        
        document.getElementById('directoryMap').innerHTML = '';
        document.getElementById('directoryMap').appendChild(noLocationDiv);
        return;
    }
    
    // Group businesses by coordinates to handle multiple businesses at same location
    const businessesByCoords = {};
    
    businesses.forEach(business => {
        // Get coordinates regardless of format
        const lat = business.latitude || (business.coordinates && business.coordinates.lat);
        const lng = business.longitude || (business.coordinates && business.coordinates.lng);
        
        if (lat && lng) {
            const coordKey = `${lat},${lng}`;
            if (!businessesByCoords[coordKey]) {
                businessesByCoords[coordKey] = [];
            }
            businessesByCoords[coordKey].push(business);
        }
    });
    
    // Process each coordinate group
    Object.keys(businessesByCoords).forEach(coordKey => {
        const [lat, lng] = coordKey.split(',').map(Number);
        const businessesAtLocation = businessesByCoords[coordKey];
        
        let marker;
        if (businessesAtLocation.length === 1) {
            // Single business at this location
            const business = businessesAtLocation[0];
            const firstLetter = business.name.charAt(0).toUpperCase();
            
            // Create marker with custom icon (first letter of business name)
            const icon = L.divIcon({
                html: `<div class="map-marker">${firstLetter}</div>`,
                className: '',
                iconSize: [30, 30]
            });
            
            // Store business ID as a string to avoid type issues
            const businessId = business.id ? business.id.toString() : '';
            
            marker = L.marker([lat, lng], { 
                icon: icon,
                businessId: businessId
            })
                .addTo(directoryMap)
                .on('click', () => {
                    console.log('Marker clicked for business:', business.name, 'ID:', businessId);
                    showDirectoryMapBusinessDetail(businessId);
                });
                
            // Add tooltip with business name
            marker.bindTooltip(business.name);
        } else {
            // Multiple businesses at this location
            const icon = L.divIcon({
                html: `<div class="map-marker-cluster">${businessesAtLocation.length}</div>`,
                className: '',
                iconSize: [40, 40]
            });
            
            marker = L.marker([lat, lng], { icon: icon })
                .addTo(directoryMap)
                .on('click', () => {
                    // Show list of businesses at this location
                    console.log('Cluster marker clicked with', businessesAtLocation.length, 'businesses');
                    showMultipleBusinessesDetail(businessesAtLocation);
                });
                
            // Add tooltip with count of businesses
            marker.bindTooltip(`${businessesAtLocation.length} businesses at this location`);
        }
        
        directoryMarkers.push(marker);
    });
    
    // Fit map to bounds
    fitDirectoryMapToBounds();
}

// Display businesses in the map business list
function displayDirectoryMapBusinessList(businesses) {
    const mapBusinessList = document.getElementById('directoryMapBusinessList');
    mapBusinessList.innerHTML = '';
    
    if (!businesses || businesses.length === 0) {
        mapBusinessList.innerHTML = '<tr><td colspan="5" class="text-center">No businesses found</td></tr>';
        return;
    }
    
    // Sort businesses by name
    const sortedBusinesses = [...businesses].sort((a, b) => a.name.localeCompare(b.name));
    
    // Add each business to the list
    sortedBusinesses.forEach(business => {
        const row = document.createElement('tr');
        row.className = 'business-list-item';
        row.dataset.id = business.id;
        
        // Determine if business has location data
        const hasLocation = (business.latitude && business.longitude) || 
                          (business.coordinates && business.coordinates.lat && business.coordinates.lng);
        
        // Highlight businesses with locations
        if (hasLocation) {
            row.className += ' has-location';
        }
        
        // Get location display text
        const locationDisplay = getLocationDisplay(business);
        
        // Generate categories HTML
        const categoriesHTML = getCategoryBadgesHTML(business.categories);
        
        // Create website/social column content
        let websiteSocialContent = '';
        if (business.website) {
            const websiteUrl = business.website.startsWith('http') ? business.website : `https://${business.website}`;
            websiteSocialContent += `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="social-link" title="Website: ${business.website}">
                <i class="bi bi-globe"></i>
            </a>`;
        }
        
        // Add social media icons if available
        if (business.socialMedia && Object.keys(business.socialMedia).length > 0) {
            Object.entries(business.socialMedia).forEach(([platform, value]) => {
                if (value) {
                    websiteSocialContent += `
                        <a href="${getSocialUrl(platform, value)}" target="_blank" rel="noopener noreferrer" class="social-link">
                            <i class="bi ${getSocialMediaIcon(platform)}"></i>
                        </a>
                    `;
                }
            });
        }
        
        // Create row HTML
        row.innerHTML = `
            <td>${business.name}</td>
            <td>${categoriesHTML}</td>
            <td>${locationDisplay}</td>
            <td class="text-start" style="white-space: nowrap;">${websiteSocialContent || '<em>Not available</em>'}</td>
        `;
        
        // Add click handler to show business details
        row.onclick = function() {
            showDirectoryMapBusinessDetail(business.id);
        };
        
        mapBusinessList.appendChild(row);
    });
}

// Show multiple businesses dialog when a cluster marker is clicked
function showMultipleBusinessesDetail(businesses) {
    console.log('Showing multiple businesses popup for businesses:', businesses);
    
    // Create content for the popup
    let content = `
        <div class="map-popup-businesses">
            <h5>${businesses.length} Businesses at this Location</h5>
            <ul class="map-popup-business-list">
    `;
    
    businesses.forEach(business => {
        // Create a data attribute for the business ID instead of an onClick handler
        content += `
            <li>
                <a href="#" class="business-popup-link" data-business-id="${business.id}">
                    ${business.name}
                </a>
            </li>
        `;
    });
    
    content += `
            </ul>
        </div>
    `;
    
    // Create and open a popup at the location of the first business
    const lat = businesses[0].latitude || businesses[0].coordinates.lat;
    const lng = businesses[0].longitude || businesses[0].coordinates.lng;
    
    const popup = L.popup()
        .setLatLng([lat, lng])
        .setContent(content)
        .openOn(directoryMap);
    
    // Add click handlers after the popup is added to the DOM
    setTimeout(() => {
        console.log('Setting up popup click handlers');
        const links = document.querySelectorAll('.business-popup-link');
        console.log('Found popup links:', links.length);
        
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const businessId = this.getAttribute('data-business-id');
                console.log('Popup link clicked for business ID:', businessId);
                popup.close();
                setTimeout(() => {
                    showDirectoryMapBusinessDetail(businessId);
                }, 50);
            });
        });
    }, 100);
}




// Function to fit directory map to show all businesses
function fitDirectoryMapToBounds() {
    if (!directoryMap) return;

    // Get businesses with valid coordinates
    const businessesWithLocation = filteredBusinesses.filter(business => 
        (business.latitude && business.longitude) || 
        (business.coordinates && business.coordinates.lat && business.coordinates.lng)
    );

    if (businessesWithLocation.length > 0) {
        // Create bounds object
        const bounds = L.latLngBounds();
        
        // Add all business coordinates to bounds
        businessesWithLocation.forEach(business => {
            const lat = business.latitude || business.coordinates.lat;
            const lng = business.longitude || business.coordinates.lng;
            bounds.extend([lat, lng]);
        });
        
        // Fit map to bounds with padding
        directoryMap.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 12
        });
    } else {
        // If no businesses with coordinates, show world view
        directoryMap.setView([20, 0], 2);
    }
}