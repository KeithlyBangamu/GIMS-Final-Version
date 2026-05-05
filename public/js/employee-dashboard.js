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

    attendedSeminarsList: document.getElementById('attended-seminars-list'),
    attendedCertStatus: document.getElementById('attended-cert-status'),

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
    evalForm: document.getElementById('eval-form'),
    evalStars: document.getElementById('eval-stars'),
    evalRatingInput: document.getElementById('eval-rating'),
    evalFeedback: document.getElementById('eval-feedback'),
    evalRecommend: document.getElementById('eval-recommend'),
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
    return `${hours}:${minutes} ${period}`;
  };

  const formatSeminarDate = (date) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return String(date);
    }
  };

  const truncate = (text, max = 120) => {
    const s = String(text || '');
    if (s.length <= max) return s;
    return s.slice(0, max).trimEnd() + '…';
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
    if (!isOpen) loadNotifications();
  });

  // Mark all read
  el.notifReadAllBtn?.addEventListener('click', async () => {
    try {
      await authedFetch('/api/employee/notifications/read-all', { method: 'PUT' });
      await loadNotifications();
    } catch {}
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
      currentSeminarTab = btn.getAttribute('data-tab') || 'open';
      applySeminarFilter();
    });
  });

  const applySeminarFilter = () => {
    if (!currentDashboardData) return;

    if (currentSeminarTab === 'pre-registered') {
      // Show pre-registered seminars
      const preReg = Array.isArray(currentDashboardData.preRegistered) ? currentDashboardData.preRegistered : [];
      renderPreRegistered(preReg);
      return;
    }

    const allSeminars = Array.isArray(currentDashboardData.upcomingSeminars) ? currentDashboardData.upcomingSeminars : [];

    // Get IDs of seminars already registered in any status
    const allRegIds = new Set();
    const allRegs = [...(currentDashboardData.preRegistered || []), ...(currentDashboardData.attendedSeminars || [])];
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
    } else {
      if (el.upcomingStatus) el.upcomingStatus.textContent = '';
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
          const mandatoryLabel = s.mandatory ? 'Mandatory' : 'Optional';
          const shortDesc = truncate(s.description, 110);
          const capacity = Number(s.capacity || 0);
          const remaining = Number(s.remainingCapacity || 0);
          const joined = Math.max(0, capacity - remaining);
          const sessionId = String(sess._id || sess.id || '');
          const dayLabel = `Day ${idx + 1} of ${s.sessions.length}`;

          cards.push(`
            <div class="card seminar-card" style="box-shadow:none; padding: 1rem; min-width: 290px; flex: 0 0 290px; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="display:flex; align-items:flex-start; gap: 0.8rem;">
                <div style="width:36px; height:36px; border-radius:10px; background: rgba(32,58,115,0.12); display:flex; align-items:center; justify-content:center; color: var(--xu-blue);">
                  <i class="fa-solid fa-chalkboard-user"></i>
                </div>
                <div style="flex:1;">
                  <div style="font-weight:600; color: var(--xu-blue);">${escapeHtml(s.title)}</div>
                  <div class="muted small" style="margin-top:0.2rem; font-size:0.83rem; font-weight:600; color:var(--text);">
                    ${escapeHtml(formatSeminarDate(sess.date))} &bull; ${escapeHtml(formatTime(sess.startTime))}
                  </div>
                  <div class="muted small" style="font-size:0.78rem; margin-top:0.1rem; opacity:0.72;">
                    <i class="fa-solid fa-calendar-days" style="margin-right:0.25rem;"></i>Series: ${escapeHtml(seriesRange)}
                  </div>
                </div>
              </div>

              <div class="muted" style="margin-top: 0.7rem; font-size:0.92rem; line-height:1.4;">
                ${escapeHtml(shortDesc)}
              </div>

              <div style="margin-top: 0.75rem; display:flex; justify-content: space-between; align-items:center; gap: 0.75rem;">
                <div style="display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center;">
                  <div class="badge badge-soft" style="background: rgba(32,58,115,0.08); color: var(--xu-blue); border-color: rgba(32,58,115,0.18);">
                    ${escapeHtml(mandatoryLabel)}
                  </div>
                  <div class="badge badge-soft" style="background:rgba(79,70,229,0.08); color:#4338ca; border-color:rgba(79,70,229,0.2);">
                    ${escapeHtml(dayLabel)}
                  </div>
                </div>
                <div class="muted small" style="font-size:0.82rem;">
                  Slots: ${escapeHtml(String(joined))}/${escapeHtml(String(capacity))}
                </div>
              </div>

              <button class="btn pre-register-btn" style="margin-top: 0.9rem; width: 100%;"
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
        const shortDesc = truncate(s.description, 110);
        const capacity = Number(s.capacity || 0);
        const remaining = Number(s.remainingCapacity || 0);
        const joined = Math.max(0, capacity - remaining);
        const isAll = s.multiSessionType === 'all';
        const allHasMulti = Array.isArray(s.sessions) && s.sessions.length > 1;

        let dateDisplay = `${escapeHtml(formatSeminarDate(s.date))} &bull; ${escapeHtml(formatTime(s.startTime))}`;
        let seriesLine = '';
        let multiDayBadge = '';
        if (isAll && allHasMulti) {
          const first = formatSeminarDate(s.sessions[0].date);
          const last = formatSeminarDate(s.sessions[s.sessions.length - 1].date);
          dateDisplay = `${escapeHtml(first)} – ${escapeHtml(last)}`;
          seriesLine = `<div class="muted small" style="font-size:0.78rem; margin-top:0.1rem; opacity:0.72;">All ${s.sessions.length} sessions required &bull; starts ${escapeHtml(formatTime(s.sessions[0].startTime))}</div>`;
          multiDayBadge = `<div class="badge badge-soft" style="background:rgba(79,70,229,0.08); color:#4338ca; border-color:rgba(79,70,229,0.2);">Multi-Day</div>`;
        }

        cards.push(`
          <div class="card seminar-card" style="box-shadow:none; padding: 1rem; min-width: 290px; flex: 0 0 290px; display:flex; flex-direction:column; justify-content:space-between;">
            <div style="display:flex; align-items:flex-start; gap: 0.8rem;">
              <div style="width:36px; height:36px; border-radius:10px; background: rgba(32,58,115,0.12); display:flex; align-items:center; justify-content:center; color: var(--xu-blue);">
                <i class="fa-solid fa-chalkboard-user"></i>
              </div>
              <div style="flex:1;">
                <div style="font-weight:600; color: var(--xu-blue);">${escapeHtml(s.title)}</div>
                <div class="muted small" style="margin-top:0.2rem; font-size:0.83rem;">${dateDisplay}</div>
                ${seriesLine}
              </div>
            </div>

            <div class="muted" style="margin-top: 0.7rem; font-size:0.92rem; line-height:1.4;">
              ${escapeHtml(shortDesc)}
            </div>

            <div style="margin-top: 0.75rem; display:flex; justify-content: space-between; align-items:center; gap: 0.75rem;">
              <div style="display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center;">
                <div class="badge badge-soft" style="background: rgba(32,58,115,0.08); color: var(--xu-blue); border-color: rgba(32,58,115,0.18);">
                  ${escapeHtml(mandatoryLabel)}
                </div>
                ${multiDayBadge}
              </div>
              <div class="muted small" style="font-size:0.82rem;">
                Slots: ${escapeHtml(String(joined))}/${escapeHtml(String(capacity))}
              </div>
            </div>

            <button class="btn pre-register-btn" style="margin-top: 0.9rem; width: 100%;" data-join-id="${escapeHtml(s.id)}" type="button">
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
  };

  // ========================
  // RENDER PRE-REGISTERED SEMINARS
  // ========================

  const renderPreRegistered = (preRegistered) => {
    if (!el.upcomingCarousel) return;
    el.upcomingCarousel.innerHTML = '';

    if (!Array.isArray(preRegistered) || preRegistered.length === 0) {
      el.upcomingCarousel.innerHTML = `<p class="muted">You have no pre-registered seminars awaiting approval.</p>`;
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
  // RENDER ATTENDED SEMINARS
  // ========================

  const getMaterialFileIcon = (fileURL) => {
    const ext = String(fileURL || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (ext === 'ppt' || ext === 'pptx') return 'PPT';
    return 'FILE';
  };

  const renderAttendedSeminars = (attendedSeminars) => {
    if (!el.attendedSeminarsList) return;
    if (!Array.isArray(attendedSeminars) || attendedSeminars.length === 0) {
      el.attendedSeminarsList.innerHTML = '<p class="muted">No attended seminars yet.</p>';
      return;
    }

    el.attendedSeminarsList.innerHTML = attendedSeminars
      .map((r) => {
        const s = r.seminar;
        const canDownloadCert = r.certificateIssued;
        const canEval = r.evaluationAvailable && !r.evaluationCompleted;
        const evalDone = r.evaluationCompleted;

        return `
          <article class="joined-seminar-card" style="border-color: rgba(32,58,115,0.2);">
            <div class="joined-seminar-head">
              <span class="badge badge-soft badge-attended">Attended</span>
              <span class="joined-seminar-date">${escapeHtml(formatSeminarDate(s.date))} • ${escapeHtml(formatTime(s.startTime))}</span>
            </div>
            <h3 class="joined-seminar-title">${escapeHtml(s.title || '')}</h3>
            <p class="muted small joined-seminar-description">${escapeHtml(truncate(s.description || '', 110))}</p>
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
            if (listEl) listEl.innerHTML = `<span>${escapeHtml(err.message || 'Failed to load materials.')}</span>`;
            loaded = false;
          }
        }
      });
    });
  };

  // ========================
  // EVALUATION MODAL
  // ========================

  let currentEvalRating = 0;

  const updateStars = (rating) => {
    if (!el.evalStars) return;
    el.evalStars.querySelectorAll('.eval-star-btn').forEach((btn) => {
      const star = Number(btn.getAttribute('data-star'));
      btn.style.color = star <= rating ? '#f59e0b' : '#d1d5db';
    });
    if (el.evalRatingInput) el.evalRatingInput.value = String(rating);
    currentEvalRating = rating;
  };

  el.evalStars?.querySelectorAll('.eval-star-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const star = Number(btn.getAttribute('data-star'));
      updateStars(star);
    });
    btn.addEventListener('mouseenter', () => {
      const star = Number(btn.getAttribute('data-star'));
      el.evalStars.querySelectorAll('.eval-star-btn').forEach((b) => {
        b.style.color = Number(b.getAttribute('data-star')) <= star ? '#f59e0b' : '#d1d5db';
      });
    });
    btn.addEventListener('mouseleave', () => {
      updateStars(currentEvalRating);
    });
  });

  const openEvalModal = (registrationId, seminarName) => {
    currentEvalRegistrationId = registrationId;
    currentEvalRating = 0;
    updateStars(0);
    if (el.evalFeedback) el.evalFeedback.value = '';
    if (el.evalRecommend) el.evalRecommend.checked = true;
    if (el.evalModalStatus) el.evalModalStatus.textContent = '';
    if (el.evalSeminarName) el.evalSeminarName.textContent = seminarName || '';
    if (el.evalBackdrop) el.evalBackdrop.style.display = 'flex';
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
    if (!currentEvalRegistrationId) return;
    if (!currentEvalRating) {
      if (el.evalModalStatus) el.evalModalStatus.textContent = 'Please select a rating.';
      return;
    }

    if (el.evalSubmitBtn) el.evalSubmitBtn.disabled = true;
    if (el.evalModalStatus) el.evalModalStatus.textContent = 'Submitting…';

    try {
      const res = await authedFetch(`/api/employee/registrations/${currentEvalRegistrationId}/evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: currentEvalRating,
          feedback: el.evalFeedback?.value || '',
          wouldRecommend: el.evalRecommend?.checked !== false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to submit evaluation');
      if (el.evalModalStatus) el.evalModalStatus.textContent = 'Evaluation submitted successfully!';
      setTimeout(() => {
        closeEvalModal();
        loadDashboard();
      }, 1500);
    } catch (err) {
      if (el.evalModalStatus) el.evalModalStatus.textContent = err.message || 'Submission failed.';
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

    if (isCompliant) {
      if (el.complianceStatusBadge) {
        el.complianceStatusBadge.textContent = 'Compliant';
        el.complianceStatusBadge.style.background = 'rgba(16,185,129,0.10)';
        el.complianceStatusBadge.style.color = '#059669';
        el.complianceStatusBadge.style.borderColor = 'rgba(16,185,129,0.25)';
      }
      if (el.complianceAdviceBox) {
        el.complianceAdviceBox.style.borderColor = 'rgba(16,185,129,0.22)';
        el.complianceAdviceBox.style.background = 'rgba(16,185,129,0.08)';
      }
      if (el.complianceAdviceHeader) el.complianceAdviceHeader.textContent = 'All Requirements Completed!';
      if (el.complianceAdviceText) {
        el.complianceAdviceText.textContent = 'You have successfully completed all required GAD seminars.';
      }
    } else {
      if (el.complianceStatusBadge) {
        el.complianceStatusBadge.textContent = 'Incomplete';
        el.complianceStatusBadge.style.background = 'rgba(239,68,68,0.10)';
        el.complianceStatusBadge.style.color = '#dc2626';
        el.complianceStatusBadge.style.borderColor = 'rgba(239,68,68,0.25)';
      }
      if (el.complianceAdviceBox) {
        el.complianceAdviceBox.style.borderColor = 'rgba(239,68,68,0.22)';
        el.complianceAdviceBox.style.background = 'rgba(239,68,68,0.08)';
      }
      if (el.complianceAdviceHeader) el.complianceAdviceHeader.textContent = 'You Are Almost There';
      if (el.complianceAdviceText) {
        const remaining = requiredSeminars - completedSeminars;
        el.complianceAdviceText.textContent =
          remaining > 0
            ? `You still need ${remaining} seminar(s) to complete your requirement.`
            : 'Keep going—your progress will be updated soon.';
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

    // Render attended seminars
    renderAttendedSeminars(attendedSeminars);

    // Load notifications
    loadNotifications();
  };

  // Initial load
  loadDashboard().catch((err) => {
    if (String(err?.message || '').toLowerCase().includes('not authenticated')) {
      window.localStorage.removeItem('gims_employee_token');
      window.localStorage.removeItem('gims_role');
      window.location.replace('/');
      return;
    }
    if (el.upcomingStatus) el.upcomingStatus.textContent = err.message || 'Failed to load dashboard.';
  });
});
