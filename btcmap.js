// BTCMap integration module
// This file contains all the BTCMap functionality extracted from btcmap.html

// Region boundaries
const btcmapRegionBounds = {
    'worldwide': {
        center: [20, 0],
        zoom: 2,
        bounds: [[-60, -180], [85, 180]]
    },
    'north-america': {
        center: [39.8283, -98.5795],
        zoom: 4,
        bounds: [[14.0101, -168.1248], [71.3388, -52.3328]]
    },
    'central-america': {
        center: [15.7835, -90.2308],
        zoom: 5,
        bounds: [[7.0134, -117.1211], [32.7187, -77.1720]]
    },
    'south-america': {
        center: [-8.7832, -55.4915],
        zoom: 4,
        bounds: [[-55.9808, -81.3582], [12.4462, -34.7949]]
    },
    'europe': {
        center: [54.5260, 15.2551],
        zoom: 4,
        bounds: [[34.5428, -24.5673], [71.1854, 69.0601]]
    },
    'asia': {
        center: [34.0479, 100.6197],
        zoom: 3,
        bounds: [[-10.3600, 25.6506], [63.8605, 149.4126]]
    },
    'africa': {
        center: [8.7832, 34.5085],
        zoom: 3,
        bounds: [[-35.1364, -17.5866], [37.5681, 51.4128]]
    },
    'oceania': {
        center: [-25.2744, 133.7751],
        zoom: 4,
        bounds: [[-47.1853, 96.8181], [5.9336, 175.2919]]
    }
};

// Global variables for BTCMap
let btcmapMap;
let btcmapMarkers = [];
let btcmapBusinesses = [];
let btcmapFilteredBusinesses = [];
let btcmapSelectedBusinessId = null;
let btcmapUserLocation = null;
let btcmapCurrentSortColumn = null;
let btcmapCurrentSortDirection = 'asc';
let btcmapIsInitialized = false;

// Cache management functions
const BTCMAP_CACHE_VERSION = '1';
const BTCMAP_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function btcmapGetCacheKey(region) {
    return `btcmap_data_${region}_${BTCMAP_CACHE_VERSION}`;
}

function btcmapGetTimestampKey(region) {
    return `btcmap_timestamp_${region}_${BTCMAP_CACHE_VERSION}`;
}

function btcmapSaveToCache(region, data) {
    try {
        const timestamp = new Date().getTime();
        localStorage.setItem(btcmapGetCacheKey(region), JSON.stringify(data));
        localStorage.setItem(btcmapGetTimestampKey(region), timestamp.toString());
        console.log(`Cached ${data.length} businesses for ${region}`);
    } catch (error) {
        console.error('Error saving to cache:', error);
        // If localStorage is full, clear it and try again
        if (error.name === 'QuotaExceededError') {
            localStorage.clear();
            try {
                localStorage.setItem(btcmapGetCacheKey(region), JSON.stringify(data));
                localStorage.setItem(btcmapGetTimestampKey(region), new Date().getTime().toString());
            } catch (retryError) {
                console.error('Error saving to cache after clearing:', retryError);
            }
        }
    }
}

function btcmapGetFromCache(region) {
    try {
        const timestamp = localStorage.getItem(btcmapGetTimestampKey(region));
        if (!timestamp) return null;

        const age = new Date().getTime() - parseInt(timestamp);
        if (age > BTCMAP_CACHE_DURATION) {
            // Cache is too old, clear it
            localStorage.removeItem(btcmapGetCacheKey(region));
            localStorage.removeItem(btcmapGetTimestampKey(region));
            return null;
        }

        const cachedData = localStorage.getItem(btcmapGetCacheKey(region));
        if (!cachedData) return null;

        const data = JSON.parse(cachedData);
        console.log(`Retrieved ${data.length} businesses from cache for ${region}`);
        return data;
    } catch (error) {
        console.error('Error reading from cache:', error);
        return null;
    }
}

// Initialize the BTCMap
function btcmapInitMap() {
    // Make sure the map container exists and is visible
    const mapContainer = document.getElementById('btcmap-map');
    if (!mapContainer) {
        console.error('BTCMap container not found');
        return;
    }

    // Check if map is already initialized
    if (btcmapMap) {
        console.log('BTCMap already initialized, just resizing...');
        btcmapMap.invalidateSize();
        return;
    }

    console.log('Initializing BTCMap...');

    // Initialize map with specific options
    btcmapMap = L.map('btcmap-map', {
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1.0,
        worldCopyJump: true,
        preferCanvas: true  // Use canvas for better performance
    });

    // Add the tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(btcmapMap);

    // Set initial view
    const region = document.getElementById('btcmap-regionSelect').value;
    const regionConfig = btcmapRegionBounds[region];
    btcmapMap.setView(regionConfig.center, regionConfig.zoom);
    
    // Force multiple resizes to ensure proper rendering in hidden container
    setTimeout(() => {
        if (btcmapMap) {
            btcmapMap.invalidateSize();
            console.log('BTCMap first resize complete');
        }
    }, 100);
    
    setTimeout(() => {
        if (btcmapMap) {
            btcmapMap.invalidateSize();
            console.log('BTCMap second resize complete');
        }
    }, 300);
    
    setTimeout(() => {
        if (btcmapMap) {
            btcmapMap.invalidateSize();
            console.log('BTCMap final resize complete');
        }
    }, 500);
}

// Fetch businesses from Overpass API
async function btcmapFetchBusinesses(region) {
    // Update loading message
    const regionName = region.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Check cache first
    const cachedData = btcmapGetFromCache(region);
    if (cachedData) {
        document.getElementById('btcmap-loadingMessage').textContent = 
            `Loading cached data for ${regionName}...`;
        return cachedData;
    }

    document.getElementById('btcmap-loadingMessage').textContent = 
        `Querying OpenStreetMap for Bitcoin businesses in ${regionName}...`;

    const bounds = btcmapRegionBounds[region].bounds;
    const query = `
        [out:json][timeout:25];
        (
            // Businesses that accept Bitcoin payments
            node["payment:bitcoin"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            way["payment:bitcoin"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            relation["payment:bitcoin"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            
            // Businesses that use XBT currency
            node["currency:XBT"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            way["currency:XBT"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            relation["currency:XBT"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});

            // Businesses that use CoinOS
            node["payment:coinos"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            way["payment:coinos"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
            relation["payment:coinos"="yes"](${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]});
        );
        out body;
        >;
        out skel qt;
    `;

    try {
        document.getElementById('btcmap-loadingMessage').textContent = 
            `Fetching data from OpenStreetMap for ${regionName}...`;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        document.getElementById('btcmap-loadingMessage').textContent = 
            `Processing business data for ${regionName}...`;

        const data = await response.json();
        const processedData = btcmapProcessOverpassData(data.elements);
        
        // Save to cache
        btcmapSaveToCache(region, processedData);
        
        return processedData;
    } catch (error) {
        document.getElementById('btcmap-loadingMessage').textContent = 
            `Error loading data for ${regionName}`;
        console.error('Error fetching data:', error);
        throw error;
    }
}

// Process Overpass API data
function btcmapProcessOverpassData(elements) {
    return elements
        .filter(element => element.tags)
        .map(element => {
            const tags = element.tags;
            
            // Try to extract country from various tags (for display purposes only)
            let country = tags['addr:country'] || 
                         tags['addr:country_code'] || 
                         tags['country'] || 
                         tags['is_in:country'] || 
                         tags['is_in:country_code'];
            
            return {
                id: element.id.toString(),
                name: tags.name || 'Unnamed Business',
                categories: [
                    tags.amenity,
                    tags.shop,
                    tags.tourism,
                    tags.leisure
                ].filter(Boolean),
                coordinates: {
                    lat: element.lat || (element.center && element.center.lat),
                    lng: element.lon || (element.center && element.center.lon)
                },
                address: {
                    street: tags['addr:street'],
                    housenumber: tags['addr:housenumber'],
                    city: tags['addr:city'],
                    state: tags['addr:state'],
                    country: country
                },
                website: tags.website || tags['contact:website'],
                paymentMethods: {
                    onchain: tags['payment:bitcoin'] === 'yes' || tags['currency:XBT'] === 'yes',
                    lightning: tags['payment:lightning'] === 'yes',
                    coinos: tags['payment:coinos'] === 'yes'
                },
                socialMedia: {
                    twitter: tags['contact:twitter'],
                    instagram: tags['contact:instagram'],
                    facebook: tags['contact:facebook'],
                    telegram: tags['contact:telegram']
                }
            };
        })
        .filter(business => business.coordinates.lat && business.coordinates.lng);
}

// Add markers to map
function btcmapAddMarkersToMap(businesses) {
    // Clear existing markers
    btcmapMarkers.forEach(marker => marker.remove());
    btcmapMarkers = [];

    businesses.forEach(business => {
        const marker = L.marker([business.coordinates.lat, business.coordinates.lng], {
            icon: L.divIcon({
                className: 'btcmap-custom-marker',
                html: business.name.charAt(0).toUpperCase(),
                iconSize: [32, 32]
            })
        });

        marker.bindPopup(btcmapCreatePopupContent(business));
        marker.on('click', () => btcmapShowBusinessDetail(business.id));
        marker.addTo(btcmapMap);
        btcmapMarkers.push(marker);
    });

    // Fit map to markers if we have any
    if (btcmapMarkers.length > 0) {
        const group = L.featureGroup(btcmapMarkers);
        btcmapMap.fitBounds(group.getBounds());
    }
}

// Create popup content
function btcmapCreatePopupContent(business) {
    return `
        <div class="popup-content">
            <h5>${business.name}</h5>
            ${business.categories.length ? `
                <div class="categories mb-2">
                    ${business.categories.map(cat => `
                        <span class="badge bg-secondary me-1">${cat}</span>
                    `).join('')}
                </div>
            ` : ''}
            <button class="btn btn-sm btn-primary" onclick="btcmapShowBusinessDetail('${business.id}')">
                View Details
            </button>
        </div>
    `;
}

// Helper functions for formatting
function btcmapFormatAddress(address) {
    if (!address) return 'Location not specified';
    
    const parts = [
        address.housenumber && address.street ? `${address.housenumber} ${address.street}` : address.street,
        address.city,
        address.state,
        address.country
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'Location not specified';
}

function btcmapGetLocationDisplay(business) {
    return btcmapFormatAddress(business.address);
}

function btcmapGetCategoryBadgesHTML(categories) {
    if (!categories || categories.length === 0) return '<em>No categories</em>';
    return categories.map(category => 
        `<span class="badge bg-secondary me-1">${category}</span>`
    ).join('');
}

function btcmapFormatDistance(km) {
    // Convert kilometers to miles (1 km = 0.621371 miles)
    const miles = km * 0.621371;
    
    if (km < 1) {
        // For short distances, show meters and feet
        const meters = Math.round(km * 1000);
        const feet = Math.round(meters * 3.28084);
        return `${meters}m <span class="separator">•</span> ${feet}ft`;
    } else {
        // For longer distances, show km and miles
        return `${km.toFixed(1)}km <span class="separator">•</span> ${miles.toFixed(1)}mi`;
    }
}

function btcmapGetSocialMediaIcon(platform) {
    const iconMap = {
        twitter: 'bi-twitter',
        instagram: 'bi-instagram',
        facebook: 'bi-facebook',
        telegram: 'bi-telegram'
    };
    return iconMap[platform] || 'bi-link';
}

function btcmapGetPlatformName(platform) {
    const nameMap = {
        twitter: 'Twitter',
        instagram: 'Instagram',
        facebook: 'Facebook',
        telegram: 'Telegram'
    };
    return nameMap[platform] || platform;
}

function btcmapGetSocialUrl(platform, value) {
    // If the value is already a complete URL, return it as-is
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }
    
    // Handle platform-specific URL construction for handles/usernames
    const urlMap = {
        twitter: (handle) => `https://twitter.com/${handle.replace('@', '')}`,
        instagram: (handle) => `https://instagram.com/${handle.replace('@', '')}`,
        facebook: (handle) => `https://facebook.com/${handle}`,
        telegram: (handle) => `https://t.me/${handle.replace('@', '')}`
    };
    
    if (urlMap[platform]) {
        return urlMap[platform](value);
    }
    
    // Fallback for unknown platforms
    return `https://${value}`;
}

// Update business list function
function btcmapUpdateBusinessList(businesses) {
    const listContainer = document.getElementById('btcmap-businessList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

    // Check if we're in location mode
    const hasLocation = btcmapUserLocation !== null;

    // Show/hide distance column based on location availability
    document.querySelectorAll('.btcmap-distance-column').forEach(el => {
        el.style.display = hasLocation ? 'table-cell' : 'none';
    });

    businesses.forEach(business => {
        const row = document.createElement('tr');
        row.className = business.id === btcmapSelectedBusinessId ? 'selected' : '';
        row.onclick = () => btcmapShowBusinessDetail(business.id);

        // Get location display text
        const locationDisplay = btcmapGetLocationDisplay(business);

        // Create website/social column content
        let websiteSocialContent = '';
        if (business.website) {
            const websiteUrl = business.website.startsWith('http') ? business.website : `https://${business.website}`;
            websiteSocialContent += `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="btcmap-social-link" title="Website: ${business.website}">
                <i class="bi bi-globe"></i>
            </a>`;
        }

        // Add social media icons if available
        if (business.socialMedia) {
            Object.entries(business.socialMedia).forEach(([platform, value]) => {
                if (value) {
                    websiteSocialContent += `
                        <a href="${btcmapGetSocialUrl(platform, value)}" target="_blank" rel="noopener noreferrer" class="btcmap-social-link" title="${btcmapGetPlatformName(platform)}: ${value}">
                            <i class="bi ${btcmapGetSocialMediaIcon(platform)}"></i>
                        </a>
                    `;
                }
            });
        }

        row.innerHTML = `
            <td>${business.name}</td>
            <td>${btcmapGetCategoryBadgesHTML(business.categories || [])}</td>
            <td>${locationDisplay}</td>
            <td class="btcmap-distance-column" style="display: ${hasLocation ? 'table-cell' : 'none'}">
                ${business.distance !== undefined ? 
                    `<div class="btcmap-distance-badge">
                        <i class="bi bi-geo-alt"></i>${btcmapFormatDistance(business.distance)}
                    </div>` : 
                    '<em>N/A</em>'
                }
            </td>
            <td class="text-start ps-0" style="white-space: nowrap;">${websiteSocialContent || '<em>Not available</em>'}</td>
        `;

        listContainer.appendChild(row);
    });
}

// Show business detail
function btcmapShowBusinessDetail(businessId) {
    const business = btcmapBusinesses.find(b => b.id === businessId);
    if (!business) return;

    btcmapSelectedBusinessId = businessId;

    // Update detail panel
    document.getElementById('btcmap-detailName').textContent = business.name;
    document.getElementById('btcmap-detailCategories').innerHTML = btcmapGetCategoryBadgesHTML(business.categories || []);
    document.getElementById('btcmap-detailLocation').innerHTML = btcmapGetLocationDisplay(business);
    
    // Update payment methods
    const paymentMethodsEl = document.getElementById('btcmap-detailPaymentMethods');
    paymentMethodsEl.innerHTML = '';
    if (business.paymentMethods.onchain) {
        paymentMethodsEl.innerHTML += '<span class="btcmap-payment-badge btcmap-onchain-badge">Bitcoin Onchain</span>';
    }
    if (business.paymentMethods.lightning) {
        paymentMethodsEl.innerHTML += '<span class="btcmap-payment-badge btcmap-lightning-badge">Lightning Network</span>';
    }
    if (business.paymentMethods.coinos) {
        paymentMethodsEl.innerHTML += '<span class="btcmap-payment-badge btcmap-coinos-badge">CoinOS</span>';
    }

    // Update website
    const websiteEl = document.getElementById('btcmap-detailWebsite');
    if (business.website) {
        const websiteUrl = business.website.startsWith('http') ? business.website : `https://${business.website}`;
        websiteEl.innerHTML = `<a href="${websiteUrl}" target="_blank">${business.website}</a>`;
    } else {
        websiteEl.textContent = 'Not available';
    }

    // Update social media
    const socialEl = document.getElementById('btcmap-detailSocial');
    socialEl.innerHTML = '';
    if (business.socialMedia) {
        Object.entries(business.socialMedia).forEach(([platform, value]) => {
            if (value) {
                socialEl.innerHTML += `
                    <a href="${btcmapGetSocialUrl(platform, value)}" 
                       class="btcmap-social-link" 
                       target="_blank" 
                       title="${platform}: ${value}">
                        <i class="bi ${btcmapGetSocialMediaIcon(platform)}"></i>
                    </a>
                `;
            }
        });
    }

    // Show detail panel
    document.getElementById('btcmap-businessDetail').style.display = 'block';
    document.getElementById('btcmap-mainContent').classList.add('btcmap-detail-visible');

    // Update business list to highlight selected item
    btcmapUpdateBusinessList(btcmapFilteredBusinesses);

    // Focus map on selected business
    if (btcmapMap && business.coordinates.lat && business.coordinates.lng) {
        btcmapMap.setView([business.coordinates.lat, business.coordinates.lng], 15);
        
        // Update marker styling
        btcmapMarkers.forEach(marker => {
            const icon = marker.getIcon();
            if (icon) {
                icon.options.className = 'btcmap-custom-marker';
                marker.setIcon(icon);
            }
        });
        
        // Find and highlight selected marker
        const selectedMarker = btcmapMarkers.find(marker => {
            const pos = marker.getLatLng();
            return Math.abs(pos.lat - business.coordinates.lat) < 0.0001 && 
                   Math.abs(pos.lng - business.coordinates.lng) < 0.0001;
        });
        
        if (selectedMarker) {
            const icon = selectedMarker.getIcon();
            if (icon) {
                icon.options.className = 'btcmap-custom-marker btcmap-marker-selected';
                selectedMarker.setIcon(icon);
            }
        }
    }
}

// Filter businesses based on search and category
function btcmapFilterBusinesses() {
    const searchTerm = document.getElementById('btcmap-searchInput').value.toLowerCase();
    const categorySelect = document.getElementById('btcmap-categorySelect');
    const category = categorySelect.value;

    btcmapFilteredBusinesses = btcmapBusinesses.filter(business => {
        const matchesSearch = !searchTerm || 
            business.name.toLowerCase().includes(searchTerm) ||
            business.categories.some(cat => cat.toLowerCase().includes(searchTerm)) ||
            btcmapFormatAddress(business.address).toLowerCase().includes(searchTerm);

        const matchesCategory = !category || 
            business.categories.includes(category);

        return matchesSearch && matchesCategory;
    });

    // Update markers and list
    btcmapAddMarkersToMap(btcmapFilteredBusinesses);
    btcmapUpdateBusinessList(btcmapFilteredBusinesses);
    
    // Update category counts based on current filters
    const filteredForCategories = btcmapBusinesses.filter(business => {
        const matchesSearch = !searchTerm || 
            business.name.toLowerCase().includes(searchTerm) ||
            business.categories.some(cat => cat.toLowerCase().includes(searchTerm)) ||
            btcmapFormatAddress(business.address).toLowerCase().includes(searchTerm);

        return matchesSearch;
    });
    
    btcmapUpdateCategoryFilter(filteredForCategories);
    // Restore the selected category after updating options
    if (category) {
        categorySelect.value = category;
    }
    
    // Update status message
    const categoryText = category ? 
        ` in category "${category}"` : 
        '';
    const searchText = searchTerm ? 
        ` matching "${searchTerm}"` : 
        '';
    
    document.getElementById('btcmap-filterStatus').textContent = 
        `Showing ${btcmapFilteredBusinesses.length} of ${btcmapBusinesses.length} businesses${categoryText}${searchText}`;
}

// Update category filter options
function btcmapUpdateCategoryFilter(businesses) {
    // Get counts for each category
    const categoryCounts = new Map();
    let totalBusinesses = businesses.length;
    
    // Count businesses in each category
    businesses.forEach(business => {
        business.categories.forEach(category => {
            if (category) {
                categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
            }
        });
    });

    const categorySelect = document.getElementById('btcmap-categorySelect');
    categorySelect.innerHTML = `<option value="">All Categories (${totalBusinesses})</option>`;
    
    // Convert to array, sort by count (descending) then alphabetically
    const sortedCategories = Array.from(categoryCounts.entries())
        .sort((a, b) => {
            // First sort by count (descending)
            if (b[1] !== a[1]) {
                return b[1] - a[1];
            }
            // Then alphabetically
            return a[0].localeCompare(b[0]);
        });
    
    // Add options with counts
    sortedCategories.forEach(([category, count]) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = `${category} (${count})`;
        categorySelect.appendChild(option);
    });
}



// Location handling
function btcmapHandleLocationSelection(coords, locationName) {
    btcmapUserLocation = coords;
    
    // Calculate distances to all businesses
    btcmapBusinesses.forEach(business => {
        if (business.coordinates.lat && business.coordinates.lng) {
            business.distance = btcmapCalculateDistance(
                coords.lat, coords.lng,
                business.coordinates.lat, business.coordinates.lng
            );
        }
    });
    
    // Sort by distance
    btcmapFilteredBusinesses.sort((a, b) => {
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
    });
    
    // Update the UI
    btcmapUpdateBusinessList(btcmapFilteredBusinesses);
    
    // Update location status
    document.getElementById('btcmap-locationStatus').innerHTML = 
        `<i class="bi bi-geo-alt-fill text-success"></i> Location set to ${locationName}`;
    
    // Center map on selected location
    if (btcmapMap) {
        btcmapMap.setView([coords.lat, coords.lng], 10);
    }
}

function btcmapCalculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = btcmapDeg2rad(lat2 - lat1);
    const dLon = btcmapDeg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(btcmapDeg2rad(lat1)) * Math.cos(btcmapDeg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in kilometers
    return d;
}

function btcmapDeg2rad(deg) {
    return deg * (Math.PI/180);
}

// Sorting functionality
function btcmapHandleSort(column) {
    if (column === btcmapCurrentSortColumn) {
        btcmapCurrentSortDirection = btcmapCurrentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        btcmapCurrentSortColumn = column;
        btcmapCurrentSortDirection = 'asc';
    }

    document.querySelectorAll('.btcmap-sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sort === column) {
            header.classList.add(`sort-${btcmapCurrentSortDirection}`);
        }
    });

    btcmapSortBusinesses(column, btcmapCurrentSortDirection);
}

function btcmapSortBusinesses(column, direction) {
    const multiplier = direction === 'asc' ? 1 : -1;

    btcmapFilteredBusinesses.sort((a, b) => {
        switch (column) {
            case 'name':
                return multiplier * a.name.localeCompare(b.name);
            case 'location':
                const locA = btcmapFormatAddress(a.address);
                const locB = btcmapFormatAddress(b.address);
                return multiplier * locA.localeCompare(locB);
            case 'distance':
                if (a.distance === undefined && b.distance === undefined) return 0;
                if (a.distance === undefined) return 1;
                if (b.distance === undefined) return -1;
                return multiplier * (a.distance - b.distance);
            default:
                return 0;
        }
    });

    btcmapUpdateBusinessList(btcmapFilteredBusinesses);
}

// Initialize BTCMap when switched to
async function initializeBTCMap() {
    console.log('initializeBTCMap called, btcmapIsInitialized =', btcmapIsInitialized);
    if (btcmapIsInitialized) return;
    
    try {
        document.getElementById('btcmap-loadingSpinner').style.display = 'flex';
        document.getElementById('btcmap-mainContent').style.display = 'none';
        
        // Initialize map first
        btcmapInitMap();
        
        const initialRegion = document.getElementById('btcmap-regionSelect').value;
        btcmapBusinesses = await btcmapFetchBusinesses(initialRegion);
        btcmapFilteredBusinesses = [...btcmapBusinesses];
        
        btcmapAddMarkersToMap(btcmapBusinesses);
        btcmapUpdateBusinessList(btcmapBusinesses);
        btcmapUpdateCategoryFilter(btcmapBusinesses);
        
        document.getElementById('btcmap-filterStatus').textContent = 
            `Found ${btcmapBusinesses.length} Bitcoin-accepting businesses in ${initialRegion.replace('-', ' ')}`;
        
        // Set up event listeners
        btcmapSetupEventListeners();
        
        btcmapIsInitialized = true;
    } catch (error) {
        console.error('Error initializing BTCMap:', error);
        document.getElementById('btcmap-filterStatus').textContent = 
            'Error loading businesses. Please try again.';
    } finally {
        document.getElementById('btcmap-loadingSpinner').style.display = 'none';
        document.getElementById('btcmap-mainContent').style.display = 'block';
        
        // Ensure map is properly sized after content becomes visible
        setTimeout(() => {
            if (btcmapMap) {
                btcmapMap.invalidateSize();
                console.log('BTCMap resized after content display');
            }
        }, 100);
    }
}

// Set up event listeners for BTCMap
function btcmapSetupEventListeners() {
    // Region selection
    document.getElementById('btcmap-regionSelect').addEventListener('change', async (e) => {
        const region = e.target.value;
        const regionConfig = btcmapRegionBounds[region];
        
        try {
            document.getElementById('btcmap-loadingSpinner').style.display = 'flex';
            document.getElementById('btcmap-mainContent').style.display = 'none';
            
            btcmapBusinesses = await btcmapFetchBusinesses(region);
            btcmapFilteredBusinesses = [...btcmapBusinesses];
            
            btcmapAddMarkersToMap(btcmapBusinesses);
            btcmapUpdateBusinessList(btcmapBusinesses);
            btcmapUpdateCategoryFilter(btcmapBusinesses);
            
            // Update map view
            if (btcmapMap) {
                btcmapMap.setView(regionConfig.center, regionConfig.zoom);
            }
            
            document.getElementById('btcmap-filterStatus').textContent = 
                `Found ${btcmapBusinesses.length} Bitcoin-accepting businesses in ${region.replace('-', ' ')}`;
        } finally {
            document.getElementById('btcmap-loadingSpinner').style.display = 'none';
            document.getElementById('btcmap-mainContent').style.display = 'block';
        }
    });

    // Location handling
    document.getElementById('btcmap-useMyLocation').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    btcmapHandleLocationSelection(coords, 'Current Location');
                    document.getElementById('btcmap-locationDropdown').value = '';
                },
                (error) => {
                    console.error('Error getting location:', error);
                    alert('Unable to get your location. Please select a city from the dropdown.');
                }
            );
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    });

    document.getElementById('btcmap-locationDropdown').addEventListener('change', (e) => {
        if (!e.target.value) {
            // Reset if "Select a city" is chosen
            btcmapUserLocation = null;
            document.querySelectorAll('.btcmap-distance-column').forEach(el => {
                el.style.display = 'none';
            });
            document.getElementById('btcmap-locationStatus').innerHTML = '';
            return;
        }
        
        const [lat, lng] = e.target.value.split(',').map(Number);
        const locationName = e.target.options[e.target.selectedIndex].text;
        btcmapHandleLocationSelection({ lat, lng }, locationName);
    });

    // Search and filters
    document.getElementById('btcmap-searchInput').addEventListener('input', btcmapFilterBusinesses);
    
    document.getElementById('btcmap-categorySelect').addEventListener('change', btcmapFilterBusinesses);

    // Clear filters
    document.getElementById('btcmap-clearFilters').addEventListener('click', () => {
        document.getElementById('btcmap-searchInput').value = '';
        document.getElementById('btcmap-categorySelect').value = '';
        document.getElementById('btcmap-locationDropdown').value = '';
        document.getElementById('btcmap-locationStatus').innerHTML = '';
        btcmapUserLocation = null;
        btcmapUpdateCategoryFilter(btcmapBusinesses);
        btcmapFilterBusinesses();
    });

    // Clear cache and refresh data
    document.getElementById('btcmap-clearCache').addEventListener('click', async () => {
        const region = document.getElementById('btcmap-regionSelect').value;
        // Clear cache for current region
        localStorage.removeItem(btcmapGetCacheKey(region));
        localStorage.removeItem(btcmapGetTimestampKey(region));
        
        // Reload data
        try {
            document.getElementById('btcmap-loadingSpinner').style.display = 'flex';
            document.getElementById('btcmap-mainContent').style.display = 'none';
            
            btcmapBusinesses = await btcmapFetchBusinesses(region);
            btcmapFilteredBusinesses = [...btcmapBusinesses];
            
            btcmapAddMarkersToMap(btcmapBusinesses);
            btcmapUpdateBusinessList(btcmapBusinesses);
            btcmapUpdateCategoryFilter(btcmapBusinesses);
            btcmapFilterBusinesses();
        } finally {
            document.getElementById('btcmap-loadingSpinner').style.display = 'none';
            document.getElementById('btcmap-mainContent').style.display = 'block';
        }
    });

    // Close detail
    document.getElementById('btcmap-closeDetail').addEventListener('click', () => {
        document.getElementById('btcmap-businessDetail').style.display = 'none';
        document.getElementById('btcmap-mainContent').classList.remove('btcmap-detail-visible');
        btcmapSelectedBusinessId = null;
        btcmapUpdateBusinessList(btcmapFilteredBusinesses);
        
        // Reset marker styling
        btcmapMarkers.forEach(marker => {
            const icon = marker.getIcon();
            if (icon) {
                icon.options.className = 'btcmap-custom-marker';
                marker.setIcon(icon);
            }
        });
    });

    // View on map button
    document.getElementById('btcmap-viewOnMapBtn').addEventListener('click', () => {
        const business = btcmapBusinesses.find(b => b.id === btcmapSelectedBusinessId);
        if (business && btcmapMap) {
            btcmapMap.setView([business.coordinates.lat, business.coordinates.lng], 18);
        }
    });

    // Sortable headers
    document.querySelectorAll('.btcmap-sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            btcmapHandleSort(column);
        });
    });
}

// BTCMap CSV Export Functions
function btcmapShowExportModal() {
    // Update the count of businesses to be exported
    const exportCount = document.getElementById('btcmapExportBusinessCount');
    exportCount.textContent = btcmapFilteredBusinesses.length;
    
    // Show or hide distance field based on whether user location is set
    const distanceCheckbox = document.getElementById('btcmap-export-distance');
    const distanceLabel = distanceCheckbox.nextElementSibling;
    
    if (btcmapUserLocation) {
        distanceCheckbox.parentElement.style.display = 'block';
        distanceLabel.textContent = 'Distance from Your Location';
    } else {
        distanceCheckbox.parentElement.style.display = 'none';
        distanceCheckbox.checked = false;
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('btcmapExportModal'));
    modal.show();
}

function btcmapSelectAllExportFields() {
    const checkboxes = document.querySelectorAll('#btcmapExportModal input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        // Only check visible fields
        if (checkbox.parentElement.style.display !== 'none') {
            checkbox.checked = true;
        }
    });
}

function btcmapSelectNoneExportFields() {
    const checkboxes = document.querySelectorAll('#btcmapExportModal input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

function btcmapSelectBasicExportFields() {
    // First uncheck all
    btcmapSelectNoneExportFields();
    
    // Then check only basic fields
    const basicFields = ['name', 'categories', 'website', 'fullAddress', 'city', 'country'];
    basicFields.forEach(fieldId => {
        const checkbox = document.getElementById(`btcmap-export-${fieldId}`);
        if (checkbox && checkbox.parentElement.style.display !== 'none') {
            checkbox.checked = true;
        }
    });
}

function btcmapGetSelectedExportFields() {
    const selectedFields = [];
    const checkboxes = document.querySelectorAll('#btcmapExportModal input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
        selectedFields.push(checkbox.value);
    });
    
    return selectedFields;
}

function btcmapEscapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    // Convert to string and escape quotes
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
}

function btcmapFormatExportField(business, fieldName) {
    switch (fieldName) {
        case 'name':
            return business.name || '';
            
        case 'osmId':
            return business.id || '';
            
        case 'categories':
            if (business.categories && Array.isArray(business.categories)) {
                return business.categories.join('; ');
            }
            return '';
            
        case 'website':
            return business.website || '';
            
        case 'fullAddress':
            return btcmapFormatAddress(business.address) || '';
            
        case 'street':
            if (business.address) {
                let street = business.address.street || '';
                if (business.address.housenumber) {
                    street = `${business.address.housenumber} ${street}`.trim();
                }
                return street;
            }
            return '';
            
        case 'city':
            return business.address ? (business.address.city || '') : '';
            
        case 'state':
            return business.address ? (business.address.state || '') : '';
            
        case 'country':
            return business.address ? (business.address.country || '') : '';
            
        case 'coordinates':
            if (business.coordinates && business.coordinates.lat && business.coordinates.lng) {
                return `${business.coordinates.lat}, ${business.coordinates.lng}`;
            }
            return '';
            
        case 'distance':
            if (business.distance !== undefined) {
                return btcmapFormatDistance(business.distance);
            }
            return '';
            
        case 'paymentMethods':
            const methods = [];
            if (business.paymentMethods) {
                if (business.paymentMethods.onchain) methods.push('Bitcoin Onchain');
                if (business.paymentMethods.lightning) methods.push('Lightning Network');
                if (business.paymentMethods.coinos) methods.push('CoinOS');
            }
            return methods.join('; ');
            
        case 'onchainOnly':
            return business.paymentMethods && business.paymentMethods.onchain ? 'Yes' : 'No';
            
        case 'lightningOnly':
            return business.paymentMethods && business.paymentMethods.lightning ? 'Yes' : 'No';
            
        case 'coinosOnly':
            return business.paymentMethods && business.paymentMethods.coinos ? 'Yes' : 'No';
            
        case 'socialMedia':
            const socialLinks = [];
            if (business.socialMedia && Object.keys(business.socialMedia).length > 0) {
                Object.entries(business.socialMedia).forEach(([platform, value]) => {
                    if (value) {
                        const platformName = btcmapGetPlatformName(platform);
                        socialLinks.push(`${platformName}: ${value}`);
                    }
                });
            }
            return socialLinks.join('; ');
            
        case 'osmLink':
            if (business.id) {
                return `https://www.openstreetmap.org/node/${business.id}`;
            }
            return '';
            
        default:
            return '';
    }
}

function btcmapGetFieldDisplayName(fieldName) {
    const fieldNames = {
        'name': 'Business Name',
        'osmId': 'OpenStreetMap ID',
        'categories': 'Categories',
        'website': 'Website',
        'fullAddress': 'Full Address',
        'street': 'Street',
        'city': 'City',
        'state': 'State/Province',
        'country': 'Country',
        'coordinates': 'Latitude, Longitude',
        'distance': 'Distance',
        'paymentMethods': 'Payment Methods',
        'onchainOnly': 'Bitcoin Onchain',
        'lightningOnly': 'Lightning Network',
        'coinosOnly': 'CoinOS',
        'socialMedia': 'Social Media',
        'osmLink': 'OpenStreetMap Link'
    };
    
    return fieldNames[fieldName] || fieldName;
}

function btcmapShowMessage(message, type = 'info') {
    // Show message in the filter status area
    const statusEl = document.getElementById('btcmap-filterStatus');
    const originalContent = statusEl.innerHTML;
    
    statusEl.innerHTML = `<div class="alert alert-${type} mt-2 mb-0">${message}</div>`;
    
    // Restore original content after 5 seconds
    setTimeout(() => {
        statusEl.innerHTML = originalContent;
    }, 5000);
}

function btcmapPerformCSVExport() {
    const selectedFields = btcmapGetSelectedExportFields();
    
    if (selectedFields.length === 0) {
        alert('Please select at least one field to export.');
        return;
    }
    
    // Create CSV header
    const headers = selectedFields.map(field => btcmapGetFieldDisplayName(field));
    let csvContent = headers.map(header => btcmapEscapeCSVField(header)).join(',') + '\n';
    
    // Add business data
    btcmapFilteredBusinesses.forEach(business => {
        const row = selectedFields.map(field => {
            const value = btcmapFormatExportField(business, field);
            return btcmapEscapeCSVField(value);
        });
        csvContent += row.join(',') + '\n';
    });
    
    // Create filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const filename = `btcmap-businesses-${dateStr}.csv`;
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        // Feature detection for download attribute
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        // Fallback for browsers that don't support download attribute
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
    }
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('btcmapExportModal'));
    modal.hide();
    
    // Show success message
    btcmapShowMessage(`Successfully exported ${btcmapFilteredBusinesses.length} businesses to CSV file: ${filename}`, 'success');
} 