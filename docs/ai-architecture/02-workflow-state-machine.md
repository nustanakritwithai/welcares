# Workflow State Machine Map

เอกสารวาด state machine และ workflow การทำงานหลักของระบบ WelCares พร้อมเงื่อนไข fallback

---

## State Machine หลัก: Service Request Lifecycle

```
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                      SERVICE REQUEST                             │
                    │                      (Entry Point)                               │
                    └──────────────────────────┬──────────────────────────────────────┘
                                               │
                                               ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │  ┌─────────────┐                                               │
         ┌──────────┴──│   START     │                                               │
         │            │  (Initial)   │                                               │
         │            └──────┬──────┘                                               │
         │                   │ Intent Classified                                     │
         │                   ▼                                                       │
         │            ┌─────────────┐                                               │
         │            │   INTAKE    │◀──────────────────────────────────────────────┤
         │            │  (Gather    │                                               │
         │            │   Info)     │                                               │
         │            └──────┬──────┘                                               │
         │                   │ Data Complete?                                        │
         │           ┌───────┴───────┐                                               │
         │           │               │                                               │
         │          NO              YES                                              │
         │           │               │                                               │
         │           ▼               ▼                                               │
         │    ┌─────────────┐   ┌─────────────┐                                      │
         │    │ CLARIFICATION│   │  VALIDATE   │                                    │
         │    │   (Ask User) │   │  (Check Data)│                                   │
         │    └──────┬──────┘   └──────┬──────┘                                    │
         │           └─────────────────┘                                           │
         │                             │ Valid?                                    │
         │                    ┌────────┴────────┐                                   │
         │                   NO                YES                                  │
         │                    │                  │                                  │
         │                    ▼                  ▼                                  │
         │            ┌─────────────┐     ┌─────────────┐                          │
         │            │   REJECT    │     │  DISPATCH   │                          │
         │            │  (Invalid)  │     │  (Find      │                          │
         │            └─────────────┘     │  Provider)  │                          │
         │                                └──────┬──────┘                          │
         │                                       │ Provider Found?                  │
         │                              ┌────────┴────────┐                         │
         │                             NO                YES                        │
         │                              │                  │                        │
         │                              ▼                  ▼                        │
         │                     ┌─────────────┐     ┌─────────────┐                 │
         │                     │  NO_CAPACITY│     │  ASSIGNED   │                 │
         │                     │  (Queue/Wait)│     │  (Provider   │                │
         │                     └──────┬──────┘     │   Confirmed) │                │
         │                            │            └──────┬──────┘                │
         │                            │                   │                        │
         │                            ▼                   ▼                        │
         │                   ┌─────────────┐     ┌─────────────┐                   │
         └──────────────────▶│   WAITING   │     │  PREPARING  │                   │
                               │  (Queue)    │     │  (En Route)  │                  │
                               └──────┬──────┘     └──────┬──────┘                  │
                                      │                   │                         │
                                      │ Provider Ready    │ Provider Arrived        │
                                      └──────────────────▶│                         │
                                                          ▼                         │
                                               ┌─────────────┐                      │
                                               │   ACTIVE    │                      │
                                               │  (In Progress)                     │
                                               │             │                      │
                                               └──────┬──────┘                      │
                                                      │                             │
                           ┌──────────────────────────┼──────────────────────────┐  │
                           │                          │                          │  │
                           ▼                          ▼                          ▼  │
                    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐│
                    │  COMPLETED  │          │   DELAYED   │          │  INCIDENT   ││
                    │  (Success)  │          │  (Issue)    │          │  (Emergency)││
                    └──────┬──────┘          └──────┬──────┘          └──────┬──────┘│
                           │                        │                        │       │
                           │                        ▼                        │       │
                           │               ┌─────────────┐                   │       │
                           │               │  SAFETY     │◀──────────────────┘       │
                           │               │  CHECK      │                           │
                           │               └──────┬──────┘                           │
                           │                      │                                  │
                           │           ┌─────────┴─────────┐                         │
                           │          OK                RISK                           │
                           │           │                  │                            │
                           │           ▼                  ▼                            │
                           │  ┌─────────────┐     ┌─────────────┐                      │
                           │  │  RESUME     │     │  ESCALATE   │                      │
                           │  │  (Continue) │     │  (Human)    │                      │
                           │  └─────────────┘     └─────────────┘                      │
                           │                                                           │
                           └───────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │   SUMMARY   │
                                               │  (Generate  │
                                               │   Report)   │
                                               └──────┬──────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │   BILLING   │
                                               │  (Invoice)   │
                                               └──────┬──────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │    END      │
                                               │  (Closed)    │
                                               └─────────────┘
```

---

## State Definitions

### START
- **Entry Action**: Log new request, assign request_id
- **Exit Condition**: User input received
- **Next State**: INTAKE

### INTAKE
- **Entry Action**: Trigger Intake Agent
- **Activities**: 
  - Classify intent
  - Extract entities
  - Validate required fields
- **Exit Conditions**:
  - Data complete → VALIDATE
  - Data incomplete → CLARIFICATION
- **Timeout**: 5 minutes → Auto-close with notification

### CLARIFICATION
- **Entry Action**: Generate clarification question
- **Max Iterations**: 2 times
- **Exit Conditions**:
  - Data received → Back to INTAKE
  - Max iterations reached → REJECT
  - User cancels → END

### VALIDATE
- **Entry Action**: Validate data against business rules
- **Checks**:
  - Patient eligibility
  - Service availability in area
  - Time slot validity
- **Exit Conditions**:
  - Valid → DISPATCH
  - Invalid → REJECT

### DISPATCH
- **Entry Action**: Trigger Dispatch Agent
- **Activities**:
  - Query available providers
  - Calculate suitability scores
  - Rank candidates
- **Exit Conditions**:
  - Provider found → ASSIGNED
  - No provider → NO_CAPACITY
  - Multiple candidates → Human approval

### NO_CAPACITY
- **Entry Action**: Queue request
- **Activities**:
  - Add to waitlist
  - Estimate wait time
  - Notify user
- **Exit Conditions**:
  - Provider available → WAITING → PREPARING
  - Timeout (30 min) → REJECT with apology offer

### ASSIGNED
- **Entry Action**: Send confirmation to provider
- **Activities**:
  - Reserve provider
  - Send job details
  - Wait acceptance (5 min timeout)
- **Exit Conditions**:
  - Provider accepts → PREPARING
  - Provider declines → Back to DISPATCH
  - Timeout → DISPATCH (find alternative)

### PREPARING
- **Entry Action**: Trigger Navigation Agent
- **Activities**:
  - Calculate route
  - Estimate arrival
  - Start location tracking
- **Exit Condition**: Provider arrives pickup → ACTIVE

### ACTIVE
- **Entry Action**: Start service timer
- **Parallel Activities**:
  - Navigation Agent: Track location, update ETA
  - Family Update Agent: Send milestone notifications
  - Safety Agent: Monitor for anomalies
- **Exit Conditions**:
  - Normal completion → COMPLETED
  - Delay detected → DELAYED
  - Incident detected → INCIDENT

### DELAYED
- **Entry Action**: Analyze delay cause
- **Auto-triggers**: Family Update Agent notification
- **Exit Conditions**:
  - Resolved → RESUME → ACTIVE
  - Critical → SAFETY CHECK

### INCIDENT
- **Entry Action**: Trigger Safety Agent immediately
- **Activities**:
  - Assess severity
  - Notify relevant parties
  - Log incident
- **Exit Conditions**:
  - Handled → SAFETY CHECK
  - Critical escalation → ESCALATE

### SAFETY CHECK
- **Entry Action**: Re-evaluate situation
- **Exit Conditions**:
  - Safe to continue → RESUME
  - Risk remains → ESCALATE

### ESCALATE
- **Entry Action**: Hand off to human supervisor
- **Activities**:
  - Compile context for human
  - Maintain monitoring
  - Log all actions
- **Exit Conditions**:
  - Human resolves → RESUME or COMPLETED
  - Emergency protocol → External dispatch (1669)

### COMPLETED
- **Entry Action**: Stop all tracking
- **Exit Condition**: Always → SUMMARY

### SUMMARY
- **Entry Action**: Trigger Summary Agent
- **Activities**:
  - Generate case summary
  - Calculate metrics
  - Prepare follow-up recommendations
- **Exit Condition**: Always → BILLING

### BILLING
- **Entry Action**: Trigger Cost Meter Agent
- **Activities**:
  - Calculate final cost
  - Apply insurance
  - Generate invoice
- **Exit Condition**: Always → END

### END
- **Entry Action**: Archive case, cleanup resources
- **Final State**: Terminal

---

## Event Triggers

| Event | Source | Triggered State | Priority |
|-------|--------|-----------------|----------|
| `user_request_received` | API/Webhook | START → INTAKE | NORMAL |
| `data_extracted` | Intake Agent | INTAKE → VALIDATE | NORMAL |
| `clarification_needed` | Intake Agent | INTAKE → CLARIFICATION | NORMAL |
| `validation_passed` | Validator | VALIDATE → DISPATCH | NORMAL |
| `validation_failed` | Validator | VALIDATE → REJECT | NORMAL |
| `provider_found` | Dispatch Agent | DISPATCH → ASSIGNED | NORMAL |
| `provider_accepted` | Provider App | ASSIGNED → PREPARING | NORMAL |
| `provider_arrived` | GPS/Provider | PREPARING → ACTIVE | NORMAL |
| `service_completed` | Provider App | ACTIVE → COMPLETED | NORMAL |
| `delay_detected` | Navigation Agent | ACTIVE → DELAYED | HIGH |
| `incident_reported` | Safety Agent | ACTIVE → INCIDENT | CRITICAL |
| `panic_button_pressed` | Provider App | Any → INCIDENT | CRITICAL |
| `safety_clear` | Safety Agent | INCIDENT → RESUME | HIGH |
| `safety_risk` | Safety Agent | INCIDENT → ESCALATE | CRITICAL |
| `human_resolved` | Supervisor | ESCALATE → COMPLETED | HIGH |
| `timeout_no_response` | System | Any waiting state → REJECT | NORMAL |

---

## Fallback Rules

### Confidence-Based Fallbacks

```
Agent Confidence Level:
├── >= 0.9: Auto-execute
├── 0.7 - 0.89: Execute + Log for review
├── 0.5 - 0.69: Request human approval
└── < 0.5: Reject + Human takeover
```

### Error Handling Matrix

| Error Type | Agent | Fallback Action |
|------------|-------|-----------------|
| LLM timeout | Any | Retry 2x → Use cached template → Human |
| Invalid JSON output | Any | Schema validation → Re-prompt → Human |
| Hallucination detected | Intake | Confidence check → Clarification loop |
| Provider decline | Dispatch | Try alternatives → Queue → Human |
| GPS failure | Navigation | Last known position → ETA estimation → Human |
| Notification failure | Family | Retry 3x → Alternative channel → Log |

### Human Handoff Conditions

ต้องส่งต่อคนทันทีเมื่อ:
1. **Safety**: Risk level = CRITICAL
2. **Compliance**: PHI access request from unauthorized agent
3. **Business**: Cost estimate > 10,000 THB
4. **Technical**: 3 consecutive AI failures
5. **User**: Explicit "speak to human" request
6. **Legal**: Potential liability situation

---

## State Persistence

```json
{
  "state_machine": {
    "current_state": "ACTIVE",
    "previous_state": "PREPARING",
    "state_history": [
      { "state": "START", "entered_at": "2025-04-09T10:00:00Z", "exited_at": "2025-04-09T10:00:02Z" },
      { "state": "INTAKE", "entered_at": "2025-04-09T10:00:02Z", "exited_at": "2025-04-09T10:02:15Z" }
    ],
    "current_agent": "NavigationAgent",
    "active_agents": ["NavigationAgent", "FamilyUpdateAgent", "SafetyAgent"],
    "context": {
      "trip_id": "TRP-2025-001",
      "patient_id": "PT-12345",
      "provider_id": "DRV-789"
    },
    "fallback_count": 0,
    "human_escalation": false
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-04-09 | Initial state machine definition |
