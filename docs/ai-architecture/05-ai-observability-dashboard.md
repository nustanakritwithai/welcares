# AI Observability Dashboard

เอกสารกำหนด KPI และ dashboard สำหรับ monitoring AI system ของ WelCares

---

## Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI OBSERVABILITY DASHBOARD                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  SYSTEM HEALTH  │  │   AGENT METRICS │  │   COST TRACKING │            │
│  │                 │  │                 │  │                 │            │
│  │  ● Uptime: 99.9%│  │  Intake: 45ms   │  │  Today: ฿2,450  │            │
│  │  ● Error: 0.3%  │  │  Dispatch: 120ms│  │  Avg/Job: ฿12.3 │            │
│  │  ● Queue: 12    │  │  Safety: 89ms   │  │  Budget: 78%    │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    REAL-TIME AGENT ACTIVITY                         │   │
│  │                                                                     │   │
│  │  Intake      ████████████████████████████████████████  245 req/min │   │
│  │  Dispatch    ████████████████████████████              156 req/min │   │
│  │  Navigate    ██████████████████████████                142 req/min │   │
│  │  Family      ████████████████                          89 req/min  │   │
│  │  Safety      ███████                                   23 req/min  │   │
│  │  Summary     ████████████████████                      98 req/min  │   │
│  │  CostMeter   ████████████████████████                  134 req/min │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │      ERROR BREAKDOWN    │  │          FALLBACK ANALYSIS              │  │
│  │                         │  │                                         │  │
│  │  Timeout:        12     │  │  Fallback Rate: 4.2%                    │  │
│  │  Invalid JSON:    5     │  │  By Provider:                           │  │
│  │  Hallucination:   3     │  │    - OpenAI → Anthropic: 2.1%          │  │
│  │  Auth Error:      0     │  │    - Anthropic → Google: 1.5%          │  │
│  │  Rate Limit:      2     │  │    - To Local: 0.6%                    │  │
│  └─────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Performance Indicators (KPIs)

### 1. System Health Metrics

| Metric | Description | Target | Critical |
|--------|-------------|--------|----------|
| System Uptime | % เวลาที่ระบบพร้อมใช้ | > 99.9% | < 99% |
| API Availability | % การตอบสนองสำเร็จ | > 99.5% | < 95% |
| Queue Depth | จำนวนงานค้าง | < 50 | > 200 |
| Error Rate | % คำขอที่ล้มเหลว | < 1% | > 5% |
| Recovery Time | เวลากู้คืนหลัง incident | < 5 min | > 15 min |

### 2. Agent Performance Metrics

| Agent | Latency (p95) | Success Rate | Fallback Rate | Quality Score |
|-------|---------------|--------------|---------------|---------------|
| Intake | < 500ms | > 95% | < 5% | > 4.0/5 |
| Dispatch | < 2s | > 90% | < 10% | > 3.5/5 |
| Navigation | < 1s | > 98% | < 2% | N/A |
| Family Update | < 800ms | > 95% | < 3% | > 4.2/5 |
| Safety | < 3s | > 99% | < 1% | N/A |
| Summary | < 5s | > 85% | < 15% | > 3.8/5 |
| Cost Meter | < 500ms | > 99% | < 1% | N/A |

### 3. Cost Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Cost per job | < ฿15 | > ฿20 |
| Cost per day | < ฿30,000 | > ฿40,000 |
| Token efficiency | > 80% | < 70% |
| Cache hit rate | > 30% | < 20% |
| Fallback cost impact | < 10% | > 20% |

### 4. Quality Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Intent Accuracy | % การ classify intent ถูกต้อง | > 90% |
| Entity Extraction F1 | F1 score การดึง entities | > 0.85 |
| Hallucination Rate | % การตอบที่ไม่ตรงข้อมูล | < 2% |
| User Satisfaction | คะแนนความพึงพอใจ (1-5) | > 4.0 |
| Human Override Rate | % ที่คนต้องแก้ไข | < 10% |

---

## Dashboard Panels

### Panel 1: Real-Time Overview

```yaml
panel_name: "System Overview"
refresh_rate: 5s
metrics:
  - active_jobs: gauge
  - requests_per_minute: rate
  - avg_response_time: gauge
  - error_rate: percentage
  - cost_per_minute: rate
visualization: 
  - big_number cards
  - sparkline charts
```

### Panel 2: Agent Performance Grid

```yaml
panel_name: "Agent Status"
refresh_rate: 10s
layout: 7-column grid (one per agent)
per_agent:
  - status_indicator: green/yellow/red
  - current_load: requests/min
  - avg_latency: ms
  - error_count: count (last 5 min)
  - last_successful_call: timestamp
```

### Panel 3: Cost Tracking

```yaml
panel_name: "Cost Dashboard"
refresh_rate: 1m
time_ranges: [1h, 6h, 24h, 7d, 30d]
charts:
  - cost_by_agent: stacked bar
  - cost_by_model: pie chart
  - daily_budget_usage: gauge
  - projected_monthly_cost: trend line
alerts:
  - 80% of daily budget: warning
  - 95% of daily budget: critical
  - cost spike (>200% of avg): critical
```

### Panel 4: Error Analysis

```yaml
panel_name: "Error Explorer"
refresh_rate: 30s
filters:
  - agent: multi-select
  - error_type: multi-select
  - time_range: selector
views:
  - error_count_by_type: bar chart
  - error_trend: line chart
  - top_errors: table
  - error_details: log view (last 100)
```

### Panel 5: Quality Metrics

```yaml
panel_name: "AI Quality"
refresh_rate: 5m
metrics:
  - intent_confidence_distribution: histogram
  - entity_extraction_accuracy: line chart
  - user_feedback_scores: bar chart
  - human_override_reasons: pie chart
  - hallucination_detection: alert list
```

### Panel 6: Tracing View

```yaml
panel_name: "Request Tracing"
refresh_rate: on_demand
features:
  - search_by: [job_id, patient_id, timestamp]
  - trace_timeline: waterfall view
  - agent_calls: expandable tree
  - context_inspection: json viewer
  - performance_breakdown: flame graph
```

---

## Alert Configuration

### Critical Alerts (PagerDuty)

```yaml
alerts:
  - name: "AI System Down"
    condition: uptime < 99% for 2m
    action: page_oncall
    
  - name: "High Error Rate"
    condition: error_rate > 5% for 5m
    action: page_oncall
    
  - name: "Safety Agent Failure"
    condition: safety_agent_errors > 0
    action: page_oncall + escalate
    
  - name: "Budget Exceeded"
    condition: daily_cost > budget_limit
    action: page_oncall + throttle_ai
```

### Warning Alerts (Slack)

```yaml
alerts:
  - name: "Elevated Latency"
    condition: p95_latency > threshold for 10m
    action: slack_warning
    
  - name: "High Fallback Rate"
    condition: fallback_rate > 10% for 15m
    action: slack_warning
    
  - name: "Cache Hit Rate Low"
    condition: cache_hit < 20% for 30m
    action: slack_warning
    
  - name: "Model Degradation"
    condition: quality_score drops > 10%
    action: slack_warning
```

### Info Alerts (Dashboard)

```yaml
alerts:
  - name: "New Model Version"
    condition: model_updated
    action: dashboard_notification
    
  - name: "Cost Anomaly"
    condition: cost_spike > 150% of baseline
    action: dashboard_highlight
```

---

## Logging Schema

### Structured Log Format

```json
{
  "timestamp": "2025-04-09T10:00:00.123Z",
  "level": "INFO",
  "service": "welcares-ai",
  "trace_id": "trace_abc123",
  "span_id": "span_def456",
  "agent": "IntakeAgent",
  "event_type": "request_completed",
  "data": {
    "job_id": "JOB-12345",
    "patient_id_hash": "hash_xyz",
    "intent": "BOOK_TRIP",
    "confidence": 0.94,
    "model_used": "gemini-1.5-flash",
    "input_tokens": 450,
    "output_tokens": 180,
    "cost_thb": 0.45,
    "latency_ms": 245,
    "cache_hit": false,
    "fallback_used": false
  }
}
```

### Log Retention Policy

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Raw logs | 7 days | Hot (SSD) |
| Aggregated metrics | 90 days | Warm |
| Audit logs | 7 years | Cold (S3) |
| Error logs | 1 year | Warm |
| Cost logs | 2 years | Cold (S3) |

---

## Distributed Tracing

### Trace Structure

```
Trace: trip_booking_flow
├── Span: intake_classification (245ms)
│   ├── Tag: model=gemini-flash
│   └── Log: extracted_entities={...}
├── Span: data_validation (15ms)
├── Span: dispatch_matching (1,200ms)
│   ├── Tag: model=gpt-4o
│   ├── Span: provider_query (200ms)
│   ├── Span: suitability_calc (800ms)
│   └── Span: assignment (200ms)
├── Span: navigation_setup (150ms)
└── Span: family_notification (89ms)
    └── Tag: channel=LINE
```

### Sampling Strategy

```yaml
tracing:
  sampler: "probabilistic"
  rate: 0.1  # 10% of requests
  
  # Always trace these
  forced_traces:
    - error_rate > 0
    - latency > 5s
    - safety_agent_invoked
    - human_escalation
```

---

## Implementation Stack

### Recommended Tools

| Layer | Tool | Purpose |
|-------|------|---------|
| Metrics | Prometheus | Time-series metrics |
| Visualization | Grafana | Dashboards |
| Logging | Loki | Log aggregation |
| Tracing | Jaeger | Distributed tracing |
| Alerting | PagerDuty + Slack | Notifications |
| APM | OpenTelemetry | Instrumentation |

### Grafana Dashboard JSON Model

```json
{
  "dashboard": {
    "title": "WelCares AI Observability",
    "timezone": "Asia/Bangkok",
    "panels": [
      {
        "id": 1,
        "title": "Active Jobs",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(welcares_active_jobs)"
          }
        ]
      },
      {
        "id": 2,
        "title": "Agent Latency",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, welcares_agent_latency_bucket)"
          }
        ]
      }
    ]
  }
}
```

---

## Runbooks

### Runbook: High Error Rate

```markdown
## Symptom: Error rate > 5%

### Checklist
1. [ ] Check provider status pages
2. [ ] Review recent deployments
3. [ ] Check rate limiting
4. [ ] Verify API keys
5. [ ] Check for model deprecation

### Mitigation
- Enable fallback to alternative providers
- Throttle non-critical requests
- Page on-call engineer
```

### Runbook: Cost Spike

```markdown
## Symptom: Cost > 200% of baseline

### Checklist
1. [ ] Identify high-cost jobs
2. [ ] Check for infinite loops
3. [ ] Review model selection
4. [ ] Check for retry storms

### Mitigation
- Switch to cheaper models temporarily
- Enable aggressive caching
- Add rate limiting
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-04-09 | Initial dashboard specification |
