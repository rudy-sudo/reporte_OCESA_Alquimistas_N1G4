// ===== Theme Toggle =====
(function() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  updateToggleIcon();

  toggle && toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    updateToggleIcon();
    setTimeout(() => {
      initCharts();
      renderSprintContent(currentSprint);
      renderMaturitySection();
    }, 50);
  });

  function updateToggleIcon() {
    if (!toggle) return;
    toggle.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
})();

// ===== Data =====
const D = DASHBOARD_DATA;
let currentSprint = '1';
let chartInstances = {};

// ===== Sort State =====
let rankingSortKey = 'sprints';
let rankingSortDir = 'desc';

// ===== New 6-tier Maturity System =====
const MATURITY_CONFIG = {
  'Alquimista Completo':        { icon: '🏆', color: 'var(--color-amber)',  bg: 'var(--color-amber-soft)',  cssClass: 'mat-completo',     order: 0, short: 'Completo' },
  'Alquimista Consistente':     { icon: '🔮', color: 'var(--color-teal)',   bg: 'var(--color-teal-soft)',   cssClass: 'mat-consistente',  order: 1, short: 'Consistente' },
  'Talento de Alto Potencial':  { icon: '⚡', color: 'var(--color-violet)', bg: 'var(--color-violet-soft)', cssClass: 'mat-potencial',    order: 2, short: 'Alto Potencial' },
  'Alquimista en Práctica':     { icon: '⚗️', color: 'var(--color-green)',  bg: 'var(--color-green-soft)',  cssClass: 'mat-practica',     order: 3, short: 'En Práctica' },
  'Aprendiz Activo':            { icon: '🧪', color: 'var(--color-primary)',bg: 'var(--color-primary-soft)',cssClass: 'mat-aprendiz',     order: 4, short: 'Aprendiz' },
  'Participación Insuficiente': { icon: '—',  color: 'var(--color-rose)',   bg: 'var(--color-rose-soft)',   cssClass: 'mat-insuficiente', order: 5, short: 'Insuficiente' }
};

function maturityInfo(level) {
  return MATURITY_CONFIG[level] || MATURITY_CONFIG['Participación Insuficiente'];
}

// ===== Computed Data =====
function computeLevelDistribution() {
  const levels = { 'Destacado': 0, 'Competente': 0, 'En Desarrollo': 0, 'Emergente': 0 };
  D.students.forEach(s => {
    Object.values(s.sprints).forEach(sp => {
      const score = sp.score;
      if (score >= 3.5) levels['Destacado']++;
      else if (score >= 2.5) levels['Competente']++;
      else if (score >= 2.0) levels['En Desarrollo']++;
      else levels['Emergente']++;
    });
  });
  return levels;
}

function computeSprintMaturity() {
  const sm = {};
  const sprintIds = ['1', '2', '3', '4'];
  const matKeys = Object.keys(MATURITY_CONFIG).filter(k => k !== 'Participación Insuficiente');
  sprintIds.forEach(sid => {
    sm[sid] = {};
    matKeys.forEach(k => sm[sid][k] = 0);
  });
  D.students.forEach(s => {
    if (s.maturity === 'Participación Insuficiente') return;
    Object.keys(s.sprints).forEach(sid => {
      if (sm[sid] && sm[sid][s.maturity] !== undefined) {
        sm[sid][s.maturity]++;
      }
    });
  });
  return sm;
}

function computeLevelUpSummary() {
  const mat = D.summary.maturityDistribution;
  const tiers = [
    { level: 'Aprendiz Activo', next: 'Alquimista en Práctica', advice: 'Enfocarse en aplicar IA a problemas reales del puesto. Pasar de la experimentación general a casos de uso concretos con métricas de impacto.' },
    { level: 'Alquimista en Práctica', next: 'Alquimista Consistente', advice: 'Incrementar la frecuencia de participación. Completar más sprints para demostrar constancia y ampliar el dominio de competencias.' },
    { level: 'Alquimista Consistente', next: 'Alquimista Completo', advice: 'Completar todos los sprints restantes. Liderar la adopción de IA en su área y mentorear a compañeros.' }
  ];
  return tiers.map(t => ({
    ...t,
    count: mat[t.level] || 0
  }));
}

// ===== Utility Functions =====
function getCSS(prop) {
  return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
}

function scoreClass(score) {
  if (score >= 3.5) return 'score-high';
  if (score >= 2.5) return 'score-mid';
  if (score >= 1.5) return 'score-low';
  return 'score-vlow';
}

function classCSS(cls) {
  const info = MATURITY_CONFIG[cls];
  return info ? info.cssClass : 'mat-insuficiente';
}

function avatarColor(id) {
  const colors = ['#3b2d7e','#0a7b6f','#c77d0a','#b5365a','#6b3fa0','#2a7a3a'];
  let hash = 0;
  for (let c of id) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name) {
  if (name.startsWith('Student_')) return name.slice(8, 10);
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function levelLabel(score) {
  if (score >= 3.5) return 'Destacado';
  if (score >= 2.5) return 'Competente';
  if (score >= 1.5) return 'En Desarrollo';
  return 'Emergente';
}

function sprintLabel(id) {
  const emojis = { '1': '🧪', '2': '🛡️', '3': '🧩', '4': '🔮' };
  const stat = D.summary.sprintStats[id];
  const name = stat ? stat.name : `Sprint ${id}`;
  return `${emojis[id] || ''} ${name}`;
}

function shortSprintLabel(id) {
  const emojis = { '1': '🧪', '2': '🛡️', '3': '🧩', '4': '🔮' };
  return `${emojis[id] || ''} Sprint ${id}`;
}

// ===== Sparkline SVG =====
function sparklineSVG(scores) {
  if (scores.length < 2) return '';
  const w = 80, h = 24, pad = 4;
  const min = 1, max = 4;
  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((s - min) / (max - min)) * (h - 2 * pad);
    return `${x},${y}`;
  });
  const color = scores[scores.length - 1] >= scores[0] ? getCSS('--color-green') || '#2a7a3a' : getCSS('--color-rose') || '#b5365a';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="2.5" fill="${color}"/>`).join('')}
  </svg>`;
}

// ===== Coverage Ring SVG =====
function coverageRingSVG(covered, total, size) {
  size = size || 48;
  const r = (size - 6) / 2;
  const c = Math.PI * 2 * r;
  const pct = total > 0 ? covered / total : 0;
  const dash = c * pct;
  const gap = c - dash;
  const color = pct >= 0.8 ? 'var(--color-green)' : pct >= 0.5 ? 'var(--color-amber)' : 'var(--color-rose)';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--color-divider)" stroke-width="4"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
      stroke-dasharray="${dash} ${gap}" stroke-linecap="round"/>
  </svg>`;
}

// ===== Populate Hero & KPIs =====
function populateHeroAndKPIs() {
  const sum = D.summary;
  const md = sum.maturityDistribution;

  document.getElementById('heroEnrolled').textContent = sum.totalStudents;
  document.getElementById('heroEvaluated').textContent = sum.evaluatedStudents;
  document.getElementById('heroAvg').textContent = sum.overallAverage.toFixed(2);
  document.getElementById('heroSprints').textContent = Object.keys(sum.sprintStats).length;

  // KPI cards — new tier counts
  const completos = (md['Alquimista Completo'] || 0);
  const consistentes = (md['Alquimista Consistente'] || 0);
  const topTier = completos + consistentes;
  document.getElementById('kpiHighlighted').textContent = topTier;
  document.getElementById('kpiHighlightedLabel').textContent = `Completos (${completos}) + Consistentes (${consistentes})`;
  document.getElementById('kpiPotencial').textContent = md['Talento de Alto Potencial'] || 0;
  document.getElementById('kpiProgression').textContent = computeAvgProgression();
  document.getElementById('kpiInactive').textContent = md['Participación Insuficiente'] || 0;

  populateFunnel();
}

function computeAvgProgression() {
  const withMultiple = D.students.filter(s => s.numSprints >= 2);
  if (withMultiple.length === 0) return '0.00';
  const avg = withMultiple.reduce((sum, s) => sum + s.progression, 0) / withMultiple.length;
  return (avg >= 0 ? '+' : '') + avg.toFixed(2);
}

function populateFunnel() {
  const sum = D.summary;
  const total = sum.totalStudents;
  const evaluated = sum.evaluatedStudents;
  const stats = sum.sprintStats;

  const steps = [
    { value: total, label: 'Inscritos', color: 'var(--color-teal)' },
    { value: evaluated, label: 'Con alguna actividad', color: 'var(--color-violet)' },
    { value: stats['1'] ? stats['1'].count : 0, label: 'Sprint 1', color: 'var(--color-amber)' },
    { value: stats['2'] ? stats['2'].count : 0, label: 'Sprint 2', color: 'var(--color-amber-dark, var(--color-amber))' },
    { value: stats['3'] ? stats['3'].count : 0, label: 'Sprint 3', color: 'var(--color-rose)' },
    { value: stats['4'] ? stats['4'].count : 0, label: 'Sprint 4', color: 'var(--color-rose-dark, var(--color-rose))' }
  ];

  const funnelEl = document.querySelector('.funnel');
  if (!funnelEl) return;

  funnelEl.innerHTML = steps.map(step => {
    const pct = total > 0 ? ((step.value / total) * 100).toFixed(1) : 0;
    return `
      <div class="funnel-step" style="--width: ${pct}%">
        <div class="funnel-bar" style="background: ${step.color};"></div>
        <div class="funnel-info">
          <span class="funnel-value">${step.value}</span>
          <span class="funnel-label">${step.label}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Charts =====
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function initCharts() {
  const textColor = getCSS('--color-text') || '#1a1814';
  const textMuted = getCSS('--color-text-muted') || '#9e9b93';
  const gridColor = getCSS('--color-divider') || '#ece9e3';

  Chart.defaults.color = textMuted;
  Chart.defaults.font.family = "'Satoshi', 'Inter', sans-serif";
  Chart.defaults.font.size = 12;

  const md = D.summary.maturityDistribution;
  const maturityLabels = [];
  const maturityData = [];
  const maturityColors = [];

  // Use ordered maturity config
  Object.keys(MATURITY_CONFIG).forEach(key => {
    const val = md[key] || 0;
    if (val > 0) {
      const info = MATURITY_CONFIG[key];
      maturityLabels.push(`${info.short} (${val})`);
      maturityData.push(val);
      maturityColors.push(getCSS(info.color.replace('var(', '').replace(')', '')) || info.color);
    }
  });

  // Classification Doughnut
  destroyChart('classificationChart');
  const classCtx = document.getElementById('classificationChart');
  if (classCtx) {
    chartInstances['classificationChart'] = new Chart(classCtx, {
      type: 'doughnut',
      data: {
        labels: maturityLabels,
        datasets: [{
          data: maturityData,
          backgroundColor: maturityColors,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: {
              label: function(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(0);
                return ` ${ctx.raw} estudiantes (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Level Distribution Bar
  destroyChart('levelChart');
  const levelCtx = document.getElementById('levelChart');
  if (levelCtx) {
    const levelDist = computeLevelDistribution();
    const totalEvals = Object.values(levelDist).reduce((a, b) => a + b, 0);
    const levelChartTitle = levelCtx.closest('.chart-card')?.querySelector('.chart-title');
    if (levelChartTitle) levelChartTitle.textContent = `Distribución de Niveles (${totalEvals} evaluaciones)`;

    chartInstances['levelChart'] = new Chart(levelCtx, {
      type: 'bar',
      data: {
        labels: ['Destacado', 'Competente', 'En Desarrollo', 'Emergente'],
        datasets: [{
          data: [levelDist['Destacado'], levelDist['Competente'], levelDist['En Desarrollo'], levelDist['Emergente']],
          backgroundColor: [
            getCSS('--color-green') || '#2a7a3a',
            getCSS('--color-teal') || '#0a7b6f',
            getCSS('--color-amber') || '#c77d0a',
            getCSS('--color-rose') || '#b5365a'
          ],
          borderRadius: 6,
          maxBarThickness: 48
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => ` ${ctx.raw} evaluaciones` }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor, drawBorder: false }, ticks: { stepSize: 10 } },
          x: { grid: { display: false }, ticks: { font: { weight: 500 } } }
        }
      }
    });
  }

  // Sprint Performance
  destroyChart('sprintChart');
  const sprintCtx = document.getElementById('sprintChart');
  if (sprintCtx) {
    const sprintLabels = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'];
    const sprintIds = ['1', '2', '3', '4'];
    const participation = sprintIds.map(id => D.summary.sprintStats[id] ? D.summary.sprintStats[id].count : 0);
    const avgScores = sprintIds.map(id => D.summary.sprintStats[id] ? D.summary.sprintStats[id].avg : 0);
    const maxPart = Math.max(...participation);

    chartInstances['sprintChart'] = new Chart(sprintCtx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Participantes', data: participation,
            backgroundColor: getCSS('--color-primary') || '#3b2d7e',
            borderRadius: 6, maxBarThickness: 56, yAxisID: 'y', order: 2
          },
          {
            label: 'Promedio', data: avgScores, type: 'line',
            borderColor: getCSS('--color-amber') || '#c77d0a',
            backgroundColor: getCSS('--color-amber') || '#c77d0a',
            pointBackgroundColor: getCSS('--color-amber') || '#c77d0a',
            pointRadius: 6, pointHoverRadius: 8, borderWidth: 3, tension: 0.3,
            yAxisID: 'y1', order: 1
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8
          }
        },
        scales: {
          y: { beginAtZero: true, max: Math.ceil(maxPart * 1.2), grid: { color: gridColor, drawBorder: false }, title: { display: true, text: 'Participantes', font: { size: 11 } } },
          y1: { position: 'right', min: 1, max: 4, grid: { display: false }, title: { display: true, text: 'Promedio', font: { size: 11 } }, ticks: { stepSize: 0.5 } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

// ===== Sprint Tab Content =====
function renderSprintContent(sprintId) {
  currentSprint = sprintId;
  const container = document.getElementById('sprintContent');

  const sprintStudents = D.students
    .filter(s => s.sprints[sprintId])
    .map(s => ({
      ...s,
      sprint_score: s.sprints[sprintId].score,
      sprint_level: s.sprints[sprintId].level,
      sprint_data: s.sprints[sprintId]
    }))
    .sort((a, b) => b.sprint_score - a.sprint_score);

  const count = sprintStudents.length;
  const avg = count > 0 ? (sprintStudents.reduce((sum, s) => sum + s.sprint_score, 0) / count).toFixed(2) : '—';

  const criteriaAvgs = {};
  sprintStudents.forEach(s => {
    Object.entries(s.sprint_data.criteria || {}).forEach(([name, score]) => {
      if (!criteriaAvgs[name]) criteriaAvgs[name] = { total: 0, count: 0 };
      criteriaAvgs[name].total += score;
      criteriaAvgs[name].count++;
    });
  });

  const levels = { Destacado: 0, Competente: 0, 'En Desarrollo': 0, Emergente: 0 };
  sprintStudents.forEach(s => { if (levels.hasOwnProperty(s.sprint_level)) levels[s.sprint_level]++; });

  const top5 = sprintStudents.slice(0, 5);

  container.innerHTML = `
    <div class="sprint-detail animate-in">
      <div class="sprint-info-card">
        <div class="sprint-info-title">Resumen</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3);">
          <div>
            <div class="sprint-info-value" style="color:var(--color-primary);">${avg}</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);">Promedio del sprint</div>
          </div>
          <div>
            <div class="sprint-info-value">${count}</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);">Respuestas evaluadas</div>
          </div>
          <div style="margin-top:var(--space-2);">
            <div style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-secondary);margin-bottom:var(--space-1);">Distribución de niveles</div>
            <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
              ${Object.entries(levels).filter(([,v]) => v > 0).map(([k, v]) =>
                `<span class="class-badge ${k === 'Destacado' ? 'mat-completo' : k === 'Competente' ? 'mat-consistente' : k === 'En Desarrollo' ? 'mat-aprendiz' : 'mat-insuficiente'}">${v} ${k}</span>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="sprint-info-card">
        <div class="sprint-info-title">Top 5 del Sprint</div>
        <div class="sprint-top-list">
          ${top5.map((s, i) => `
            <div class="sprint-top-item" onclick="openStudentModal('${s.id}')">
              <span class="sprint-top-rank">${i + 1}</span>
              <span class="sprint-top-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</span>
              <span class="sprint-top-score score-pill ${scoreClass(s.sprint_score)}">${s.sprint_score.toFixed(1)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="sprint-info-card full-width">
        <div class="sprint-info-title">Criterios de Evaluación — Promedios</div>
        <div class="sprint-criteria-list">
          ${Object.entries(criteriaAvgs).map(([name, data]) => {
            const avg = (data.total / data.count).toFixed(2);
            const pct = ((avg / 4) * 100).toFixed(0);
            return `
              <div class="sprint-criterion">
                <span class="criterion-name">${name}</span>
                <div class="criterion-bar-wrapper">
                  <div class="criterion-bar" style="width:${pct}%"></div>
                </div>
                <span class="criterion-score">${avg}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ===== Ranking Table =====
function sortStudents(students) {
  const key = rankingSortKey;
  const dir = rankingSortDir === 'asc' ? 1 : -1;

  return [...students].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'es');
        break;
      case 'class':
        cmp = (maturityInfo(a.maturity).order) - (maturityInfo(b.maturity).order);
        if (cmp === 0) cmp = b.overallAvg - a.overallAvg;
        break;
      case 'avg':
        cmp = b.overallAvg - a.overallAvg;
        if (dir === -1) return cmp || b.numSprints - a.numSprints;
        return (a.overallAvg - b.overallAvg) || b.numSprints - a.numSprints;
      case 'sprints':
        cmp = b.numSprints - a.numSprints;
        if (dir === -1) return cmp || b.overallAvg - a.overallAvg;
        return (a.numSprints - b.numSprints) || b.overallAvg - a.overallAvg;
      case 'coverage':
        cmp = (b.competencyCoverage || 0) - (a.competencyCoverage || 0);
        if (dir === -1) return cmp || b.overallAvg - a.overallAvg;
        return ((a.competencyCoverage || 0) - (b.competencyCoverage || 0)) || b.overallAvg - a.overallAvg;
      default:
        cmp = 0;
    }
    if (key === 'name' || key === 'class') return cmp * dir;
    return cmp;
  });
}

function updateSortHeaders() {
  document.querySelectorAll('.ranking-table th.sortable').forEach(th => {
    const sortKey = th.dataset.sort;
    const arrow = th.querySelector('.sort-arrow');
    if (sortKey === rankingSortKey) {
      th.classList.add('active-sort');
      arrow.textContent = rankingSortDir === 'desc' ? '▼' : '▲';
      arrow.className = 'sort-arrow ' + rankingSortDir;
    } else {
      th.classList.remove('active-sort');
      arrow.textContent = '';
      arrow.className = 'sort-arrow';
    }
  });
}

function renderRanking(students) {
  const tbody = document.getElementById('rankingBody');
  const countEl = document.getElementById('rankingCount');

  const sorted = sortStudents(students);

  tbody.innerHTML = sorted.map((s, i) => {
    const isTop3 = i < 3 && sorted.length > 3;
    const sprintKeys = ['1', '2', '3', '4'];
    const orderedScores = [];
    sprintKeys.forEach(sk => {
      if (s.sprints[sk]) orderedScores.push(s.sprints[sk].score);
    });
    const info = maturityInfo(s.maturity);
    const coverage = s.competencyCoverage || 0;
    const total = s.competencyTotal || 13;

    return `
      <tr class="${isTop3 ? 'rank-top' : ''}">
        <td class="col-rank"><span class="rank-num">${i + 1}</span></td>
        <td class="col-name">
          <div class="student-name-cell">
            <div class="student-avatar" style="background:${avatarColor(s.id)};">${initials(s.name)}</div>
            <span class="student-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</span>
          </div>
        </td>
        <td class="col-class"><span class="class-badge ${info.cssClass}">${info.icon} ${info.short}</span></td>
        <td class="col-avg"><span class="score-pill ${scoreClass(s.overallAvg)}">${s.overallAvg.toFixed(1)}</span></td>
        <td class="col-coverage">${coverage}/${total}</td>
        <td class="col-sprints">
          <div class="sprint-dots">
            ${sprintKeys.map(sk => {
              const has = !!s.sprints[sk];
              const score = has ? s.sprints[sk].score : 0;
              const dotClass = has ? (score >= 3.5 ? 'active high' : score >= 2.5 ? 'active mid' : 'active low') : '';
              return `<span class="sprint-dot ${dotClass}" title="${has ? shortSprintLabel(sk) + ': ' + score.toFixed(1) : 'No participó'}"></span>`;
            }).join('')}
          </div>
        </td>
        <td class="col-sparkline">
          <div class="sparkline-cell">${sparklineSVG(orderedScores)}</div>
        </td>
        <td class="col-action">
          <button class="btn-detail" onclick="openStudentModal('${s.id}')" title="Ver detalle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  countEl.textContent = `Mostrando ${sorted.length} de ${D.students.length} estudiantes`;
  updateSortHeaders();
}

function filterStudents() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const classFilter = document.getElementById('classFilter').value;
  const sprintFilter = document.getElementById('sprintFilter').value;

  let filtered = D.students.filter(s => {
    if (search && !s.name.toLowerCase().includes(search)) return false;
    if (classFilter !== 'all' && s.maturity !== classFilter) return false;
    if (sprintFilter !== 'all' && !s.sprints[sprintFilter]) return false;
    return true;
  });

  if (sprintFilter !== 'all') {
    filtered.sort((a, b) => (b.sprints[sprintFilter]?.score || 0) - (a.sprints[sprintFilter]?.score || 0));
  }

  renderRanking(filtered);
}

// ===== Executive Insights Block =====
function renderExecutiveInsights() {
  const container = document.getElementById('executiveInsights');
  if (!container) return;
  const ei = D.summary.executiveInsights;
  if (!ei) return;

  const md = D.summary.maturityDistribution;
  const completos = md['Alquimista Completo'] || 0;
  const consistentes = md['Alquimista Consistente'] || 0;
  const altoPotencial = md['Talento de Alto Potencial'] || 0;
  const practicantes = md['Alquimista en Práctica'] || 0;
  const aprendices = md['Aprendiz Activo'] || 0;
  const insuficientes = md['Participación Insuficiente'] || 0;

  const completosNames = (ei.completoNames || []).join(', ');
  const consistenteNames = (ei.consistenteNames || []).join(', ');
  const hpNames = (ei.highPotentialNames || []).join(', ');

  container.innerHTML = `
    <div class="exec-insight-card">
      <div class="exec-insight-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <h3 class="exec-insight-title">Resumen Ejecutivo para el CEO</h3>
      </div>

      <div class="exec-insight-body">
        <div class="exec-kpi-strip">
          <div class="exec-kpi">
            <span class="exec-kpi-value">${ei.totalEnrolled}</span>
            <span class="exec-kpi-label">Inscritos</span>
          </div>
          <div class="exec-kpi-arrow">→</div>
          <div class="exec-kpi">
            <span class="exec-kpi-value">${ei.totalEvaluated}</span>
            <span class="exec-kpi-label">Participaron</span>
          </div>
          <div class="exec-kpi-arrow">→</div>
          <div class="exec-kpi">
            <span class="exec-kpi-value">${ei.threePlusSprints}</span>
            <span class="exec-kpi-label">3+ Sprints</span>
          </div>
          <div class="exec-kpi-arrow">→</div>
          <div class="exec-kpi">
            <span class="exec-kpi-value">${ei.completedProgram}</span>
            <span class="exec-kpi-label">Completaron</span>
          </div>
        </div>

        <div class="exec-insight-grid">
          <div class="exec-insight-item exec-insight-highlight">
            <div class="exec-insight-item-icon">🏆</div>
            <div>
              <strong>Alquimistas Completos (${completos})</strong> — Cursaron los 4 sprints con promedio ≥ 3.0. Son los candidatos naturales para liderar adopción de IA en sus equipos.
              ${completosNames ? `<div class="exec-names">${completosNames}</div>` : ''}
            </div>
          </div>

          <div class="exec-insight-item exec-insight-highlight">
            <div class="exec-insight-item-icon">🔮</div>
            <div>
              <strong>Alquimistas Consistentes (${consistentes})</strong> — 3+ sprints con buen desempeño. Un sprint más y se suman a los completos.
              ${consistenteNames ? `<div class="exec-names">${consistenteNames}</div>` : ''}
            </div>
          </div>

          <div class="exec-insight-item exec-insight-caution">
            <div class="exec-insight-item-icon">⚡</div>
            <div>
              <strong>Talento de Alto Potencial (${altoPotencial})</strong> — Destacaron en 1-2 sprints (promedio ≥ 3.5), pero no continuaron. Es posible que ya conocieran prompting y por eso destacaron, sin embargo se perdieron de aprender herramientas de los otros sprints. Son perfiles valiosos que merecen seguimiento individual.
              ${hpNames ? `<div class="exec-names">${hpNames}</div>` : ''}
            </div>
          </div>

          <div class="exec-insight-item">
            <div class="exec-insight-item-icon">📊</div>
            <div>
              <strong>Panorama general:</strong> De ${ei.totalEnrolled} inscritos, solo ${ei.completedProgram} completaron el programa (${ei.dropoffRate}% de deserción). ${practicantes + aprendices} personas participaron parcialmente (${practicantes} en práctica activa, ${aprendices} en nivel aprendiz). ${insuficientes} nunca entregaron actividades evaluables.
            </div>
          </div>

          <div class="exec-insight-item">
            <div class="exec-insight-item-icon">🎯</div>
            <div>
              <strong>Recomendación:</strong> Los ${completos + consistentes} alquimistas de nivel Completo y Consistente son la base para un programa de "Campeones de IA" dentro de OCESA. Los ${altoPotencial} talentos de alto potencial merecen una conversación directa para entender por qué no continuaron y cómo reactivarlos.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===== Alchemist Spotlight (Redesigned) =====
function renderAlchemists() {
  const grid = document.getElementById('alchemistGrid');

  // Group into tiers: Completo, Consistente, Alto Potencial
  const tiers = [
    { key: 'Alquimista Completo', title: 'Alquimistas Completos', desc: '4 sprints completados con promedio ≥ 3.0 — Dominio demostrado a lo largo de todo el programa' },
    { key: 'Alquimista Consistente', title: 'Alquimistas Consistentes', desc: '3+ sprints con buen desempeño — A un paso de completar el programa' },
    { key: 'Talento de Alto Potencial', title: 'Talento de Alto Potencial', desc: 'Destacaron en 1-2 sprints pero no continuaron — Perfiles con habilidad demostrada que merecen seguimiento' }
  ];

  let html = '';

  tiers.forEach(tier => {
    const students = D.students
      .filter(s => s.maturity === tier.key)
      .sort((a, b) => b.overallAvg - a.overallAvg || b.numSprints - a.numSprints);

    if (students.length === 0) return;

    const info = maturityInfo(tier.key);

    html += `
      <div class="alchemist-tier">
        <div class="alchemist-tier-header">
          <span class="alchemist-tier-icon">${info.icon}</span>
          <div>
            <h3 class="alchemist-tier-title">${tier.title} <span class="alchemist-tier-count">${students.length}</span></h3>
            <p class="alchemist-tier-desc">${tier.desc}</p>
          </div>
        </div>
        <div class="alchemist-tier-grid">
          ${students.map(s => {
            const coverage = s.competencyCoverage || 0;
            const total = s.competencyTotal || 13;
            const sprintKeys = ['1', '2', '3', '4'];
            const sprintCov = s.sprintCoverage || {};

            return `
              <div class="alchemist-card animate-in" onclick="openStudentModal('${s.id}')">
                <div class="alchemist-header">
                  <div class="alchemist-avatar-wrap">
                    ${coverageRingSVG(coverage, total, 56)}
                    <span class="alchemist-avatar-text">${coverage}/${total}</span>
                  </div>
                  <div>
                    <div class="alchemist-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</div>
                    <div class="alchemist-class"><span class="class-badge ${info.cssClass}">${info.icon} ${tier.key}</span></div>
                  </div>
                </div>

                <div class="alchemist-stats">
                  <div class="alchemist-stat">
                    <div class="alchemist-stat-value" style="color:var(--color-primary);">${s.overallAvg.toFixed(1)}</div>
                    <div class="alchemist-stat-label">Promedio</div>
                  </div>
                  <div class="alchemist-stat">
                    <div class="alchemist-stat-value">${s.numSprints}/4</div>
                    <div class="alchemist-stat-label">Sprints</div>
                  </div>
                  <div class="alchemist-stat">
                    <div class="alchemist-stat-value" style="color:${s.progression > 0 ? 'var(--color-green)' : s.progression < 0 ? 'var(--color-rose)' : 'var(--color-text-muted)'};">${s.numSprints > 1 ? (s.progression > 0 ? '+' : '') + s.progression.toFixed(1) : '—'}</div>
                    <div class="alchemist-stat-label">Progresión</div>
                  </div>
                </div>

                <div class="alchemist-sprint-bar">
                  ${sprintKeys.map(sk => `<span class="alchemist-sprint-dot ${sprintCov[sk] ? 'filled' : ''}" title="Sprint ${sk}"></span>`).join('')}
                  <span class="alchemist-sprint-label">Sprints cursados</span>
                </div>

                ${s.synthesis ? `
                  <div class="alchemist-signals">
                    <p class="alchemist-signal">${s.synthesis.length > 200 ? s.synthesis.slice(0, 200) + '...' : s.synthesis}</p>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// ===== Competency Map for Modal =====
function renderCompetencyMap(s) {
  const map = s.competencyMap;
  if (!map) return '';

  const sprintComps = D.summary.sprintCompetencies || {};
  const sprintKeys = ['1', '2', '3', '4'];
  const sprintNames = { '1': 'Sprint 1 — Fundamentos', '2': 'Sprint 2 — Técnicas Avanzadas', '3': 'Sprint 3 — Sistemas', '4': 'Sprint 4 — Orquestación' };

  let html = '<div class="competency-map">';
  html += '<div class="modal-section-title" style="margin-bottom:var(--space-3);">Mapa de Competencias</div>';
  html += `<div class="competency-coverage-summary">
    <div class="competency-coverage-ring">${coverageRingSVG(s.competencyCoverage || 0, s.competencyTotal || 13, 44)}</div>
    <div>
      <strong>${s.competencyCoverage || 0} de ${s.competencyTotal || 13} competencias</strong> evaluadas
      <span class="competency-pct">(${s.coveragePct || 0}%)</span>
    </div>
  </div>`;

  sprintKeys.forEach(sk => {
    const comps = sprintComps[sk] || [];
    if (comps.length === 0) return;
    const participated = s.sprintCoverage && s.sprintCoverage[sk];

    html += `<div class="competency-sprint-group ${participated ? '' : 'not-participated'}">`;
    html += `<div class="competency-sprint-label">${shortSprintLabel(sk)} ${!participated ? '<span class="not-participated-tag">No cursado</span>' : ''}</div>`;
    html += '<div class="competency-items">';
    comps.forEach(comp => {
      const score = map[comp];
      const hasScore = score !== null && score !== undefined;
      html += `
        <div class="competency-item ${hasScore ? '' : 'empty'}">
          <span class="competency-name">${comp}</span>
          ${hasScore
            ? `<span class="competency-score score-pill ${scoreClass(score)}">${score.toFixed(1)}</span>`
            : '<span class="competency-score empty-score">—</span>'
          }
        </div>
      `;
    });
    html += '</div></div>';
  });

  html += '</div>';
  return html;
}

// ===== Student Modal =====
function openStudentModal(studentId) {
  const s = D.students.find(st => st.id === studentId);
  if (!s) return;

  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  const sprintKeys = ['1', '2', '3', '4'];
  const info = maturityInfo(s.maturity);

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-avatar" style="background:${avatarColor(s.id)};">${initials(s.name)}</div>
      <div>
        <div class="modal-student-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</div>
        <div class="modal-student-meta">
          <span class="class-badge ${info.cssClass}">${info.icon} ${s.maturity}</span>
          <span style="font-size:var(--text-xs);color:var(--color-text-muted);">${s.competencyCoverage || 0}/${s.competencyTotal || 13} competencias</span>
        </div>
      </div>
    </div>

    <div class="modal-kpis">
      <div class="modal-kpi">
        <div class="modal-kpi-value" style="color:var(--color-primary);">${s.overallAvg.toFixed(2)}</div>
        <div class="modal-kpi-label">Promedio General</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-value">${s.numSprints}/4</div>
        <div class="modal-kpi-label">Sprints Evaluados</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-value" style="color:${s.progression > 0 ? 'var(--color-green)' : s.progression < 0 ? 'var(--color-rose)' : 'var(--color-text-muted)'};">${s.numSprints > 1 ? (s.progression > 0 ? '+' : '') + s.progression.toFixed(1) : '—'}</div>
        <div class="modal-kpi-label">Progresión</div>
      </div>
    </div>

    ${s.synthesis ? `
      <div class="modal-sprint">
        <div class="modal-sprint-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <span class="modal-sprint-title">📝 Síntesis</span>
        </div>
        <div class="modal-sprint-body open">
          <div class="modal-synthesis">
            <div class="modal-synthesis-text">${s.synthesis}</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Competency Map -->
    <div class="modal-sprint">
      <div class="modal-sprint-header" onclick="this.nextElementSibling.classList.toggle('open')">
        <span class="modal-sprint-title">🗺️ Mapa de Competencias <span style="font-weight:400;color:var(--color-text-muted);font-size:var(--text-xs);">${s.competencyCoverage || 0}/${s.competencyTotal || 13}</span></span>
      </div>
      <div class="modal-sprint-body open">
        ${renderCompetencyMap(s)}
      </div>
    </div>

    ${sprintKeys.map(sk => {
      const sp = s.sprints[sk];
      if (!sp) return '';

      return `
        <div class="modal-sprint">
          <div class="modal-sprint-header" onclick="this.nextElementSibling.classList.toggle('open')">
            <span class="modal-sprint-title">${sprintLabel(sk)}</span>
            <span class="modal-sprint-score score-pill ${scoreClass(sp.score)}">${sp.score.toFixed(1)} — ${sp.level}</span>
          </div>
          <div class="modal-sprint-body">
            ${sp.justification ? `
              <div class="modal-synthesis">
                <div class="modal-synthesis-text">${sp.justification}</div>
              </div>
            ` : ''}
            <div class="modal-criteria">
              ${Object.entries(sp.criteria || {}).map(([name, score]) => `
                <div class="modal-criterion">
                  <div class="modal-criterion-header">
                    <span class="modal-criterion-name">${name}</span>
                    <span class="modal-criterion-score score-pill ${scoreClass(score)}">${score}/4</span>
                  </div>
                  <div class="criterion-bar-wrapper" style="margin-top:4px;">
                    <div class="criterion-bar" style="width:${((score / 4) * 100).toFixed(0)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>

            ${sp.strengths && sp.strengths.length > 0 ? `
              <div class="modal-section-title" style="margin-top:var(--space-4);">Fortalezas</div>
              <ul class="modal-list strengths">
                ${sp.strengths.map(str => `<li>${str}</li>`).join('')}
              </ul>
            ` : ''}

            ${sp.recommendations && sp.recommendations.length > 0 ? `
              <div class="modal-section-title">Recomendaciones</div>
              <ul class="modal-list recommendations">
                ${sp.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            ` : ''}

            ${sp.alchemist_signals && sp.alchemist_signals.length > 0 ? `
              <div class="modal-section-title">Señales de Alquimista</div>
              <ul class="modal-list signals">
                ${sp.alchemist_signals.map(sig => `<li>${sig}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </div>
      `;
    }).join('')}
  `;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== Maturity Map Section =====
function renderMaturitySection() {
  const mat = D.summary.maturityDistribution;
  const levelUp = computeLevelUpSummary();
  const textColor = getCSS('--color-text') || '#1a1814';
  const textMuted = getCSS('--color-text-muted') || '#9e9b93';
  const gridColor = getCSS('--color-divider') || '#ece9e3';

  // KPI row — updated for 6 tiers
  const kpiEl = document.getElementById('maturityKpis');
  const completos = mat['Alquimista Completo'] || 0;
  const consistentes = mat['Alquimista Consistente'] || 0;
  const altoPotencial = mat['Talento de Alto Potencial'] || 0;
  const totalActive = (mat['Aprendiz Activo'] || 0) + (mat['Alquimista en Práctica'] || 0) + completos + consistentes + altoPotencial;
  const topTier = completos + consistentes;
  const pctTop = totalActive > 0 ? Math.round((topTier / totalActive) * 100) : 0;

  kpiEl.innerHTML = `
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-amber);">${completos}</div>
      <div class="maturity-kpi-label">Alquimista Completo</div>
      <div class="maturity-kpi-sub">4 sprints, promedio ≥ 3.0</div>
    </div>
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-teal);">${consistentes}</div>
      <div class="maturity-kpi-label">Alquimista Consistente</div>
      <div class="maturity-kpi-sub">3+ sprints, promedio ≥ 3.0</div>
    </div>
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-violet);">${altoPotencial}</div>
      <div class="maturity-kpi-label">Alto Potencial</div>
      <div class="maturity-kpi-sub">1-2 sprints, promedio ≥ 3.5</div>
    </div>
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-primary);">${pctTop}%</div>
      <div class="maturity-kpi-label">Nivel Avanzado</div>
      <div class="maturity-kpi-sub">Completos + Consistentes sobre activos</div>
    </div>
  `;

  // Maturity donut chart — all tiers except insuficiente
  destroyChart('maturityChart');
  const matCtx = document.getElementById('maturityChart');
  if (matCtx) {
    const matLabels = [];
    const matData = [];
    const matColors = [];

    Object.keys(MATURITY_CONFIG).forEach(key => {
      if (key === 'Participación Insuficiente') return;
      const val = mat[key] || 0;
      if (val > 0) {
        const info = MATURITY_CONFIG[key];
        matLabels.push(info.short);
        matData.push(val);
        matColors.push(getCSS(info.color.replace('var(', '').replace(')', '')) || info.color);
      }
    });

    chartInstances['maturityChart'] = new Chart(matCtx, {
      type: 'doughnut',
      data: {
        labels: matLabels,
        datasets: [{ data: matData, backgroundColor: matColors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${ctx.raw} estudiantes (${total > 0 ? Math.round(ctx.raw / total * 100) : 0}%)`;
            }}
          }
        }
      }
    });
  }

  // Competencias Promedio horizontal bar
  destroyChart('areasChart');
  const areasCtx = document.getElementById('areasChart');
  if (areasCtx) {
    const competencies = D.summary.competencyAverages;
    const sortedCompetencies = Object.entries(competencies).sort((a, b) => b[1] - a[1]);
    const compColors = [
      getCSS('--color-primary') || '#3b2d7e',
      getCSS('--color-teal') || '#0a7b6f',
      getCSS('--color-amber') || '#c77d0a',
      getCSS('--color-violet') || '#6b3fa0',
      getCSS('--color-rose') || '#b5365a',
      getCSS('--color-green') || '#2a7a3a',
      '#5a8a9a', '#9a6b5a', '#6a9a5a', '#8a5a9a', '#5a6a8a', '#7a8a4a', '#4a7a8a'
    ];

    const areasChartTitle = areasCtx.closest('.chart-card')?.querySelector('.chart-title');
    if (areasChartTitle) areasChartTitle.textContent = 'Competencias Promedio (13 competencias)';

    chartInstances['areasChart'] = new Chart(areasCtx, {
      type: 'bar',
      data: {
        labels: sortedCompetencies.map(a => a[0]),
        datasets: [{
          data: sortedCompetencies.map(a => a[1]),
          backgroundColor: sortedCompetencies.map((_, i) => compColors[i % compColors.length]),
          borderRadius: 6, maxBarThickness: 32
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => ` Promedio: ${ctx.raw.toFixed(2)}` }
          }
        },
        scales: {
          x: { beginAtZero: true, max: 4, grid: { color: gridColor, drawBorder: false }, ticks: { stepSize: 0.5 } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // Sprint maturity progression stacked bar
  destroyChart('maturityProgressionChart');
  const progCtx = document.getElementById('maturityProgressionChart');
  if (progCtx) {
    const sm = computeSprintMaturity();
    const sprintLabels = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'];
    const sprintIds = ['1', '2', '3', '4'];

    // Aggregate into 3 tiers for chart clarity
    const tiers = [
      { label: 'Aprendiz / En Práctica', keys: ['Aprendiz Activo', 'Alquimista en Práctica'], color: getCSS('--color-violet') || '#6b3fa0' },
      { label: 'Alto Potencial', keys: ['Talento de Alto Potencial'], color: getCSS('--color-amber') || '#c77d0a' },
      { label: 'Consistente / Completo', keys: ['Alquimista Consistente', 'Alquimista Completo'], color: getCSS('--color-teal') || '#0a7b6f' }
    ];

    chartInstances['maturityProgressionChart'] = new Chart(progCtx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: tiers.map(t => ({
          label: t.label,
          data: sprintIds.map(s => t.keys.reduce((sum, k) => sum + (sm[s][k] || 0), 0)),
          backgroundColor: t.color,
          borderRadius: 4, maxBarThickness: 56
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: gridColor, drawBorder: false }, title: { display: true, text: 'Estudiantes', font: { size: 11 } } }
        }
      }
    });
  }

  // Level-up cards
  const luGrid = document.getElementById('levelUpGrid');
  const levelIcons = { 'Aprendiz Activo': '🧪', 'Alquimista en Práctica': '⚗️', 'Alquimista Consistente': '🔮' };
  const levelColors = { 'Aprendiz Activo': 'var(--color-primary)', 'Alquimista en Práctica': 'var(--color-green)', 'Alquimista Consistente': 'var(--color-teal)' };

  luGrid.innerHTML = levelUp.map(info => `
    <div class="level-up-card animate-in">
      <div class="level-up-header">
        <span class="level-up-icon">${levelIcons[info.level] || '📈'}</span>
        <div>
          <div class="level-up-title">${info.level}</div>
          <div class="level-up-count" style="color:${levelColors[info.level] || 'var(--color-text)'};">${info.count} estudiantes</div>
        </div>
      </div>
      <div class="level-up-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
        <span>Hacia ${info.next}</span>
      </div>
      <p class="level-up-advice">${info.advice}</p>
    </div>
  `).join('');
}

// ===== Navigation =====
function updateNavActive() {
  const sections = ['executive', 'overview', 'sprints', 'ranking', 'maturity', 'alchemists'];
  const scrollY = window.scrollY + 100;

  let current = sections[0];
  for (const id of sections) {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= scrollY) current = id;
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === current);
  });
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(link.dataset.section);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ===== Column Sort Click Handlers =====
document.querySelectorAll('.ranking-table th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (rankingSortKey === key) {
      rankingSortDir = rankingSortDir === 'desc' ? 'asc' : 'desc';
    } else {
      rankingSortKey = key;
      rankingSortDir = key === 'name' ? 'asc' : 'desc';
    }
    filterStudents();
  });
});

// ===== Ranking Collapsible =====
let rankingExpanded = false;

function renderRankingPreview() {
  // Remove existing preview if any
  const existing = document.querySelector('.ranking-preview');
  if (existing) existing.remove();

  const sectionInner = document.querySelector('#ranking .section-inner');
  const collapsible = document.getElementById('rankingCollapsible');
  if (!sectionInner || !collapsible) return;

  // Build a preview showing top 10 students sorted by current criteria
  const previewCount = 10;
  const sorted = sortStudents(D.students);
  const top = sorted.slice(0, previewCount);
  const sprintKeys = ['1', '2', '3', '4'];

  const rows = top.map((s, i) => {
    const info = maturityInfo(s.maturity);
    const coverage = s.competencyCoverage || 0;
    const total = s.competencyTotal || 13;
    const isTop3 = i < 3;

    return `
      <tr class="${isTop3 ? 'rank-top' : ''}">
        <td class="col-rank"><span class="rank-num">${i + 1}</span></td>
        <td class="col-name">
          <div class="student-name-cell">
            <div class="student-avatar" style="background:${avatarColor(s.id)};">${initials(s.name)}</div>
            <span class="student-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</span>
          </div>
        </td>
        <td class="col-class"><span class="class-badge ${info.cssClass}">${info.icon} ${info.short}</span></td>
        <td class="col-avg"><span class="score-pill ${scoreClass(s.overallAvg)}">${s.overallAvg.toFixed(1)}</span></td>
        <td class="col-coverage">${coverage}/${total}</td>
        <td class="col-sprints">
          <div class="sprint-dots">
            ${sprintKeys.map(sk => {
              const has = !!s.sprints[sk];
              const score = has ? s.sprints[sk].score : 0;
              const dotClass = has ? (score >= 3.5 ? 'active high' : score >= 2.5 ? 'active mid' : 'active low') : '';
              return `<span class="sprint-dot ${dotClass}" title="${has ? shortSprintLabel(sk) + ': ' + score.toFixed(1) : 'No participó'}"></span>`;
            }).join('')}
          </div>
        </td>
        <td class="col-sparkline">
          <div class="sparkline-cell">${sparklineSVG(sprintKeys.filter(sk => s.sprints[sk]).map(sk => s.sprints[sk].score))}</div>
        </td>
        <td class="col-action">
          <button class="btn-detail" onclick="openStudentModal('${s.id}')" title="Ver detalle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  const previewHTML = `
    <div class="ranking-preview">
      <div class="ranking-table-wrapper">
        <table class="ranking-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-name">Estudiante</th>
              <th class="col-class">Clasificación</th>
              <th class="col-avg">Promedio</th>
              <th class="col-coverage">Competencias</th>
              <th class="col-sprints">Sprints</th>
              <th class="col-sparkline">Trayectoria</th>
              <th class="col-action"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="ranking-preview-cta">
        <button class="ranking-preview-btn" id="rankingPreviewBtn">
          <span>Ver los ${D.students.length} estudiantes</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
    </div>
  `;

  // Insert preview after the section header, before the collapsible
  collapsible.insertAdjacentHTML('beforebegin', previewHTML);

  // Bind preview CTA
  const previewBtn = document.getElementById('rankingPreviewBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => toggleRankingExpanded(true));
  }
}

function toggleRankingExpanded(forceExpand) {
  const collapsible = document.getElementById('rankingCollapsible');
  const toggleBtn = document.getElementById('rankingToggleBtn');
  const preview = document.querySelector('.ranking-preview');
  if (!collapsible || !toggleBtn) return;

  if (forceExpand === true) {
    rankingExpanded = true;
  } else if (forceExpand === false) {
    rankingExpanded = false;
  } else {
    rankingExpanded = !rankingExpanded;
  }

  if (rankingExpanded) {
    collapsible.classList.add('expanded');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.querySelector('.ranking-toggle-label').textContent = 'Colapsar';
    if (preview) preview.style.display = 'none';
  } else {
    collapsible.classList.remove('expanded');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.querySelector('.ranking-toggle-label').textContent = 'Ver todos';
    if (preview) preview.style.display = '';
  }
}

// Toggle button click handler
document.getElementById('rankingToggleBtn').addEventListener('click', () => toggleRankingExpanded());

// ===== Event Listeners =====
document.getElementById('searchInput').addEventListener('input', filterStudents);
document.getElementById('classFilter').addEventListener('change', filterStudents);
document.getElementById('sprintFilter').addEventListener('change', filterStudents);

document.querySelectorAll('.sprint-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sprint-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderSprintContent(tab.dataset.sprint);
  });
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

window.addEventListener('scroll', updateNavActive, { passive: true });

// ===== Initialize =====
populateHeroAndKPIs();
initCharts();
renderSprintContent('1');
renderRanking(D.students);
renderRankingPreview();
renderMaturitySection();
renderAlchemists();
renderExecutiveInsights();
