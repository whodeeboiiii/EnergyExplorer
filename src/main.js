import * as d3 from 'd3';
import { feature } from 'topojson-client';
import world from '/src/data/countries-110m.json';
import countriesData from '/src/data/countries.js';

// Initialize variables
const svg = d3.select('#map');
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

// Initialize horizontal chart
const horizontalChartSvg = d3.select('#horizontal-chart');

let currentYear = 2018;
let currentMetric = 'self_sufficiency_rate';
let currentScale = 'linear';
let showAllCountries = false; // Track whether to show all countries or just top 30

// Calculate global maximum self-sufficiency rate across all years
let globalMaxSelfSufficiency = 0;
Object.values(countriesData).forEach(country => {
  if (country.self_sufficiency_rate) {
    Object.values(country.self_sufficiency_rate).forEach(value => {
      if (!isNaN(value) && value > globalMaxSelfSufficiency) {
        globalMaxSelfSufficiency = value;
      }
    });
  }
});

// Round up the global maximum to the nearest hundred for better visualization
globalMaxSelfSufficiency = Math.ceil(globalMaxSelfSufficiency / 100) * 100;

// Projection and path generator
const projection = d3.geoNaturalEarth1().fitSize([width, height], feature(world, world.objects.countries));
const path = d3.geoPath(projection);

// Create a mapping from country names to country data
const countryNameToData = {};
Object.values(countriesData).forEach(country => {
  countryNameToData[country.name] = country;
});

// Helper function to find country data by country name
function getCountryData(countryName) {
  // Try exact match first
  if (countryNameToData[countryName]) {
    return countryNameToData[countryName];
  }
  
  // Try fuzzy matching for common variations
  const nameVariations = {
    'United States of America': 'United States',
    'Russian Federation': 'Russia',
    'United Kingdom': 'United Kingdom',
    'Democratic Republic of the Congo': 'Dem. Rep. Congo',
    'Central African Republic': 'Central African Rep.',
    'Dominican Rep.': 'Dominican Republic',
    'Eq. Guinea': 'Equatorial Guinea',
    'W. Sahara': 'Western Sahara',
    'eSwatini': 'Eswatini',
    'S. Sudan': 'South Sudan',
    'Côte d\'Ivoire': 'Cote d\'Ivoire',
    'Bosnia and Herz.': 'Bosnia and Herzegovina',
    'Falkland Is.': 'Falkland Islands',
    'Solomon Is.': 'Solomon Islands',
    'Turkiye': 'Turkey'
  };
  
  if (nameVariations[countryName] && countryNameToData[nameVariations[countryName]]) {
    return countryNameToData[nameVariations[countryName]];
  }
  
  return null;
}

// Draw land
const land = feature(world, world.objects.countries);

svg.append('g')
  .selectAll('path')
  .data(land.features)
  .join('path')
    .attr('d', path)
    .attr('fill', '#eee') // Default color for countries without data
    .attr('stroke', '#999')
    .on('click', onCountryClick)
    .on('mouseover', showTooltip)
    .on('mouseout', hideTooltip);

// Initial choropleth
updateChoropleth();

// Control events
d3.select('#year-slider').on('input', function() {
  currentYear = +this.value;
  // Update the year display
  d3.select('#year-value').text(currentYear);
  d3.select('#chart-year').text(currentYear); // Update chart header year
  // Update the detail panel year if it's visible
  d3.select('#year-value-detail').text(currentYear);
  // Update the visualization
  updateChoropleth();
  // Update the horizontal chart
  drawHorizontalChart();
  
  // If a country is selected (detail panel is visible), update its details
  if (!d3.select('#detail-panel').classed('hidden')) {
    const selectedCountry = d3.select('#country-name').text();
    const countryFeature = land.features.find(f => f.properties.name === selectedCountry);
    if (countryFeature) {
      onCountryClick(null, countryFeature);
    }
  }
});

d3.select('#metric-select').on('change', function() {
  currentMetric = this.value;
  updateChoropleth();
});

d3.select('#scale-type').on('change', function() {
  currentScale = this.value;
  updateChoropleth();
});

function updateChoropleth() {
  // Collect all values for the current metric and year
  const values = [];
  
  Object.values(countriesData).forEach(country => {
    const value = country[currentMetric]?.[currentYear];
    if (value != null && !isNaN(value)) {
      values.push(value);
    }
  });
  
  if (values.length === 0) {
    console.warn(`No data available for ${currentMetric} in ${currentYear}`);
    return;
  }
  
  // Create color scale
  const maxValue = d3.max(values);
  const minValue = d3.min(values);
  
  let colorScale;
  if (currentMetric === 'self_sufficiency_rate') {
    const redColor = "#d73027";    // Deep red for 0%
    const yellowColor = "#fee08b"; // Yellow for values approaching 100%
    const greenColor = "#1a9850";  // Deep green for max value
    
    // Create two separate scales for under and over 100%
    colorScale = value => {
      if (value <= 100) {
        // Scale from 0 to 100
        return d3.scaleLinear()
          .domain([0, 100])
          .range([redColor, yellowColor])
          .interpolate(d3.interpolateHcl)
          (value);
      } else {
        // Scale from 100 to globalMaxSelfSufficiency
        return d3.scaleLinear()
          .domain([100, globalMaxSelfSufficiency])
          .range([yellowColor, greenColor])
          .interpolate(d3.interpolateHcl)
          (Math.min(value, globalMaxSelfSufficiency)); // Cap at global maximum
      }
    };
  } else {
    colorScale = d3.scaleSequential()
      .domain([minValue, maxValue])
      .interpolator(d3.interpolateBlues);
  }

  // Update country colors
  svg.selectAll('path')
    .transition()
    .duration(50)
    .attr('fill', d => {
      const countryName = d.properties.name;
      const countryData = getCountryData(countryName);
      
      if (!countryData) {
        return '#eee'; // Gray for countries without data
      }
      
      const value = countryData[currentMetric]?.[currentYear];
      if (value == null || isNaN(value)) {
        return '#eee'; // Gray for missing data
      }
      
      return colorScale(value);
    });
    
  // Update legend with diverging scale
  if (currentMetric === 'self_sufficiency_rate') {
    updateDivergingLegend(colorScale);
  } else {
    updateMapLegend(colorScale, minValue, maxValue);
  }
}

function updateDivergingLegend(colorScale) {
  // Remove existing legend
  svg.select('.map-legend').remove();
  
  const legendWidth = 200;
  const legendHeight = 15;
  const legendMargin = 20;
  
  // Create legend group in upper right corner
  const legend = svg.append('g')
    .attr('class', 'map-legend')
    .attr('transform', `translate(${width - legendWidth - legendMargin}, ${legendMargin})`);
  
  // Create gradient definition
  const gradientId = 'map-legend-gradient';
  const gradient = svg.select('defs').empty() ? 
    svg.append('defs') : svg.select('defs');
  
  gradient.select(`#${gradientId}`).remove();
  
  const legendGradient = gradient.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%');
  
  // Add color stops with more stops around 100% for better visualization
  const stops = [
    { pos: 0, val: 0 },
    { pos: 0.2, val: 20 },
    { pos: 0.4, val: 40 },
    { pos: 0.6, val: 60 },
    { pos: 0.8, val: 80 },
    { pos: 0.95, val: 95 },
    { pos: 1, val: 100 },
    { pos: 1.05, val: Math.round(globalMaxSelfSufficiency * 0.2) },
    { pos: 1.1, val: Math.round(globalMaxSelfSufficiency * 0.4) },
    { pos: 1.15, val: Math.round(globalMaxSelfSufficiency * 0.6) },
    { pos: 1.2, val: Math.round(globalMaxSelfSufficiency * 0.8) },
    { pos: 1.25, val: globalMaxSelfSufficiency }
  ];
  
  stops.forEach(stop => {
    legendGradient.append('stop')
      .attr('offset', `${(stop.pos / 1.25) * 100}%`)
      .attr('stop-color', colorScale(stop.val));
  });
  
  // Add legend background
  legend.append('rect')
    .attr('x', -10)
    .attr('y', -25)
    .attr('width', legendWidth + 20)
    .attr('height', legendHeight + 50)
    .attr('fill', 'rgba(255, 255, 255, 0.9)')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1)
    .attr('rx', 5);
  
  // Add legend rectangle with gradient
  legend.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', `url(#${gradientId})`);
  
  // Add legend title with current year
  legend.append('text')
    .attr('x', legendWidth / 2)
    .attr('y', -8)
    .attr('text-anchor', 'middle')
    .text(`Self-Sufficiency Rate (%) - ${currentYear}`)
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#333');
  
  // Add key value labels with updated maximum
  const keyValues = [0, 50, 100, Math.round(globalMaxSelfSufficiency / 2), globalMaxSelfSufficiency];
  keyValues.forEach(value => {
    const position = value <= 100 ? 
      (value / 100) * (legendWidth / 2) : // First half for 0-100
      (legendWidth / 2) + ((value - 100) / (globalMaxSelfSufficiency - 100)) * (legendWidth / 2); // Second half for 100-max
      
    legend.append('text')
      .attr('x', position)
      .attr('y', legendHeight + 12)
      .attr('text-anchor', value === 0 ? 'start' : value === globalMaxSelfSufficiency ? 'end' : 'middle')
      .text(`${value}%`)
      .style('font-size', '10px')
      .style('fill', '#666');
      
    // Add tick mark
    legend.append('line')
      .attr('x1', position)
      .attr('x2', position)
      .attr('y1', legendHeight)
      .attr('y2', legendHeight + 5)
      .attr('stroke', '#666')
      .attr('stroke-width', 1);
  });
  
  // Add special emphasis to 100% mark
  legend.append('line')
    .attr('x1', legendWidth / 2)
    .attr('x2', legendWidth / 2)
    .attr('y1', -20)
    .attr('y2', legendHeight + 5)
    .attr('stroke', '#666')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '2,2');
}

function updateMapLegend(colorScale, minValue, maxValue) {
  // Remove existing legend
  svg.select('.map-legend').remove();
  
  const legendWidth = 200;
  const legendHeight = 15;
  const legendMargin = 20;
  
  // Create legend group in upper right corner
  const legend = svg.append('g')
    .attr('class', 'map-legend')
    .attr('transform', `translate(${width - legendWidth - legendMargin}, ${legendMargin})`);
  
  // Create gradient definition
  const gradientId = 'map-legend-gradient';
  const gradient = svg.select('defs').empty() ? 
    svg.append('defs') : svg.select('defs');
  
  gradient.select(`#${gradientId}`).remove();
  
  const legendGradient = gradient.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%');
  
  // Add color stops
  const numStops = 20;
  for (let i = 0; i <= numStops; i++) {
    const t = i / numStops;
    const value = minValue + t * (maxValue - minValue);
    legendGradient.append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', colorScale(value));
  }
  
  // Add legend background (semi-transparent white)
  legend.append('rect')
    .attr('x', -10)
    .attr('y', -25)
    .attr('width', legendWidth + 20)
    .attr('height', legendHeight + 50)
    .attr('fill', 'rgba(255, 255, 255, 0.9)')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1)
    .attr('rx', 5);
  
  // Add legend rectangle with gradient
  legend.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', `url(#${gradientId})`);
  
  // Add legend title
  legend.append('text')
    .attr('x', legendWidth / 2)
    .attr('y', -8)
    .attr('text-anchor', 'middle')
    .text(getMetricLabel(currentMetric))
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#333');
  
  // Add min label
  legend.append('text')
    .attr('x', 0)
    .attr('y', legendHeight + 12)
    .attr('text-anchor', 'start')
    .text(currentMetric === 'self_sufficiency_rate' ? 
      `${minValue.toFixed(0)}%` : 
      minValue.toFixed(1))
    .style('font-size', '10px')
    .style('fill', '#666');
  
  // Add max label
  legend.append('text')
    .attr('x', legendWidth)
    .attr('y', legendHeight + 12)
    .attr('text-anchor', 'end')
    .text(currentMetric === 'self_sufficiency_rate' ? 
      `${maxValue.toFixed(0)}%` : 
      maxValue.toFixed(1))
    .style('font-size', '10px')
    .style('fill', '#666');
    
  // Add middle label for self-sufficiency rate (100% mark)
  if (currentMetric === 'self_sufficiency_rate') {
    const hundredPercent = 100;
    if (hundredPercent >= minValue && hundredPercent <= maxValue) {
      const position = ((hundredPercent - minValue) / (maxValue - minValue)) * legendWidth;
      legend.append('text')
        .attr('x', position)
        .attr('y', legendHeight + 12)
        .attr('text-anchor', 'middle')
        .text('100%')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('fill', '#333');
        
      // Add a small tick mark at 100%
      legend.append('line')
        .attr('x1', position)
        .attr('x2', position)
        .attr('y1', legendHeight)
        .attr('y2', legendHeight + 5)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);
    }
  }
}

function updateLegend(colorScale, minValue, maxValue) {
  // This function is now replaced by updateMapLegend
  // Keep it for compatibility but redirect to the old legend element if needed
  d3.select('#legend').selectAll('*').remove();
  
  // Add a note that legend is now on the map
  d3.select('#legend').append('div')
    .style('text-align', 'center')
    .style('color', '#666')
    .style('font-size', '12px')
    .text('Legend moved to upper right corner of map');
}

function getMetricLabel(metric) {
  const labels = {
    'self_sufficiency_rate': 'Self-Sufficiency Rate (%)',
    'net_generation': 'Net Generation (TWh)',
    'net_consumption': 'Net Consumption (TWh)',
    'imports': 'Electricity Imports (TWh)'
  };
  return labels[metric] || metric;
}

function highlightCountryBar(countryName) {
  // Remove any existing highlights
  horizontalChartSvg.selectAll('.consumption-bar, .generation-bar, .imports-bar')
    .classed('highlighted', false);
  horizontalChartSvg.selectAll('.value-label').remove();
  
  if (!countryName) return;
  
  // Find the country data
  const countryData = getCountryData(countryName);
  if (!countryData) return;
  
  const generation = countryData.net_generation?.[currentYear];
  const consumption = countryData.net_consumption?.[currentYear];
  const imports = countryData.imports?.[currentYear];
  
  if (generation == null || consumption == null || imports == null ||
      isNaN(generation) || isNaN(consumption) || isNaN(imports)) {
    return;
  }
  
  // Find the index of this country in the current chart data
  const allChartData = [];
  Object.values(countriesData).forEach(country => {
    const gen = country.net_generation?.[currentYear];
    const cons = country.net_consumption?.[currentYear];
    const imp = country.imports?.[currentYear];
    
    if (gen != null && cons != null && imp != null &&
        !isNaN(gen) && !isNaN(cons) && !isNaN(imp)) {
      allChartData.push({
        country: country.name,
        generation: gen,
        consumption: cons,
        imports: imp,
        total: gen + imp
      });
    }
  });
  
  // Sort countries by net consumption (largest to smallest)
  allChartData.sort((a, b) => b.consumption - a.consumption);
  
  // Use the same filtering logic as drawHorizontalChart
  const chartData = showAllCountries ? allChartData : allChartData.slice(0, 30);
  const countryIndex = chartData.findIndex(d => d.country === countryName);
  
  if (countryIndex === -1) return; // Country not in current view
  
  // Highlight the bars for this country
  horizontalChartSvg.selectAll('.consumption-bar')
    .filter((d, i) => i === countryIndex)
    .classed('highlighted', true);
    
  horizontalChartSvg.selectAll('.generation-bar')
    .filter((d, i) => i === countryIndex)
    .classed('highlighted', true);
    
  horizontalChartSvg.selectAll('.imports-bar')
    .filter((d, i) => i === countryIndex)
    .classed('highlighted', true);
  
  // Add value labels
  const container = d3.select('#horizontal-chart-container').node();
  const containerWidth = container.clientWidth - 16;
  const containerHeight = container.clientHeight - 16;
  const margin = { top: 10, right: 120, bottom: 50, left: 120 }; // Match drawHorizontalChart margin
  const chartWidth = containerWidth - margin.left - margin.right;
  const availableHeight = containerHeight - margin.top - margin.bottom;
  
  const maxValue = d3.max(chartData, d => Math.max(d.consumption, d.total));
  const xScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, chartWidth]);
  
  const yScale = d3.scaleLinear()
    .domain([0, chartData.length])
    .range([margin.top, margin.top + availableHeight]);
  
  const barHeight = Math.max(2, Math.min(8, availableHeight / chartData.length - 1));
  
  const chartGroup = horizontalChartSvg.select('g');
  
  // Add labels for the highlighted country
  const yPos = yScale(countryIndex) + barHeight / 2;
  const labelYPos = yPos + barHeight * 1.5; // Position labels below the bars
  
  // Consumption label (gray) - positioned to the right of the bar
  if (consumption > 0) {
    chartGroup.append('text')
      .attr('class', 'value-label')
      .attr('x', xScale(consumption) + 15)
      .attr('y', yPos)
      .attr('alignment-baseline', 'middle')
      .style('fill', '#666')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .text(`${consumption.toFixed(1)} TWh`);
  }
  
  // Generation label (blue)
  if (generation > 0) {
    chartGroup.append('text')
      .attr('class', 'value-label')
      .attr('x', xScale(generation / 2))
      .attr('y', labelYPos)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .style('fill', '#2196F3')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .text(`${generation.toFixed(1)}`);
  }
  
  // Imports label (red)
  if (imports > 0) {
    chartGroup.append('text')
      .attr('class', 'value-label')
      .attr('x', xScale(generation) + xScale(imports / 2))
      .attr('y', labelYPos)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .style('fill', '#e53e3e')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .text(`${imports.toFixed(1)}`);
  }
}

function removeCountryBarHighlight() {
  // Remove highlights
  horizontalChartSvg.selectAll('.consumption-bar, .generation-bar, .imports-bar')
    .classed('highlighted', false);
  // Remove value labels
  horizontalChartSvg.selectAll('.value-label').remove();
}

function showTooltip(event, d) {
  const countryName = d.properties.name;
  const countryData = getCountryData(countryName);

  const tooltip = d3.select('#map-tooltip');
  
  // Check if country is in current chart view and make button glow if not
  if (!showAllCountries && countryData) {
    // Get the current top 30 countries
    const allChartData = [];
    Object.values(countriesData).forEach(country => {
      const generation = country.net_generation?.[currentYear];
      const consumption = country.net_consumption?.[currentYear];
      const imports = country.imports?.[currentYear];
      
      if (generation != null && consumption != null && imports != null &&
          !isNaN(generation) && !isNaN(consumption) && !isNaN(imports)) {
        allChartData.push({
          country: country.name,
          consumption: consumption
        });
      }
    });
    
    allChartData.sort((a, b) => b.consumption - a.consumption);
    const top30Countries = allChartData.slice(0, 30);
    const isInTop30 = top30Countries.some(c => c.country === countryName);
    
    // Make button glow if country is not in top 30
    if (!isInTop30) {
      d3.selectAll('.toggle-button')
        .attr('fill', '#ffeb3b')
        .attr('stroke', '#ffc107')
        .attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 0 8px #ffc107)');
      
      d3.selectAll('.toggle-button-text')
        .style('fill', '#333')
        .style('font-weight', 'bold');
    }
  }
  
  // Highlight the corresponding bar in the chart
  highlightCountryBar(countryName);
  
  if (!countryData) {
    tooltip
      .classed('hidden', false)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px');
    
    d3.select('#tooltip-title').text(countryName);
    d3.select('#tooltip-value').text('No data available');
    return;
  }
  
  const value = countryData[currentMetric]?.[currentYear];
  
  tooltip
    .classed('hidden', false)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 10) + 'px');

  d3.select('#tooltip-title').text(countryName);
  
  if (value != null && !isNaN(value)) {
    const formattedValue = currentMetric === 'self_sufficiency_rate' 
      ? `${value.toFixed(1)}%` 
      : value.toLocaleString();
    d3.select('#tooltip-value').text(`${getMetricLabel(currentMetric)}: ${formattedValue}`);
  } else {
    d3.select('#tooltip-value').text(`${getMetricLabel(currentMetric)}: No data`);
  }
}

function hideTooltip() {
  d3.select('#map-tooltip').classed('hidden', true);
  // Remove bar highlighting when tooltip is hidden
  removeCountryBarHighlight();
  
  // Remove button glow effect
  d3.selectAll('.toggle-button')
    .attr('fill', '#f0f0f0')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1)
    .style('filter', null);
  
  d3.selectAll('.toggle-button-text')
    .style('fill', '#333')
    .style('font-weight', '600');
}

function onCountryClick(event, d) {
  const countryName = d.properties.name;
  const countryData = getCountryData(countryName);
  
  const detailPanel = d3.select('#detail-panel');
  detailPanel.classed('hidden', false);
  
  // Update country name
  d3.select('#country-name').text(countryName);
  
  if (!countryData) {
    d3.select('#stat-production').text('N/A');
    d3.select('#stat-consumption').text('N/A');
    d3.select('#stat-trade').text('N/A');
    return;
  }
  
  // Update statistics
  const generation = countryData.net_generation?.[currentYear];
  const consumption = countryData.net_consumption?.[currentYear];
  const imports = countryData.imports?.[currentYear];
  const selfSufficiency = countryData.self_sufficiency_rate?.[currentYear];
  
  d3.select('#stat-production').text(generation ? generation.toLocaleString() + ' TWh' : 'N/A');
  d3.select('#stat-consumption').text(consumption ? consumption.toLocaleString() + ' TWh' : 'N/A');
  d3.select('#stat-trade').text(imports ? imports.toLocaleString() + ' TWh' : 'N/A');
  
  // Add self-sufficiency rate display
  if (!d3.select('#stat-sufficiency').empty()) {
    d3.select('#stat-sufficiency').text(selfSufficiency ? selfSufficiency.toFixed(1) + '%' : 'N/A');
  }
  
  // Draw charts with real data
  if (countryData.self_sufficiency_rate) {
    drawBarChart(countryData.self_sufficiency_rate, 'Self-Sufficiency Rate (%)');
  }
}

d3.select('#close-detail').on('click', () => {
  d3.select('#detail-panel').classed('hidden', true);
});

function drawPieChart(mix) {
  // Clear previous chart
  d3.select('#pie-chart').selectAll('*').remove();
  
  const data = Object.entries(mix).map(([source, value]) => ({ source, value }));
  const pie = d3.pie().value(d => d.value)(data);
  const arc = d3.arc().innerRadius(40).outerRadius(80);

  const svgPie = d3.select('#pie-chart')
    .append('svg')
    .attr('width', 200)
    .attr('height', 200)
    .append('g')
    .attr('transform', 'translate(100,100)');

  // Add pie slices
  svgPie.selectAll('path')
    .data(pie)
    .join('path')
    .attr('d', arc)
    .attr('fill', (d, i) => d3.schemeCategory10[i])
    .append('title')
    .text(d => `${d.data.source}: ${d.data.value}%`);

  // Add labels
  svgPie.selectAll('text')
    .data(pie)
    .join('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .text(d => d.data.source)
    .style('font-size', '10px')
    .style('fill', 'white');
}

function drawBarChart(timeseries, label = '') {
  // Clear previous chart
  d3.select('#bar-chart').selectAll('*').remove();
  
  const data = Object.entries(timeseries)
    .map(([year, value]) => ({ year: +year, value: +value }))
    .filter(d => !isNaN(d.value))
    .sort((a, b) => a.year - b.year);

  if (data.length === 0) {
    d3.select('#bar-chart').append('div').text('No data available');
    return;
  }

  const w = 300, h = 200;
  const margin = { top: 20, right: 10, bottom: 30, left: 50 };
  
  const x = d3.scaleBand()
    .domain(data.map(d => d.year))
    .range([margin.left, w - margin.right])
    .padding(0.1);
    
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .nice()
    .range([h - margin.bottom, margin.top]);

  const svgBar = d3.select('#bar-chart')
    .append('svg')
    .attr('width', w)
    .attr('height', h);

  // Add bars
  svgBar.append('g')
    .attr('fill', 'steelblue')
    .selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', d => x(d.year))
    .attr('y', d => y(d.value))
    .attr('height', d => y(0) - y(d.value))
    .attr('width', x.bandwidth())
    .append('title')
    .text(d => `${d.year}: ${d.value.toFixed(1)}${label.includes('%') ? '%' : ''}`);

  // Add x-axis
  svgBar.append('g')
    .attr('transform', `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 5 === 0)));

  // Add y-axis
  svgBar.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));
    
  // Add y-axis label
  if (label) {
    svgBar.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (h / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(label);
  }
}

function drawHorizontalChart() {
  // Clear previous chart
  horizontalChartSvg.selectAll('*').remove();
  
  // Prepare data for all countries
  const allChartData = [];
  Object.values(countriesData).forEach(country => {
    const generation = country.net_generation?.[currentYear];
    const consumption = country.net_consumption?.[currentYear];
    const imports = country.imports?.[currentYear];
    
    // Only include countries with valid data
    if (generation != null && consumption != null && imports != null &&
        !isNaN(generation) && !isNaN(consumption) && !isNaN(imports)) {
      allChartData.push({
        country: country.name,
        generation: generation,
        consumption: consumption,
        imports: imports,
        total: generation + imports
      });
    }
  });
  
  // Sort countries by net consumption (largest to smallest)
  allChartData.sort((a, b) => b.consumption - a.consumption);
  
  // Limit to top 30 countries if showAllCountries is false
  const chartData = showAllCountries ? allChartData : allChartData.slice(0, 30);
  
  if (chartData.length === 0) {
    horizontalChartSvg.append('text')
      .attr('x', '50%')
      .attr('y', '50%')
      .attr('text-anchor', 'middle')
      .text('No data available for this year')
      .style('font-size', '16px')
      .style('fill', '#666');
    return;
  }
  
  // Get container dimensions
  const container = d3.select('#horizontal-chart-container').node();
  const containerWidth = container.clientWidth - 16; // Account for padding
  const containerHeight = container.clientHeight - 16; // Account for padding
  
  // Chart dimensions and margins - fit to container
  const margin = { top: 10, right: 120, bottom: 50, left: 120 }; // Increased bottom margin for button
  const chartWidth = containerWidth - margin.left - margin.right;
  const chartHeight = containerHeight - margin.top - margin.bottom;
  
  // Calculate bar height to fit all countries without scrolling
  const availableHeight = chartHeight;
  const barHeight = Math.max(2, Math.min(8, availableHeight / chartData.length - 1)); // Very narrow bars, max 8px
  const actualChartHeight = chartData.length * (barHeight + 1) + margin.top + margin.bottom;
  
  // Set SVG dimensions to container size
  horizontalChartSvg
    .attr('width', containerWidth)
    .attr('height', containerHeight);
  
  // Create scales
  const maxValue = d3.max(chartData, d => Math.max(d.consumption, d.total));
  const xScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, chartWidth]);
  
  // Use a simple linear scale for Y positioning to fit all countries
  const yScale = d3.scaleLinear()
    .domain([0, chartData.length])
    .range([margin.top, margin.top + availableHeight]);
  
  // Create chart group
  const chartGroup = horizontalChartSvg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`);
  
  // Add grid lines (fewer ticks)
  const xAxis = d3.axisBottom(xScale)
    .ticks(5)
    .tickSize(-availableHeight);
  
  chartGroup.append('g')
    .attr('class', 'chart-grid')
    .attr('transform', `translate(0, ${margin.top + availableHeight})`)
    .call(xAxis)
    .selectAll('text').remove();
  
  // Draw consumption bars (background, gray)
  chartGroup.selectAll('.consumption-bar')
    .data(chartData)
    .enter()
    .append('rect')
    .attr('class', 'consumption-bar')
    .attr('x', 0)
    .attr('y', (d, i) => yScale(i) - barHeight * 0.3)
    .attr('width', d => xScale(d.consumption))
    .attr('height', barHeight * 1.6); // Made wider than before
  
  // Draw generation bars (blue)
  chartGroup.selectAll('.generation-bar')
    .data(chartData)
    .enter()
    .append('rect')
    .attr('class', 'generation-bar')
    .attr('x', 0)
    .attr('y', (d, i) => yScale(i))
    .attr('width', d => xScale(d.generation))
    .attr('height', barHeight);
  
  // Draw imports bars (green, stacked on generation)
  chartGroup.selectAll('.imports-bar')
    .data(chartData)
    .enter()
    .append('rect')
    .attr('class', 'imports-bar')
    .attr('x', d => xScale(d.generation))
    .attr('y', (d, i) => yScale(i))
    .attr('width', d => xScale(d.imports))
    .attr('height', barHeight);
  
  // Add country labels (only show every few countries to avoid clutter)
  const labelStep = Math.max(1, Math.ceil(chartData.length / 50)); // Show max 50 labels
  chartGroup.selectAll('.country-label')
    .data(chartData.filter((d, i) => i % labelStep === 0))
    .enter()
    .append('text')
    .attr('class', 'country-label')
    .attr('x', -5)
    .attr('y', (d, i) => yScale(i * labelStep) + barHeight / 2)
    .attr('text-anchor', 'end')
    .attr('alignment-baseline', 'middle')
    .text(d => d.country);
  
  // Add x-axis
  chartGroup.append('g')
    .attr('class', 'chart-axis')
    .attr('transform', `translate(0, ${margin.top + availableHeight})`)
    .call(d3.axisBottom(xScale).ticks(5));
  
  // Add x-axis label
  chartGroup.append('text')
    .attr('class', 'chart-axis')
    .attr('x', chartWidth / 2)
    .attr('y', margin.top + availableHeight + 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .text('Energy (TWh)');
  
  // Add compact legend
  const legend = horizontalChartSvg.append('g')
    .attr('transform', `translate(${containerWidth - 110}, 15)`);
  
  const legendData = [
    { label: 'Consumption', color: '#333', opacity: 0.8 },
    { label: 'Generation', color: '#2196F3', opacity: 0.7 },
    { label: 'Imports', color: '#e53e3e', opacity: 0.8 }
  ];
  
  legendData.forEach((item, i) => {
    const legendItem = legend.append('g')
      .attr('transform', `translate(0, ${i * 12})`);
    
    legendItem.append('rect')
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', item.color)
      .attr('fill-opacity', item.opacity);
    
    legendItem.append('text')
      .attr('x', 12)
      .attr('y', 6)
      .style('font-size', '9px')
      .style('fill', '#333')
      .text(item.label);
  });
  
  // Add toggle button for showing all countries
  const buttonGroup = horizontalChartSvg.append('g')
    .attr('transform', `translate(${containerWidth - 160}, ${containerHeight - 35})`);
  
  // Button background
  const buttonRect = buttonGroup.append('rect')
    .attr('class', 'toggle-button')
    .attr('width', 150)
    .attr('height', 25)
    .attr('rx', 3)
    .attr('fill', '#f0f0f0')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer');
  
  // Button text
  const buttonText = buttonGroup.append('text')
    .attr('class', 'toggle-button-text')
    .attr('x', 75)
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('fill', '#333')
    .style('cursor', 'pointer')
    .text(showAllCountries ? 'Show Top 30' : 'Show All Countries');
  
  // Add click handler to button
  buttonGroup.on('click', function() {
    showAllCountries = !showAllCountries;
    drawHorizontalChart(); // Redraw chart with new setting
  });
  
  // Add hover effects
  buttonGroup.on('mouseover', function() {
    buttonRect.attr('fill', '#e0e0e0');
  }).on('mouseout', function() {
    buttonRect.attr('fill', '#f0f0f0');
  });
}

// Initial chart drawing
updateChoropleth();
drawHorizontalChart();
