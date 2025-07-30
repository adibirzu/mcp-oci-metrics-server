/**
 * Graph generation utilities for OCI metrics visualization
 * Creates interactive graphs that can be displayed in GenAI chat windows
 */
import { MetricResult, GraphConfig, VisualizationResult } from '../types/index.js';
export declare class GraphGenerator {
    private defaultColorScheme;
    /**
     * Generate LLM-compatible visualization (ASCII + data table)
     * This works in any LLM context without requiring JavaScript
     */
    generateLLMCompatibleVisualization(metricData: MetricResult[], config: GraphConfig): Promise<VisualizationResult>;
    /**
     * Generate ASCII chart for text-based visualization
     */
    private generateASCIIChart;
    /**
     * Generate a readable data table
     */
    private generateDataTable;
    /**
     * Generate visualization - defaults to LLM-compatible format
     * Use interactive: true for Plotly.js charts (web browsers only)
     */
    generateGraph(metricData: MetricResult[], config: GraphConfig & {
        interactive?: boolean;
    }): Promise<VisualizationResult>;
    /**
     * Convert metric data to Plotly.js format
     */
    private convertToPlotlyData;
    /**
     * Create Plotly.js layout configuration
     */
    private createPlotlyLayout;
    /**
     * Generate complete HTML with embedded Plotly.js
     */
    private generatePlotlyHTML;
    /**
     * Generate correlation heatmap for multiple metrics
     */
    generateCorrelationHeatmap(metricData: MetricResult[], title?: string): Promise<VisualizationResult>;
    /**
     * Calculate correlation matrix for multiple metrics
     */
    private calculateCorrelationMatrix;
    /**
     * Calculate Pearson correlation coefficient between two metric series
     */
    private calculateCorrelation;
    /**
     * Align timestamps between two metric series
     */
    private alignTimestamps;
    /**
     * Get Plotly.js chart type from config
     */
    private getPlotlyType;
    /**
     * Extract time range from metric data
     */
    private extractTimeRange;
    /**
     * Generate summary text for visualization
     */
    private generateSummary;
}
//# sourceMappingURL=GraphGenerator.d.ts.map