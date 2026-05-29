/**
 * ============================================================
 *  VERDANT — Personal Savings Tracker
 *  app.js
 *
 *  Architecture:
 *    State  — single source of truth (persisted to localStorage)
 *    Render — pure functions that read State and paint the DOM
 *    Events — user actions that mutate State then call Render
 *
 *  Backend Readiness:
 *    All data mutations are funnelled through saveState().
 *    Replace saveState() / loadState() with fetch('/api/...')
 *    calls to wire up a Flask or Django REST backend.
 * ============================================================
 */

// ============================================================
//  STATE — single source of truth
// ============================================================
const DEFAULT_STATE = {
  totalSavings: 12450.00,           // Running total ($)
  monthlyIncome: 5200,              // Used for saving-rate KPI
  monthlyDeposits: {                // deposits by month key "YYYY-MM"
    "2025-01": 900,
    "2025-02": 1050,
    "2025-03": 800,
    "2025-04": 1200,
    "2025-05": 950,
    "2025-06": 1100,
    "2025-07": 870,
    "2025-08": 1300,
    "2025-09": 990,
    "2025-10": 1150,
    "2025-11": 1050,
    "2025-12": 0,                   // current month — grows with deposits
  },
  goals: [
    { id: 1, name: "Emergency Fund", emoji: "🛡️", target: 20000, current: 12450, created: "2025-01-01" },
    { id: 2, name: "Japan Holiday",  emoji: "✈️", target: 5000,  current: 2200,  created: "2025-03-01" },
    { id: 3, name: "New MacBook",    emoji: "💻", target: 3500,  current: 1800,  created: "2025-06-01" },
  ],
  transactions: [
    { id: 1,  type: "deposit",    amount: 1300, note: "October salary transfer", date: "2025-10-01", goalId: null },
    { id: 2,  type: "deposit",    amount: 500,  note: "Freelance project",        date: "2025-10-12", goalId: 2 },
    { id: 3,  type: "withdrawal", amount: 200,  note: "Camera lens",              date: "2025-10-20", goalId: null },
    { id: 4,  type: "deposit",    amount: 900,  note: "November salary transfer", date: "2025-11-01", goalId: null },
    { id: 5,  type: "deposit",    amount: 150,  note: "Bonus",                    date: "2025-11-15", goalId: 1 },
    { id: 6,  type: "withdrawal", amount: 75,   note: "Spotify + subscriptions",  date: "2025-11-22", goalId: null },
    { id: 7,  type: "deposit",    amount: 800,  note: "December salary transfer", date: "2025-12-01", goalId: null },
  ],
  nextId: 8,
};

/**
 * loadState — tries localStorage first; falls back to DEFAULT_STATE.
 * Replace with: const res = await fetch('/api/state'); return res.json();
 */
function loadState() {
  try {
    const raw = localStorage.getItem('verdant_state');
    return raw ? JSON.parse(raw) : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * saveState — persists to localStorage.
 * Replace with: await fetch('/api/state', { method:'PUT', body: JSON.stringify(state) });
 */
function saveState() {
  localStorage.setItem('verdant_state', JSON.stringify(state));
}

// Initialise state
let state = loadState();

// ============================================================
//  UTILITIES
// ============================================================

/** Format number as dollar currency string */
function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format compact dollar for charts */
function fmtK(n) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + Math.round(n);
}

/** Get current month key "YYYY-MM" */
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Month abbreviation from 1-based number */
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Resolve time of day greeting */
function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/** Calculate months until goal is reached */
function monthsToGoal(remaining, monthly) {
  if (monthly <= 0) return null;
  return Math.ceil(remaining / monthly);
}

/** Projected completion date string */
function projectedDate(months) {
  if (!months) return '—';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Total deposited in the current month (from transactions) */
function currentMonthDeposited() {
  const key = currentMonthKey();
  const [y, m] = key.split('-').map(Number);
  return state.transactions
    .filter(tx => {
      const d = new Date(tx.date);
      return tx.type === 'deposit' && d.getFullYear() === y && d.getMonth() + 1 === m;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

// ============================================================
//  NAVIGATION
// ============================================================

/**
 * showSection — switch visible section and update nav highlights.
 * @param {string} name  Section ID suffix (e.g. 'dashboard')
 * @param {Element|null} linkEl  The nav-item that was clicked
 */
function showSection(name, linkEl) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Show target section
  document.getElementById('section-' + name)?.classList.add('active');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    goals: 'Goals',
    transactions: 'Transactions',
    analytics: 'Analytics',
    settings: 'Settings',
  };
  document.getElementById('topbarTitle').textContent = titles[name] || '';

  // Re-render section-specific views
  if (name === 'transactions') renderTransactions();
  if (name === 'analytics')    renderAnalytics();
  if (name === 'goals')        renderGoalsGrid();

  closeSidebar();
}

/** Open/close sidebar on mobile */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ============================================================
//  RENDER — DASHBOARD
// ============================================================

function renderDashboard() {
  renderKPIs();
  renderProgressBars();
  renderGoalSnapshot();
  renderRecentTransactions();
}

/** Update the four KPI cards */
function renderKPIs() {
  const monthlyDep = currentMonthDeposited();
  document.getElementById('kpiTotal').textContent   = fmt(state.totalSavings);
  document.getElementById('kpiMonthly').textContent = fmt(monthlyDep);

  // Closest active goal
  const topGoal = state.goals[0];
  if (topGoal) {
    const remaining = Math.max(0, topGoal.target - topGoal.current);
    document.getElementById('kpiToGoal').textContent = fmt(remaining);
    document.getElementById('kpiGoalLabel').textContent = topGoal.name;
  }

  // Saving rate = monthlyDeposited / monthlyIncome * 100
  const rate = state.monthlyIncome > 0
    ? Math.round((monthlyDep / state.monthlyIncome) * 100)
    : 0;
  document.getElementById('kpiRate').textContent = rate + '%';

  // Update income input in settings
  const incomeInput = document.getElementById('monthlyIncome');
  if (incomeInput) incomeInput.value = state.monthlyIncome;
}

/** Build monthly progress bar chart (Jan–Dec) */
function renderProgressBars() {
  const container = document.getElementById('progressBars');
  if (!container) return;

  const months = Object.entries(state.monthlyDeposits);
  const maxVal  = Math.max(...months.map(([,v]) => v), 1);

  container.innerHTML = months.map(([key, val]) => {
    const [, m] = key.split('-').map(Number);
    const pct   = Math.round((val / maxVal) * 100);
    return `
      <div class="progress-month">
        <span class="progress-month-label">${MONTH_ABBR[m - 1]}</span>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="progress-amount">${fmtK(val)}</span>
      </div>`;
  }).join('');
}

/** Render the top 3 goals as compact items for the dashboard */
function renderGoalSnapshot() {
  const container = document.getElementById('goalList');
  if (!container) return;

  const goals = state.goals.slice(0, 3);
  if (!goals.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">No goals yet — add one in the Goals section.</p>';
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    return `
      <div class="goal-item">
        <div class="goal-item-header">
          <span class="goal-item-name">${g.emoji} ${g.name}</span>
          <span class="goal-item-pct">${pct}%</span>
        </div>
        <div class="goal-track">
          <div class="goal-fill" style="width:${pct}%"></div>
        </div>
        <div class="goal-item-amounts">
          <span>${fmt(g.current)} saved</span>
          <span>Goal: ${fmt(g.target)}</span>
        </div>
      </div>`;
  }).join('');
}

/** Render the 5 most recent transactions on the dashboard */
function renderRecentTransactions() {
  const container = document.getElementById('recentTxList');
  if (!container) return;

  const recent = [...state.transactions].reverse().slice(0, 5);
  renderTxRows(container, recent);
}

/** Shared helper — renders transaction rows into a container element */
function renderTxRows(container, txList) {
  if (!txList.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);padding:12px 8px;">No transactions yet.</p>';
    return;
  }

  container.innerHTML = txList.map(tx => {
    const sign   = tx.type === 'deposit' ? '+' : '−';
    const icon   = tx.type === 'deposit' ? '↑' : '↓';
    const d      = new Date(tx.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="tx-row">
        <div class="tx-icon ${tx.type}">${icon}</div>
        <div class="tx-info">
          <div class="tx-note">${tx.note || (tx.type === 'deposit' ? 'Deposit' : 'Withdrawal')}</div>
          <div class="tx-date">${dateStr}</div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
      </div>`;
  }).join('');
}

// ============================================================
//  RENDER — TRANSACTIONS
// ============================================================

/** Full transactions list with filter */
function renderTransactions() {
  const container = document.getElementById('fullTxList');
  if (!container) return;

  const filter = document.getElementById('txFilter')?.value || 'all';
  let list = [...state.transactions].reverse();
  if (filter !== 'all') list = list.filter(tx => tx.type === filter);

  renderTxRows(container, list);
}

// ============================================================
//  RENDER — GOALS
// ============================================================

function renderGoalsGrid() {
  const container = document.getElementById('goalsGrid');
  if (!container) return;

  // Populate deposit modal goal select
  const select = document.getElementById('depositGoal');
  if (select) {
    select.innerHTML = '<option value="">— General Savings —</option>' +
      state.goals.map(g => `<option value="${g.id}">${g.emoji} ${g.name}</option>`).join('');
  }

  if (!state.goals.length) {
    container.innerHTML = '<p style="font-size:14px;color:var(--text-muted);">No goals yet. Use the calculator above to create one!</p>';
    return;
  }

  container.innerHTML = state.goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const remaining = Math.max(0, g.target - g.current);
    return `
      <div class="goal-card" id="goal-card-${g.id}">
        <span class="goal-card-emoji">${g.emoji}</span>
        <div class="goal-card-pct">${pct}%</div>
        <div class="goal-card-name">${g.name}</div>
        <div class="goal-card-dates">Started ${new Date(g.created).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>
        <div class="goal-track" style="height:8px;border-radius:99px;">
          <div class="goal-fill" style="width:${pct}%"></div>
        </div>
        <div class="goal-card-amounts">
          <span><strong>${fmt(g.current)}</strong> saved</span>
          <span>${fmt(remaining)} left of <strong>${fmt(g.target)}</strong></span>
        </div>
        <div class="goal-card-actions">
          <button class="goal-action-btn" onclick="addToGoal(${g.id})">+ Add funds</button>
          <button class="goal-action-btn delete" onclick="deleteGoal(${g.id})">Remove</button>
        </div>
      </div>`;
  }).join('');
}

// ============================================================
//  RENDER — ANALYTICS
// ============================================================

function renderAnalytics() {
  renderAnalyticsChart();
  renderDonut();
  renderProjection();
}

/** Bar chart of monthly deposits for the analytics section */
function renderAnalyticsChart() {
  const container = document.getElementById('analyticsChart');
  if (!container) return;

  const entries = Object.entries(state.monthlyDeposits);
  const maxVal  = Math.max(...entries.map(([,v]) => v), 1);

  container.innerHTML = entries.map(([key, val]) => {
    const [, m] = key.split('-').map(Number);
    const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
    return `
      <div class="bar-wrap">
        <span class="bar-val">${fmtK(val)}</span>
        <div class="bar" style="height:${heightPct}%"></div>
        <span class="bar-label">${MONTH_ABBR[m - 1]}</span>
      </div>`;
  }).join('');
}

/** Simple legend-based "donut" for goal breakdown */
function renderDonut() {
  const container = document.getElementById('donutChart');
  if (!container) return;

  const COLORS = ['#A8D5BA','#78BF97','#4E8C6A','#D4EDDF','#B2D8C5'];
  const total  = state.goals.reduce((s, g) => s + g.current, 0) || 1;

  container.innerHTML = state.goals.map((g, i) => {
    const pct = Math.round((g.current / total) * 100);
    return `
      <div class="donut-legend-item">
        <div class="donut-dot" style="background:${COLORS[i % COLORS.length]}"></div>
        <span class="donut-legend-name">${g.emoji} ${g.name}</span>
        <span class="donut-legend-val">${fmt(g.current)}</span>
        <span class="donut-legend-pct">${pct}%</span>
      </div>`;
  }).join('');

  if (!state.goals.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">Add goals to see breakdown.</p>';
  }
}

/** 12-month projection chart — shows actual past + projected future */
function renderProjection() {
  const container = document.getElementById('projectionChart');
  if (!container) return;

  const months  = Object.entries(state.monthlyDeposits);
  const avgDep  = months.reduce((s,[,v]) => s + v, 0) / months.length;

  // Build 12 months: first 11 actual (from state), last 1 projected
  let running = 0;
  const CHART_COLORS = { actual: '#A8D5BA', projected: '#E8F5EE' };
  const bars = months.map(([key, val], idx) => {
    running += val;
    const isProjected = idx >= 11;
    return { key, val: running, isProjected };
  });

  // Add one projected month if data is full
  const lastKey = months[months.length - 1][0];
  const [ly, lm] = lastKey.split('-').map(Number);
  const projMonth = lm === 12 ? `${ly+1}-01` : `${ly}-${String(lm+1).padStart(2,'0')}`;
  bars.push({ key: projMonth, val: running + avgDep, isProjected: true });

  const maxVal = Math.max(...bars.map(b => b.val), 1);

  const barsHTML = bars.map(b => {
    const [, m] = b.key.split('-').map(Number);
    const heightPct = Math.max(4, Math.round((b.val / maxVal) * 90));
    const cls = b.isProjected ? 'proj-bar projected' : 'proj-bar actual';
    return `
      <div class="proj-bar-wrap">
        <div class="${cls}" style="height:${heightPct}px;width:28px;"></div>
        <span class="proj-label">${MONTH_ABBR[m - 1]}</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="projection-grid" style="display:flex;align-items:flex-end;gap:8px;height:140px;overflow-x:auto;padding-bottom:4px;">
      ${barsHTML}
    </div>
    <div class="proj-legend">
      <div class="proj-legend-item"><div class="proj-legend-dot" style="background:#A8D5BA"></div>Actual</div>
      <div class="proj-legend-item"><div class="proj-legend-dot" style="background:#E8F5EE;border:1px dashed #A8D5BA"></div>Projected</div>
    </div>`;
}

// ============================================================
//  GOAL CALCULATOR
// ============================================================

/**
 * calculateGoal — core arithmetic for the savings goal calculator.
 *
 *   remaining = target − current
 *   months    = ceil(remaining / monthly)
 *   percent   = (current / target) * 100
 */
function calculateGoal() {
  const target  = parseFloat(document.getElementById('calcTarget').value)  || 0;
  const current = parseFloat(document.getElementById('calcCurrent').value) || 0;
  const monthly = parseFloat(document.getElementById('calcMonthly').value) || 0;

  if (target <= 0) { showToast('Please enter a target amount.'); return; }

  const remaining = Math.max(0, target - current);
  const percent   = Math.min(100, Math.round((current / target) * 100));
  const months    = monthsToGoal(remaining, monthly);
  const dateStr   = projectedDate(months);

  // Update result UI
  document.getElementById('calcRemaining').textContent = fmt(remaining);
  document.getElementById('calcMonths').textContent    = months !== null ? months + ' mo' : '—';
  document.getElementById('calcPercent').textContent   = percent + '%';
  document.getElementById('calcDate').textContent      = dateStr;
  document.getElementById('calcProgressFill').style.width = percent + '%';

  // Contextual message
  let msg = '';
  if (percent >= 100) {
    msg = '🎉 Goal achieved! You\'ve already hit this target.';
  } else if (!monthly) {
    msg = `You need ${fmt(remaining)} more to reach your goal. Set a monthly contribution to see a timeline.`;
  } else {
    msg = `At ${fmt(monthly)}/month, you'll reach your goal of ${fmt(target)} in about ${months} months (${dateStr}).`;
  }
  document.getElementById('calcMessage').textContent = msg;

  // Show result block
  document.getElementById('calcResult').style.display = 'block';
}

/** Add goal from calculator to the goals list */
function addGoalFromCalc() {
  const name    = document.getElementById('calcName').value.trim() || 'New Goal';
  const target  = parseFloat(document.getElementById('calcTarget').value)  || 0;
  const current = parseFloat(document.getElementById('calcCurrent').value) || 0;

  if (target <= 0) { showToast('Enter a target amount first.'); return; }

  const EMOJIS = ['🎯','🏡','✈️','🚗','💻','📚','🏖️','💎','🎸','🌱'];
  const emoji  = EMOJIS[state.goals.length % EMOJIS.length];

  state.goals.push({
    id: state.nextId++,
    name, emoji, target,
    current: Math.min(current, target),
    created: new Date().toISOString().slice(0, 10),
  });
  saveState();

  renderGoalsGrid();
  renderGoalSnapshot();
  renderKPIs();
  showToast(`"${name}" added to your goals!`);

  // Reset calculator
  document.getElementById('calcResult').style.display = 'none';
  ['calcName','calcTarget','calcCurrent','calcMonthly'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

/** Add funds to an existing goal */
function addToGoal(goalId) {
  const amountStr = prompt('How much would you like to add to this goal? ($)');
  if (!amountStr) return;
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) { showToast('Invalid amount.'); return; }

  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;

  goal.current = Math.min(goal.target, goal.current + amount);
  state.totalSavings += amount;

  // Log transaction
  state.transactions.push({
    id: state.nextId++,
    type: 'deposit',
    amount,
    note: `Added to "${goal.name}"`,
    date: new Date().toISOString().slice(0, 10),
    goalId,
  });

  // Update current month's deposit total
  const key = currentMonthKey();
  state.monthlyDeposits[key] = (state.monthlyDeposits[key] || 0) + amount;

  saveState();
  renderDashboard();
  renderGoalsGrid();
  showToast(`${fmt(amount)} added to "${goal.name}"!`);
}

/** Remove a goal */
function deleteGoal(goalId) {
  if (!confirm('Remove this goal? This won\'t affect your total savings balance.')) return;
  state.goals = state.goals.filter(g => g.id !== goalId);
  saveState();
  renderGoalsGrid();
  renderGoalSnapshot();
  renderKPIs();
  showToast('Goal removed.');
}

// ============================================================
//  DEPOSIT MODAL
// ============================================================

function openDepositModal() {
  // Populate goals dropdown
  renderGoalsGrid();
  document.getElementById('depositModal').classList.add('open');
  document.getElementById('depositAmount').focus();
}

function closeDepositModal(event) {
  // Only close if clicking the overlay background or the close button
  if (event && event.target !== document.getElementById('depositModal')) return;
  document.getElementById('depositModal').classList.remove('open');
  document.getElementById('depositAmount').value = '';
  document.getElementById('depositNote').value   = '';
}

/**
 * submitDeposit — validates and processes a user deposit.
 *
 *  Updates:
 *    state.totalSavings         ← total balance
 *    state.monthlyDeposits      ← for progress chart
 *    state.goals[i].current     ← if a goal is selected
 *    state.transactions         ← activity log
 */
function submitDeposit() {
  const amountRaw = parseFloat(document.getElementById('depositAmount').value);
  const goalId    = parseInt(document.getElementById('depositGoal').value) || null;
  const note      = document.getElementById('depositNote').value.trim() || 'Manual deposit';

  // Validation
  if (isNaN(amountRaw) || amountRaw <= 0) {
    showToast('Please enter a valid amount.'); return;
  }

  const amount = Math.round(amountRaw * 100) / 100; // Normalise to 2 decimal places

  // Update total savings
  state.totalSavings = Math.round((state.totalSavings + amount) * 100) / 100;

  // Update goal balance if one was selected
  if (goalId) {
    const goal = state.goals.find(g => g.id === goalId);
    if (goal) goal.current = Math.min(goal.target, Math.round((goal.current + amount) * 100) / 100);
  }

  // Update monthly deposits for progress chart
  const key = currentMonthKey();
  state.monthlyDeposits[key] = Math.round(((state.monthlyDeposits[key] || 0) + amount) * 100) / 100;

  // Log the transaction
  state.transactions.push({
    id: state.nextId++,
    type: 'deposit',
    amount,
    note,
    date: new Date().toISOString().slice(0, 10),
    goalId,
  });

  saveState();
  closeDepositModal();
  renderDashboard();

  showToast(`${fmt(amount)} deposited!`);
}

// ============================================================
//  SETTINGS
// ============================================================

/** Update saving rate KPI when income changes */
function updateRate() {
  const val = parseFloat(document.getElementById('monthlyIncome')?.value) || 0;
  state.monthlyIncome = val;
  saveState();
  renderKPIs();
}

// ============================================================
//  TOAST NOTIFICATION
// ============================================================

let toastTimer;
function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Topbar date
  document.getElementById('topbarDate').textContent =
    new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  // Greeting time of day
  const tod = document.getElementById('timeOfDay');
  if (tod) tod.textContent = timeOfDay();

  // Initial render
  renderDashboard();

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('depositModal').classList.remove('open');
  });
});
