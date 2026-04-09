# LLM Routing Policy

เอกสารกำหนดกลยุทธ์การเลือกโมเดล การคุมต้นทุน timeout retry fallback และงบประมาณต่อเคส

---

## Cost Model

### Estimated Cost Per Job

| Job Type | Complexity | AI Cost | Notes |
|----------|------------|---------|-------|
| Simple booking | Low | ~฿6 | Intent classification + basic extraction |
| Standard trip | Medium | ~฿13 | Full workflow with navigation |
| Complex case | High | ~฿25 | Multi-agent coordination + PHI handling |
| Emergency | Critical | ~฿40 | Safety override + human escalation |

### Cost Breakdown by Component

```
Total AI Cost per Job = Σ (Token Usage × Model Rate) + Orchestration Overhead

Typical breakdown:
├── Intake Agent:     30% (~฿2-4)
├── Dispatch Agent:   20% (~฿1.5-3)
├── Navigation Agent: 15% (~฿1-2)
├── Family Update:    10% (~฿0.5-1)
├── Safety Agent:     15% (~฿1-2)
├── Summary Agent:    10% (~฿0.5-1)
└── Cost Meter:        5% (~฿0.3-0.5)
```

---

## Model Selection Matrix

### Available Models

| Model | Provider | Input Cost | Output Cost | Latency | Strengths |
|-------|----------|------------|-------------|---------|-----------|
| GPT-4o-mini | OpenAI | $0.15/M | $0.60/M | Fast | Cost-effective, simple tasks |
| GPT-4o | OpenAI | $2.50/M | $10.00/M | Medium | Complex reasoning, high accuracy |
| Claude 3 Haiku | Anthropic | $0.25/M | $1.25/M | Fast | Fast, cheap |
| Claude 3.5 Sonnet | Anthropic | $3.00/M | $15.00/M | Medium | Best for healthcare context |
| Gemini 1.5 Flash | Google | $0.075/M | $0.30/M | Fast | Cheapest, good for Thai |
| Gemini 1.5 Pro | Google | $3.50/M | $10.50/M | Medium | Multilingual, long context |
| Local (Ollama) | Self-hosted | $0 | $0 | Variable | PHI-safe, zero cost |

### Task-to-Model Routing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LLM GATEWAY CONTROLLER                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │   FAST TIER     │    │  BALANCED TIER  │    │  PREMIUM TIER   │
    │   (฿0-3/job)    │    │   (฿3-10/job)   │    │  (฿10-50/job)   │
    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
    │ • Intent classify│    │ • Dispatch logic │    │ • Safety agent  │
    │ • Simple extract │    │ • Route optimize │    │ • Complex PHI   │
    │ • Cost estimate  │    │ • Family update  │    │ • Emergency     │
    │ • Token count    │    │ • Summary gen    │    │ • Human handoff │
    └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
             │                      │                      │
             ▼                      ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │ Gemini Flash    │    │ GPT-4o          │    │ Claude 3.5 Sonne│
    │ GPT-4o-mini     │    │ Claude 3 Haiku  │    │ GPT-4o          │
    │ Local small     │    │ Gemini Pro      │    │ Local large     │
    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Detailed Routing Rules

#### Intake Agent
```yaml
task: intent_classification
complexity: low
primary_model: gemini-1.5-flash
fallback_model: gpt-4o-mini
max_tokens: 500
timeout_ms: 2000
retry: 2
cost_ceiling: 0.5  # THB
```

#### Dispatch Agent
```yaml
task: provider_matching
complexity: medium
primary_model: gpt-4o
fallback_model: claude-3-haiku
max_tokens: 1000
timeout_ms: 3000
retry: 2
cost_ceiling: 2.0  # THB
```

#### Safety Agent
```yaml
task: risk_assessment
complexity: high
primary_model: claude-3.5-sonnet  # Best for healthcare
fallback_model: gpt-4o
max_tokens: 2000
timeout_ms: 5000
retry: 3
cost_ceiling: 10.0  # THB - emergency allows higher cost
```

---

## Fallback Strategy

### Three-Level Fallback

```
Level 1: Same Provider, Different Model
  GPT-4o fails → GPT-4o-mini (with simplified prompt)
  
Level 2: Different Provider
  OpenAI fails → Anthropic → Google
  
Level 3: Local Model (Ollama)
  All cloud fails → Local inference
  Trade-off: Slower, less accurate, but PHI-safe
```

### Fallback Triggers

| Condition | Action | Delay Added |
|-----------|--------|-------------|
| Timeout (> 5s) | Retry → Fallback | +2s |
| 5xx Error | Immediate fallback | 0s |
| Rate Limited | Queue + Fallback | +5s |
| Cost exceeded | Downgrade model | 0s |
| Invalid JSON | Retry with schema | +1s |

### Circuit Breaker Pattern

```python
class CircuitBreaker:
    def __init__(self, threshold=5, timeout=60):
        self.failure_threshold = threshold
        self.timeout_seconds = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.timeout_seconds:
                self.state = "HALF_OPEN"
            else:
                raise CircuitOpenError("Provider unavailable")
        
        try:
            result = func()
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
    
    def _on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
```

---

## Budget Control

### Per-Request Limits

```yaml
max_cost_per_request:
  fast_tier: 1.0 THB
  balanced_tier: 5.0 THB
  premium_tier: 20.0 THB
  emergency_override: 50.0 THB

max_tokens_per_request:
  input: 8000
  output: 4000

max_latency_ms:
  fast_tier: 3000
  balanced_tier: 5000
  premium_tier: 10000
```

### Per-Job Limits

```yaml
max_ai_cost_per_job:
  simple: 10 THB
  standard: 25 THB
  complex: 50 THB
  emergency: 100 THB

alert_thresholds:
  warning: 80% of budget
  critical: 95% of budget
  hard_stop: 100% of budget (fallback to human)
```

### Daily/Monthly Quotas

| Tier | Daily Limit | Monthly Limit | Action on Exceed |
|------|-------------|---------------|------------------|
| Development | 1,000 THB | 10,000 THB | Alert + Throttle |
| Staging | 5,000 THB | 50,000 THB | Alert + Review |
| Production | 50,000 THB | 1,000,000 THB | Alert + Escalate |

---

## Cost Optimization Strategies

### 1. Prompt Caching
```python
# Cache common system prompts
system_prompt_hash = hash(system_prompt)
cached_response = cache.get(system_prompt_hash)
if cached_response:
    return cached_response
```

### 2. Response Caching
```python
# Cache deterministic responses
if task in ["intent_classify", "cost_calculate"]:
    cache_key = f"{task}:{hash(input)}"
    return cache.get_or_compute(cache_key, lambda: call_llm(input))
```

### 3. Batch Processing
```python
# Combine multiple similar requests
batched_inputs = batch_similar_requests(inputs, max_batch_size=10)
response = llm.batch_generate(batched_inputs)
```

### 4. Model Downgrading
```python
# Start with cheap model, escalate if needed
models = ["gemini-flash", "gpt-4o-mini", "gpt-4o"]
for model in models:
    try:
        result = generate(model, input)
        if result.confidence > 0.8:
            return result
    except:
        continue
```

### 5. Token Optimization
```python
# Truncate long contexts intelligently
optimized_input = {
    "system": system_prompt,
    "context": truncate_relevant_chunks(long_context, max_tokens=4000),
    "query": user_query
}
```

---

## Provider Health Monitoring

### Health Check Endpoints

```yaml
providers:
  openai:
    health_url: https://status.openai.com/api/v2/status.json
    check_interval: 30s
    timeout: 5s
  
  anthropic:
    health_url: https://status.anthropic.com/api/v2/status.json
    check_interval: 30s
    timeout: 5s
  
  google:
    health_url: https://status.cloud.google.com/incidents.json
    check_interval: 60s
    timeout: 10s
```

### Dynamic Routing

```python
def select_provider(task_complexity, required_capabilities):
    healthy_providers = get_healthy_providers()
    
    candidates = [
        p for p in healthy_providers
        if p.supports(required_capabilities)
        and p.current_cost < p.daily_budget * 0.9
    ]
    
    # Sort by cost-performance ratio
    candidates.sort(key=lambda p: p.cost_per_token / p.quality_score)
    
    return candidates[0] if candidates else fallback_to_local()
```

---

## Observability

### Key Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Cost per job | < ฿15 | > ฿20 |
| Avg latency | < 3s | > 5s |
| Fallback rate | < 5% | > 10% |
| Error rate | < 1% | > 2% |
| Cache hit rate | > 30% | < 20% |

### Cost Tracking Schema

```json
{
  "job_id": "JOB-12345",
  "timestamp": "2025-04-09T10:00:00Z",
  "cost_breakdown": {
    "intake_agent": { "model": "gemini-flash", "input_tokens": 500, "output_tokens": 200, "cost_thb": 0.5 },
    "dispatch_agent": { "model": "gpt-4o", "input_tokens": 1000, "output_tokens": 400, "cost_thb": 4.2 },
    "navigation_agent": { "model": "gpt-4o-mini", "input_tokens": 800, "output_tokens": 300, "cost_thb": 0.8 }
  },
  "total_cost_thb": 5.5,
  "fallback_used": false,
  "cache_hits": 2
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-04-09 | Initial routing policy definition |
