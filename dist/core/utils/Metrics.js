const DEFAULT_CONFIG = {
    enabled: true,
    collectInterval: 60000,
    maxAge: 3600000,
    enableExport: false,
};
export class Metrics {
    config;
    logger;
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    summaries = new Map();
    values = new Map();
    labelSets = new Map();
    collectTimer = null;
    constructor(logger, config) {
        this.logger = logger;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startCollection();
    }
    startCollection() {
        if (!this.config.enabled)
            return;
        this.collectTimer = setInterval(() => {
            this.collect();
        }, this.config.collectInterval);
    }
    collect() {
        const now = Date.now();
        for (const [key, values] of this.values) {
            const filtered = values.filter(v => now - v.timestamp < this.config.maxAge);
            this.values.set(key, filtered);
        }
    }
    increment(counter, value = 1, labels) {
        const key = this.makeKey(counter, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
        this.recordValue(key, value, labels);
    }
    decrement(counter, value = 1, labels) {
        this.increment(counter, -value, labels);
    }
    getCounter(name, labels) {
        const key = this.makeKey(name, labels);
        return this.counters.get(key) || 0;
    }
    setGauge(gauge, value, labels) {
        const key = this.makeKey(gauge, labels);
        this.gauges.set(key, value);
        this.recordValue(key, value, labels);
    }
    getGauge(name, labels) {
        const key = this.makeKey(name, labels);
        return this.gauges.get(key) || 0;
    }
    observe(histogram, value, labels) {
        const key = this.makeKey(histogram, labels);
        const buckets = [0.1, 0.5, 1, 5, 10, 30, 100, 500, 1000, 5000, 10000, Infinity];
        let data = this.histograms.get(key);
        if (!data) {
            data = {
                buckets: buckets.map(b => ({ upperBound: b, count: 0 })),
                sum: 0,
                count: 0,
            };
            this.histograms.set(key, data);
        }
        for (const bucket of data.buckets) {
            if (value <= bucket.upperBound) {
                bucket.count++;
            }
        }
        data.sum += value;
        data.count++;
        this.recordValue(key, value, labels);
    }
    getHistogram(name, labels) {
        const key = this.makeKey(name, labels);
        return this.histograms.get(key) || { buckets: [], sum: 0, count: 0 };
    }
    record(name, value, labels) {
        const key = this.makeKey(name, labels);
        let summary = this.summaries.get(key);
        if (!summary) {
            summary = { count: 0, sum: 0 };
            this.summaries.set(key, summary);
        }
        summary.count++;
        summary.sum += value;
        this.recordValue(key, value, labels);
    }
    getSummary(name, labels) {
        const key = this.makeKey(name, labels);
        const summary = this.summaries.get(key);
        if (!summary || summary.count === 0) {
            return { count: 0, sum: 0, avg: 0 };
        }
        return {
            count: summary.count,
            sum: summary.sum,
            avg: summary.sum / summary.count,
        };
    }
    makeKey(name, labels) {
        if (!labels || Object.keys(labels).length === 0) {
            return name;
        }
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${labelStr}}`;
    }
    recordValue(key, value, labels) {
        if (!this.values.has(key)) {
            this.values.set(key, []);
        }
        const values = this.values.get(key);
        values.push({ value, timestamp: Date.now(), labels });
    }
    getSnapshot() {
        const snapshot = {
            counter: Object.fromEntries(this.counters),
            gauge: Object.fromEntries(this.gauges),
            histogram: {},
            summary: {},
        };
        for (const [key, data] of this.histograms) {
            snapshot.histogram[key] = data;
        }
        for (const [key, summary] of this.summaries) {
            snapshot.summary[key] = {
                count: summary.count,
                sum: summary.sum,
                avg: summary.count > 0 ? summary.sum / summary.count : 0,
            };
        }
        return snapshot;
    }
    reset() {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.summaries.clear();
        this.values.clear();
    }
    getValues(metricName) {
        return this.values.get(metricName) || [];
    }
    getRecentValues(metricName, seconds) {
        const cutoff = Date.now() - seconds * 1000;
        return this.getValues(metricName).filter(v => v.timestamp >= cutoff);
    }
    close() {
        if (this.collectTimer) {
            clearInterval(this.collectTimer);
            this.collectTimer = null;
        }
    }
}
//# sourceMappingURL=Metrics.js.map