/**
 * Time utilities for OCI Metrics MCP Server
 * Ensures compatibility with Logan MCP date/time formats for correlation
 */
import moment from 'moment-timezone';
export class TimeUtils {
    // Logan MCP uses UTC timestamps in ISO 8601 format
    static LOGAN_TIMEZONE = 'UTC';
    static LOGAN_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
    /**
     * Convert any time input to Logan MCP compatible format (ISO 8601 UTC)
     */
    static toLoganFormat(input) {
        let momentObj;
        if (moment.isMoment(input)) {
            momentObj = input.clone();
        }
        else if (input instanceof Date) {
            momentObj = moment(input);
        }
        else {
            // Parse string input - handle various formats
            momentObj = moment(input);
        }
        // Convert to UTC and format for Logan compatibility
        return momentObj.utc().toISOString();
    }
    /**
     * Parse time range string and return Logan compatible start/end times
     */
    static parseTimeRange(timeRange) {
        const now = moment().utc();
        let startTime;
        let endTime = now.clone();
        // Handle relative time ranges (e.g., "1h", "24h", "7d")
        if (timeRange.match(/^\d+[mhd]$/)) {
            const value = parseInt(timeRange);
            const unit = timeRange.slice(-1);
            switch (unit) {
                case 'm':
                    startTime = now.clone().subtract(value, 'minutes');
                    break;
                case 'h':
                    startTime = now.clone().subtract(value, 'hours');
                    break;
                case 'd':
                    startTime = now.clone().subtract(value, 'days');
                    break;
                default:
                    startTime = now.clone().subtract(1, 'hour');
            }
        }
        // Handle absolute time ranges
        else if (timeRange.includes(' to ')) {
            const [start, end] = timeRange.split(' to ');
            startTime = moment(start).utc();
            endTime = moment(end).utc();
        }
        // Handle ISO strings
        else if (timeRange.includes('T')) {
            startTime = moment(timeRange).utc();
            endTime = now.clone();
        }
        // Default to last hour
        else {
            startTime = now.clone().subtract(1, 'hour');
        }
        return {
            startTime: this.toLoganFormat(startTime),
            endTime: this.toLoganFormat(endTime)
        };
    }
    /**
     * Get time range for common Logan MCP queries
     */
    static getLoganCompatibleRanges() {
        const now = moment().utc();
        return {
            'last_hour': {
                startTime: this.toLoganFormat(now.clone().subtract(1, 'hour')),
                endTime: this.toLoganFormat(now)
            },
            'last_6_hours': {
                startTime: this.toLoganFormat(now.clone().subtract(6, 'hours')),
                endTime: this.toLoganFormat(now)
            },
            'last_24_hours': {
                startTime: this.toLoganFormat(now.clone().subtract(24, 'hours')),
                endTime: this.toLoganFormat(now)
            },
            'last_7_days': {
                startTime: this.toLoganFormat(now.clone().subtract(7, 'days')),
                endTime: this.toLoganFormat(now)
            },
            'last_30_days': {
                startTime: this.toLoganFormat(now.clone().subtract(30, 'days')),
                endTime: this.toLoganFormat(now)
            }
        };
    }
    /**
     * Convert OCI timestamp to Logan compatible format
     */
    static convertOCITimestamp(ociTimestamp) {
        return this.toLoganFormat(ociTimestamp);
    }
    /**
     * Generate time buckets for aggregation (compatible with Logan queries)
     */
    static generateTimeBuckets(startTime, endTime, interval = 'PT1M') {
        const start = moment(startTime).utc();
        const end = moment(endTime).utc();
        const buckets = [];
        // Convert OCI interval format to moment duration
        let duration;
        if (interval.startsWith('PT')) {
            // ISO 8601 duration format (PT1M, PT5M, PT1H, etc.)
            const match = interval.match(/PT(\d+)([MH])/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2] === 'M' ? 'minutes' : 'hours';
                duration = moment.duration(value, unit);
            }
            else {
                duration = moment.duration(1, 'minute'); // Default
            }
        }
        else {
            // Simple format (1m, 5m, 1h, etc.)
            const match = interval.match(/(\d+)([mh])/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2] === 'm' ? 'minutes' : 'hours';
                duration = moment.duration(value, unit);
            }
            else {
                duration = moment.duration(1, 'minute'); // Default
            }
        }
        let current = start.clone();
        while (current.isBefore(end)) {
            buckets.push(this.toLoganFormat(current));
            current.add(duration);
        }
        return buckets;
    }
    /**
     * Check if timestamp is within Logan MCP query range
     */
    static isInLoganTimeRange(timestamp, rangeStart, rangeEnd) {
        const ts = moment(timestamp);
        const start = moment(rangeStart);
        const end = moment(rangeEnd);
        return ts.isBetween(start, end, undefined, '[]'); // Inclusive
    }
    /**
     * Format duration for human-readable display (Logan style)
     */
    static formatDuration(startTime, endTime) {
        const start = moment(startTime);
        const end = moment(endTime);
        const duration = moment.duration(end.diff(start));
        if (duration.asMinutes() < 60) {
            return `${Math.round(duration.asMinutes())} minutes`;
        }
        else if (duration.asHours() < 24) {
            return `${Math.round(duration.asHours())} hours`;
        }
        else {
            return `${Math.round(duration.asDays())} days`;
        }
    }
    /**
     * Get timezone offset for correlation with Logan events
     */
    static getTimezoneInfo() {
        const local = moment();
        const utc = moment.utc();
        return {
            logan_timezone: this.LOGAN_TIMEZONE,
            local_timezone: local.format('z'),
            offset_hours: local.utcOffset() / 60
        };
    }
    /**
     * Synchronize timestamps for correlation analysis
     */
    static synchronizeTimestamps(metricTimestamps, loganTimestamps, toleranceMinutes = 1) {
        const synchronized = [];
        const toleranceMs = toleranceMinutes * 60 * 1000;
        metricTimestamps.forEach(metricTime => {
            const metricMoment = moment(metricTime);
            // Find closest Logan timestamp within tolerance
            let closestLogan = null;
            let smallestDiff = Infinity;
            loganTimestamps.forEach(loganTime => {
                const loganMoment = moment(loganTime);
                const diff = Math.abs(metricMoment.diff(loganMoment));
                if (diff < toleranceMs && diff < smallestDiff) {
                    closestLogan = loganTime;
                    smallestDiff = diff;
                }
            });
            if (closestLogan) {
                synchronized.push({
                    metricTime,
                    loganTime: closestLogan,
                    timeDiff: smallestDiff
                });
            }
        });
        return synchronized;
    }
    /**
     * Validate timestamp format for Logan compatibility
     */
    static validateLoganTimestamp(timestamp) {
        try {
            const parsed = moment(timestamp);
            if (!parsed.isValid()) {
                return {
                    valid: false,
                    error: 'Invalid timestamp format'
                };
            }
            // Ensure it's in Logan compatible format
            const formatted = this.toLoganFormat(parsed);
            return {
                valid: true,
                formatted
            };
        }
        catch (error) {
            return {
                valid: false,
                error: `Timestamp validation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Get common time intervals used in OCI and Logan
     */
    static getCommonIntervals() {
        return {
            '1m': {
                oci_format: 'PT1M',
                display_name: '1 minute',
                description: 'High resolution monitoring'
            },
            '5m': {
                oci_format: 'PT5M',
                display_name: '5 minutes',
                description: 'Standard monitoring interval'
            },
            '15m': {
                oci_format: 'PT15M',
                display_name: '15 minutes',
                description: 'Medium resolution monitoring'
            },
            '1h': {
                oci_format: 'PT1H',
                display_name: '1 hour',
                description: 'Low resolution monitoring'
            },
            '1d': {
                oci_format: 'PT24H',
                display_name: '1 day',
                description: 'Daily aggregation'
            }
        };
    }
}
//# sourceMappingURL=TimeUtils.js.map