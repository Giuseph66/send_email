---
target: public/dashboard.html
total_score: 19
p0_count: 2
p1_count: 2
timestamp: 2026-06-16T17-58-23Z
slug: public-dashboard-html
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | No sender health indicator; history requires manual refresh with no "last updated" timestamp |
| 2 | Match System / Real World | 3/4 | Portuguese labels appropriate; "Senha de App" hint is contextually useful |
| 3 | User Control and Freedom | 2/4 | No send confirmation; no undo; no way to deactivate a sender without deleting it |
| 4 | Consistency and Standards | 2/4 | 7 different border-radius values (20/15/12/10/8/6/5px); btn-info is absolute-positioned without a positioned parent |
| 5 | Error Prevention | 1/4 | Email sends with zero confirmation; default credentials always visible in login page |
| 6 | Recognition Rather Than Recall | 2/4 | No empty states in remetentesContainer or history — blank white rectangle on first load |
| 7 | Flexibility and Efficiency | 1/4 | No keyboard shortcuts; no history search/filter; no bulk ops; history has no pagination |
| 8 | Aesthetic and Minimalist Design | 1/4 | Glassmorphism everywhere; side-stripe toasts; purple gradient on 8+ surfaces |
| 9 | Error Recovery | 2/4 | Toast errors exist but form fields show no inline error state on dashboard |
| 10 | Help and Documentation | 3/4 | API docs modal is thoughtful; app password hint is well-placed |
| **Total** | | **19/40** | **Needs Significant Work** |

### Anti-Patterns Verdict

Does this look AI-generated? Yes, immediately and completely.

The purple-indigo gradient (#667eea to #764ba2) is the most overused AI default palette. It appears in body background, every button, nav active state, card avatars, logo circle, and focus rings. Every surface uses backdrop-filter: blur(10px) on a white-95% card — textbook glassmorphism as default (absolute ban). Side-stripe borders on toasts and email-detail (absolute ban). transition: all animates layout properties.

### Overall Impression

Functional skeleton with zero design identity. The gradient-plus-glass pattern communicates nothing specific. Biggest opportunity: strip glassmorphism, pick one surface color with intention, let content carry the weight.

### What's Working

1. Mobile-responsive history with dual-mode table/card is thoughtful and correctly implemented.
2. API docs modal with copy-to-clipboard curl examples is genuinely useful.
3. Password toggle on login is a small, well-implemented detail.

### Priority Issues

**[P0] No send confirmation on irreversible action**: Email submit fires immediately with no confirmation. Fix: inline preview panel (sender, recipient, subject, body excerpt) before final send.

**[P0] Default credentials permanently displayed on login**: admin/admin123 visible to anyone reaching /login. Fix: remove block entirely or put behind a disclosure toggle.

**[P1] Glassmorphism as default surface**: backdrop-filter: blur(10px) on header, nav, main-content, login-card — decorative, not purposeful. Fix: drop it, use solid intentional backgrounds.

**[P1] Side-stripe borders**: border-left: 4px solid on toasts and email-detail. Fix: use full border, background tint, or colored icon instead.

**[P2] btn-info layout bug**: position: absolute without positioned parent. Fix: add position: relative to .header-content or remove absolute positioning.

### Persona Red Flags

**Alex (Power User)**: API docs modal and send form can't be open simultaneously. Pointer-only workflow with no keyboard shortcuts.

**Jordan (First-Timer)**: Remetentes tab loads completely empty with no empty state or guidance. Gmail app password requirement buried in modal help text — Jordan will fail with main password first.

### Minor Observations

- transition: all on cards/buttons — scope explicitly to transform, box-shadow, background-color, border-color
- 7 different border-radius values with no system — pick 2-3 steps
- Courier New in code blocks — use JetBrains Mono or ui-monospace fallback
- Header mixes title, subtitle, API button, user display, logout with no visual grouping logic
- History requires manual refresh — a 30s setInterval would be appropriate
