// Global variables
let map;
let markers = [];
let chart;
let isDarkMode = true;
let currentCity = 'Morocco';
let isDriverMode = false;
let driverMarker;
let trackingInterval;
let currentRoute = [];
let currentUser = null;
let userRole = 'regular';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initAuth();
    initMap();
    initChart();
    loadTeam();
    initCounters();
    initFormValidation();
    initScrollAnimations();
    initThemeToggle();
    loadUserPreferences();
    initHeroFeatures();
    initCustomizationPanel();
    loadPendingTasks();
});

// Initialize authentication
function initAuth() {
    currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        try {
            currentUser = JSON.parse(currentUser);
            userRole = currentUser.type || 'regular';
        } catch (e) {
            localStorage.removeItem('currentUser');
            currentUser = null;
        }
    }
    applyRoleBasedUI();
}

// Apply role-based UI restrictions
function applyRoleBasedUI() {
    if (userRole === 'employer') {
        // Hide admin-only sections
        const adminSections = document.querySelectorAll('.admin-only');
        adminSections.forEach(section => section.style.display = 'none');

        // Filter map data based on user's location
        if (currentUser && currentUser.city) {
            filterMapByLocation(currentUser.city, currentUser.region, currentUser.streetAddress);
        }
    } else if (userRole === 'admin') {
        // Show all sections for admin
        const adminSections = document.querySelectorAll('.admin-only');
        adminSections.forEach(section => section.style.display = 'block');
    }
}

// Filter map data based on user's location
function filterMapByLocation(city, region, street) {
    fetch('assets/data/bins.json')
        .then(response => response.json())
        .then(data => {
            // Filter bins to only show those in user's city/region/street
            const filteredBins = data.filter(bin => {
                // Simple location matching - in real app, use proper geocoding
                const binLocation = `${bin.city} ${bin.region} ${bin.street}`.toLowerCase();
                const userLocation = `${city} ${region} ${street}`.toLowerCase();
                return binLocation.includes(userLocation) || userLocation.includes(binLocation);
            });

            // Clear existing markers
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];

            // Load only filtered bins
            filteredBins.forEach(bin => {
                const color = bin.fill < 30 ? 'green' : bin.fill < 70 ? 'yellow' : 'red';
                const marker = L.circleMarker([bin.lat, bin.lng], {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.8,
                    radius: 10
                }).addTo(map);

                marker.bindPopup(`<b>ID:</b> ${bin.id}<br><b>Fill:</b> ${bin.fill}%<br><b>Type:</b> ${bin.type}`);

                // Add hover effect
                marker.on('mouseover', function() {
                    this.setRadius(15);
                });
                marker.on('mouseout', function() {
                    this.setRadius(10);
                });

                markers.push(marker);
            });

            // Add clustering
            const clusterGroup = L.markerClusterGroup();
            clusterGroup.addLayers(markers);
            map.addLayer(clusterGroup);

            // Center map on user's location
            if (filteredBins.length > 0) {
                const bounds = L.latLngBounds(filteredBins.map(bin => [bin.lat, bin.lng]));
                map.fitBounds(bounds, { padding: [20, 20] });
            }
        });
}

// Initialize Leaflet Map
function initMap() {
    map = L.map('map-container').setView([31.7917, -7.0926], 5); // Morocco center

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add satellite view toggle
    document.getElementById('view-toggle').addEventListener('click', toggleMapView);

    // Add fullscreen toggle
    document.getElementById('fullscreen-toggle').addEventListener('click', toggleFullscreen);

    // Add search functionality
    document.getElementById('city-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchCity(this.value);
        }
    });

    // Add layer toggle
    document.getElementById('layer-toggle').addEventListener('change', toggleLayers);

    // Add optimize route button
    document.getElementById('optimize-route').addEventListener('click', optimizeRoute);

    // Add driver mode toggle
    document.getElementById('driver-mode-toggle').addEventListener('click', toggleDriverMode);

    // Add driver-specific controls
    document.getElementById('road-view-toggle').addEventListener('click', toggleRoadView);
    document.getElementById('gps-location').addEventListener('click', getGPSLocation);
    document.getElementById('traffic-toggle').addEventListener('click', toggleTrafficLayer);
    document.getElementById('directions-btn').addEventListener('click', getDirections);
    document.getElementById('tracking-toggle').addEventListener('click', toggleTracking);
    document.getElementById('start-route-btn').addEventListener('click', startOptimizedRoute);

    loadBins();
}

// Toggle between normal and satellite view
function toggleMapView() {
    const btn = document.getElementById('view-toggle');
    if (btn.textContent === 'Satellite') {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(map);
        btn.textContent = 'Normal';
    } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        btn.textContent = 'Satellite';
    }
}

// Toggle fullscreen
function toggleFullscreen() {
    const container = document.getElementById('map-container');
    if (!document.fullscreenElement) {
        container.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Search city
function searchCity(city) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                map.setView([lat, lng], 12);
                currentCity = city;
                localStorage.setItem('lastCity', city);
            }
        });
}

// Toggle layers
function toggleLayers() {
    const layer = document.getElementById('layer-toggle').value;
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    if (layer === 'all') {
        loadBins();
    } else if (layer === 'full') {
        loadBins('full');
    } else {
        // Implement heatmap or traffic layers if needed
        loadBins();
    }
}

// Load bin data
function loadBins(filter = 'all') {
    fetch('assets/data/bins.json')
        .then(response => response.json())
        .then(data => {
            data.forEach(bin => {
                if (filter === 'all' || (filter === 'full' && bin.fill >= 80)) {
                    const color = bin.fill < 30 ? 'green' : bin.fill < 70 ? 'yellow' : 'red';
                    const marker = L.circleMarker([bin.lat, bin.lng], {
                        color: color,
                        fillColor: color,
                        fillOpacity: 0.8,
                        radius: 10
                    }).addTo(map);

                    marker.bindPopup(`<b>ID:</b> ${bin.id}<br><b>Fill:</b> ${bin.fill}%<br><b>Type:</b> ${bin.type}`);

                    // Add hover effect
                    marker.on('mouseover', function() {
                        this.setRadius(15);
                    });
                    marker.on('mouseout', function() {
                        this.setRadius(10);
                    });

                    markers.push(marker);
                }
            });

            // Add clustering
            const clusterGroup = L.markerClusterGroup();
            clusterGroup.addLayers(markers);
            map.addLayer(clusterGroup);
        });
}

// Initialize Chart.js
function initChart() {
    // Trends Chart (Bar/Line)
    const trendsCtx = document.getElementById('trends-chart').getContext('2d');
    const trendsChart = new Chart(trendsCtx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Waste Collected (kg)',
                data: [120, 150, 180, 200, 220, 250, 280],
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: '#36a2eb',
                borderWidth: 2,
                borderRadius: 5,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' kg';
                        }
                    }
                }
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            }
        }
    });

    // Distribution Chart (Pie)
    const distributionCtx = document.getElementById('distribution-chart').getContext('2d');
    const distributionChart = new Chart(distributionCtx, {
        type: 'pie',
        data: {
            labels: ['Organic', 'Plastic', 'Paper', 'Metal', 'Glass'],
            datasets: [{
                data: [35, 25, 20, 10, 10],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateScale: true,
                animateRotate: true
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            }
        }
    });

    // CO2 Savings Chart
    const co2Ctx = document.getElementById('co2-chart').getContext('2d');
    const co2Chart = new Chart(co2Ctx, {
        type: 'bar',
        data: {
            labels: ['Rabat', 'Casablanca', 'Marrakech', 'Tangier'],
            datasets: [{
                label: 'CO2 Saved (tons)',
                data: [500, 700, 400, 300],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(251, 146, 60, 0.8)'
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(168, 85, 247, 1)',
                    'rgba(251, 146, 60, 1)'
                ],
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeOutBounce'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            const reduction = Math.round((context.parsed.y / 1000) * 100);
                            return context.dataset.label + ': ' + context.parsed.y + ' tons (' + reduction + '% reduction)';
                        }
                    }
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const city = co2Chart.data.labels[index];
                    filterChartsByCity(city);
                }
            }
        }
    });

    // Full Bins by Region Chart
    const binsCtx = document.getElementById('bins-chart').getContext('2d');
    const binsChart = new Chart(binsCtx, {
        type: 'doughnut',
        data: {
            labels: ['North', 'Center', 'South'],
            datasets: [{
                data: [5, 8, 3],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(34, 197, 94, 0.8)'
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(34, 197, 94, 1)'
                ],
                borderWidth: 3,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateScale: true,
                animateRotate: true
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' full bins';
                        }
                    }
                }
            }
        }
    });

    // Efficiency Trends Chart
    const efficiencyCtx = document.getElementById('efficiency-chart').getContext('2d');
    const efficiencyChart = new Chart(efficiencyCtx, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'],
            datasets: [{
                label: 'Efficiency (%)',
                data: [85, 88, 90, 92, 94, 96, 98],
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 80,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '%';
                        }
                    }
                }
            }
        }
    });

    // Cost Savings Chart
    const costCtx = document.getElementById('cost-chart').getContext('2d');
    const costChart = new Chart(costCtx, {
        type: 'bar',
        data: {
            labels: ['Rabat', 'Casablanca', 'Marrakech', 'Tangier'],
            datasets: [{
                label: 'Cost Savings ($)',
                data: [2000, 3000, 1500, 1200],
                backgroundColor: 'rgba(168, 85, 247, 0.8)',
                borderColor: 'rgba(168, 85, 247, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeOutBounce'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y;
                        }
                    }
                }
            }
        }
    });

    // Event listeners
    document.getElementById('chart-type').addEventListener('change', function() {
        trendsChart.config.type = this.value;
        trendsChart.update();
    });

    document.getElementById('time-period').addEventListener('change', function() {
        updateChartData(trendsChart);
    });

    document.getElementById('region-filter').addEventListener('change', function() {
        filterChartsByCity(this.value);
    });

    document.getElementById('refresh-data').addEventListener('click', function() {
        refreshAllCharts();
    });

    // Download functions
    document.getElementById('download-csv').addEventListener('click', downloadCSV);
    document.getElementById('download-pdf').addEventListener('click', downloadPDF);
}

// Filter charts by city
function filterChartsByCity(city) {
    if (city === 'all') {
        // Reset all charts to original data
        fetch('assets/data/stats.json')
            .then(response => response.json())
            .then(data => {
                // Update CO2 chart
                const co2Chart = Chart.getChart('co2-chart');
                co2Chart.data.labels = ['Rabat', 'Casablanca', 'Marrakech', 'Tangier'];
                co2Chart.data.datasets[0].data = [data.co2.Rabat, data.co2.Casablanca, data.co2.Marrakech, data.co2.Tangier];
                co2Chart.update();

                // Update cost chart
                const costChart = Chart.getChart('cost-chart');
                costChart.data.labels = ['Rabat', 'Casablanca', 'Marrakech', 'Tangier'];
                costChart.data.datasets[0].data = [data.costSavings.Rabat, data.costSavings.Casablanca, data.costSavings.Marrakech, data.costSavings.Tangier];
                costChart.update();
            });
    } else {
        // Filter to selected city
        fetch('assets/data/stats.json')
            .then(response => response.json())
            .then(data => {
                // Update CO2 chart
                const co2Chart = Chart.getChart('co2-chart');
                co2Chart.data.labels = [city];
                co2Chart.data.datasets[0].data = [data.co2[city]];
                co2Chart.update();

                // Update cost chart
                const costChart = Chart.getChart('cost-chart');
                costChart.data.labels = [city];
                costChart.data.datasets[0].data = [data.costSavings[city]];
                costChart.update();
            });
    }
}

// Refresh all charts with simulated new data
function refreshAllCharts() {
    // Simulate data refresh by adding small random variations
    fetch('assets/data/stats.json')
        .then(response => response.json())
        .then(data => {
            // Update trends chart
            const trendsChart = Chart.getChart('trends-chart');
            trendsChart.data.datasets[0].data = data.daily.map(val => val + Math.floor(Math.random() * 20 - 10));
            trendsChart.update();

            // Update CO2 chart
            const co2Chart = Chart.getChart('co2-chart');
            co2Chart.data.datasets[0].data = Object.values(data.co2).map(val => val + Math.floor(Math.random() * 50 - 25));
            co2Chart.update();

            // Update efficiency chart
            const efficiencyChart = Chart.getChart('efficiency-chart');
            efficiencyChart.data.datasets[0].data = data.efficiency.map(val => Math.min(100, val + Math.floor(Math.random() * 5 - 2)));
            efficiencyChart.update();

            // Update cost chart
            const costChart = Chart.getChart('cost-chart');
            costChart.data.datasets[0].data = Object.values(data.costSavings).map(val => val + Math.floor(Math.random() * 200 - 100));
            costChart.update();

            // Show refresh notification
            showNotification('Data refreshed successfully!');
        });
}

// Download CSV function
function downloadCSV() {
    fetch('assets/data/stats.json')
        .then(response => response.json())
        .then(data => {
            let csv = 'Category,Value\n';
            csv += 'Daily Waste,' + data.daily.join(',') + '\n';
            csv += 'Weekly Waste,' + data.weekly.join(',') + '\n';
            csv += 'Monthly Waste,' + data.monthly.join(',') + '\n';
            csv += 'CO2 Savings,' + Object.values(data.co2).join(',') + '\n';
            csv += 'Full Bins,' + Object.values(data.fullBins).join(',') + '\n';
            csv += 'Efficiency,' + data.efficiency.join(',') + '\n';
            csv += 'Cost Savings,' + Object.values(data.costSavings).join(',') + '\n';

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'waste-management-stats.csv';
            a.click();
            window.URL.revokeObjectURL(url);
        });
}

// Download PDF function (basic implementation)
function downloadPDF() {
    // For a full PDF implementation, you'd need a library like jsPDF
    // This is a placeholder that opens a print dialog
    window.print();
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.background = 'rgba(34, 197, 94, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '10000';
    document.body.appendChild(notification);

    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Update chart data based on time period
function updateChartData(trendsChart) {
    const period = document.getElementById('time-period').value;
    fetch('assets/data/stats.json')
        .then(response => response.json())
        .then(data => {
            trendsChart.data.labels = period === 'daily' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
                               period === 'weekly' ? ['Week 1', 'Week 2', 'Week 3', 'Week 4'] :
                               ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
            trendsChart.data.datasets[0].data = data[period];
            trendsChart.update();
        });
}

// Initialize animated counters
function initCounters() {
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const increment = target / 100;
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                counter.textContent = Math.ceil(current);
                setTimeout(updateCounter, 20);
            } else {
                counter.textContent = target;
            }
        };

        updateCounter();
    });
}

// Load team data
function loadTeam() {
    fetch('assets/data/team.json')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('team-container');
            const footerPhotos = document.getElementById('footer-photos');

            data.forEach((member, index) => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'team-member';
                if (index === 3) memberDiv.classList.add('encadrant');

                memberDiv.innerHTML = `
                    <img src="${member.photo}" alt="${member.name}" class="team-photo">
                    <h3>${member.name}</h3>
                    <p>${member.role}</p>
                    <p>${member.desc}</p>
                `;

                container.appendChild(memberDiv);

                // Add to footer
                const footerImg = document.createElement('img');
                footerImg.src = member.photo;
                footerImg.alt = member.name;
                footerPhotos.appendChild(footerImg);
            });
        });
}

// Form validation
function initFormValidation() {
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;

        if (name && email && message) {
            alert('Message sent successfully!');
            form.reset();
        } else {
            alert('Please fill in all fields.');
        }
    });
}

// Scroll animations
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    });

    document.querySelectorAll('.section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(50px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
}

// Theme toggle
function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    toggle.addEventListener('click', function() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('light-mode');
        toggle.textContent = isDarkMode ? '🌙' : '☀️';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    });
}



// Load user preferences
function loadUserPreferences() {
    const savedTheme = localStorage.getItem('theme');
    const savedCity = localStorage.getItem('lastCity');

    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-toggle').textContent = '☀️';
        isDarkMode = false;
    }

    if (savedCity) {
        searchCity(savedCity);
    }
}

// Initialize hero features
function initHeroFeatures() {
    loadHeroStats();
    initTypingAnimation();
    initCTAButton();
}

// Load dynamic stats for hero
function loadHeroStats() {
    fetch('assets/data/stats.json')
        .then(response => response.json())
        .then(data => {
            const heroStats = document.getElementById('hero-stats');
            const totalBins = data.daily.reduce((a, b) => a + b, 0); // Sum daily data as example
            const citiesServed = 50; // Placeholder, could be from data
            const efficiency = 99; // Placeholder

            heroStats.innerHTML = `
                <div class="stat-item">
                    <span class="stat-number">${totalBins}+</span>
                    <span class="stat-label">Bins Monitored</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${citiesServed}+</span>
                    <span class="stat-label">Cities Served</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${efficiency}%</span>
                    <span class="stat-label">Efficiency Rate</span>
                </div>
            `;
        });
}

// Typing animation for subtitle
function initTypingAnimation() {
    const subtitle = document.getElementById('typing-subtitle');
    const text = "Smart Waste Management for Smarter Cities";
    let index = 0;

    function typeWriter() {
        if (index < text.length) {
            subtitle.textContent += text.charAt(index);
            index++;
            setTimeout(typeWriter, 100);
        }
    }

    // Clear initial text and start typing
    subtitle.textContent = '';
    setTimeout(typeWriter, 1000);
}

// CTA button interaction
function initCTAButton() {
    const ctaBtn = document.getElementById('explore-btn');
    ctaBtn.addEventListener('click', function() {
        document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
    });
}

// Customization panel
function initCustomizationPanel() {
    const customizeBtn = document.getElementById('customize-btn');
    const customizeOptions = document.getElementById('customize-options');

    customizeBtn.addEventListener('click', function() {
        customizeOptions.classList.toggle('show');
    });

    // Mood selection
    document.getElementById('mood-select').addEventListener('change', function() {
        applyMoodTheme(this.value);
        localStorage.setItem('selectedMood', this.value);
    });

    // Primary color change
    document.getElementById('primary-color').addEventListener('input', function() {
        document.documentElement.style.setProperty('--primary-color', this.value);
        localStorage.setItem('primaryColor', this.value);
    });

    // Font family change
    document.getElementById('font-family').addEventListener('change', function() {
        document.documentElement.style.setProperty('--font-family', this.value);
        localStorage.setItem('fontFamily', this.value);
    });

    // Load saved customizations
    const savedMood = localStorage.getItem('selectedMood');
    const savedPrimaryColor = localStorage.getItem('primaryColor');
    const savedFontFamily = localStorage.getItem('fontFamily');

    if (savedMood) {
        document.getElementById('mood-select').value = savedMood;
        applyMoodTheme(savedMood);
    }

    if (savedPrimaryColor) {
        document.documentElement.style.setProperty('--primary-color', savedPrimaryColor);
        document.getElementById('primary-color').value = savedPrimaryColor;
    }

    if (savedFontFamily) {
        document.documentElement.style.setProperty('--font-family', savedFontFamily);
        document.getElementById('font-family').value = savedFontFamily;
    }
}

// Apply mood-based themes
function applyMoodTheme(mood) {
    const root = document.documentElement;
    const heroSection = document.querySelector('.hero');
    const body = document.body;

    // Reset to default
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--secondary-color');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--bg-gradient');
    root.style.removeProperty('--text-shadow');
    body.classList.remove('nature-mood', 'ocean-mood', 'sunset-mood', 'forest-mood', 'minimalist-mood');

    switch (mood) {
        case 'nature':
            root.style.setProperty('--primary-color', '#22c55e');
            root.style.setProperty('--secondary-color', '#16a34a');
            root.style.setProperty('--accent-color', '#84cc16');
            root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #22c55e, #16a34a)');
            root.style.setProperty('--text-shadow', '0 10px 30px rgba(34, 197, 94, 0.45)');
            body.classList.add('nature-mood');
            if (heroSection) {
                heroSection.style.backgroundImage = "url('image.png'), linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.1))";
            }
            break;

        case 'ocean':
            root.style.setProperty('--primary-color', '#3b82f6');
            root.style.setProperty('--secondary-color', '#1d4ed8');
            root.style.setProperty('--accent-color', '#06b6d4');
            root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #3b82f6, #1d4ed8)');
            root.style.setProperty('--text-shadow', '0 10px 30px rgba(59, 130, 246, 0.45)');
            body.classList.add('ocean-mood');
            if (heroSection) {
                heroSection.style.backgroundImage = "url('image.png'), linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(29, 78, 216, 0.1))";
            }
            break;

        case 'sunset':
            root.style.setProperty('--primary-color', '#f97316');
            root.style.setProperty('--secondary-color', '#ea580c');
            root.style.setProperty('--accent-color', '#dc2626');
            root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #f97316, #ea580c)');
            root.style.setProperty('--text-shadow', '0 10px 30px rgba(249, 115, 22, 0.45)');
            body.classList.add('sunset-mood');
            if (heroSection) {
                heroSection.style.backgroundImage = "url('image.png'), linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 88, 12, 0.1))";
            }
            break;

        case 'forest':
            root.style.setProperty('--primary-color', '#166534');
            root.style.setProperty('--secondary-color', '#14532d');
            root.style.setProperty('--accent-color', '#365314');
            root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #166534, #14532d)');
            root.style.setProperty('--text-shadow', '0 10px 30px rgba(22, 101, 52, 0.45)');
            body.classList.add('forest-mood');
            if (heroSection) {
                heroSection.style.backgroundImage = "url('image.png'), linear-gradient(135deg, rgba(22, 101, 52, 0.1), rgba(20, 83, 45, 0.1))";
            }
            break;

        case 'minimalist':
            root.style.setProperty('--primary-color', '#6b7280');
            root.style.setProperty('--secondary-color', '#4b5563');
            root.style.setProperty('--accent-color', '#374151');
            root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #6b7280, #4b5563)');
            root.style.setProperty('--text-shadow', '0 10px 30px rgba(107, 114, 128, 0.45)');
            body.classList.add('minimalist-mood');
            if (heroSection) {
                heroSection.style.backgroundImage = "url('image.png'), linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(75, 85, 99, 0.1))";
            }
            break;

        default: // default
            root.style.setProperty('--primary-color', '#007bff');
            root.style.setProperty('--secondary-color', '#0056b3');
            root.style.setProperty('--accent-color', '#28a745');
            root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #007bff, #0056b3)');
            root.style.setProperty('--text-shadow', '0 10px 30px rgba(0, 123, 255, 0.45)');
            if (heroSection) {
                heroSection.style.backgroundImage = "url('image.png')";
            }
            break;
    }

    // Update floating shapes colors based on mood
    updateFloatingShapes(mood);

    // Show notification
    showNotification(`Theme changed to ${mood.charAt(0).toUpperCase() + mood.slice(1)} mood!`);
}

// Update floating shapes based on mood
function updateFloatingShapes(mood) {
    const shapes = document.querySelectorAll('.shape');
    shapes.forEach((shape, index) => {
        let color;
        switch (mood) {
            case 'nature':
                color = index === 0 ? '#22c55e' : index === 1 ? '#16a34a' : '#84cc16';
                break;
            case 'ocean':
                color = index === 0 ? '#3b82f6' : index === 1 ? '#1d4ed8' : '#06b6d4';
                break;
            case 'sunset':
                color = index === 0 ? '#f97316' : index === 1 ? '#ea580c' : '#dc2626';
                break;
            case 'forest':
                color = index === 0 ? '#166534' : index === 1 ? '#14532d' : '#365314';
                break;
            case 'minimalist':
                color = index === 0 ? '#6b7280' : index === 1 ? '#4b5563' : '#374151';
                break;
            default:
                color = index === 0 ? '#007bff' : index === 1 ? '#0056b3' : '#28a745';
        }
        shape.style.background = color;
        shape.style.boxShadow = `0 0 20px ${color}40`;
    });
}

// Optimize route for collecting full bins
function optimizeRoute() {
    fetch('assets/data/bins.json')
        .then(response => response.json())
        .then(data => {
            // Filter full bins (fill >= 80%)
            const fullBins = data.filter(bin => bin.fill >= 80);
            if (fullBins.length === 0) {
                showNotification('No full bins to collect!');
                return;
            }

            // Use nearest neighbor algorithm starting from map center
            const depot = map.getCenter();
            const route = nearestNeighborRoute(fullBins, depot);

            // Draw route on map
            drawOptimizedRoute(route);

            // Display route details
            displayRouteDetails(route);

            showNotification(`Optimized route calculated for ${route.length} bins!`);
        });
}

// Nearest neighbor algorithm for route optimization
function nearestNeighborRoute(bins, depot) {
    const route = [];
    const remainingBins = [...bins];

    // Start from depot
    let currentLatLng = [depot.lat, depot.lng];

    while (remainingBins.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = haversineDistance(currentLatLng, [remainingBins[0].lat, remainingBins[0].lng]);

        for (let i = 1; i < remainingBins.length; i++) {
            const distance = haversineDistance(currentLatLng, [remainingBins[i].lat, remainingBins[i].lng]);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        const nearestBin = remainingBins.splice(nearestIndex, 1)[0];
        route.push(nearestBin);
        currentLatLng = [nearestBin.lat, nearestBin.lng];
    }

    return route;
}

// Haversine formula for distance calculation
function haversineDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLng = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Draw optimized route on map
function drawOptimizedRoute(route) {
    // Clear existing route
    if (window.routeLayer) {
        map.removeLayer(window.routeLayer);
    }

    // Create route coordinates
    const routeCoords = route.map(bin => [bin.lat, bin.lng]);

    // Draw polyline
    const routeLine = L.polyline(routeCoords, {
        color: 'blue',
        weight: 4,
        opacity: 0.8
    }).addTo(map);

    // Add markers for route order
    const routeMarkers = route.map((bin, index) => {
        const marker = L.marker([bin.lat, bin.lng], {
            icon: L.divIcon({
                className: 'route-marker',
                html: `<div style="background: blue; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${index + 1}</div>`,
                iconSize: [24, 24]
            })
        });
        marker.bindPopup(`<b>Stop ${index + 1}:</b> ${bin.id}<br><b>Fill:</b> ${bin.fill}%<br><b>Type:</b> ${bin.type}<br><b>Operation Time:</b> ${bin.operationTime} min`);
        return marker;
    });

    // Group layers
    window.routeLayer = L.layerGroup([routeLine, ...routeMarkers]).addTo(map);

    // Fit map to route
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
}

// Display route details
function displayRouteDetails(route) {
    const totalDistance = calculateTotalDistance(route);
    const totalTime = route.reduce((sum, bin) => sum + bin.operationTime, 0);
    const estimatedTravelTime = totalDistance * 2; // Assume 30 km/h average speed, so 2 min per km

    const details = `
        <div style="background: rgba(0,0,0,0.8); color: white; padding: 10px; border-radius: 5px; position: absolute; top: 10px; left: 10px; z-index: 1000;">
            <h4>Optimized Route Details</h4>
            <p><b>Bins to Collect:</b> ${route.length}</p>
            <p><b>Total Distance:</b> ${totalDistance.toFixed(2)} km</p>
            <p><b>Operation Time:</b> ${totalTime} min</p>
            <p><b>Estimated Travel Time:</b> ${estimatedTravelTime.toFixed(0)} min</p>
            <p><b>Total Time:</b> ${(totalTime + estimatedTravelTime).toFixed(0)} min</p>
        </div>
    `;

    // Remove existing details
    const existingDetails = document.getElementById('route-details');
    if (existingDetails) {
        existingDetails.remove();
    }

    // Add new details
    const detailsDiv = document.createElement('div');
    detailsDiv.id = 'route-details';
    detailsDiv.innerHTML = details;
    document.body.appendChild(detailsDiv);
}

// Calculate total distance of route
function calculateTotalDistance(route) {
    let totalDistance = 0;
    const depot = map.getCenter();

    // Distance from depot to first bin
    if (route.length > 0) {
        totalDistance += haversineDistance([depot.lat, depot.lng], [route[0].lat, route[0].lng]);
    }

    // Distance between bins
    for (let i = 0; i < route.length - 1; i++) {
        totalDistance += haversineDistance([route[i].lat, route[i].lng], [route[i + 1].lat, route[i + 1].lng]);
    }

    // Distance from last bin back to depot (optional, for round trip)
    if (route.length > 0) {
        totalDistance += haversineDistance([route[route.length - 1].lat, route[route.length - 1].lng], [depot.lat, depot.lng]);
    }

    return totalDistance;
}

// Driver mode functions
function toggleDriverMode() {
    isDriverMode = !isDriverMode;
    const driverControls = document.getElementById('driver-controls');
    const btn = document.getElementById('driver-mode-toggle');

    if (isDriverMode) {
        driverControls.style.display = 'block';
        btn.textContent = 'Exit Driver Mode';
        btn.style.background = '#ef4444';
        showNotification('Driver mode activated! Getting your location...');
        // Auto-get GPS location when activating driver mode
        getGPSLocation();
    } else {
        driverControls.style.display = 'none';
        btn.textContent = 'Driver Mode';
        btn.style.background = '';
        // Hide START button
        document.getElementById('start-route-btn').style.display = 'none';
        // Stop tracking if active
        if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
        }
        if (driverMarker) {
            map.removeLayer(driverMarker);
            driverMarker = null;
        }
        showNotification('Driver mode deactivated!');
    }
}

function toggleRoadView() {
    if (!isDriverMode) return;

    const btn = document.getElementById('road-view-toggle');
    if (btn.textContent === 'Road View') {
        // Switch to road view (simulated)
        L.tileLayer('https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, Humanitarian OpenStreetMap Team'
        }).addTo(map);
        btn.textContent = 'Normal View';
        showNotification('Switched to road view');
    } else {
        // Switch back to normal view
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        btn.textContent = 'Road View';
        showNotification('Switched to normal view');
    }
}

function getGPSLocation() {
    if (!isDriverMode) return;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Center map on current location
                map.setView([lat, lng], 15);

                // Add/update driver marker
                if (driverMarker) {
                    map.removeLayer(driverMarker);
                }

                driverMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'driver-marker',
                        html: '<div style="background: #3b82f6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white;">🚛</div>',
                        iconSize: [30, 30]
                    })
                }).addTo(map);

                driverMarker.bindPopup('Your Location').openPopup();
                showNotification('GPS location updated!');
            },
            (error) => {
                showNotification('GPS location error: ' + error.message);
            }
        );
    } else {
        showNotification('Geolocation is not supported by this browser.');
    }
}

function toggleTrafficLayer() {
    if (!isDriverMode) return;

    const btn = document.getElementById('traffic-toggle');
    if (btn.textContent === 'Show Traffic') {
        // Simulate traffic layer (in real app, use traffic API)
        showNotification('Traffic layer enabled (simulated)');
        btn.textContent = 'Hide Traffic';
        btn.style.background = '#10b981';
    } else {
        showNotification('Traffic layer disabled');
        btn.textContent = 'Show Traffic';
        btn.style.background = '';
    }
}

function getDirections() {
    if (!isDriverMode) return;

    // Show destination input modal
    showDestinationModal();
}

function showDestinationModal() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'destination-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--bg-color, #1a1a1a);
            padding: 30px;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        ">
            <h3 style="color: var(--text-color, #ffffff); margin-bottom: 20px; text-align: center;">Enter Destination</h3>
            <input type="text" id="destination-input" placeholder="Enter city, street, or address"
                style="
                    width: 100%;
                    padding: 12px;
                    margin-bottom: 20px;
                    border: 1px solid #555;
                    border-radius: 5px;
                    background: var(--bg-color, #2a2a2a);
                    color: var(--text-color, #ffffff);
                    font-size: 16px;
                    box-sizing: border-box;
                ">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="get-directions-btn" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">Get Directions</button>
                <button id="cancel-directions-btn" style="
                    background: #ef4444;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus on input
    document.getElementById('destination-input').focus();

    // Event listeners
    document.getElementById('get-directions-btn').addEventListener('click', () => {
        const destination = document.getElementById('destination-input').value.trim();
        if (destination) {
            calculateRouteToDestination(destination);
            document.body.removeChild(modal);
        } else {
            showNotification('Please enter a destination!');
        }
    });

    document.getElementById('cancel-directions-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Close modal on escape key
    document.addEventListener('keydown', function closeModal(e) {
        if (e.key === 'Escape') {
            if (document.getElementById('destination-modal')) {
                document.body.removeChild(modal);
            }
            document.removeEventListener('keydown', closeModal);
        }
    });
}

function calculateRouteToDestination(destination) {
    // First, get current GPS location
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by this browser.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const startLat = position.coords.latitude;
            const startLng = position.coords.longitude;

            // Geocode destination using Nominatim
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`)
                .then(response => response.json())
                .then(data => {
                    if (data.length === 0) {
                        showNotification('Destination not found. Please try a different address.');
                        return;
                    }

                    const destLat = parseFloat(data[0].lat);
                    const destLng = parseFloat(data[0].lon);

                    // Use OSRM for routing
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

                    fetch(osrmUrl)
                        .then(response => response.json())
                        .then(routeData => {
                            if (routeData.routes && routeData.routes.length > 0) {
                                displayRouteAndDirections(routeData.routes[0], [startLat, startLng], [destLat, destLng]);
                            } else {
                                showNotification('No route found to the destination.');
                            }
                        })
                        .catch(error => {
                            console.error('Routing error:', error);
                            showNotification('Error calculating route. Please try again.');
                        });
                })
                .catch(error => {
                    console.error('Geocoding error:', error);
                    showNotification('Error finding destination. Please try again.');
                });
        },
        (error) => {
            showNotification('GPS location error: ' + error.message + '. Please enable location services.');
        }
    );
}

function displayRouteAndDirections(route, startCoords, endCoords) {
    // Clear existing route
    if (window.directionsRouteLayer) {
        map.removeLayer(window.directionsRouteLayer);
    }

    // Draw route on map
    const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    const routeLine = L.polyline(routeCoords, {
        color: '#3b82f6',
        weight: 6,
        opacity: 0.8
    }).addTo(map);

    // Add start and end markers
    const startMarker = L.marker(startCoords, {
        icon: L.divIcon({
            className: 'route-marker',
            html: '<div style="background: #10b981; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">A</div>',
            iconSize: [30, 30]
        })
    }).bindPopup('Starting Point');

    const endMarker = L.marker(endCoords, {
        icon: L.divIcon({
            className: 'route-marker',
            html: '<div style="background: #ef4444; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">B</div>',
            iconSize: [30, 30]
        })
    }).bindPopup('Destination');

    window.directionsRouteLayer = L.layerGroup([routeLine, startMarker, endMarker]).addTo(map);

    // Fit map to route
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });

    // Display turn-by-turn directions
    displayTurnByTurnDirections(route.legs[0].steps);

    showNotification(`Route calculated! Distance: ${(route.distance / 1000).toFixed(1)} km, Time: ${Math.round(route.duration / 60)} min`);
}

function displayTurnByTurnDirections(steps) {
    // Create directions panel
    const directionsPanel = document.createElement('div');
    directionsPanel.id = 'directions-panel';
    directionsPanel.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        width: 300px;
        max-height: 400px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 10px;
        overflow-y: auto;
        z-index: 1000;
        font-size: 14px;
    `;

    let directionsHTML = '<h4 style="margin: 0 0 15px 0; color: #3b82f6;">Turn-by-Turn Directions</h4>';

    steps.forEach((step, index) => {
        const instruction = step.maneuver.instruction || step.name || 'Continue';
        const distance = (step.distance / 1000).toFixed(1) + ' km';
        const duration = Math.round(step.duration / 60) + ' min';

        directionsHTML += `
            <div style="margin-bottom: 10px; padding: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 5px;">${index + 1}. ${instruction}</div>
                <div style="font-size: 12px; color: #ccc;">${distance} • ${duration}</div>
            </div>
        `;
    });

    directionsHTML += '<button id="close-directions" style="width: 100%; margin-top: 10px; padding: 8px; background: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Close Directions</button>';

    directionsPanel.innerHTML = directionsHTML;
    document.body.appendChild(directionsPanel);

    // Close directions event
    document.getElementById('close-directions').addEventListener('click', () => {
        document.body.removeChild(directionsPanel);
    });
}

function toggleTracking() {
    if (!isDriverMode) return;

    const btn = document.getElementById('tracking-toggle');

    if (trackingInterval) {
        // Stop tracking
        clearInterval(trackingInterval);
        trackingInterval = null;
        btn.textContent = 'Start Tracking';
        btn.style.background = '';
        showNotification('Location tracking stopped');
    } else {
        // Start tracking
        if (navigator.geolocation) {
            trackingInterval = setInterval(() => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;

                        // Update driver marker position
                        if (driverMarker) {
                            driverMarker.setLatLng([lat, lng]);
                        } else {
                            driverMarker = L.marker([lat, lng], {
                                icon: L.divIcon({
                                    className: 'driver-marker',
                                    html: '<div style="background: #3b82f6; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white;">🚛</div>',
                                    iconSize: [30, 30]
                                })
                            }).addTo(map);
                        }

                        // Update route progress (simplified)
                        updateRouteProgress([lat, lng]);
                    },
                    (error) => {
                        console.error('Tracking error:', error);
                    }
                );
            }, 5000); // Update every 5 seconds

            btn.textContent = 'Stop Tracking';
            btn.style.background = '#10b981';
            showNotification('Location tracking started');
        } else {
            showNotification('Geolocation is not supported by this browser.');
        }
    }
}

function updateRouteProgress(currentPos) {
    if (currentRoute.length === 0) return;

    // Find nearest bin to current position
    let nearestIndex = 0;
    let nearestDistance = haversineDistance(currentPos, [currentRoute[0].lat, currentRoute[0].lng]);

    for (let i = 1; i < currentRoute.length; i++) {
        const distance = haversineDistance(currentPos, [currentRoute[i].lat, currentRoute[i].lng]);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
        }
    }

    // If within 100 meters of a bin, mark it as collected (simplified)
    if (nearestDistance < 0.1) {
        showNotification(`Bin ${currentRoute[nearestIndex].id} collected!`);
        currentRoute.splice(nearestIndex, 1);
    }
}

// Global pending tasks array
let pendingTasks = [];

// Load and display pending tasks
function loadPendingTasks() {
    const taskGrid = document.getElementById('task-cards-grid');
    taskGrid.innerHTML = ''; // Clear existing tasks

    if (pendingTasks.length === 0) {
        // Show empty state
        const emptyCard = document.createElement('div');
        emptyCard.className = 'task-card empty-state';
        emptyCard.innerHTML = `
            <div class="task-icon">
                <i class="fas fa-clipboard-list"></i>
            </div>
            <h3>No Pending Tasks</h3>
            <p>Calculate a route or get directions to see tasks here.</p>
        `;
        taskGrid.appendChild(emptyCard);
        return;
    }

    pendingTasks.forEach((task, index) => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        taskCard.style.animationDelay = `${index * 0.1}s`;

        taskCard.innerHTML = `
            <div class="task-icon">
                <i class="fas fa-route"></i>
            </div>
            <div class="task-content">
                <h3>Step ${index + 1}</h3>
                <p class="task-instruction">${task.instruction}</p>
                <div class="task-details">
                    <span class="task-distance"><i class="fas fa-road"></i> ${task.distance}</span>
                    <span class="task-duration"><i class="fas fa-clock"></i> ${task.duration}</span>
                </div>
            </div>
            <div class="task-status">
                <span class="status-pending">Pending</span>
            </div>
        `;

        taskGrid.appendChild(taskCard);
    });
}

// Smooth scrolling for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
