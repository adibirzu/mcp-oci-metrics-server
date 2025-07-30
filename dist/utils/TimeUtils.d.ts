/**
 * Time utilities for OCI Metrics MCP Server
 * Ensures compatibility with Logan MCP date/time formats for correlation
 */
import moment from 'moment-timezone';
export declare class TimeUtils {
    private static readonly LOGAN_TIMEZONE;
    private static readonly LOGAN_FORMAT;
    /**
     * Convert any time input to Logan MCP compatible format (ISO 8601 UTC)
     */
    static toLoganFormat(input: string | Date | moment.Moment): string;
    /**
     * Parse time range string and return Logan compatible start/end times
     */
    static parseTimeRange(timeRange: string): {
        startTime: string;
        endTime: string;
    };
    /**
     * Get time range for common Logan MCP queries
     */
    static getLoganCompatibleRanges(): Record<string, {
        startTime: string;
        endTime: string;
    }>;
    /**
     * Convert OCI timestamp to Logan compatible format
     */
    static convertOCITimestamp(ociTimestamp: string | Date): string;
    /**
     * Generate time buckets for aggregation (compatible with Logan queries)
     */
    static generateTimeBuckets(startTime: string, endTime: string, interval?: string): string[];
    /**
     * Check if timestamp is within Logan MCP query range
     */
    static isInLoganTimeRange(timestamp: string, rangeStart: string, rangeEnd: string): boolean;
    /**
     * Format duration for human-readable display (Logan style)
     */
    static formatDuration(startTime: string, endTime: string): string;
    /**
     * Get timezone offset for correlation with Logan events
     */
    static getTimezoneInfo(): {
        logan_timezone: string;
        local_timezone: string;
        offset_hours: number;
    };
    /**
     * Synchronize timestamps for correlation analysis
     */
    static synchronizeTimestamps(metricTimestamps: string[], loganTimestamps: string[], toleranceMinutes?: number): Array<{
        metricTime: string;
        loganTime: string;
        timeDiff: number;
    }>;
    /**
     * Validate timestamp format for Logan compatibility
     */
    static validateLoganTimestamp(timestamp: string): {
        valid: boolean;
        formatted?: string;
        error?: string;
    };
    /**
     * Get common time intervals used in OCI and Logan
     */
    static getCommonIntervals(): Record<string, {
        oci_format: string;
        display_name: string;
        description: string;
    }>;
}
//# sourceMappingURL=TimeUtils.d.ts.map