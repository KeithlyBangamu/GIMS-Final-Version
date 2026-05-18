window.addEventListener('error', (event) => {
  console.error('[employee-dashboard] uncaught error', event.error || event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[employee-dashboard] unhandled promise rejection', event.reason);
});

document.addEventListener('DOMContentLoaded', () => {
  /** @type {string|null} */
  let token = window.localStorage.getItem('gims_employee_token');
  const savedRole = window.localStorage.getItem('gims_role');

  const decodeJwtPayload = (jwtToken) => {
    try {
      const parts = String(jwtToken || '').split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(base64 + pad));
    } catch {
      return null;
    }
  };
  const isTokenValid = (jwtToken) => {
    const data = decodeJwtPayload(jwtToken);
    if (!data) return false;
    if (data.exp && Date.now() / 1000 > data.exp) return false;
    return true;
  };
  const redirectToHome = () => {
    window.localStorage.removeItem('gims_employee_token');
    window.localStorage.removeItem('gims_role');
    window.location.replace('/');
  };

  if (!token || !isTokenValid(token)) {
    redirectToHome();
    return;
  }

  if (savedRole === 'admin') {
    window.location.replace('/admin.html');
    return;
  }

  // Re-validate after Back/Forward navigation (bfcache restore).
  window.addEventListener('pageshow', (event) => {
    const stored = window.localStorage.getItem('gims_employee_token');
    if (event.persisted || stored !== token) {
      token = stored;
      if (!isTokenValid(token)) redirectToHome();
    }
  });

  const el = {
    topbarName: null,
    profileTrigger: document.getElementById('employee-profile-trigger'),
    topbarEmail: null,
    topbarId: null,
    welcomeName: document.getElementById('employee-welcome-name'),

    complianceProgressText: document.getElementById('compliance-progress-text'),
    complianceProgressPercent: document.getElementById('compliance-progress-percent'),
    complianceProgressBar: document.getElementById('compliance-progress-bar'),
    complianceStatusBadge: document.getElementById('compliance-status-badge'),
    complianceUpdatedAt: document.getElementById('compliance-updated-at'),
    complianceAdviceBox: document.getElementById('compliance-advice-box'),
    complianceAdviceHeader: document.getElementById('compliance-advice-header'),
    complianceAdviceText: document.getElementById('compliance-advice-text'),

    infoId: document.getElementById('employee-info-id'),
    infoEmail: document.getElementById('employee-info-email'),
    infoDepartment: document.getElementById('employee-info-department'),
    infoPosition: document.getElementById('employee-info-position'),
    infoBirthSex: document.getElementById('employee-info-birthSex'),
    infoGenderIdentity: document.getElementById('employee-info-genderIdentity'),
    infoMaleCount: document.getElementById('employee-info-maleCount'),
    infoFemaleCount: document.getElementById('employee-info-femaleCount'),
    infoStatus: document.getElementById('employee-info-status'),

    upcomingCarousel: document.getElementById('upcoming-carousel'),
    upcomingStatus: document.getElementById('upcoming-status'),
    upcomingViewSwipe: document.getElementById('employee-upcoming-view-swipe'),
    upcomingViewGrid: document.getElementById('employee-upcoming-view-grid'),
    upcomingViewList: document.getElementById('employee-upcoming-view-list'),

    attendedSeminarsList: document.getElementById('attended-seminars-list'),
    attendedCertStatus: document.getElementById('attended-cert-status'),
    attendedViewSwipe: document.getElementById('employee-attended-view-swipe'),
    attendedViewGrid: document.getElementById('employee-attended-view-grid'),
    attendedViewList: document.getElementById('employee-attended-view-list'),
    attendedSortBtn: document.getElementById('employee-attended-sort-btn'),
    attendedPrev: document.getElementById('employee-attended-prev'),
    attendedNext: document.getElementById('employee-attended-next'),

    // Notification elements
    notifBellBtn: document.getElementById('notif-bell-btn'),
    notifBadge: document.getElementById('notif-badge'),
    notifDropdown: document.getElementById('notif-dropdown'),
    notifList: document.getElementById('notif-list'),
    notifReadAllBtn: document.getElementById('notif-read-all-btn'),
    notifClearBtn: document.getElementById('notif-clear-btn'),

    // Seminar tab buttons
    seminarTabs: document.getElementById('seminar-tabs'),

    // Join/Pre-register modal
    joinBackdrop: document.getElementById('join-modal-backdrop'),
    joinTitle: document.getElementById('join-modal-title'),
    joinMeta: document.getElementById('join-modal-meta'),
    joinDesc: document.getElementById('join-modal-desc'),
    joinSessionPicker: document.getElementById('join-modal-session-picker'),
    joinConsent1: document.getElementById('join-consent-1'),
    joinConsent2: document.getElementById('join-consent-2'),
    joinConfirmBtn: document.getElementById('join-modal-confirm'),
    joinCancelBtn: document.getElementById('join-modal-cancel'),
    joinCloseBtn: document.getElementById('join-modal-close'),
    joinStatus: document.getElementById('join-modal-status'),

    // Profile modal
    profileBackdrop: document.getElementById('profile-modal-backdrop'),
    profileCloseBtn: document.getElementById('profile-modal-close'),

    // Evaluation modal
    evalBackdrop: document.getElementById('eval-modal-backdrop'),
    evalTitle: document.getElementById('eval-modal-title'),
    evalSeminarName: document.getElementById('eval-modal-seminar-name'),
    evalSeminarDesc: document.getElementById('eval-modal-seminar-desc'),
    evalForm: document.getElementById('eval-form'),
    evalFormBody: document.getElementById('eval-form-body'),
    evalSubmitBtn: document.getElementById('eval-submit-btn'),
    evalModalClose: document.getElementById('eval-modal-close'),
    evalModalCancel: document.getElementById('eval-modal-cancel'),
    evalModalStatus: document.getElementById('eval-modal-status'),

    logoutBtn: document.getElementById('employee-logout-btn'),
  };

  let currentDashboardData = null;
  let currentSeminarTab = 'open';
  let currentEmployeeId = null;
  let currentSeminars = [];
  let currentEvalRegistrationId = null;
  let currentChosenSessionId = null;

  const authedFetch = async (url, options = {}) => {
    if (!token) throw new Error('Not authenticated');
    const headers = options.headers || {};
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const escapeHtml = (str) => {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const formatTime = (value) => {
    if (!value) return '';
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (!match) return String(value);
    let hours = Number(match[1]);
    const minutes = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes}\u00A0${period}`;
  };

  const formatSeminarDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  };

  /** Local calendar day key YYYY-MM-DD for matching a card’s “Pre-Register for &lt;date&gt;” to a session row. */
  const toLocalDateKey = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  /** Compact list of every session (date • time) for multi-day seminars; optional bold for pick-one / chosen day row. */
  const buildSessionsScheduleBlock = (sessions, opts = {}) => {
    if (!Array.isArray(sessions) || sessions.length <= 1) return '';
    const highlightId = opts.highlightSessionId != null ? String(opts.highlightSessionId) : '';
    const highlightDateKey = opts.highlightDateKey != null ? String(opts.highlightDateKey) : '';
    const label = opts.label || 'All sessions';
    const items = sessions.map((sess, idx) => {
      const sid = String(sess._id || sess.id || '');
      const sessKey = toLocalDateKey(sess.date);
      const isBoldRow =
        (highlightId && sid && sid === highlightId) ||
        (highlightDateKey && sessKey && sessKey === highlightDateKey);
      const line = `Day ${idx + 1}: ${formatSeminarDate(sess.date)} • ${formatTime(sess.startTime)}`;
      const tag = isBoldRow
        ? ` <strong style="font-size:0.62rem; font-weight:700;">(this session)</strong>`
        : '';
      const lineHtml = isBoldRow
        ? `<strong style="font-weight:700;">${escapeHtml(line)}</strong>${tag}`
        : escapeHtml(line);
      return `<div class="muted small" style="font-size:0.68rem; margin-top:0.14rem; line-height:1.25; letter-spacing:-0.01em; opacity:0.9;">${lineHtml}</div>`;
    });
    return `
      <div class="seminar-sessions-schedule" style="margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid rgba(15,23,42,0.08);">
        <div class="muted small" style="font-size:0.65rem; font-weight:600; letter-spacing:0.015em; opacity:0.8;">${escapeHtml(label)}</div>
        ${items.join('')}
      </div>`;
  };

  const truncate = (text, max = 120) => {
    const s = String(text || '');
    if (s.length > max) return s.slice(0, max).trimEnd() + '…';
    return s;
  };

  const wireJoinedSeminarDescriptionToggles = (root) => {
    if (!root) return;
    root.querySelectorAll('.joined-seminar-desc-block').forEach((block) => {
      const view = block.querySelector('.joined-seminar-desc-view');
      const mask = block.querySelector('.joined-seminar-description-mask');
      const btn = block.querySelector('.joined-seminar-desc-chevron-btn');
      if (!view || !mask || !btn) return;

      const setExpanded = (open) => {
        view.classList.toggle('joined-seminar-description--expanded', open);
        view.classList.toggle('joined-seminar-description--collapsed', !open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Collapse description' : 'Expand description');
        if (open) mask.scrollTop = 0;
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !view.classList.contains('joined-seminar-description--expanded');
        setExpanded(open);
      });

      mask.addEventListener('click', () => {
        if (view.classList.contains('joined-seminar-description--collapsed')) setExpanded(true);
      });
    });
  };

  /** Max collapsed preview height (px). Long descriptions stay truncated until expanded. */
  const DESC_COLLAPSED_PREVIEW_CAP_PX = 84;

  /** Pixels available for description text before chevron (flex region or space above actions). */
  const resolveDescMeasureBudgetPx = (wrap) => {
    const upcomingHost = wrap.closest('.seminar-card-desc-inner');
    if (upcomingHost && upcomingHost.clientHeight > 48) {
      return Math.floor(upcomingHost.clientHeight);
    }
    const card = wrap.closest('.joined-seminar-card');
    const actions = card?.querySelector('.joined-seminar-actions');
    if (card && actions) {
      const top = wrap.getBoundingClientRect().top;
      const limit = actions.getBoundingClientRect().top;
      const gap = Math.floor(limit - top - 8);
      if (gap > 56) return gap;
    }
    return 0;
  };

  const buildExpandableDescriptionMarkup = (descHtml, innerStyle = 'margin:0;', collapsedMaxPx = 0) => {
    const maskClamp = collapsedMaxPx > 0 ? `max-height:${collapsedMaxPx}px;` : '';
    return `
      <div class="joined-seminar-desc-block">
        <div class="joined-seminar-desc-view joined-seminar-description--collapsed">
          <div class="joined-seminar-description-mask" style="${maskClamp}">
            <p class="muted small joined-seminar-description" style="${innerStyle}">${descHtml}</p>
          </div>
          <button type="button" class="joined-seminar-desc-chevron-btn" aria-expanded="false" aria-label="Expand description">
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `;
  };

  /** Renders a measure pass; call {@link finalizeSeminarDescriptionAutowrap} after layout. */
  const buildAttendedDescriptionHtml = (rawDesc) => {
    const desc = String(rawDesc || '').trim();
    if (!desc) return '<p class="muted small joined-seminar-description">—</p>';
    const descHtml = escapeHtml(desc);
    return `
      <div class="joined-seminar-desc-autowrap" data-desc-autowrap>
        <div class="joined-seminar-desc-measure-clip">
          <p class="muted small joined-seminar-description joined-seminar-desc-measure-txt" style="margin:0;">${descHtml}</p>
        </div>
      </div>
    `;
  };

  const finalizeSeminarDescriptionAutowrap = (root) => {
    if (!root) return;
    Array.from(root.querySelectorAll('[data-desc-autowrap]')).forEach((wrap) => {
      const clip = wrap.querySelector('.joined-seminar-desc-measure-clip');
      const p = clip?.querySelector('.joined-seminar-desc-measure-txt');
      if (!clip || !p) return;
      const budgetPx = resolveDescMeasureBudgetPx(wrap);
      const previewPx =
        budgetPx > 0 ? Math.min(budgetPx, DESC_COLLAPSED_PREVIEW_CAP_PX) : DESC_COLLAPSED_PREVIEW_CAP_PX;
      clip.style.maxHeight = `${previewPx}px`;
      void clip.offsetHeight;
      const fullText = p.textContent ?? '';
      const needsExpand = clip.scrollHeight > clip.clientHeight + 1;
      const descHtml = escapeHtml(fullText);
      if (needsExpand) {
        wrap.outerHTML = buildExpandableDescriptionMarkup(descHtml, 'margin:0;', previewPx);
      } else {
        wrap.outerHTML = `<p class="muted small joined-seminar-description" style="margin:0;">${descHtml}</p>`;
      }
    });
  };

  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatSeminarDate(date);
  };

  // ========================
  // NOTIFICATION SYSTEM
  // ========================

  const notifIconMap = {
    approval: '<i class="fa-solid fa-circle-check" style="color:#059669;"></i>',
    certificate: '<i class="fa-solid fa-file-certificate" style="color:var(--xu-blue);"></i>',
    evaluation: '<i class="fa-solid fa-clipboard-list" style="color:#b45309;"></i>',
    seminar_update: '<i class="fa-solid fa-bookmark" style="color:var(--xu-blue);"></i>',
  };

  const navigateFromNotification = (type, registrationId, seminarId) => {
    el.notifDropdown?.classList.remove('is-open');

    if (type === 'evaluation' && registrationId) {
      const target = document.getElementById('attended-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Delay slightly so scroll settles, then trigger the eval modal for this registration
      setTimeout(() => {
        const evalBtn = el.attendedSeminarsList?.querySelector(`button[data-open-eval="${CSS.escape(registrationId)}"]`);
        if (evalBtn && !evalBtn.disabled) {
          evalBtn.click();
        } else {
          // Fallback: just scroll, the button may be disabled if already submitted
          const target2 = document.getElementById('attended-section');
          if (target2) target2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 400);
      return;
    }

    if (type === 'certificate') {
      const target = document.getElementById('attended-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (type === 'approval') {
      const target = document.getElementById('upcoming-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (type === 'seminar_update') {
      const target = document.getElementById('upcoming-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  };

  const renderNotifications = (notifications) => {
    if (!el.notifList) return;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      el.notifList.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
      return;
    }

    el.notifList.innerHTML = notifications
      .map((n) => `
        <div class="notif-item ${n.read ? '' : 'unread'}"
          data-notif-id="${escapeHtml(String(n._id || ''))}"
          data-notif-type="${escapeHtml(String(n.type || ''))}"
          data-notif-registration-id="${escapeHtml(String(n.registrationID || ''))}"
          data-notif-seminar-id="${escapeHtml(String(n.seminarID || ''))}"
          style="cursor:pointer;"
          title="Click to go to this notification's source"
        >
          <span class="notif-icon">${notifIconMap[n.type] || '<i class="fa-solid fa-bell"></i>'}</span>
          <div class="notif-item-body">
            <div class="notif-item-msg">${escapeHtml(n.message)}</div>
            <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
          </div>
          ${!n.read ? '<div class="notif-dot"></div>' : ''}
        </div>
      `)
      .join('');

    // Click: mark as read then navigate to source
    el.notifList.querySelectorAll('.notif-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const notifId = item.getAttribute('data-notif-id');
        const notifType = item.getAttribute('data-notif-type');
        const registrationId = item.getAttribute('data-notif-registration-id');
        const seminarId = item.getAttribute('data-notif-seminar-id');

        if (notifId && !item.classList.contains('read-marked')) {
          item.classList.remove('unread');
          item.classList.add('read-marked');
          const dotEl = item.querySelector('.notif-dot');
          if (dotEl) dotEl.remove();
          try {
            await authedFetch(`/api/employee/notifications/${notifId}/read`, { method: 'PUT' });
            await loadNotifications();
          } catch {}
        }

        navigateFromNotification(notifType, registrationId, seminarId);
      });
    });
  };

  const loadNotifications = async () => {
    try {
      const res = await authedFetch('/api/employee/notifications');
      if (!res.ok) return;
      const data = await res.json();
      const notifications = Array.isArray(data.notifications) ? data.notifications : [];
      const unread = Number(data.unreadCount || 0);

      renderNotifications(notifications);

      if (el.notifBadge) {
        if (unread > 0) {
          el.notifBadge.textContent = unread > 99 ? '99+' : String(unread);
          el.notifBadge.style.display = 'flex';
        } else {
          el.notifBadge.style.display = 'none';
        }
      }
    } catch {}
  };

  // Bell toggle
  el.notifBellBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = el.notifDropdown;
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('is-open');
    dropdown.classList.toggle('is-open', !isOpen);
    if (!isOpen) {
      loadNotifications();
      loadDashboard().catch(() => {});
    }
  });

  // Mark all read
  el.notifReadAllBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    el.notifReadAllBtn.disabled = true;
    try {
      const res = await authedFetch('/api/employee/notifications/read-all', { method: 'PUT' });
      if (!res.ok) {
        let msg = 'Failed to mark all as read.';
        try {
          const data = await res.json();
          msg = data?.message || msg;
        } catch {}
        console.error('[notif] mark-all-read failed', res.status, msg);
      }
      // Optimistically clear unread styling immediately so the user sees a result
      el.notifList?.querySelectorAll('.notif-item.unread').forEach((item) => {
        item.classList.remove('unread');
        const dot = item.querySelector('.notif-dot');
        if (dot) dot.remove();
      });
      if (el.notifBadge) el.notifBadge.style.display = 'none';
      await loadNotifications();
    } catch (err) {
      console.error('[notif] mark-all-read error', err);
    } finally {
      el.notifReadAllBtn.disabled = false;
    }
  });

  // Clear all notifications
  el.notifClearBtn?.addEventListener('click', async () => {
    if (!window.confirm('Clear all notifications? This cannot be undone.')) return;
    try {
      await authedFetch('/api/employee/notifications', { method: 'DELETE' });
      await loadNotifications();
    } catch {}
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notif-bell-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      el.notifDropdown?.classList.remove('is-open');
    }
  });

  // ========================
  // SEMINAR TABS
  // ========================

  el.seminarTabs?.querySelectorAll('.seminar-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.seminarTabs.querySelectorAll('.seminar-tab-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const nextTab = btn.getAttribute('data-tab') || 'open';
      currentSeminarTab = nextTab;
      // Registration lists come from /dashboard; refresh when opening these tabs so approvals show up without a full reload.
      if (nextTab === 'registered' || nextTab === 'pre-registered') {
        loadDashboard().catch(() => {});
      } else {
        applySeminarFilter();
      }
    });
  });

  const parseTimeForScheduleSort = (value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const registrationScheduleSortKey = (r) => {
    const s = r?.seminar;
    if (!s) return 0;
    if (r.chosenSessionId && Array.isArray(s.sessions)) {
      const sess = s.sessions.find((x) => String(x._id || x.id || '') === String(r.chosenSessionId));
      if (sess?.date) {
        return new Date(sess.date).getTime() + parseTimeForScheduleSort(sess.startTime);
      }
    }
    return new Date(s.date || 0).getTime() + parseTimeForScheduleSort(s.startTime);
  };

  const applySeminarFilter = () => {
    if (!currentDashboardData) return;

    if (currentSeminarTab === 'pre-registered') {
      // Show pre-registered seminars
      const preReg = Array.isArray(currentDashboardData.preRegistered) ? currentDashboardData.preRegistered : [];
      renderPreRegistered(preReg);
      return;
    }

    if (currentSeminarTab === 'registered') {
      const rows = Array.isArray(currentDashboardData.registeredSeminars) ? currentDashboardData.registeredSeminars : [];
      const sorted = [...rows].sort((a, b) => registrationScheduleSortKey(a) - registrationScheduleSortKey(b));
      renderRegisteredSeminars(sorted);
      return;
    }

    const allSeminars = Array.isArray(currentDashboardData.upcomingSeminars) ? currentDashboardData.upcomingSeminars : [];

    // Get IDs of seminars already registered in any status
    const allRegIds = new Set();
    const allRegs = [
      ...(currentDashboardData.preRegistered || []),
      ...(currentDashboardData.registeredSeminars || []),
      ...(currentDashboardData.attendedSeminars || []),
    ];
    allRegs.forEach((r) => {
      if (r.seminar?.id) allRegIds.add(String(r.seminar.id));
    });

    // Also check from currentSeminars for registered employees
    const registeredSeminarIds = new Set();
    currentSeminars.forEach((s) => {
      if (currentEmployeeId && Array.isArray(s.registeredEmployees) &&
          s.registeredEmployees.some((id) => String(id) === String(currentEmployeeId))) {
        registeredSeminarIds.add(String(s._id || s.id));
      }
    });

    let filtered = [];
    if (currentSeminarTab === 'open') {
      // All upcoming seminars not yet registered/pre-registered
      filtered = allSeminars.filter((s) =>
        !allRegIds.has(String(s.id)) && !registeredSeminarIds.has(String(s.id))
      );
    } else if (currentSeminarTab === 'mandatory') {
      // Mandatory seminars not yet registered
      filtered = allSeminars.filter((s) =>
        s.mandatory && !allRegIds.has(String(s.id)) && !registeredSeminarIds.has(String(s.id))
      );
    }

    renderUpcoming(filtered);

    if (!filtered.length) {
      if (el.upcomingStatus) {
        el.upcomingStatus.textContent =
          currentSeminarTab === 'mandatory'
            ? 'No mandatory seminars found.'
            : 'No open seminars found.';
      }
    } else if (el.upcomingStatus) {
      el.upcomingStatus.textContent = '';
    }
  };

  // ========================
  // RENDER UPCOMING (Open / Mandatory)
  // ========================

  const renderUpcoming = (upcomingSeminars) => {
    if (!el.upcomingCarousel) return;
    el.upcomingCarousel.innerHTML = '';

    if (!Array.isArray(upcomingSeminars) || upcomingSeminars.length === 0) {
      el.upcomingCarousel.innerHTML = `<p class="muted">No seminars found for this filter.</p>`;
      return;
    }

    const cards = [];

    upcomingSeminars.forEach((s) => {
      const isPickOne = s.multiSessionType === 'pick-one';
      const hasMultiSessions = Array.isArray(s.sessions) && s.sessions.length > 1;

      if (isPickOne && hasMultiSessions) {
        // Explode into one card per session — same seminar info, each session is its own card
        const seriesFirst = formatSeminarDate(s.sessions[0].date);
        const seriesLast = formatSeminarDate(s.sessions[s.sessions.length - 1].date);
        const seriesRange = `${seriesFirst} – ${seriesLast}`;

        s.sessions.forEach((sess, idx) => {
          if (sess.isHeld) return;
          const mandatoryLabel = s.mandatory ? 'Mandatory' : 'Optional';
          const capacity = Number(s.capacity || 0);
          const remaining = Number(s.remainingCapacity || 0);
          const joined = Math.max(0, capacity - remaining);
          const sessionId = String(sess._id || sess.id || '');
          const dayLabel = `Day ${idx + 1} of ${s.sessions.length}`;

          cards.push(`
            <div class="card seminar-card seminar-card--stack" style="box-shadow:none; padding: 1rem; min-width: 290px; flex: 0 0 290px;">
              <div class="seminar-card-top">
                <div style="display:flex; align-items:flex-start; gap: 0.8rem;">
                  <div style="width:36px; height:36px; border-radius:10px; background: rgba(32,58,115,0.12); display:flex; align-items:center; justify-content:center; color: var(--xu-blue);">
                    <i class="fa-solid fa-chalkboard-user"></i>
                  </div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; color: var(--xu-blue);">${escapeHtml(s.title)}</div>
                    <div class="muted small" style="margin-top:0.2rem; font-size:0.83rem; font-weight:600; color:var(--text);">
                      ${escapeHtml(formatSeminarDate(sess.date))} &bull; ${escapeHtml(formatTime(sess.startTime))}
                    </div>
                    <div class="muted small" style="font-size:0.78rem; margin-top:0.1rem; opacity:0.72;">
                      <i class="fa-solid fa-calendar-days" style="margin-right:0.25rem;"></i>Series: ${escapeHtml(seriesRange)}
                    </div>
                    ${buildSessionsScheduleBlock(s.sessions, {
                      highlightSessionId: sessionId,
                      highlightDateKey: toLocalDateKey(sess.date),
                      label: 'All session options',
                    })}
                  </div>
                </div>
              </div>

              <div class="seminar-card-body-spacer">
                <div class="seminar-card-desc-inner">
                  ${buildAttendedDescriptionHtml(s.description)}
                </div>
              </div>

              <div class="seminar-card-footer-row">
                <div class="seminar-card-footer-badges">
                  <div class="badge badge-soft" style="background: rgba(32,58,115,0.08); color: var(--xu-blue); border-color: rgba(32,58,115,0.18);">
                    ${escapeHtml(mandatoryLabel)}
                  </div>
                  <div class="badge badge-soft" style="background:rgba(79,70,229,0.08); color:#4338ca; border-color:rgba(79,70,229,0.2);">
                    ${escapeHtml(dayLabel)}
                  </div>
                </div>
                <div class="seminar-card-footer-slots muted small">
                  Slots: ${escapeHtml(String(joined))}/${escapeHtml(String(capacity))}
                </div>
              </div>

              <button class="btn pre-register-btn" style="margin-top: 0.75rem; width: 100%;"
                data-join-id="${escapeHtml(s.id)}"
                data-session-id="${escapeHtml(sessionId)}"
                type="button">
                Pre-Register for ${escapeHtml(formatSeminarDate(sess.date))}
              </button>
            </div>
          `);
        });
      } else {
        // Single-day or attend-all multi-day — one card
        const mandatoryLabel = s.mandatory ? 'Mandatory' : 'Optional';
        const capacity = Number(s.capacity || 0);
        const remaining = Number(s.remainingCapacity || 0);
        const joined = Math.max(0, capacity - remaining);
        const isAll = s.multiSessionType === 'all';
        const allHasMulti = Array.isArray(s.sessions) && s.sessions.length > 1;

        let dateDisplay = `${escapeHtml(formatSeminarDate(s.date))} &bull; ${escapeHtml(formatTime(s.startTime))}`;
        let seriesLine = '';
        let multiDayBadge = '';
        const sessionsScheduleHtml = allHasMulti
          ? buildSessionsScheduleBlock(s.sessions, { label: 'Every session (attend all)' })
          : '';

        if (isAll && allHasMulti) {
          const first = formatSeminarDate(s.sessions[0].date);
          const last = formatSeminarDate(s.sessions[s.sessions.length - 1].date);
          dateDisplay = `${escapeHtml(first)} – ${escapeHtml(last)}`;
          seriesLine = `<div class="muted small" style="font-size:0.78rem; margin-top:0.1rem; opacity:0.72;">All ${s.sessions.length} sessions required</div>`;
          multiDayBadge = `<div class="badge badge-soft" style="background:rgba(79,70,229,0.08); color:#4338ca; border-color:rgba(79,70,229,0.2);">Multi-Day</div>`;
        }

        cards.push(`
          <div class="card seminar-card seminar-card--stack" style="box-shadow:none; padding: 1rem; min-width: 290px; flex: 0 0 290px;">
            <div class="seminar-card-top">
              <div style="display:flex; align-items:flex-start; gap: 0.8rem;">
                <div style="width:36px; height:36px; border-radius:10px; background: rgba(32,58,115,0.12); display:flex; align-items:center; justify-content:center; color: var(--xu-blue);">
                  <i class="fa-solid fa-chalkboard-user"></i>
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:600; color: var(--xu-blue);">${escapeHtml(s.title)}</div>
                  <div class="muted small" style="margin-top:0.2rem; font-size:0.83rem;">${dateDisplay}</div>
                  ${s.location ? `<div class="muted small" style="font-size:0.82rem; margin-top:0.1rem;"><i class="fa-solid fa-location-dot" style="margin-right:0.25rem;"></i>${escapeHtml(s.location)}</div>` : ''}
                  ${s.resourcePerson ? `<div class="muted small" style="font-size:0.82rem; margin-top:0.1rem;"><i class="fa-solid fa-user" style="margin-right:0.25rem;"></i>${escapeHtml(s.resourcePerson)}</div>` : ''}
                  ${seriesLine}
                  ${sessionsScheduleHtml}
                </div>
              </div>
            </div>

            <div class="seminar-card-body-spacer">
              <div class="seminar-card-desc-inner">
                ${buildAttendedDescriptionHtml(s.description)}
              </div>
            </div>

            <div class="seminar-card-footer-row">
              <div class="seminar-card-footer-badges">
                <div class="badge badge-soft" style="background: rgba(32,58,115,0.08); color: var(--xu-blue); border-color: rgba(32,58,115,0.18);">
                  ${escapeHtml(mandatoryLabel)}
                </div>
                ${multiDayBadge}
              </div>
              <div class="seminar-card-footer-slots muted small">
                Slots: ${escapeHtml(String(joined))}/${escapeHtml(String(capacity))}
              </div>
            </div>

            <button class="btn pre-register-btn" style="margin-top: 0.75rem; width: 100%;" data-join-id="${escapeHtml(s.id)}" type="button">
              Pre-Register
            </button>
          </div>
        `);
      }
    });

    el.upcomingCarousel.innerHTML = cards.join('');
    el.upcomingCarousel.querySelectorAll('button[data-join-id]:not([data-session-id])').forEach((btn) => {
      btn.addEventListener('click', () => {
        const seminarId = btn.getAttribute('data-join-id');
        const seminar = upcomingSeminars.find((x) => String(x.id) === String(seminarId));
        if (!seminar) return;
        openJoinModal({ seminar, joinActionId: seminarId });
      });
    });
    el.upcomingCarousel.querySelectorAll('button[data-session-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const seminarId = btn.getAttribute('data-join-id');
        const sessionId = btn.getAttribute('data-session-id');
        const seminar = upcomingSeminars.find((x) => String(x.id) === String(seminarId));
        if (!seminar) return;
        openJoinModal({ seminar, joinActionId: seminarId, chosenSessionId: sessionId });
      });
    });
    const runDescLayout = () => {
      finalizeSeminarDescriptionAutowrap(el.upcomingCarousel);
      wireJoinedSeminarDescriptionToggles(el.upcomingCarousel);
    };
    requestAnimationFrame(() => requestAnimationFrame(runDescLayout));
  };

  // ========================
  // RENDER PRE-REGISTERED SEMINARS
  // ========================

  const renderPreRegistered = (preRegistered) => {
    if (!el.upcomingCarousel) return;
    el.upcomingCarousel.innerHTML = '';

    if (!Array.isArray(preRegistered) || preRegistered.length === 0) {
      el.upcomingCarousel.innerHTML = `<p class="muted">No seminars found for this filter.</p>`;
      if (el.upcomingStatus) el.upcomingStatus.textContent = 'No pre-registered seminars found.';
      return;
    }

    const cards = preRegistered.map((r) => {
      const s = r.seminar;
      const chosenSess = r.chosenSessionId && Array.isArray(s.sessions)
        ? s.sessions.find((sess) => String(sess._id || sess.id || '') === String(r.chosenSessionId))
        : null;
      const displayDate = chosenSess
        ? `${escapeHtml(formatSeminarDate(chosenSess.date))} &bull; ${escapeHtml(formatTime(chosenSess.startTime))}`
        : `${escapeHtml(formatSeminarDate(s.date))} &bull; ${escapeHtml(formatTime(s.startTime))}`;
      const chosenIdx = chosenSess && Array.isArray(s.sessions) ? s.sessions.indexOf(chosenSess) : -1;
      const dayBadge = chosenSess && s.sessions?.length > 1
        ? `<div class="badge badge-soft" style="background:rgba(79,70,229,0.08); color:#4338ca; border-color:rgba(79,70,229,0.2); margin-left:0.35rem;">Day ${chosenIdx + 1} of ${s.sessions.length}</div>`
        : '';
      const preRegSessionsBlock = buildSessionsScheduleBlock(s.sessions, {
        highlightSessionId: r.chosenSessionId || undefined,
        highlightDateKey: chosenSess ? toLocalDateKey(chosenSess.date) : '',
        label: 'All sessions',
      });

      return `
        <div class="card seminar-card" style="box-shadow:none; padding: 1rem; min-width: 290px; flex: 0 0 290px; display:flex; flex-direction:column; justify-content:space-between; border-color: rgba(245,158,11,0.3);">
          <div style="display:flex; align-items:flex-start; gap: 0.8rem;">
            <div style="width:36px; height:36px; border-radius:10px; background: rgba(245,158,11,0.12); display:flex; align-items:center; justify-content:center; color:#b45309;">
              <i class="fa-solid fa-hourglass-half"></i>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600; color: var(--xu-blue);">
                ${escapeHtml(s.title)}
              </div>
              <div class="muted small" style="margin-top:0.25rem; font-size:0.82rem;">${displayDate}</div>
              ${preRegSessionsBlock}
            </div>
          </div>

          <div class="muted" style="margin-top: 0.75rem; font-size:0.92rem; line-height:1.4;">
            ${escapeHtml(truncate(s.description, 100))}
          </div>

          <div style="margin-top: 0.75rem; display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center;">
            <span class="badge badge-soft badge-pending">Pending Approval</span>
            ${dayBadge}
          </div>
        </div>
      `;
    });

    el.upcomingCarousel.innerHTML = cards.join('');
    if (el.upcomingStatus) el.upcomingStatus.textContent = '';
  };

  // ========================
  // RENDER REGISTERED (approved) SEMINARS
  // ========================

  const renderRegisteredSeminars = (registeredRows) => {
    if (!el.upcomingCarousel) return;
    el.upcomingCarousel.innerHTML = '';

    if (!Array.isArray(registeredRows) || registeredRows.length === 0) {
      el.upcomingCarousel.innerHTML = `<p class="muted">No seminars found for this filter.</p>`;
      if (el.upcomingStatus) el.upcomingStatus.textContent = 'No registered seminars found.';
      return;
    }

    const cards = registeredRows.map((r) => {
      const s = r.seminar;
      const chosenSess = r.chosenSessionId && Array.isArray(s.sessions)
        ? s.sessions.find((sess) => String(sess._id || sess.id || '') === String(r.chosenSessionId))
        : null;
      const displayDate = chosenSess
        ? `${escapeHtml(formatSeminarDate(chosenSess.date))} &bull; ${escapeHtml(formatTime(chosenSess.startTime))}`
        : `${escapeHtml(formatSeminarDate(s.date))} &bull; ${escapeHtml(formatTime(s.startTime))}`;
      const chosenIdx = chosenSess && Array.isArray(s.sessions) ? s.sessions.indexOf(chosenSess) : -1;
      const dayBadge = chosenSess && s.sessions?.length > 1
        ? `<div class="badge badge-soft" style="background:rgba(79,70,229,0.08); color:#4338ca; border-color:rgba(79,70,229,0.2); margin-left:0.35rem;">Day ${chosenIdx + 1} of ${s.sessions.length}</div>`
        : '';
      const registeredSessionsBlock = buildSessionsScheduleBlock(s.sessions, {
        highlightSessionId: r.chosenSessionId || undefined,
        highlightDateKey: chosenSess ? toLocalDateKey(chosenSess.date) : '',
        label: 'All sessions',
      });

      return `
        <div class="card seminar-card" style="box-shadow:none; padding: 1rem; min-width: 290px; flex: 0 0 290px; display:flex; flex-direction:column; justify-content:space-between; border-color: rgba(5,150,105,0.35);">
          <div style="display:flex; align-items:flex-start; gap: 0.8rem;">
            <div style="width:36px; height:36px; border-radius:10px; background: rgba(5,150,105,0.12); display:flex; align-items:center; justify-content:center; color:#047857;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div style="flex:1;">
              <div style="font-weight:600; color: var(--xu-blue);">
                ${escapeHtml(s.title)}
              </div>
              <div class="muted small" style="margin-top:0.25rem; font-size:0.82rem;">${displayDate}</div>
              ${registeredSessionsBlock}
            </div>
          </div>

          <div class="muted" style="margin-top: 0.75rem; font-size:0.92rem; line-height:1.4;">
            ${escapeHtml(truncate(s.description, 100))}
          </div>

          <div style="margin-top: 0.75rem; display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center;">
            <span class="badge badge-soft" style="background: rgba(5,150,105,0.12); color:#047857; border-color: rgba(5,150,105,0.28);">Registered</span>
            ${dayBadge}
          </div>
          <p class="muted small" style="margin:0.65rem 0 0; font-size:0.8rem;">Your registration is approved. Please attend on the scheduled date${chosenSess ? ' and time' : ''}.</p>
        </div>
      `;
    });

    el.upcomingCarousel.innerHTML = cards.join('');
    if (el.upcomingStatus) el.upcomingStatus.textContent = '';
  };

  // ========================
  // RENDER ATTENDED SEMINARS
  // ========================

  const getMaterialFileIcon = (fileURL) => {
    const ext = String(fileURL || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (ext === 'ppt' || ext === 'pptx') return 'PPT';
    return 'FILE';
  };

  let attendedSeminarsCache = [];
  /** @type {'swipe'|'grid'|'list'} */
  let attendedViewMode = 'swipe';
  let attendedSortMode = 'date-desc';
  let attendedSortMenuEl = null;
  let attendedSortMenuCloseHandler = null;

  const parseTimeToMinutesAttended = (value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const getRegistrationCreatedMs = (registrationId) => {
    const id = String(registrationId || '');
    if (/^[a-fA-F0-9]{24}$/.test(id)) return Number.parseInt(id.slice(0, 8), 16) * 1000;
    return 0;
  };

  const sortAttendedNearestToFarthest = (rows) =>
    [...rows].sort((a, b) => {
      const aDate = new Date(a.seminar?.date || 0);
      const bDate = new Date(b.seminar?.date || 0);
      const d = aDate.getTime() - bDate.getTime();
      if (d !== 0) return d;
      return parseTimeToMinutesAttended(a.seminar?.startTime) - parseTimeToMinutesAttended(b.seminar?.startTime);
    });

  const sortAttendedSeminars = (rows, mode) => {
    const list = Array.isArray(rows) ? [...rows] : [];
    const n = String(mode || 'date-desc').toLowerCase();
    if (n === 'recently-added') {
      return list.sort((a, b) => getRegistrationCreatedMs(b.registrationId) - getRegistrationCreatedMs(a.registrationId));
    }
    if (n === 'date-desc') return sortAttendedNearestToFarthest(list).reverse();
    if (n === 'date-asc') return sortAttendedNearestToFarthest(list);
    if (n === 'name-asc') {
      return list.sort((a, b) =>
        String(a?.seminar?.title || '').localeCompare(String(b?.seminar?.title || ''), undefined, { sensitivity: 'base' })
      );
    }
    if (n === 'name-desc') {
      return list.sort((a, b) =>
        String(b?.seminar?.title || '').localeCompare(String(a?.seminar?.title || ''), undefined, { sensitivity: 'base' })
      );
    }
    return sortAttendedNearestToFarthest(list).reverse();
  };

  const applyAttendedViewMode = () => {
    const rail = el.attendedSeminarsList;
    if (!rail) return;

    rail.classList.remove('attended-rail--swipe', 'attended-rail--grid', 'attended-rail--list');
    if (attendedViewMode === 'grid') rail.classList.add('attended-rail--grid');
    else if (attendedViewMode === 'list') rail.classList.add('attended-rail--list');
    else rail.classList.add('attended-rail--swipe');

    if (el.attendedViewSwipe) el.attendedViewSwipe.classList.toggle('is-active', attendedViewMode === 'swipe');
    if (el.attendedViewGrid) el.attendedViewGrid.classList.toggle('is-active', attendedViewMode === 'grid');
    if (el.attendedViewList) el.attendedViewList.classList.toggle('is-active', attendedViewMode === 'list');

    const hasCards = rail.querySelectorAll('.joined-seminar-card').length > 0;
    const showArrows = hasCards && attendedViewMode === 'swipe';
    if (el.attendedPrev) el.attendedPrev.style.display = showArrows ? '' : 'none';
    if (el.attendedNext) el.attendedNext.style.display = showArrows ? '' : 'none';
  };

  const closeAttendedSortMenu = () => {
    if (attendedSortMenuEl) attendedSortMenuEl.remove();
    attendedSortMenuEl = null;
    if (attendedSortMenuCloseHandler) {
      window.removeEventListener('pointerdown', attendedSortMenuCloseHandler, true);
      attendedSortMenuCloseHandler = null;
    }
  };

  const openAttendedSortMenu = (event) => {
    if (!el.attendedSortBtn) return;
    event.preventDefault();
    event.stopPropagation();
    closeAttendedSortMenu();

    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.zIndex = '1400';
    menu.style.background = '#fff';
    menu.style.border = '1px solid var(--border)';
    menu.style.borderRadius = '0.55rem';
    menu.style.boxShadow = '0 10px 30px rgba(15,23,42,0.16)';
    menu.style.padding = '0.35rem';
    menu.style.minWidth = '240px';

    const options = [
      { id: 'recently-added', label: 'Sort: Recently added' },
      { id: 'date-asc', label: 'Sort: Ascending date' },
      { id: 'date-desc', label: 'Sort: Descending date' },
      { id: 'name-asc', label: 'Sort: Ascending name' },
      { id: 'name-desc', label: 'Sort: Descending name' },
    ];

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn secondary';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.display = 'block';
      btn.style.borderRadius = '0.45rem';
      btn.style.margin = '0';
      btn.style.boxShadow = 'none';
      btn.style.background = opt.id === attendedSortMode ? 'rgba(32,58,115,0.08)' : '#fff';
      btn.textContent = opt.id === attendedSortMode ? `✓ ${opt.label}` : opt.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        attendedSortMode = opt.id;
        closeAttendedSortMenu();
        renderAttendedSeminars(sortAttendedSeminars([...attendedSeminarsCache], attendedSortMode));
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const btnRect = el.attendedSortBtn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const left = Math.min(btnRect.right - menuRect.width, window.innerWidth - menuRect.width - 10);
    const top = Math.min(btnRect.bottom + 8, window.innerHeight - menuRect.height - 10);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    attendedSortMenuEl = menu;
    attendedSortMenuCloseHandler = (e) => {
      if (!attendedSortMenuEl) return;
      const target = e.target;
      if (attendedSortMenuEl.contains(target)) return;
      if (el.attendedSortBtn && el.attendedSortBtn.contains(target)) return;
      closeAttendedSortMenu();
    };
    window.addEventListener('pointerdown', attendedSortMenuCloseHandler, true);
  };

  const wireAttendedDescriptionToggles = () => {
    wireJoinedSeminarDescriptionToggles(el.attendedSeminarsList);
  };

  const renderAttendedSeminars = (attendedSeminars) => {
    if (!el.attendedSeminarsList) return;
    if (!Array.isArray(attendedSeminars) || attendedSeminars.length === 0) {
      el.attendedSeminarsList.innerHTML = '<p class="muted">No attended seminars yet.</p>';
      applyAttendedViewMode();
      return;
    }

    el.attendedSeminarsList.innerHTML = attendedSeminars
      .map((r) => {
        const s = r.seminar;
        const canDownloadCert = r.certificateIssued;
        const canEval = r.evaluationAvailable && !r.evaluationCompleted;
        const evalDone = r.evaluationCompleted;
        const attendedChosen = r.chosenSessionId || null;
        const attendedChosenSess =
          attendedChosen && Array.isArray(s.sessions)
            ? s.sessions.find((sess) => String(sess._id || sess.id || '') === String(attendedChosen))
            : null;
        const attendedSessionsBlock = buildSessionsScheduleBlock(s.sessions, {
          highlightSessionId: attendedChosen || undefined,
          highlightDateKey: attendedChosenSess ? toLocalDateKey(attendedChosenSess.date) : '',
          label: 'Sessions',
        });

        return `
          <article class="joined-seminar-card" style="border-color: rgba(32,58,115,0.2);">
            <div class="joined-seminar-head">
              <span class="badge badge-soft badge-attended">Attended</span>
              <span class="joined-seminar-date">${escapeHtml(formatSeminarDate(s.date))} • ${escapeHtml(formatTime(s.startTime))}</span>
            </div>
            <h3 class="joined-seminar-title">${escapeHtml(s.title || '')}</h3>
            ${attendedSessionsBlock}
            ${buildAttendedDescriptionHtml(s.description)}
            <div class="joined-seminar-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button
                class="btn secondary"
                type="button"
                ${canDownloadCert ? `data-download-cert="${escapeHtml(r.registrationId)}"` : 'disabled'}
                style="flex:1; min-width:120px;"
              >
                ${canDownloadCert ? 'Download Certificate' : 'Certificate Unavailable'}
              </button>
              <button
                class="btn ${canEval ? '' : 'secondary'}"
                type="button"
                ${canEval ? `data-open-eval="${escapeHtml(r.registrationId)}" data-eval-seminar="${escapeHtml(s.title)}"` : 'disabled'}
                style="flex:1; min-width:120px;"
              >
                ${evalDone ? 'Evaluation Submitted' : (canEval ? 'Fill Evaluation' : 'Evaluation Unavailable')}
              </button>
              <button
                class="btn secondary"
                type="button"
                data-toggle-materials="${escapeHtml(s.id)}"
                style="flex:1; min-width:120px;"
              >
                View Materials
              </button>
            </div>
            <div id="materials-panel-${escapeHtml(s.id)}" style="display:none; margin-top:0.75rem; border-top:1px solid var(--border); padding-top:0.75rem;">
              <div id="materials-list-${escapeHtml(s.id)}" class="muted small">Loading…</div>
            </div>
          </article>
        `;
      })
      .join('');

    // Attach certificate download handlers
    el.attendedSeminarsList.querySelectorAll('button[data-download-cert]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const registrationId = btn.getAttribute('data-download-cert');
        if (!registrationId) return;
        await downloadCertificate(registrationId);
      });
    });

    // Attach evaluation form open handlers
    el.attendedSeminarsList.querySelectorAll('button[data-open-eval]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const registrationId = btn.getAttribute('data-open-eval');
        const seminarName = btn.getAttribute('data-eval-seminar');
        openEvalModal(registrationId, seminarName);
      });
    });

    // Attach materials dropdown handlers
    el.attendedSeminarsList.querySelectorAll('button[data-toggle-materials]').forEach((btn) => {
      const seminarId = btn.getAttribute('data-toggle-materials');
      const panel = document.getElementById(`materials-panel-${seminarId}`);
      const listEl = document.getElementById(`materials-list-${seminarId}`);
      let loaded = false;

      btn.addEventListener('click', async () => {
        const isOpen = panel?.style.display !== 'none';
        if (panel) panel.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? 'View Materials' : 'Hide Materials';

        if (!isOpen && !loaded) {
          loaded = true;
          if (listEl) listEl.innerHTML = 'Loading materials…';
          try {
            const res = await authedFetch(`/api/employee/seminars/${seminarId}/materials`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || 'Could not load materials');
            const materials = Array.isArray(data) ? data : [];
            if (!materials.length) {
              if (listEl) listEl.innerHTML = '<span>No materials available for this seminar yet.</span>';
            } else {
              if (listEl) {
                listEl.innerHTML = '';
                const select = document.createElement('select');
                select.style.cssText = 'width:100%; padding:0.45rem 0.6rem; border:1px solid var(--border); border-radius:0.5rem; background:var(--card-bg); color:var(--text); font-size:0.9rem; margin-bottom:0.6rem; cursor:pointer;';
                const defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.textContent = `— Select a material (${materials.length} available) —`;
                select.appendChild(defaultOpt);
                materials.forEach((m) => {
                  const opt = document.createElement('option');
                  opt.value = m.fileURL || '';
                  const ext = String(m.fileURL || '').split('.').pop().toUpperCase();
                  opt.textContent = `${getMaterialFileIcon(m.fileURL)} ${m.title || 'Untitled'} (${ext})`;
                  select.appendChild(opt);
                });
                listEl.appendChild(select);

                const openBtn = document.createElement('a');
                openBtn.className = 'btn secondary';
                openBtn.style.cssText = 'display:inline-block; font-size:0.88rem; padding:0.35rem 0.75rem; text-decoration:none;';
                openBtn.textContent = 'Open Selected';
                openBtn.target = '_blank';
                openBtn.rel = 'noopener';
                openBtn.href = '#';
                openBtn.addEventListener('click', (e) => {
                  if (!select.value) { e.preventDefault(); return; }
                  openBtn.href = select.value;
                });
                select.addEventListener('change', () => {
                  openBtn.href = select.value || '#';
                });
                listEl.appendChild(openBtn);
              }
            }
          } catch (err) {
            console.error('[employee-dashboard] load seminar materials failed', err);
            if (listEl) listEl.innerHTML = `<span>${escapeHtml(err.message || 'Failed to load materials.')}</span>`;
            loaded = false;
          }
        }
      });
    });

    const runAttendedDescLayout = () => {
      finalizeSeminarDescriptionAutowrap(el.attendedSeminarsList);
      wireAttendedDescriptionToggles();
    };
    requestAnimationFrame(() => requestAnimationFrame(runAttendedDescLayout));
    applyAttendedViewMode();
  };

  // ========================
  // EVALUATION MODAL
  // ========================

  const RATING_SCALES = {
    quality: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent'],
    relevance: ['1 - Not Relevant', '2 - Somewhat Relevant', '3 - Relevant', '4 - Very Relevant', '5 - Extremely Relevant'],
    likelihood: ['1 - Very Unlikely', '2 - Unlikely', '3 - Undecided / Neutral', '4 - Likely', '5 - Very Likely'],
  };

  const buildScaleRow = (name, scaleKey) => {
    const opts = RATING_SCALES[scaleKey] || RATING_SCALES.quality;
    return opts
      .map(
        (label, i) => `
        <label style="display:grid; grid-template-columns: 1.1rem 1fr; align-items:start; column-gap:0.55rem; font-weight:400; line-height:1.35;">
          <input type="radio" name="${name}" value="${i + 1}" required style="margin:0.2rem 0 0; justify-self:center;" />
          <span>${escapeHtml(label)}</span>
        </label>`
      )
      .join('');
  };

  const buildScaleQuestion = (name, question, scaleKey) => `
    <fieldset style="border:1px solid var(--border); border-radius:0.5rem; padding:0.75rem 0.9rem; margin:0;">
      <legend style="font-weight:600; padding:0 0.4rem;">${escapeHtml(question)} <span style="color:#ef4444;">*</span></legend>
      <div style="display:flex; flex-direction:column; gap:0.35rem; margin-top:0.35rem;">
        ${buildScaleRow(name, scaleKey)}
      </div>
    </fieldset>
  `;

  const buildTextQuestion = (name, question, required = false, placeholder = '') => `
    <label style="display:block;">
      <span style="font-weight:600;">${escapeHtml(question)}${required ? ' <span style="color:#ef4444;">*</span>' : ''}</span>
      <textarea name="${name}" rows="3" ${required ? 'required' : ''} placeholder="${escapeHtml(placeholder)}" style="margin-top:0.35rem; width:100%;"></textarea>
    </label>
  `;

  const renderEvalForm = ({ topic, references }) => {
    if (!el.evalFormBody) return;
    const subject = topic ? topic.trim() : '';
    const subjectPhrase = subject || 'the seminar topic';

    const lessonsHtml = (references || [])
      .map((ref, i) => {
        const labelText = ref.shortName
          ? `${ref.label} or the ${ref.shortName}`
          : ref.label;
        return buildTextQuestion(
          `lesson_${i}`,
          `What is the most important lesson you have learned about ${labelText} so far?`,
          true
        ) + `<input type="hidden" name="lesson_label_${i}" value="${escapeHtml(ref.label || '')}" /><input type="hidden" name="lesson_short_${i}" value="${escapeHtml(ref.shortName || '')}" />`;
      })
      .join('');

    el.evalFormBody.innerHTML = `
      <fieldset style="border:1px solid var(--border); border-radius:0.5rem; padding:0.75rem 0.9rem; margin:0;">
        <legend style="font-weight:600; padding:0 0.4rem;">Data Privacy & Informed Consent <span style="color:#ef4444;">*</span></legend>
        <p class="muted small" style="margin:0.25rem 0 0.5rem;">All personal/sensitive information will be kept confidential. By selecting "Yes" you give consent to the organizers to store and use necessary information in accordance with R.A. 10173 (Data Privacy Act of 2012).</p>
        <label style="display:grid; grid-template-columns: 1.1rem 1fr; align-items:start; column-gap:0.55rem; font-weight:400; line-height:1.35;">
          <input type="radio" name="consent" value="yes" required style="margin:0.2rem 0 0; justify-self:center;" />
          <span>Yes, I give my consent.</span>
        </label>
        <label style="display:grid; grid-template-columns: 1.1rem 1fr; align-items:start; column-gap:0.55rem; font-weight:400; line-height:1.35;">
          <input type="radio" name="consent" value="no" style="margin:0.2rem 0 0; justify-self:center;" />
          <span>No, I do not give consent.</span>
        </label>
      </fieldset>

      ${buildScaleQuestion('overall', 'Overall, how would you rate the session?', 'quality')}
      ${buildScaleQuestion('relevance', 'How relevant was the session content to the objectives?', 'relevance')}
      ${buildScaleQuestion('facilitator', "How would you rate the resource facilitator's delivery and ability to engage the participants?", 'quality')}
      ${buildScaleQuestion('organization', 'How would you rate the design or organization of the session?', 'quality')}
      ${buildScaleQuestion('interaction', 'How would you rate the opportunities or avenues provided for participation and interaction?', 'quality')}
      ${buildScaleQuestion('food', 'How would you rate the food served during the session?', 'quality')}
      ${buildScaleQuestion('venue', 'How would you rate the venue of the session?', 'quality')}
      ${buildScaleQuestion('understanding', `To what extent did the session improve your understanding of ${subjectPhrase}?`, 'quality')}

      ${buildTextQuestion('relevanceContext', 'What is the relevance of the information presented to your personal or professional context?')}

      ${lessonsHtml}

      ${buildScaleQuestion('applyLikelihood', 'How likely are you to apply the knowledge gained in real-life situations (e.g., reporting, intervention, prevention)?', 'likelihood')}

      ${buildTextQuestion('stop', `What should you STOP doing to ensure you are not contributing to ${subjectPhrase} in any way?`, true)}
      ${buildTextQuestion('start', `What actions should you START taking to help prevent ${subjectPhrase} in your community?`, true)}
      ${buildTextQuestion('continueDoing', `What have you been doing that you want to CONTINUE to prevent ${subjectPhrase}?`, true)}
      ${buildTextQuestion('improvements', 'What areas could be improved for future sessions?', true)}

      <fieldset style="border:1px solid var(--border); border-radius:0.5rem; padding:0.75rem 0.9rem; margin:0;">
        <legend style="font-weight:600; padding:0 0.4rem;">Employee Acknowledgement <span style="color:#ef4444;">*</span></legend>
        <p class="muted small" style="margin:0.25rem 0 0.5rem;">As an employee of Xavier University, you are expected to read, understand, and familiarize yourself with the relevant laws and policies covered by this session, and to uphold their principles in the workplace and community.</p>
        <label style="display:grid; grid-template-columns: 1.1rem 1fr; align-items:start; column-gap:0.55rem; font-weight:400; line-height:1.35;">
          <input type="radio" name="acknowledgement" value="yes" required style="margin:0.2rem 0 0; justify-self:center;" />
          <span>I acknowledge and commit to comply.</span>
        </label>
        <label style="display:grid; grid-template-columns: 1.1rem 1fr; align-items:start; column-gap:0.55rem; font-weight:400; line-height:1.35;">
          <input type="radio" name="acknowledgement" value="no" style="margin:0.2rem 0 0; justify-self:center;" />
          <span>Not yet, but I intend to after further review or orientation.</span>
        </label>
      </fieldset>
    `;
  };

  const openEvalModal = async (registrationId, seminarName) => {
    currentEvalRegistrationId = registrationId;
    if (el.evalModalStatus) el.evalModalStatus.textContent = '';
    if (el.evalSeminarName) el.evalSeminarName.textContent = seminarName || '';
    if (el.evalSeminarDesc) el.evalSeminarDesc.textContent = '';
    if (el.evalFormBody) el.evalFormBody.innerHTML = '<p class="muted">Loading…</p>';
    if (el.evalBackdrop) el.evalBackdrop.style.display = 'flex';

    try {
      const res = await authedFetch(`/api/employee/registrations/${registrationId}/evaluation`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load evaluation form.');
      const seminar = data?.seminar || {};
      if (el.evalSeminarName) el.evalSeminarName.textContent = seminar.title || seminarName || '';
      if (el.evalSeminarDesc) el.evalSeminarDesc.textContent = seminar.description || '';
      renderEvalForm({
        topic: seminar.evaluationTopic || '',
        references: Array.isArray(seminar.evaluationReferences) ? seminar.evaluationReferences : [],
      });
    } catch (err) {
      console.error('[employee-dashboard] load evaluation context failed', err);
      if (el.evalFormBody) el.evalFormBody.innerHTML = '';
      if (el.evalModalStatus) el.evalModalStatus.textContent = err.message || 'Failed to load evaluation form.';
    }
  };

  const closeEvalModal = () => {
    if (el.evalBackdrop) el.evalBackdrop.style.display = 'none';
    currentEvalRegistrationId = null;
  };

  el.evalModalClose?.addEventListener('click', closeEvalModal);
  el.evalModalCancel?.addEventListener('click', closeEvalModal);
  el.evalBackdrop?.addEventListener('click', (e) => {
    if (e.target === el.evalBackdrop) closeEvalModal();
  });

  el.evalForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentEvalRegistrationId || !el.evalForm) return;

    const fd = new FormData(el.evalForm);
    const consent = fd.get('consent');
    if (consent !== 'yes') {
      if (el.evalModalStatus) el.evalModalStatus.textContent = 'You must give consent to submit this evaluation.';
      return;
    }
    const acknowledgement = fd.get('acknowledgement') === 'yes';

    const ratingFields = ['overall', 'relevance', 'facilitator', 'organization', 'interaction', 'food', 'venue', 'understanding', 'applyLikelihood'];
    const ratings = {};
    for (const f of ratingFields) {
      const v = fd.get(f);
      if (v) ratings[f] = Number(v);
    }
    if (!ratings.overall) {
      if (el.evalModalStatus) el.evalModalStatus.textContent = 'Please complete all required rating questions.';
      return;
    }

    const lessons = [];
    let i = 0;
    while (fd.has(`lesson_${i}`)) {
      lessons.push({
        referenceLabel: String(fd.get(`lesson_label_${i}`) || ''),
        referenceShortName: String(fd.get(`lesson_short_${i}`) || ''),
        answer: String(fd.get(`lesson_${i}`) || '').trim(),
      });
      i += 1;
    }

    const payload = {
      consent: true,
      acknowledgement,
      ratings,
      responses: {
        relevanceContext: String(fd.get('relevanceContext') || '').trim(),
        lessons,
        stop: String(fd.get('stop') || '').trim(),
        start: String(fd.get('start') || '').trim(),
        continueDoing: String(fd.get('continueDoing') || '').trim(),
        improvements: String(fd.get('improvements') || '').trim(),
      },
    };

    if (el.evalSubmitBtn) el.evalSubmitBtn.disabled = true;
    if (el.evalModalStatus) el.evalModalStatus.textContent = 'Submitting…';

    try {
      const res = await authedFetch(`/api/employee/registrations/${currentEvalRegistrationId}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to submit evaluation');
      if (el.evalModalStatus) el.evalModalStatus.textContent = 'Evaluation submitted successfully!';
      setTimeout(() => {
        closeEvalModal();
        loadDashboard();
      }, 1500);
    } catch (err) {
      console.error('[employee-dashboard] submit evaluation failed', err);
      if (el.evalModalStatus) el.evalModalStatus.textContent = err.message || 'Submission failed.';
      if (el.evalSubmitBtn) el.evalSubmitBtn.disabled = false;
    } finally {
      if (el.evalSubmitBtn) el.evalSubmitBtn.disabled = false;
    }
  });

  // ========================
  // PRE-REGISTER MODAL
  // ========================

  const openJoinModal = ({ seminar, joinActionId, chosenSessionId = null }) => {
    if (!el.joinBackdrop || !el.joinConfirmBtn || !el.joinConsent1 || !el.joinConsent2) return;

    const mandatoryLabel = seminar.mandatory ? 'Mandatory' : 'Optional';
    const isPickOneMeta = seminar.multiSessionType === 'pick-one' && Array.isArray(seminar.sessions) && seminar.sessions.length > 1;

    let modalTitle = 'Pre-Register for Seminar';
    let dateStr;
    if (chosenSessionId && Array.isArray(seminar.sessions)) {
      const picked = seminar.sessions.find((s) => String(s._id || s.id || '') === String(chosenSessionId));
      const pickedIdx = picked ? seminar.sessions.indexOf(picked) : -1;
      if (picked && pickedIdx >= 0) {
        modalTitle = `Pre-Register – Day ${pickedIdx + 1} of ${seminar.sessions.length}`;
        dateStr = `${formatSeminarDate(picked.date)} • ${formatTime(picked.startTime)}`;
      } else {
        dateStr = `${formatSeminarDate(seminar.date)} • ${formatTime(seminar.startTime)}`;
      }
    } else if (isPickOneMeta) {
      const first = formatSeminarDate(seminar.sessions[0].date);
      const last = formatSeminarDate(seminar.sessions[seminar.sessions.length - 1].date);
      dateStr = `${first} – ${last} (${seminar.sessions.length} sessions)`;
    } else {
      dateStr = `${formatSeminarDate(seminar.date)} • ${formatTime(seminar.startTime)}`;
    }
    el.joinTitle.textContent = modalTitle;
    el.joinMeta.textContent = `${dateStr} • ${mandatoryLabel} • ${seminar.remainingCapacity} slots remaining`;
    el.joinDesc.textContent = seminar.description || '';

    // Render session picker for multi-session seminars
    const isPickOne = seminar.multiSessionType === 'pick-one';
    const isAll = seminar.multiSessionType === 'all' || !seminar.multiSessionType;
    const hasMultiSessions = Array.isArray(seminar.sessions) && seminar.sessions.length > 1;

    currentChosenSessionId = chosenSessionId || null;

    if (el.joinSessionPicker) {
      if (hasMultiSessions && isPickOne && chosenSessionId) {
        const chosenSession = seminar.sessions?.find((s) => String(s._id || s.id || '') === String(chosenSessionId));
        const chosenIdx = chosenSession ? seminar.sessions.indexOf(chosenSession) : -1;
        const dayLabel = chosenIdx >= 0 ? `Day ${chosenIdx + 1} of ${seminar.sessions.length}` : '';
        const seriesFirst = formatSeminarDate(seminar.sessions[0]?.date);
        const seriesLast = formatSeminarDate(seminar.sessions[seminar.sessions.length - 1]?.date);
        const chosenDateStr = chosenSession ? formatSeminarDate(chosenSession.date) : '';
        const chosenTimeStr = chosenSession ? formatTime(chosenSession.startTime) : '';
        const chosenDurStr = chosenSession ? `${chosenSession.durationHours} hrs` : '';
        el.joinSessionPicker.innerHTML = `
          <div style="border:1px solid rgba(32,58,115,0.2); border-radius:0.6rem; overflow:hidden; margin-top:0.25rem;">
            <div style="background:rgba(32,58,115,0.06); padding:0.45rem 0.8rem; font-size:0.78rem; font-weight:600; color:var(--xu-blue); display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-calendar-days"></i>
              Multi-Day Series &bull; ${escapeHtml(seriesFirst)} – ${escapeHtml(seriesLast)}
            </div>
            <div style="padding:0.7rem 0.8rem; display:flex; align-items:center; gap:0.7rem; background:rgba(5,150,105,0.06); border-top:1px solid rgba(32,58,115,0.12);">
              <i class="fa-solid fa-calendar-check" style="color:#059669; font-size:1.1rem; flex-shrink:0;"></i>
              <div>
                <div style="font-weight:700; font-size:0.9rem; color:var(--xu-blue);">
                  You are registering for ${escapeHtml(dayLabel)}
                </div>
                <div style="margin-top:0.2rem; font-size:0.88rem; color:var(--text);">
                  ${escapeHtml(chosenDateStr)} &bull; ${escapeHtml(chosenTimeStr)} &bull; ${escapeHtml(chosenDurStr)}
                </div>
              </div>
            </div>
          </div>`;
        el.joinSessionPicker.style.display = 'block';
      } else if (hasMultiSessions && isPickOne) {
        const options = seminar.sessions
          .map((s) => `
            <label style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem; cursor:pointer; padding:0.4rem 0.5rem; border-radius:0.4rem; border:1px solid var(--border);">
              <input type="radio" name="join-session-choice" value="${escapeHtml(String(s._id))}" style="flex-shrink:0;" />
              <span style="font-size:0.9rem;">${escapeHtml(formatSeminarDate(s.date))} &bull; ${escapeHtml(formatTime(s.startTime))} &bull; ${escapeHtml(String(s.durationHours))} hrs</span>
            </label>`)
          .join('');
        el.joinSessionPicker.innerHTML = `
          <div style="font-weight:600; font-size:0.9rem; color:var(--xu-blue); margin-bottom:0.5rem;">Choose your session:</div>
          ${options}`;
        el.joinSessionPicker.style.display = 'block';
      } else if (hasMultiSessions && isAll) {
        const dates = seminar.sessions
          .map((s) => `<li style="margin-bottom:0.2rem;">${escapeHtml(formatSeminarDate(s.date))} &bull; ${escapeHtml(formatTime(s.startTime))} &bull; ${escapeHtml(String(s.durationHours))} hrs</li>`)
          .join('');
        el.joinSessionPicker.innerHTML = `
          <div style="padding:0.6rem 0.8rem; background:rgba(32,58,115,0.06); border:1px solid rgba(32,58,115,0.15); border-radius:0.5rem; font-size:0.88rem;">
            <strong style="color:var(--xu-blue);">All ${seminar.sessions.length} sessions required:</strong>
            <ul style="margin:0.4rem 0 0; padding-left:1.2rem;">${dates}</ul>
          </div>`;
        el.joinSessionPicker.style.display = 'block';
      } else {
        el.joinSessionPicker.innerHTML = '';
        el.joinSessionPicker.style.display = 'none';
      }
    }

    el.joinConsent1.checked = false;
    el.joinConsent2.checked = false;
    el.joinStatus.textContent = '';
    el.joinConfirmBtn.disabled = true;

    const updateConfirmState = () => {
      const consentsOk = el.joinConsent1.checked && el.joinConsent2.checked;
      const sessionOk = !(hasMultiSessions && isPickOne) ||
        !!currentChosenSessionId ||
        !!document.querySelector('input[name="join-session-choice"]:checked');
      el.joinConfirmBtn.disabled = !(consentsOk && sessionOk);
    };

    el.joinConsent1.onchange = updateConfirmState;
    el.joinConsent2.onchange = updateConfirmState;

    // Re-run state check when a session radio is picked
    if (hasMultiSessions && isPickOne && el.joinSessionPicker) {
      el.joinSessionPicker.querySelectorAll('input[type="radio"]').forEach((r) => {
        r.onchange = updateConfirmState;
      });
    }

    el.joinConfirmBtn.dataset.joinId = joinActionId || seminar.id || '';
    el.joinConfirmBtn.dataset.sessionType = seminar.multiSessionType || 'all';
    el.joinBackdrop.style.display = 'flex';
  };

  const closeJoinModal = () => {
    if (!el.joinBackdrop) return;
    el.joinBackdrop.style.display = 'none';
    currentChosenSessionId = null;
  };

  el.joinConfirmBtn?.addEventListener('click', async () => {
    const seminarId = el.joinConfirmBtn.dataset.joinId;
    const sessionType = el.joinConfirmBtn.dataset.sessionType || 'all';
    if (!seminarId) return;

    const fetchBody = {};
    if (sessionType === 'pick-one') {
      const sessionId = currentChosenSessionId || document.querySelector('input[name="join-session-choice"]:checked')?.value;
      if (!sessionId) {
        el.joinStatus.textContent = 'Please select a session date to attend.';
        return;
      }
      fetchBody.sessionId = sessionId;
    }

    el.joinStatus.textContent = 'Processing…';
    el.joinConfirmBtn.disabled = true;
    try {
      const res = await authedFetch(`/api/employee/seminars/${seminarId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fetchBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Pre-registration failed');
      el.joinStatus.textContent = data?.message || 'Successfully pre-registered. Awaiting approval.';
      setTimeout(() => {
        closeJoinModal();
        loadDashboard();
      }, 1800);
    } catch (err) {
      console.error('[employee-dashboard] pre-registration failed', err);
      el.joinStatus.textContent = err.message || 'Pre-registration failed.';
      el.joinConfirmBtn.disabled = false;
    }
  });

  el.joinCancelBtn?.addEventListener('click', closeJoinModal);
  el.joinCloseBtn?.addEventListener('click', closeJoinModal);
  el.joinBackdrop?.addEventListener('click', (e) => {
    if (e.target === el.joinBackdrop) closeJoinModal();
  });

  // ========================
  // PROFILE MODAL
  // ========================

  const openProfileModal = () => {
    if (!el.profileBackdrop) return;
    el.profileBackdrop.style.display = 'flex';
  };

  const closeProfileModal = () => {
    if (!el.profileBackdrop) return;
    el.profileBackdrop.style.display = 'none';
  };

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (el.joinBackdrop?.style.display === 'flex') closeJoinModal();
    if (el.profileBackdrop?.style.display === 'flex') closeProfileModal();
    if (el.evalBackdrop?.style.display === 'flex') closeEvalModal();
  });

  el.profileTrigger?.addEventListener('click', () => openProfileModal());
  el.profileCloseBtn?.addEventListener('click', closeProfileModal);
  el.profileBackdrop?.addEventListener('click', (e) => {
    if (e.target === el.profileBackdrop) closeProfileModal();
  });

  el.logoutBtn?.addEventListener('click', () => {
    window.localStorage.removeItem('gims_employee_token');
    window.localStorage.removeItem('gims_role');
    window.location.replace('/');
  });

  const sidebarLinks = Array.from(
    document.querySelectorAll('.dashboard-sidebar-link[data-scroll-target]')
  );
  const sidebarSections = sidebarLinks
    .map((link) => document.getElementById(link.getAttribute('data-scroll-target')))
    .filter(Boolean);

  let scrollSpyLocked = 0;
  const setActiveSidebarLink = (targetId) => {
    sidebarLinks.forEach((link) => {
      link.classList.toggle(
        'is-active',
        link.getAttribute('data-scroll-target') === targetId
      );
    });
  };

  const updateActiveSidebarLink = () => {
    if (scrollSpyLocked > Date.now()) return;
    if (!sidebarLinks.length || !sidebarSections.length) return;
    const nearBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 8;
    if (nearBottom) {
      setActiveSidebarLink(sidebarSections[sidebarSections.length - 1].id);
      return;
    }
    const probe = window.innerHeight * 0.3;
    let activeId = sidebarSections[0].id;
    sidebarSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= probe) activeId = section.id;
    });
    setActiveSidebarLink(activeId);
  };

  document.querySelectorAll('[data-scroll-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-scroll-target');
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (btn.classList.contains('dashboard-sidebar-link')) {
        setActiveSidebarLink(targetId);
        scrollSpyLocked = Date.now() + 700;
      }
    });
  });

  if (sidebarLinks.length && sidebarSections.length) {
    window.addEventListener('scroll', updateActiveSidebarLink, { passive: true });
    window.addEventListener('resize', updateActiveSidebarLink, { passive: true });
    updateActiveSidebarLink();
  }

  // ========================
  // CERTIFICATE DOWNLOAD
  // ========================

  const downloadCertificate = async (registrationId) => {
    if (!registrationId) return;
    if (el.attendedCertStatus) el.attendedCertStatus.textContent = 'Preparing download…';
    try {
      const res = await authedFetch(`/api/employee/certificates/${registrationId}/download`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Download failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const fileNameMatch = /filename="?([^";]+)"?/i.exec(disposition);
      const suggestedName = fileNameMatch?.[1] || `GIMS-Certificate-${registrationId}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (el.attendedCertStatus) el.attendedCertStatus.textContent = '';
    } catch (err) {
      console.error('[employee-dashboard] certificate download failed', err);
      if (el.attendedCertStatus) el.attendedCertStatus.textContent = err.message || 'Download failed.';
    }
  };

  // ========================
  // MAIN DASHBOARD LOAD
  // ========================

  const loadDashboard = async () => {
    if (!token) throw new Error('Not authenticated. Please login.');

    const [dashboardRes, meRes, seminarsRes] = await Promise.all([
      authedFetch('/api/employee/dashboard', { method: 'GET' }),
      authedFetch('/api/employee/me', { method: 'GET' }),
      authedFetch('/api/employee/seminars', { method: 'GET' }),
    ]);

    const data = await dashboardRes.json();
    const meData = await meRes.json();
    const seminarsData = await seminarsRes.json();

    if (!dashboardRes.ok) throw new Error(data?.message || 'Failed to load dashboard');
    if (!meRes.ok) throw new Error(meData?.message || 'Failed to load profile');
    if (!seminarsRes.ok) throw new Error(seminarsData?.message || 'Failed to load seminars');

    if (data.profile?.role && data.profile.role !== 'employee') {
      window.localStorage.setItem('gims_role', String(data.profile.role));
      window.location.href = '/admin.html';
      return;
    }
    window.localStorage.setItem('gims_role', 'employee');

    // Topbar + Welcome
    const profile = data.profile || {};
    currentEmployeeId = meData?._id || null;
    const name = profile.name || '';
    if (el.topbarName) el.topbarName.textContent = name;
    if (el.welcomeName) el.welcomeName.textContent = name;
    if (el.topbarEmail) el.topbarEmail.textContent = profile.email || '';
    if (el.topbarId) el.topbarId.textContent = profile.employeeId || '';

    const attendedSeminars = Array.isArray(data.attendedSeminars)
      ? data.attendedSeminars.filter((entry) => entry?.seminar?.id)
      : [];

    // Compliance
    const compliance = data.compliance || {};
    const requiredSeminars = Number(compliance.requiredSeminars || 0);
    const completedSeminars = attendedSeminars.length;
    const progressPercent =
      requiredSeminars === 0 ? 0 : Number(Math.min(100, (completedSeminars / requiredSeminars) * 100).toFixed(1));
    const isCompliant = completedSeminars >= requiredSeminars && requiredSeminars > 0;
    if (el.complianceProgressText) {
      el.complianceProgressText.textContent = `Progress: ${completedSeminars} of ${requiredSeminars} Required Seminars`;
    }
    if (el.complianceProgressPercent) el.complianceProgressPercent.textContent = `${progressPercent}%`;
    if (el.complianceProgressBar) el.complianceProgressBar.style.width = `${progressPercent}%`;

    const todayStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    if (el.complianceUpdatedAt) el.complianceUpdatedAt.textContent = `Status as of ${todayStr}`;

    let stageLabel;
    if (completedSeminars >= 5) stageLabel = 'Compliant';
    else if (completedSeminars >= 3) stageLabel = 'Almost There';
    else stageLabel = 'Pre-register Now';

    const stageIsCompliant = stageLabel === 'Compliant';

    if (stageIsCompliant) {
      if (el.complianceStatusBadge) {
        el.complianceStatusBadge.textContent = stageLabel;
        el.complianceStatusBadge.style.background = 'rgba(16,185,129,0.10)';
        el.complianceStatusBadge.style.color = '#059669';
        el.complianceStatusBadge.style.borderColor = 'rgba(16,185,129,0.25)';
      }
      if (el.complianceAdviceBox) {
        el.complianceAdviceBox.style.borderColor = 'rgba(16,185,129,0.22)';
        el.complianceAdviceBox.style.background = 'rgba(16,185,129,0.08)';
      }
      if (el.complianceAdviceHeader) el.complianceAdviceHeader.textContent = 'Compliant';
      if (el.complianceAdviceText) {
        el.complianceAdviceText.textContent = 'You have successfully completed your required GAD seminars.';
      }
    } else {
      if (el.complianceStatusBadge) {
        el.complianceStatusBadge.textContent = stageLabel;
        el.complianceStatusBadge.style.background = 'rgba(239,68,68,0.10)';
        el.complianceStatusBadge.style.color = '#dc2626';
        el.complianceStatusBadge.style.borderColor = 'rgba(239,68,68,0.25)';
      }
      if (el.complianceAdviceBox) {
        el.complianceAdviceBox.style.borderColor = 'rgba(239,68,68,0.22)';
        el.complianceAdviceBox.style.background = 'rgba(239,68,68,0.08)';
      }
      if (el.complianceAdviceHeader) el.complianceAdviceHeader.textContent = stageLabel;
      if (el.complianceAdviceText) {
        const toAlmost = Math.max(0, 3 - completedSeminars);
        const toCompliant = Math.max(0, 5 - completedSeminars);
        el.complianceAdviceText.textContent =
          stageLabel === 'Pre-register Now'
            ? `Pre-register for ${toAlmost} more seminar(s) to reach "Almost There".`
            : `Complete ${toCompliant} more seminar(s) to become Compliant.`;
      }
    }

    // Profile info
    if (el.infoId) el.infoId.textContent = profile.employeeId || '';
    if (el.infoEmail) el.infoEmail.textContent = profile.email || '';
    if (el.infoDepartment) el.infoDepartment.textContent = profile.department || '';
    if (el.infoPosition) el.infoPosition.textContent = profile.position || '';
    if (el.infoBirthSex) el.infoBirthSex.textContent = profile.birthSex || '';
    if (el.infoGenderIdentity) el.infoGenderIdentity.textContent = profile.genderIdentity || '—';
    if (el.infoMaleCount) el.infoMaleCount.textContent = String(profile.departmentGenderCounts?.male ?? 0);
    if (el.infoFemaleCount) el.infoFemaleCount.textContent = String(profile.departmentGenderCounts?.female ?? 0);
    if (el.infoStatus) el.infoStatus.textContent = profile.accountStatus || 'Active';

    // Store state
    currentSeminars = Array.isArray(seminarsData)
      ? seminarsData.map((s) => ({
          ...s,
          id: s._id || s.id,
          registeredEmployees: Array.isArray(s.registeredEmployees) ? s.registeredEmployees : [],
        }))
      : [];
    currentDashboardData = data;

    // Enrich upcoming seminars with registeredEmployees from full seminar list
    if (Array.isArray(currentDashboardData.upcomingSeminars)) {
      currentDashboardData.upcomingSeminars = currentDashboardData.upcomingSeminars.map((s) => {
        const match = currentSeminars.find((item) => String(item.id) === String(s.id));
        return {
          ...s,
          registeredEmployees: Array.isArray(match?.registeredEmployees) ? match.registeredEmployees : [],
        };
      });
    }

    // Apply current tab filter
    if (el.upcomingStatus) el.upcomingStatus.textContent = '';
    applySeminarFilter();

    // Render attended seminars (cache + current sort / view)
    attendedSeminarsCache = attendedSeminars;
    renderAttendedSeminars(sortAttendedSeminars([...attendedSeminarsCache], attendedSortMode));

    // Load notifications
    loadNotifications();
  };

  let refreshOnVisibleTimer = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (refreshOnVisibleTimer) clearTimeout(refreshOnVisibleTimer);
    refreshOnVisibleTimer = setTimeout(() => {
      refreshOnVisibleTimer = null;
      loadDashboard().catch(() => {});
    }, 400);
  });

  const applyUpcomingViewMode = (mode) => {
    const rail = el.upcomingCarousel;
    if (!rail) return;
    rail.classList.remove('view-swipe', 'view-grid', 'view-list');
    rail.classList.add(`view-${mode}`);
    if (el.upcomingViewSwipe) el.upcomingViewSwipe.classList.toggle('is-active', mode === 'swipe');
    if (el.upcomingViewGrid) el.upcomingViewGrid.classList.toggle('is-active', mode === 'grid');
    if (el.upcomingViewList) el.upcomingViewList.classList.toggle('is-active', mode === 'list');
  };
  el.upcomingViewSwipe?.addEventListener('click', () => applyUpcomingViewMode('swipe'));
  el.upcomingViewGrid?.addEventListener('click', () => applyUpcomingViewMode('grid'));
  el.upcomingViewList?.addEventListener('click', () => applyUpcomingViewMode('list'));

  el.attendedViewSwipe?.addEventListener('click', () => {
    attendedViewMode = 'swipe';
    applyAttendedViewMode();
  });
  el.attendedViewGrid?.addEventListener('click', () => {
    attendedViewMode = 'grid';
    applyAttendedViewMode();
  });
  el.attendedViewList?.addEventListener('click', () => {
    attendedViewMode = 'list';
    applyAttendedViewMode();
  });
  el.attendedSortBtn?.addEventListener('click', openAttendedSortMenu);

  el.attendedPrev?.addEventListener('click', () => {
    if (!el.attendedSeminarsList) return;
    const amount = Math.max(290, el.attendedSeminarsList.clientWidth * 0.9);
    el.attendedSeminarsList.scrollBy({ left: -amount, behavior: 'smooth' });
  });
  el.attendedNext?.addEventListener('click', () => {
    if (!el.attendedSeminarsList) return;
    const amount = Math.max(290, el.attendedSeminarsList.clientWidth * 0.9);
    el.attendedSeminarsList.scrollBy({ left: amount, behavior: 'smooth' });
  });

  // Initial load
  loadDashboard().catch((err) => {
    console.error('[employee-dashboard] loadDashboard failed', err);
    if (String(err?.message || '').toLowerCase().includes('not authenticated')) {
      window.localStorage.removeItem('gims_employee_token');
      window.localStorage.removeItem('gims_role');
      window.location.replace('/');
      return;
    }
    if (el.upcomingStatus) el.upcomingStatus.textContent = err.message || 'Failed to load dashboard.';
  });
});
