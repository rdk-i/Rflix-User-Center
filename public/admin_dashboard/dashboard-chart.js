// Dashboard Chart Logic - Neumorphic Style
// Handles the Now Playing History Chart

let nowPlayingChart = null;

// Theme Colors
const chartColors = {
  dark: {
    text: '#ecf0f1',
    grid: 'rgba(255, 255, 255, 0.05)',
    line: '#00e5ff',
    fill: 'rgba(0, 229, 255, 0.1)',
    point: '#00e5ff'
  },
  light: {
    text: '#44476A',
    grid: 'rgba(0, 0, 0, 0.05)',
    line: '#0056B3',
    fill: 'rgba(0, 86, 179, 0.1)',
    point: '#0056B3'
  }
};

// Fetch Data from API
async function fetchChartData(range) {
  try {
    console.log('[Chart] Fetching data for range:', range);
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[Chart] No authentication token found');
      return { labels: [], values: [] };
    }
    
    const response = await fetch(`/api/stats/history?range=${range}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error('[Chart] API request failed:', response.status, response.statusText);
      return { labels: [], values: [] };
    }
    
    const json = await response.json();
    
    console.log('[Chart] API Response:', json);
    
    if (json.success && json.data && json.data.length > 0) {
      const labels = [];
      const values = [];
      
      json.data.forEach(item => {
        // Parse timestamp correctly - SQLite stores in UTC format
        // If timestamp doesn't have 'Z', it's stored as local time string
        let d;
        if (item.timestamp.endsWith('Z')) {
          d = new Date(item.timestamp);
        } else {
          // SQLite CURRENT_TIMESTAMP format: "YYYY-MM-DD HH:MM:SS"
          // Treat as UTC
          d = new Date(item.timestamp + 'Z');
        }
        
        // Format label based on range
        if (range.includes('d')) {
           labels.push(d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' }));
        } else {
           labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        values.push(item.active_streams);
      });
      
      console.log('[Chart] Processed data - Labels:', labels, 'Values:', values);
      return { labels, values };
    } else {
      console.warn('[Chart] No data returned from API');
      return { labels: [], values: [] };
    }
  } catch (error) {
    console.error('[Chart] Failed to fetch chart data:', error);
    return { labels: [], values: [] };
  }
}

// Initialize Chart
async function initChart() {
  console.log('[Chart] Initializing chart...');
  const ctx = document.getElementById('nowPlayingChart');
  
  if (!ctx) {
    console.error('[Chart] Canvas element not found!');
    return;
  }
  
  const isLight = document.body.classList.contains('light-mode');
  const theme = isLight ? chartColors.light : chartColors.dark;

  // Initial Fetch
  const data = await fetchChartData('24h');
  
  console.log('[Chart] Creating Chart.js instance with data:', data);

  nowPlayingChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Now Playing',
        data: data.values,
        borderColor: theme.line,
        backgroundColor: theme.fill,
        borderWidth: 3,
        pointBackgroundColor: theme.point,
        pointBorderColor: isLight ? '#e6e7ee' : '#212121',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? '#e6e7ee' : '#212121',
          titleColor: theme.text,
          bodyColor: theme.text,
          borderColor: isLight ? '#d1d9e6' : 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return context.parsed.y + ' Users';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: theme.grid, drawBorder: false },
          ticks: { color: theme.text, font: { family: "'Poppins', sans-serif", size: 11 } }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 5,
          grid: { color: theme.grid, drawBorder: false, borderDash: [5, 5] },
          ticks: { color: theme.text, font: { family: "'Poppins', sans-serif", size: 11 }, stepSize: 1 }
        }
      }
    }
  });
  
  console.log('[Chart] Chart initialized successfully');
}

// Update Chart Theme
function updateChartTheme() {
  if (!nowPlayingChart) return;

  const isLight = document.body.classList.contains('light-mode');
  const theme = isLight ? chartColors.light : chartColors.dark;

  nowPlayingChart.data.datasets[0].borderColor = theme.line;
  nowPlayingChart.data.datasets[0].backgroundColor = theme.fill;
  nowPlayingChart.data.datasets[0].pointBackgroundColor = theme.point;
  nowPlayingChart.data.datasets[0].pointBorderColor = isLight ? '#e6e7ee' : '#212121';
  
  nowPlayingChart.options.plugins.tooltip.backgroundColor = isLight ? '#e6e7ee' : '#212121';
  nowPlayingChart.options.plugins.tooltip.titleColor = theme.text;
  nowPlayingChart.options.plugins.tooltip.bodyColor = theme.text;
  nowPlayingChart.options.plugins.tooltip.borderColor = isLight ? '#d1d9e6' : 'rgba(255,255,255,0.1)';

  nowPlayingChart.options.scales.x.grid.color = theme.grid;
  nowPlayingChart.options.scales.x.ticks.color = theme.text;
  nowPlayingChart.options.scales.y.grid.color = theme.grid;
  nowPlayingChart.options.scales.y.ticks.color = theme.text;

  nowPlayingChart.update();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Chart] DOM Content Loaded');
  initChart();

  // Time Range Change
  const rangeSelect = document.getElementById('chartTimeRange');
  if (rangeSelect) {
    rangeSelect.addEventListener('change', async (e) => {
      const range = e.target.value;
      console.log('[Chart] Time range changed to:', range);
      const newData = await fetchChartData(range);
      
      if (nowPlayingChart) {
        nowPlayingChart.data.labels = newData.labels;
        nowPlayingChart.data.datasets[0].data = newData.values;
        nowPlayingChart.update();
        console.log('[Chart] Chart updated with new data');
      }
    });
  }

  // Listen for Theme Toggle
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        updateChartTheme();
      }
    });
  });
  
  observer.observe(document.body, { attributes: true });
});
