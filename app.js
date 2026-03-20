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
    // Rebuild charts with new colors
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
let rankingSortKey = 'sprints';  // default: sort by sprints count
let rankingSortDir = 'desc';     // default: descending

// ===== Computed Data =====
// Compute level distribution from all evaluations
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

// Compute sprint maturity from students
function computeSprintMaturity() {
  const sm = {};
  const sprintIds = ['1', '2', '3', '4'];
  sprintIds.forEach(sid => {
    sm[sid] = { 'Aprendiz Activo': 0, 'Alquimista en Práctica': 0, 'Alquimista Destacado': 0 };
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

// Generate level-up summary from data
function computeLevelUpSummary() {
  const summary = {};
  const levels = ['Aprendiz Activo', 'Alquimista en Práctica', 'Alquimista Destacado'];
  const nextLevels = { 'Aprendiz Activo': 'Alquimista en Práctica', 'Alquimista en Práctica': 'Alquimista Destacado', 'Alquimista Destacado': 'Maestro Alquimista' };
  const advice = {
    'Aprendiz Activo': 'Enfocarse en aplicar IA a problemas reales del puesto. Pasar de la experimentación general a casos de uso concretos con métricas de impacto.',
    'Alquimista en Práctica': 'Escalar las soluciones puntuales a workflows completos. Documentar resultados y compartir con el equipo para multiplicar el impacto.',
    'Alquimista Destacado': 'Liderar la adopción de IA en su área. Mentorear a compañeros y diseñar sistemas que otros puedan reutilizar.'
  };
  levels.forEach(level => {
    const count = D.summary.maturityDistribution[level] || 0;
    summary[level] = {
      count: count,
      next_level: nextLevels[level],
      general_advice: advice[level]
    };
  });
  return summary;
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
  if (cls.includes('Destacado')) return 'class-destacado';
  if (cls.includes('Práctica')) return 'class-formacion';
  if (cls.includes('Aprendiz')) return 'class-aprendiz';
  return 'class-insuficiente';
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
function sparklineSVG(scores, sprintKeys) {
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
    ${points.map((p, i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="2.5" fill="${color}"/>`).join('')}
  </svg>`;
}

// ===== Populate Hero & KPIs =====
function populateHeroAndKPIs() {
  const sum = D.summary;
  const md = sum.maturityDistribution;

  // Hero stats
  document.getElementById('heroEnrolled').textContent = sum.totalStudents;
  document.getElementById('heroEvaluated').textContent = sum.evaluatedStudents;
  document.getElementById('heroAvg').textContent = sum.overallAverage.toFixed(2);
  document.getElementById('heroSprints').textContent = Object.keys(sum.sprintStats).length;

  // KPI cards
  document.getElementById('kpiHighlighted').textContent = md['Alquimista Destacado'] || 0;
  document.getElementById('kpiFormacion').textContent = md['Alquimista en Práctica'] || 0;
  document.getElementById('kpiProgression').textContent = computeAvgProgression();
  document.getElementById('kpiInactive').textContent = md['Participación Insuficiente'] || 0;

  // Funnel
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
  const colorMap = {
    'Alquimista Destacado': getCSS('--color-amber') || '#c77d0a',
    'Alquimista en Práctica': getCSS('--color-teal') || '#0a7b6f',
    'Aprendiz Activo': getCSS('--color-violet') || '#6b3fa0',
    'Participación Insuficiente': getCSS('--color-rose') || '#b5365a'
  };

  Object.entries(md).forEach(([key, val]) => {
    if (val > 0) {
      const shortName = key.replace('Alquimista ', '').replace('Participación ', '');
      maturityLabels.push(`${shortName} (${val})`);
      maturityData.push(val);
      maturityColors.push(colorMap[key] || '#999');
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
            labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
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

  // Level Distribution Bar (computed from all evaluations)
  destroyChart('levelChart');
  const levelCtx = document.getElementById('levelChart');
  if (levelCtx) {
    const levelDist = computeLevelDistribution();
    const totalEvals = Object.values(levelDist).reduce((a, b) => a + b, 0);

    // Update chart title dynamically
    const levelChartTitle = levelCtx.closest('.chart-card')?.querySelector('.chart-title');
    if (levelChartTitle) levelChartTitle.textContent = `Distribución de Niveles (${totalEvals} evaluaciones)`;

    chartInstances['levelChart'] = new Chart(levelCtx, {
      type: 'bar',
      data: {
        labels: ['Destacado', 'Competente', 'En Desarrollo', 'Emergente'],
        datasets: [{
          data: [
            levelDist['Destacado'],
            levelDist['Competente'],
            levelDist['En Desarrollo'],
            levelDist['Emergente']
          ],
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
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(ctx) { return ` ${ctx.raw} evaluaciones`; }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor, drawBorder: false },
            ticks: { stepSize: 10 }
          },
          x: {
            grid: { display: false },
            ticks: { font: { weight: 500 } }
          }
        }
      }
    });
  }

  // Sprint Performance (combined bar + line)
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
            label: 'Participantes',
            data: participation,
            backgroundColor: getCSS('--color-primary') || '#3b2d7e',
            borderRadius: 6,
            maxBarThickness: 56,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Promedio',
            data: avgScores,
            type: 'line',
            borderColor: getCSS('--color-amber') || '#c77d0a',
            backgroundColor: getCSS('--color-amber') || '#c77d0a',
            pointBackgroundColor: getCSS('--color-amber') || '#c77d0a',
            pointRadius: 6,
            pointHoverRadius: 8,
            borderWidth: 3,
            tension: 0.3,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: Math.ceil(maxPart * 1.2),
            grid: { color: gridColor, drawBorder: false },
            title: { display: true, text: 'Participantes', font: { size: 11 } }
          },
          y1: {
            position: 'right',
            min: 1,
            max: 4,
            grid: { display: false },
            title: { display: true, text: 'Promedio', font: { size: 11 } },
            ticks: { stepSize: 0.5 }
          },
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

  // Get students for this sprint
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

  // Calculate criteria averages — criteria values are direct numbers
  const criteriaAvgs = {};
  sprintStudents.forEach(s => {
    Object.entries(s.sprint_data.criteria || {}).forEach(([name, score]) => {
      if (!criteriaAvgs[name]) criteriaAvgs[name] = { total: 0, count: 0 };
      criteriaAvgs[name].total += score;
      criteriaAvgs[name].count++;
    });
  });

  // Level distribution for this sprint
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
                `<span class="class-badge ${k === 'Destacado' ? 'class-destacado' : k === 'Competente' ? 'class-formacion' : k === 'En Desarrollo' ? 'class-aprendiz' : 'class-insuficiente'}">${v} ${k}</span>`
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

  const classOrder = {
    'Alquimista Destacado': 0,
    'Alquimista en Práctica': 1,
    'Aprendiz Activo': 2,
    'Participación Insuficiente': 3
  };

  return [...students].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'es');
        break;
      case 'class':
        cmp = (classOrder[a.maturity] ?? 9) - (classOrder[b.maturity] ?? 9);
        if (cmp === 0) cmp = b.overallAvg - a.overallAvg;
        break;
      case 'avg':
        cmp = b.overallAvg - a.overallAvg;
        if (dir === -1) cmp = cmp;
        else cmp = a.overallAvg - b.overallAvg;
        return cmp || b.numSprints - a.numSprints;
      case 'sprints':
        cmp = b.numSprints - a.numSprints;
        if (dir === -1) cmp = cmp;
        else cmp = a.numSprints - b.numSprints;
        return cmp || b.overallAvg - a.overallAvg;
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
    const activeSprints = [];
    sprintKeys.forEach(sk => {
      if (s.sprints[sk]) {
        orderedScores.push(s.sprints[sk].score);
        activeSprints.push(sk);
      }
    });

    return `
      <tr class="${isTop3 ? 'rank-top' : ''}">
        <td class="col-rank"><span class="rank-num">${i + 1}</span></td>
        <td class="col-name">
          <div class="student-name-cell">
            <div class="student-avatar" style="background:${avatarColor(s.id)};">${initials(s.name)}</div>
            <span class="student-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</span>
          </div>
        </td>
        <td class="col-class"><span class="class-badge ${classCSS(s.maturity)}">${s.maturity}</span></td>
        <td class="col-avg"><span class="score-pill ${scoreClass(s.overallAvg)}">${s.overallAvg.toFixed(1)}</span></td>
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
          <div class="sparkline-cell">${sparklineSVG(orderedScores, activeSprints)}</div>
        </td>
        <td class="col-action">
          <button class="btn-detail" onclick="openStudentModal('${s.id}')" title="Ver detalle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  countEl.textContent = `Mostrando ${sorted.length} de ${D.students.length} estudiantes evaluados`;
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

  // When filtering by sprint, sort by that sprint's score by default
  if (sprintFilter !== 'all') {
    filtered.sort((a, b) => (b.sprints[sprintFilter]?.score || 0) - (a.sprints[sprintFilter]?.score || 0));
  }

  renderRanking(filtered);
}

// ===== Alchemist Spotlight =====
function renderAlchemists() {
  const grid = document.getElementById('alchemistGrid');

  // Get top students: Destacados first, then highest scores
  const highlighted = D.students
    .filter(s => s.maturity.includes('Destacado') || (s.overallAvg >= 3.5 && s.numSprints >= 2))
    .sort((a, b) => {
      if (a.maturity.includes('Destacado') && !b.maturity.includes('Destacado')) return -1;
      if (!a.maturity.includes('Destacado') && b.maturity.includes('Destacado')) return 1;
      return b.overallAvg - a.overallAvg || b.numSprints - a.numSprints;
    });

  grid.innerHTML = highlighted.map(s => {
    return `
      <div class="alchemist-card animate-in" onclick="openStudentModal('${s.id}')">
        <div class="alchemist-header">
          <div class="alchemist-avatar">${s.maturity.includes('Destacado') ? '🔮' : '⚗️'}</div>
          <div>
            <div class="alchemist-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</div>
            <div class="alchemist-class">${s.maturity}</div>
          </div>
        </div>
        <div class="alchemist-stats">
          <div class="alchemist-stat">
            <div class="alchemist-stat-value" style="color:var(--color-primary);">${s.overallAvg.toFixed(1)}</div>
            <div class="alchemist-stat-label">Promedio</div>
          </div>
          <div class="alchemist-stat">
            <div class="alchemist-stat-value">${s.numSprints}</div>
            <div class="alchemist-stat-label">Sprints</div>
          </div>
          <div class="alchemist-stat">
            <div class="alchemist-stat-value" style="color:${s.progression > 0 ? 'var(--color-green)' : s.progression < 0 ? 'var(--color-rose)' : 'var(--color-text-muted)'};">${s.progression > 0 ? '+' : ''}${s.progression.toFixed(1)}</div>
            <div class="alchemist-stat-label">Progresión</div>
          </div>
        </div>
        ${s.synthesis ? `
          <div class="alchemist-signals">
            <p class="alchemist-signal">${s.synthesis.length > 180 ? s.synthesis.slice(0, 180) + '...' : s.synthesis}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ===== Student Modal =====
function openStudentModal(studentId) {
  const s = D.students.find(st => st.id === studentId);
  if (!s) return;

  const modal = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  const sprintKeys = ['1', '2', '3', '4'];

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-avatar" style="background:${avatarColor(s.id)};">${initials(s.name)}</div>
      <div>
        <div class="modal-student-name${s.name.startsWith('Student_') ? ' student-anonymous' : ''}">${s.name}</div>
        <div class="modal-student-meta">
          <span class="class-badge ${classCSS(s.maturity)}">${s.maturity}</span>
        </div>
      </div>
    </div>

    <div class="modal-kpis">
      <div class="modal-kpi">
        <div class="modal-kpi-value" style="color:var(--color-primary);">${s.overallAvg.toFixed(2)}</div>
        <div class="modal-kpi-label">Promedio General</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-value">${s.numSprints}</div>
        <div class="modal-kpi-label">Sprints Evaluados</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-value" style="color:${s.progression > 0 ? 'var(--color-green)' : s.progression < 0 ? 'var(--color-rose)' : 'var(--color-text-muted)'};">${s.progression > 0 ? '+' : ''}${s.progression.toFixed(1)}</div>
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

    ${sprintKeys.map(sk => {
      const sp = s.sprints[sk];
      if (!sp) return '';

      return `
        <div class="modal-sprint">
          <div class="modal-sprint-header" onclick="this.nextElementSibling.classList.toggle('open')">
            <span class="modal-sprint-title">${sprintLabel(sk)}</span>
            <span class="modal-sprint-score score-pill ${scoreClass(sp.score)}">${sp.score.toFixed(1)} — ${sp.level}</span>
          </div>
          <div class="modal-sprint-body open">
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
function maturityCSS(level) {
  if (level.includes('Destacado')) return 'maturity-destacado';
  if (level.includes('Práctica')) return 'maturity-practica';
  return 'maturity-aprendiz';
}

function renderMaturitySection() {
  const mat = D.summary.maturityDistribution;
  const levelUp = computeLevelUpSummary();
  const textColor = getCSS('--color-text') || '#1a1814';
  const textMuted = getCSS('--color-text-muted') || '#9e9b93';
  const gridColor = getCSS('--color-divider') || '#ece9e3';

  // KPI row
  const kpiEl = document.getElementById('maturityKpis');
  const total = (mat['Aprendiz Activo'] || 0) + (mat['Alquimista en Práctica'] || 0) + (mat['Alquimista Destacado'] || 0);
  const practicaPlus = (mat['Alquimista en Práctica'] || 0) + (mat['Alquimista Destacado'] || 0);
  const pctProficient = total > 0 ? Math.round((practicaPlus / total) * 100) : 0;

  kpiEl.innerHTML = `
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-violet);">${mat['Aprendiz Activo'] || 0}</div>
      <div class="maturity-kpi-label">Aprendiz Activo</div>
      <div class="maturity-kpi-sub">Experimentan sin caso de uso definido</div>
    </div>
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-teal);">${mat['Alquimista en Práctica'] || 0}</div>
      <div class="maturity-kpi-label">Alquimista en Práctica</div>
      <div class="maturity-kpi-sub">Aplican IA a problemas reales de su puesto</div>
    </div>
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-amber);">${mat['Alquimista Destacado'] || 0}</div>
      <div class="maturity-kpi-label">Alquimista Destacado</div>
      <div class="maturity-kpi-sub">Construyen soluciones escalables</div>
    </div>
    <div class="maturity-kpi">
      <div class="maturity-kpi-value" style="color:var(--color-primary);">${pctProficient}%</div>
      <div class="maturity-kpi-label">Proficiencia IA</div>
      <div class="maturity-kpi-sub">En Práctica + Destacado sobre el total</div>
    </div>
  `;

  // Maturity donut chart
  destroyChart('maturityChart');
  const matCtx = document.getElementById('maturityChart');
  if (matCtx) {
    const matLabels = [];
    const matData = [];
    const matColors = [];
    const matColorMap = {
      'Aprendiz Activo': getCSS('--color-violet') || '#6b3fa0',
      'Alquimista en Práctica': getCSS('--color-teal') || '#0a7b6f',
      'Alquimista Destacado': getCSS('--color-amber') || '#c77d0a'
    };
    ['Aprendiz Activo', 'Alquimista en Práctica', 'Alquimista Destacado'].forEach(key => {
      const val = mat[key] || 0;
      if (val > 0) {
        matLabels.push(key);
        matData.push(val);
        matColors.push(matColorMap[key]);
      }
    });

    chartInstances['maturityChart'] = new Chart(matCtx, {
      type: 'doughnut',
      data: {
        labels: matLabels,
        datasets: [{
          data: matData,
          backgroundColor: matColors,
          borderWidth: 0, hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } } },
          tooltip: {
            backgroundColor: getCSS('--color-surface') || '#fff',
            titleColor: textColor, bodyColor: textColor,
            borderColor: gridColor, borderWidth: 1, padding: 12, cornerRadius: 8,
            callbacks: { label: ctx => ` ${ctx.raw} estudiantes (${total > 0 ? Math.round(ctx.raw / total * 100) : 0}%)` }
          }
        }
      }
    });
  }

  // Competencias Promedio horizontal bar (replaces old application areas chart)
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
      '#5a8a9a', '#9a6b5a', '#6a9a5a', '#8a5a9a', '#5a6a8a',
      '#7a8a4a', '#4a7a8a'
    ];

    // Update chart title
    const areasChartTitle = areasCtx.closest('.chart-card')?.querySelector('.chart-title');
    if (areasChartTitle) areasChartTitle.textContent = 'Competencias Promedio';

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

  // Sprint maturity progression stacked bar (computed from students)
  destroyChart('maturityProgressionChart');
  const progCtx = document.getElementById('maturityProgressionChart');
  if (progCtx) {
    const sm = computeSprintMaturity();
    const sprintLabels = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'];
    const sprintIds = ['1', '2', '3', '4'];

    chartInstances['maturityProgressionChart'] = new Chart(progCtx, {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Aprendiz Activo',
            data: sprintIds.map(s => sm[s]['Aprendiz Activo'] || 0),
            backgroundColor: getCSS('--color-violet') || '#6b3fa0',
            borderRadius: 4, maxBarThickness: 56
          },
          {
            label: 'Alquimista en Práctica',
            data: sprintIds.map(s => sm[s]['Alquimista en Práctica'] || 0),
            backgroundColor: getCSS('--color-teal') || '#0a7b6f',
            borderRadius: 4, maxBarThickness: 56
          },
          {
            label: 'Alquimista Destacado',
            data: sprintIds.map(s => sm[s]['Alquimista Destacado'] || 0),
            backgroundColor: getCSS('--color-amber') || '#c77d0a',
            borderRadius: 4, maxBarThickness: 56
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
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: gridColor, drawBorder: false }, title: { display: true, text: 'Estudiantes', font: { size: 11 } } }
        }
      }
    });
  }

  // Level-up cards
  const luGrid = document.getElementById('levelUpGrid');
  const levels = ['Aprendiz Activo', 'Alquimista en Práctica', 'Alquimista Destacado'];
  const levelIcons = { 'Aprendiz Activo': '🧪', 'Alquimista en Práctica': '⚗️', 'Alquimista Destacado': '🔮' };
  const levelColors = { 'Aprendiz Activo': 'var(--color-violet)', 'Alquimista en Práctica': 'var(--color-teal)', 'Alquimista Destacado': 'var(--color-amber)' };

  luGrid.innerHTML = levels.map(level => {
    const info = levelUp[level] || {};
    return `
      <div class="level-up-card animate-in">
        <div class="level-up-header">
          <span class="level-up-icon">${levelIcons[level]}</span>
          <div>
            <div class="level-up-title">${level}</div>
            <div class="level-up-count" style="color:${levelColors[level]};">${info.count || 0} estudiantes</div>
          </div>
        </div>
        <div class="level-up-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          <span>Hacia ${info.next_level || '—'}</span>
        </div>
        <p class="level-up-advice">${info.general_advice || ''}</p>
      </div>
    `;
  }).join('');
}

// ===== Navigation =====
function updateNavActive() {
  const sections = ['overview', 'sprints', 'ranking', 'maturity', 'alchemists'];
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

// Smooth scroll for nav links
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
renderMaturitySection();
renderAlchemists();
