/**
 * Graph generation utilities for OCI metrics visualization
 * Creates interactive graphs that can be displayed in GenAI chat windows
 */

// Web-based visualization - no canvas dependency needed
import moment from 'moment-timezone';
import { 
  MetricResult, 
  GraphConfig, 
  VisualizationResult,
  MetricDataPoint 
} from '../types/index.js';

export class GraphGenerator {
  private defaultColorScheme = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];

  /**
   * Generate LLM-compatible visualization (ASCII + data table)
   * This works in any LLM context without requiring JavaScript
   */
  async generateLLMCompatibleVisualization(
    metricData: MetricResult[],
    config: GraphConfig
  ): Promise<VisualizationResult> {
    try {
      const asciiChart = this.generateASCIIChart(metricData, config);
      const dataTable = this.generateDataTable(metricData);
      const summary = this.generateSummary(metricData, config, 
        metricData.reduce((sum, metric) => sum + metric.aggregatedDatapoints.length, 0));
      
      const combinedVisualization = `${summary}\n\n${asciiChart}\n\n${dataTable}`;
      
      return {
        graphHtml: combinedVisualization,
        graphJson: JSON.stringify({ 
          type: 'llm-compatible',
          ascii: asciiChart,
          table: dataTable,
          data: metricData 
        }, null, 2),
        summary,
        dataPoints: metricData.reduce((sum, metric) => sum + metric.aggregatedDatapoints.length, 0),
        timeRange: this.extractTimeRange(metricData)
      };
    } catch (error) {
      throw new Error(`LLM visualization generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate ASCII chart for text-based visualization
   */
  private generateASCIIChart(metricData: MetricResult[], config: GraphConfig): string {
    if (metricData.length === 0) return 'No data available for visualization';

    // Use the first metric for ASCII chart (can be enhanced for multiple metrics)
    const metric = metricData[0];
    const points = metric.aggregatedDatapoints.slice(-20); // Last 20 points for readability
    
    if (points.length === 0) return 'No data points available';

    const values = points.map(p => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const chartHeight = 10;
    const chartWidth = Math.min(points.length, 50);
    
    let chart = `📊 ${config.title || 'Metric Visualization'}\n`;
    chart += `${metric.namespace}/${metric.metricName}\n`;
    chart += `Range: ${minVal.toFixed(2)} - ${maxVal.toFixed(2)}\n\n`;

    // Generate ASCII sparkline
    const sparkline = points.map(point => {
      const normalized = range === 0 ? 0.5 : (point.value - minVal) / range;
      const chars = '▁▂▃▄▅▆▇█';
      const index = Math.floor(normalized * (chars.length - 1));
      return chars[index];
    }).join('');

    chart += `Trend: ${sparkline}\n\n`;

    // Generate vertical bar chart
    for (let row = chartHeight - 1; row >= 0; row--) {
      const threshold = minVal + (range * (row + 0.5) / chartHeight);
      let line = `${threshold.toFixed(1).padStart(8)} │`;
      
      for (let col = 0; col < Math.min(chartWidth, points.length); col++) {
        const value = points[col].value;
        line += value >= threshold ? '█' : ' ';
      }
      chart += line + '\n';
    }
    
    // Add time axis
    chart += '         └' + '─'.repeat(Math.min(chartWidth, points.length)) + '\n';
    chart += '          ';
    for (let i = 0; i < Math.min(chartWidth, points.length); i += 5) {
      chart += i.toString().padStart(5);
    }
    chart += '\n          (Last ' + points.length + ' data points)\n';

    return chart;
  }

  /**
   * Generate a readable data table
   */
  private generateDataTable(metricData: MetricResult[]): string {
    let table = '📋 **Detailed Metrics Data**\n\n';
    
    metricData.forEach((metric, index) => {
      table += `**${index + 1}. ${metric.namespace}/${metric.metricName}**\n`;
      table += `   Resolution: ${metric.resolution || 'PT1M'}\n`;
      
      const recentPoints = metric.aggregatedDatapoints.slice(-5);
      if (recentPoints.length > 0) {
        table += '   Recent Values:\n';
        recentPoints.forEach(point => {
          const time = moment(point.timestamp).format('MM-DD HH:mm');
          table += `   • ${time}: ${point.value.toFixed(3)}\n`;
        });
        
        const values = recentPoints.map(p => p.value);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const trend = values.length > 1 ? 
          (values[values.length - 1] > values[0] ? '📈 Rising' : '📉 Declining') : 
          '➡️ Stable';
          
        table += `   Average: ${avg.toFixed(3)} | Trend: ${trend}\n\n`;
      }
    });

    return table;
  }

  /**
   * Generate visualization - defaults to LLM-compatible format
   * Use interactive: true for Plotly.js charts (web browsers only)
   */
  async generateGraph(
    metricData: MetricResult[],
    config: GraphConfig & { interactive?: boolean }
  ): Promise<VisualizationResult> {
    try {
      // Default to LLM-compatible visualization
      if (!config.interactive) {
        return this.generateLLMCompatibleVisualization(metricData, config);
      }

      // Interactive Plotly.js version (for web browsers)
      const plotlyData = this.convertToPlotlyData(metricData, config);
      const layout = this.createPlotlyLayout(config, metricData);
      
      const graphHtml = this.generatePlotlyHTML(plotlyData, layout, config);
      const graphJson = JSON.stringify({ data: plotlyData, layout }, null, 2);
      
      const totalDataPoints = metricData.reduce((sum, metric) => 
        sum + metric.aggregatedDatapoints.length, 0);
      
      const timeRange = this.extractTimeRange(metricData);
      const summary = this.generateSummary(metricData, config, totalDataPoints);

      return {
        graphHtml,
        graphJson,
        summary,
        dataPoints: totalDataPoints,
        timeRange
      };
    } catch (error) {
      throw new Error(`Graph generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert metric data to Plotly.js format
   */
  private convertToPlotlyData(metricData: MetricResult[], config: GraphConfig): any[] {
    const traces: any[] = [];

    metricData.forEach((metric, index) => {
      const timestamps = metric.aggregatedDatapoints.map(point => point.timestamp);
      const values = metric.aggregatedDatapoints.map(point => point.value);
      
      const traceName = `${metric.namespace}/${metric.metricName}`;
      const color = this.defaultColorScheme[index % this.defaultColorScheme.length];

      let trace: any = {
        name: traceName,
        x: timestamps,
        y: values,
        type: this.getPlotlyType(config.type),
        line: config.type === 'line' ? { color, width: 2 } : undefined,
        marker: config.type !== 'line' ? { color } : undefined
      };

      // Add specific configurations for different chart types
      switch (config.type) {
        case 'scatter':
          trace.mode = 'markers';
          trace.marker.size = 8;
          break;
        case 'bar':
          trace.marker.opacity = 0.8;
          break;
        case 'pie':
          // For pie charts, use latest values
          const latestValues = metricData.map(m => {
            const latest = m.aggregatedDatapoints[m.aggregatedDatapoints.length - 1];
            return latest ? latest.value : 0;
          });
          trace = {
            type: 'pie',
            labels: metricData.map(m => `${m.namespace}/${m.metricName}`),
            values: latestValues,
            textinfo: 'label+percent',
            hovertemplate: '%{label}<br>Value: %{value}<br>Percentage: %{percent}<extra></extra>'
          };
          break;
      }

      traces.push(trace);
    });

    return traces;
  }

  /**
   * Create Plotly.js layout configuration
   */
  private createPlotlyLayout(config: GraphConfig, metricData: MetricResult[]): any {
    const layout: any = {
      title: {
        text: config.title,
        font: { size: 16, color: '#333' }
      },
      showlegend: config.showLegend !== false,
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Arial, sans-serif', size: 12, color: '#333' },
      margin: { l: 60, r: 30, t: 60, b: 80 }
    };

    // Configure axes for non-pie charts
    if (config.type !== 'pie') {
      layout.xaxis = {
        title: { text: config.xAxis || 'Time' },
        type: 'date',
        tickformat: '%H:%M<br>%m-%d',
        gridcolor: '#ddd',
        gridwidth: 1
      };

      layout.yaxis = {
        title: { text: config.yAxis || 'Value' },
        gridcolor: '#ddd',
        gridwidth: 1
      };

      // Auto-format y-axis based on value ranges
      const allValues = metricData.flatMap(m => 
        m.aggregatedDatapoints.map(p => p.value)
      );
      const maxValue = Math.max(...allValues);
      
      if (maxValue > 1000000) {
        layout.yaxis.tickformat = '.2s'; // Scientific notation
      } else if (maxValue < 1) {
        layout.yaxis.tickformat = '.4f'; // More decimal places
      }
    }

    // Responsive layout
    layout.autosize = true;
    layout.responsive = true;

    return layout;
  }

  /**
   * Generate complete HTML with embedded Plotly.js
   */
  private generatePlotlyHTML(data: any[], layout: any, config: GraphConfig): string {
    const plotlyDataJson = JSON.stringify(data);
    const plotlyLayoutJson = JSON.stringify(layout);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>OCI Metrics Visualization</title>
    <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
        }
        #chart {
            width: 100%;
            height: 600px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .chart-info {
            margin-top: 20px;
            padding: 15px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .chart-info h3 {
            margin-top: 0;
            color: #333;
        }
        .metric-list {
            list-style-type: none;
            padding: 0;
        }
        .metric-list li {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .metric-list li:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div id="chart"></div>
    
    <div class="chart-info">
        <h3>Chart Information</h3>
        <p><strong>Type:</strong> ${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Chart</p>
        <p><strong>Generated:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss')} UTC</p>
        <p><strong>Data Points:</strong> <span id="dataPointCount"></span></p>
        
        <h4>Metrics Displayed:</h4>
        <ul class="metric-list" id="metricsList"></ul>
    </div>

    <script>
        const data = ${plotlyDataJson};
        const layout = ${plotlyLayoutJson};
        
        // Configure Plotly options
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToAdd: [
                {
                    name: 'Download SVG',
                    icon: 'camera',
                    click: function(gd) {
                        Plotly.downloadImage(gd, {format: 'svg', width: 1200, height: 600, filename: 'oci-metrics-chart'});
                    }
                }
            ],
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        };
        
        // Create the plot
        Plotly.newPlot('chart', data, layout, config);
        
        // Update info section
        const totalDataPoints = data.reduce((sum, trace) => sum + (trace.x ? trace.x.length : 0), 0);
        document.getElementById('dataPointCount').textContent = totalDataPoints;
        
        const metricsList = document.getElementById('metricsList');
        data.forEach(trace => {
            const li = document.createElement('li');
            li.textContent = trace.name || 'Unnamed Metric';
            metricsList.appendChild(li);
        });
        
        // Make chart responsive
        window.addEventListener('resize', function() {
            Plotly.Plots.resize('chart');
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate correlation heatmap for multiple metrics
   */
  async generateCorrelationHeatmap(
    metricData: MetricResult[],
    title: string = 'Metric Correlation Heatmap'
  ): Promise<VisualizationResult> {
    try {
      // Calculate correlation matrix
      const correlationMatrix = this.calculateCorrelationMatrix(metricData);
      const metricNames = metricData.map(m => `${m.namespace}/${m.metricName}`);

      const heatmapData = [{
        z: correlationMatrix,
        x: metricNames,
        y: metricNames,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmid: 0,
        hoverongaps: false,
        hovertemplate: 'X: %{x}<br>Y: %{y}<br>Correlation: %{z:.3f}<extra></extra>'
      }];

      const layout = {
        title: { text: title, font: { size: 16 } },
        xaxis: { title: 'Metrics', tickangle: -45 },
        yaxis: { title: 'Metrics' },
        width: 800,
        height: 800,
        margin: { l: 150, r: 50, t: 80, b: 150 }
      };

      const graphHtml = this.generatePlotlyHTML(heatmapData, layout, { 
        type: 'heatmap', 
        title, 
        xAxis: 'Metrics', 
        yAxis: 'Metrics' 
      });

      return {
        graphHtml,
        graphJson: JSON.stringify({ data: heatmapData, layout }, null, 2),
        summary: `Correlation heatmap showing relationships between ${metricNames.length} metrics`,
        dataPoints: metricData.reduce((sum, m) => sum + m.aggregatedDatapoints.length, 0),
        timeRange: this.extractTimeRange(metricData)
      };
    } catch (error) {
      throw new Error(`Correlation heatmap generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate correlation matrix for multiple metrics
   */
  private calculateCorrelationMatrix(metricData: MetricResult[]): number[][] {
    const matrix: number[][] = [];
    const n = metricData.length;

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Perfect correlation with self
        } else {
          matrix[i][j] = this.calculateCorrelation(
            metricData[i].aggregatedDatapoints,
            metricData[j].aggregatedDatapoints
          );
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate Pearson correlation coefficient between two metric series
   */
  private calculateCorrelation(series1: MetricDataPoint[], series2: MetricDataPoint[]): number {
    if (series1.length === 0 || series2.length === 0) return 0;

    // Align timestamps and extract values
    const aligned = this.alignTimestamps(series1, series2);
    const values1 = aligned.map(point => point.value1);
    const values2 = aligned.map(point => point.value2);

    if (values1.length < 2) return 0;

    const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length;
    const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Align timestamps between two metric series
   */
  private alignTimestamps(
    series1: MetricDataPoint[], 
    series2: MetricDataPoint[]
  ): Array<{timestamp: string, value1: number, value2: number}> {
    const aligned: Array<{timestamp: string, value1: number, value2: number}> = [];
    
    // Create maps for faster lookup
    const map1 = new Map(series1.map(point => [point.timestamp, point.value]));
    const map2 = new Map(series2.map(point => [point.timestamp, point.value]));

    // Find common timestamps
    const commonTimestamps = [...map1.keys()].filter(timestamp => map2.has(timestamp));

    commonTimestamps.forEach(timestamp => {
      aligned.push({
        timestamp,
        value1: map1.get(timestamp)!,
        value2: map2.get(timestamp)!
      });
    });

    return aligned.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get Plotly.js chart type from config
   */
  private getPlotlyType(type: string): string {
    switch (type) {
      case 'line': return 'scatter';
      case 'bar': return 'bar';
      case 'scatter': return 'scatter';
      case 'heatmap': return 'heatmap';
      case 'pie': return 'pie';
      default: return 'scatter';
    }
  }

  /**
   * Extract time range from metric data
   */
  private extractTimeRange(metricData: MetricResult[]): { startTime: string; endTime: string } {
    const allTimestamps = metricData.flatMap(metric => 
      metric.aggregatedDatapoints.map(point => point.timestamp)
    );

    if (allTimestamps.length === 0) {
      const now = moment().toISOString();
      return { startTime: now, endTime: now };
    }

    allTimestamps.sort();
    return {
      startTime: allTimestamps[0],
      endTime: allTimestamps[allTimestamps.length - 1]
    };
  }

  /**
   * Generate summary text for visualization
   */
  private generateSummary(
    metricData: MetricResult[], 
    config: GraphConfig, 
    totalDataPoints: number
  ): string {
    const metricCount = metricData.length;
    const namespaces = [...new Set(metricData.map(m => m.namespace))];
    const timeRange = this.extractTimeRange(metricData);
    
    const duration = moment(timeRange.endTime).diff(moment(timeRange.startTime), 'hours', true);
    
    return `Generated ${config.type} chart with ${metricCount} metrics from ${namespaces.length} namespace(s). ` +
           `Total data points: ${totalDataPoints}. Time range: ${duration.toFixed(1)} hours ` +
           `(${moment(timeRange.startTime).format('MMM DD HH:mm')} - ${moment(timeRange.endTime).format('MMM DD HH:mm')}).`;
  }
}