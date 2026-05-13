window.addEventListener('error', (event) => {
  console.error('[admin] uncaught error', event.error || event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[admin] unhandled promise rejection', event.reason);
});

const _EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.innerHTML = _EYE;
    btn.addEventListener('click', () => {
      const input = btn.closest('.password-field').querySelector('input');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? _EYE : _EYE_OFF;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  let adminToken = window.localStorage.getItem('gims_employee_token') || null;

  const decodeJwtPayload = (jwtToken) => {
    try {
      const parts = String(jwtToken || '').split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (base64.length % 4)) % 4);
      const json = atob(base64 + pad);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const isAdminTokenValid = (jwtToken) => {
    const data = decodeJwtPayload(jwtToken);
    if (!data || data.role !== 'admin') return false;
    if (data.exp && Date.now() / 1000 > data.exp) return false;
    return true;
  };

  const redirectToHome = () => {
    window.localStorage.removeItem('gims_employee_token');
    window.localStorage.removeItem('gims_role');
    window.location.replace('/');
  };

  if (!isAdminTokenValid(adminToken)) {
    redirectToHome();
    return;
  }

  // Re-validate when the page is shown from the bfcache (Back/Forward nav).
  window.addEventListener('pageshow', (event) => {
    const stored = window.localStorage.getItem('gims_employee_token');
    if (event.persisted || stored !== adminToken) {
      adminToken = stored;
      if (!isAdminTokenValid(adminToken)) redirectToHome();
    }
  });

  const logoutBtn = document.getElementById('admin-logout-btn');
  const createAdminForm = document.getElementById('admin-create-admin-form');
  const createAdminStatusEl = document.getElementById('admin-create-admin-status');
  const createSeminarForm = document.getElementById('admin-create-seminar-form');
  const createSeminarStatusEl = document.getElementById('admin-create-seminar-status');
  const createSeminarClearBtn = document.getElementById('admin-create-seminar-clear-btn');
  const createSeminarModalEl = document.getElementById('admin-create-seminar-modal');
  const createSeminarCloseBtn = document.getElementById('admin-create-seminar-close');
  const createSeminarDateInput = createSeminarForm?.querySelector('input[name="date"]');
  const dashboardWrapperEl = document.getElementById('admin-dashboard-wrapper');
  const seminarsSectionEl = document.getElementById('admin-seminars-section');
  const createAdminSectionEl = document.getElementById('admin-create-admin-section');
  const moduleHintEl = document.getElementById('admin-module-hint');
  const sidebarNavButtons = Array.from(document.querySelectorAll('.dashboard-sidebar-link[data-nav]'));
  const seminarsCarouselEl = document.getElementById('admin-seminars-carousel');
  const seminarsStatusEl = document.getElementById('admin-seminars-status');
  const seminarsFilterStatusEl = document.getElementById('admin-seminars-filter-status');
  const seminarsSearchEl = document.getElementById('admin-seminars-search');
  const seminarsMonthFilterEl = document.getElementById('admin-seminars-month-filter');
  const seminarsYearFilterEl = document.getElementById('admin-seminars-year-filter');
  const seminarsClearFiltersBtn = document.getElementById('admin-seminars-clear-filters');
  const seminarsViewSortWrapEl = document.getElementById('admin-seminars-view-sort');
  const seminarsViewSwipeBtn = document.getElementById('admin-seminars-view-swipe');
  const seminarsViewGridBtn = document.getElementById('admin-seminars-view-grid');
  const seminarsViewListBtn = document.getElementById('admin-seminars-view-list');
  const seminarsSortBtn = document.getElementById('admin-seminars-sort-btn');
  const toggleDeletedSeminarsBtn = document.getElementById('admin-toggle-deleted-seminars-btn');
  const deletedSeminarsModalEl = document.getElementById('admin-deleted-seminars-modal');
  const deletedSeminarsCloseBtn = document.getElementById('admin-deleted-seminars-close');
  const seminarsPrevBtn = document.getElementById('admin-seminars-prev-btn');
  const seminarsNextBtn = document.getElementById('admin-seminars-next-btn');
  const seminarEditModalEl = document.getElementById('admin-seminar-edit-modal');
  const seminarEditForm = document.getElementById('admin-seminar-edit-form');
  const seminarEditCloseBtn = document.getElementById('admin-seminar-edit-close');
  const seminarEditCancelBtn = document.getElementById('admin-seminar-edit-cancel');
  const seminarEditStatusEl = document.getElementById('admin-seminar-edit-status');
  const seminarParticipantsModalEl = document.getElementById('admin-seminar-participants-modal');
  const seminarParticipantsCloseBtn = document.getElementById('admin-seminar-participants-close');
  const seminarParticipantsMetaEl = document.getElementById('admin-seminar-participants-meta');
  const seminarParticipantsListEl = document.getElementById('admin-seminar-participants-list');
  const seminarParticipantsStatusEl = document.getElementById('admin-seminar-participants-status');
  const seminarHeldBtn = document.getElementById('admin-seminar-held-btn');
  const markAttendanceBtn = document.getElementById('admin-mark-attendance-btn');
  const sendCertificatesBtn = document.getElementById('admin-send-certificates-btn');
  const attendanceSelectAllEl = document.getElementById('admin-attendance-select-all');
  const employeeModalEl = document.getElementById('admin-employee-modal');
  const employeeModalCloseBtn = document.getElementById('admin-employee-modal-close');
  const profileNameEl = document.getElementById('admin-employee-profile-name');
  const profileIdEl = document.getElementById('admin-employee-profile-id');
  const profileEmailEl = document.getElementById('admin-employee-profile-email');
  const profileDepartmentEl = document.getElementById('admin-employee-profile-department');
  const profilePositionEl = document.getElementById('admin-employee-profile-position');
  const profileRegisteredEl = document.getElementById('admin-employee-profile-registered');
  const profileStatusEl = document.getElementById('admin-employee-profile-status');
  const profileReservedCountEl = document.getElementById('admin-employee-profile-reserved-count');
  const profileTakenCountEl = document.getElementById('admin-employee-profile-taken-count');
  const profileReservedListEl = document.getElementById('admin-employee-profile-reserved-list');
  const profileTakenListEl = document.getElementById('admin-employee-profile-taken-list');
  const profileCertificatesCountEl = document.getElementById('admin-employee-profile-certificates-count');
  const profileCertificatesListEl = document.getElementById('admin-employee-profile-certificates-list');
  const profileModalStatusEl = document.getElementById('admin-employee-profile-modal-status');
  const totalEmployeesEl = document.getElementById('admin-total-employees');
  const completionRateEl = document.getElementById('admin-completion-rate');
  const compliantEmployeesEl = document.getElementById('admin-compliant-employees');
  const selectModeEl = document.getElementById('admin-select-mode');
  const employeeSearchEl = document.getElementById('admin-employee-search');
  const departmentFilterEl = document.getElementById('admin-department-filter');
  const clusterFilterEl = document.getElementById('admin-cluster-filter');

  const setupCombobox = (rootId, { onChange }) => {
    const root = document.getElementById(rootId);
    if (!root) return null;
    const search = root.querySelector('.combobox-search');
    const panel = root.querySelector('.combobox-panel');
    const clearBtn = root.querySelector('.combobox-clear');
    const hidden = root.querySelector('input[type="hidden"]');
    let options = [];
    let activeIndex = -1;

    const close = () => {
      root.classList.remove('is-open');
      activeIndex = -1;
    };
    const open = () => {
      root.classList.add('is-open');
      render();
    };
    const render = () => {
      const q = search.value.trim().toLowerCase();
      const filtered = q
        ? options.filter((o) => o.label.toLowerCase().includes(q))
        : options;
      if (!filtered.length) {
        panel.innerHTML = '<div class="combobox-empty">No matches</div>';
        return;
      }
      panel.innerHTML = filtered
        .map((o, i) => {
          const sel = o.value === hidden.value ? ' is-selected' : '';
          const act = i === activeIndex ? ' is-active' : '';
          return `<div class="combobox-option${sel}${act}" role="option" data-value="${o.value.replace(/"/g, '&quot;')}">${o.label.replace(/</g, '&lt;')}</div>`;
        })
        .join('');
      panel.querySelectorAll('.combobox-option').forEach((el) => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          select(el.getAttribute('data-value') || '');
        });
      });
    };
    const select = (value) => {
      hidden.value = value;
      const match = options.find((o) => o.value === value);
      search.value = match ? match.label : '';
      root.classList.toggle('has-value', Boolean(value));
      close();
      onChange?.(value);
    };

    search.addEventListener('focus', () => {
      search.value = '';
      activeIndex = -1;
      open();
    });
    search.addEventListener('input', () => {
      activeIndex = -1;
      open();
    });
    search.addEventListener('keydown', (e) => {
      const visible = panel.querySelectorAll('.combobox-option');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!root.classList.contains('is-open')) open();
        activeIndex = Math.min(activeIndex + 1, visible.length - 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = visible[activeIndex] || visible[0];
        if (target) select(target.getAttribute('data-value') || '');
      } else if (e.key === 'Escape') {
        close();
      }
    });
    search.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!root.contains(document.activeElement)) close();
        const match = options.find((o) => o.value === hidden.value);
        if (match) search.value = match.label;
        else if (!hidden.value) search.value = '';
      }, 120);
    });
    clearBtn?.addEventListener('click', () => {
      select('');
      search.focus();
    });
    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) close();
    });

    return {
      setOptions(next) {
        options = next.slice();
        const current = hidden.value;
        if (current && !options.some((o) => o.value === current)) {
          select('');
        } else {
          const match = options.find((o) => o.value === current);
          if (match && document.activeElement !== search) search.value = match.label;
        }
        if (root.classList.contains('is-open')) render();
      },
      get value() { return hidden.value; },
      set value(v) { select(v); },
    };
  };

  const buildOptions = (values, allLabel) =>
    [{ value: '', label: allLabel }].concat(
      values.map((v) => ({ value: v, label: v }))
    );

  const clusterCombo = setupCombobox('admin-cluster-combobox', {
    onChange: async () => {
      populateDepartmentFilter();
      await loadDepartmentsAndEmployees();
    },
  });
  const departmentCombo = setupCombobox('admin-department-combobox', {
    onChange: async () => {
      await loadDepartmentsAndEmployees();
    },
  });

  const populateClusterFilter = () => {
    if (!clusterCombo || !Array.isArray(window.XU_CLUSTERS)) return;
    clusterCombo.setOptions(buildOptions(window.XU_CLUSTERS, 'All clusters'));
  };

  const populateDepartmentFilter = (extraDepartments = []) => {
    if (!departmentCombo || !window.XU_DEPARTMENTS) return;
    const cluster = clusterFilterEl?.value || '';
    const baseList = cluster ? (window.XU_DEPARTMENTS[cluster] || []) : window.XU_ALL_DEPARTMENTS;
    const extras = extraDepartments.filter(
      (d) => d && !baseList.includes(d) && (!cluster || window.XU_DEPARTMENT_TO_CLUSTER[d] === cluster)
    );
    const merged = [...baseList, ...extras].sort((a, b) => a.localeCompare(b));
    departmentCombo.setOptions(buildOptions(merged, 'All departments'));
  };

  const accountStatusFilterEl = document.getElementById('admin-account-status-filter');
  const notifyBtn = document.getElementById('admin-notify-btn');
  const exportBtn = document.getElementById('admin-export-btn');
  const employeesStatusEl = document.getElementById('admin-employees-status');
  const employeesTableEl = document.getElementById('admin-employees-table');
  const deletedSeminarsListEl = document.getElementById('admin-deleted-seminars-list');
  const deletedSeminarsStatusEl = document.getElementById('admin-deleted-seminars-status');
  const adminProfileTriggerBtn = document.getElementById('admin-profile-trigger');
  const adminOwnProfileModalEl = document.getElementById('admin-own-profile-modal');
  const adminOwnProfileCloseBtn = document.getElementById('admin-own-profile-close');
  const adminOwnProfileNameEl = document.getElementById('admin-own-profile-name');
  const adminOwnProfileEmailEl = document.getElementById('admin-own-profile-email');
  const adminOwnProfileIdEl = document.getElementById('admin-own-profile-id');

  // Pre-registration elements
  const preRegListEl = document.getElementById('admin-pre-reg-list');
  const preRegStatusEl = document.getElementById('admin-pre-reg-status');
  const approveSelectedBtn = document.getElementById('admin-approve-selected-btn');
  const preRegSelectAllEl = document.getElementById('admin-pre-reg-select-all');

  // Materials tab elements
  const seminarMaterialsFormEl = document.getElementById('admin-seminar-materials-form');
  const materialTitleEl = document.getElementById('admin-material-title');
  const materialFileEl = document.getElementById('admin-material-file');
  const materialsUploadStatusEl = document.getElementById('admin-materials-upload-status');
  const seminarMaterialsListEl = document.getElementById('admin-seminar-materials-list');

  // Report tab elements
  const seminarReportContentEl = document.getElementById('admin-seminar-report-content');
  let seminarReportChartInstance = null;

  let currentSeminars = [];
  let seminarFilters = {
    query: '',
    month: '',
    year: '',
  };
  let seminarViewMode = 'swipe';
  let seminarSortMode = 'date-asc';
  let seminarsSortMenuEl = null;
  let seminarsSortMenuCloseHandler = null;
  let deletedSeminars = [];
  let isDeletedSeminarsModalOpen = false;
  let accountStatusMenuEl = null;
  let employeeSearchDebounceId = null;
  let attendanceModalState = {
    seminarId: null,
    isHeld: false,
    rows: [],
    attendanceSaved: false,
    currentTab: 'pre-registered',
  };

  const authedFetch = async (url, options = {}) => {
    const headers = options.headers || {};
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        Authorization: `Bearer ${adminToken}`,
      },
    });
  };

  const getTodayDateInputValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (value) => {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
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

  /** Multi-day seminar: list each session date & time (Manage Seminars cards). */
  const buildAdminSessionsScheduleBlock = (sessions, opts = {}) => {
    if (!Array.isArray(sessions) || sessions.length <= 1) return '';
    const label = opts.label || 'All sessions';
    const items = sessions.map((sess, idx) => {
      const line = `Day ${idx + 1}: ${formatDate(sess.date)} • ${formatTime(sess.startTime)}`;
      return `<div class="muted small" style="font-size:0.68rem; margin-top:0.14rem; line-height:1.25; letter-spacing:-0.01em; opacity:0.92;">${escapeHtml(line)}</div>`;
    });
    return `
      <div style="margin-top:0.35rem; padding-top:0.4rem; border-top:1px solid rgba(15,23,42,0.08);">
        <div class="muted small" style="font-size:0.65rem; font-weight:600; letter-spacing:0.015em; opacity:0.85;">${escapeHtml(label)}</div>
        ${items.join('')}
      </div>`;
  };

  const parseTimeToMinutes = (value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const sortSeminarsNearestToFarthest = (seminars) => {
    return [...seminars].sort((a, b) => {
      const aDate = new Date(a.date || 0);
      const bDate = new Date(b.date || 0);
      const dateDiff = aDate.getTime() - bDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
    });
  };

  const getSeminarCreatedMs = (seminar) => {
    const createdAtMs = new Date(seminar?.createdAt || seminar?.created_at || 0).getTime();
    if (!Number.isNaN(createdAtMs) && createdAtMs > 0) return createdAtMs;

    const id = String(seminar?._id || '');
    // Mongo ObjectId's first 8 hex chars represent timestamp seconds.
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      return Number.parseInt(id.slice(0, 8), 16) * 1000;
    }
    return 0;
  };

  const sortSeminarsByMode = (seminars, mode) => {
    const list = Array.isArray(seminars) ? [...seminars] : [];
    const normalized = String(mode || 'date-asc').toLowerCase();
    if (normalized === 'recently-added') {
      return list.sort((a, b) => getSeminarCreatedMs(b) - getSeminarCreatedMs(a));
    }
    if (normalized === 'date-desc') return sortSeminarsNearestToFarthest(list).reverse();
    if (normalized === 'name-asc') {
      return list.sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), undefined, { sensitivity: 'base' }));
    }
    if (normalized === 'name-desc') {
      return list
        .sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), undefined, { sensitivity: 'base' }))
        .reverse();
    }
    return sortSeminarsNearestToFarthest(list);
  };

  const applySeminarsViewMode = () => {
    if (seminarsViewSwipeBtn) seminarsViewSwipeBtn.classList.toggle('is-active', seminarViewMode === 'swipe');
    if (seminarsViewGridBtn) seminarsViewGridBtn.classList.toggle('is-active', seminarViewMode === 'grid');
    if (seminarsViewListBtn) seminarsViewListBtn.classList.toggle('is-active', seminarViewMode === 'list');

    if (!seminarsCarouselEl) return;
    const cards = Array.from(seminarsCarouselEl.querySelectorAll('article.card'));

    if (seminarViewMode === 'swipe') {
      seminarsCarouselEl.style.display = 'flex';
      seminarsCarouselEl.style.flexDirection = 'row';
      seminarsCarouselEl.style.gap = '1rem';
      seminarsCarouselEl.style.overflowX = 'auto';
      seminarsCarouselEl.style.scrollBehavior = 'smooth';
      seminarsCarouselEl.style.padding = '0.4rem 2.3rem';
      seminarsCarouselEl.style.gridTemplateColumns = '';
      cards.forEach((card) => {
        card.style.minWidth = '320px';
        card.style.flex = '0 0 320px';
      });
      if (seminarsPrevBtn) seminarsPrevBtn.style.display = '';
      if (seminarsNextBtn) seminarsNextBtn.style.display = '';
      return;
    }

    if (seminarViewMode === 'list') {
      seminarsCarouselEl.style.display = 'flex';
      seminarsCarouselEl.style.flexDirection = 'column';
      seminarsCarouselEl.style.gap = '0.75rem';
      seminarsCarouselEl.style.overflowX = 'visible';
      seminarsCarouselEl.style.padding = '0';
      seminarsCarouselEl.style.scrollBehavior = 'auto';
      seminarsCarouselEl.style.gridTemplateColumns = '';
      cards.forEach((card) => {
        card.style.minWidth = 'auto';
        card.style.flex = '1 1 auto';
      });
    } else {
      seminarsCarouselEl.style.display = 'grid';
      seminarsCarouselEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
      seminarsCarouselEl.style.gap = '1rem';
      seminarsCarouselEl.style.overflowX = 'visible';
      seminarsCarouselEl.style.padding = '0';
      seminarsCarouselEl.style.scrollBehavior = 'auto';
      cards.forEach((card) => {
        card.style.minWidth = 'auto';
        card.style.flex = '1 1 auto';
      });
    }

    if (seminarsPrevBtn) seminarsPrevBtn.style.display = 'none';
    if (seminarsNextBtn) seminarsNextBtn.style.display = 'none';
  };

  const closeSeminarsSortMenu = () => {
    if (seminarsSortMenuEl) seminarsSortMenuEl.remove();
    seminarsSortMenuEl = null;
    if (seminarsSortMenuCloseHandler) {
      window.removeEventListener('pointerdown', seminarsSortMenuCloseHandler, true);
      seminarsSortMenuCloseHandler = null;
    }
  };

  const openSeminarsSortMenu = (event) => {
    if (!seminarsSortBtn) return;
    event.preventDefault();
    event.stopPropagation();
    closeSeminarsSortMenu();

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
      btn.style.background = opt.id === seminarSortMode ? 'rgba(32,58,115,0.08)' : '#fff';
      btn.textContent = opt.id === seminarSortMode ? `✓ ${opt.label}` : opt.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        seminarSortMode = opt.id;
        closeSeminarsSortMenu();
        applySeminarFilters();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const btnRect = seminarsSortBtn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const left = Math.min(btnRect.right - menuRect.width, window.innerWidth - menuRect.width - 10);
    const top = Math.min(btnRect.bottom + 8, window.innerHeight - menuRect.height - 10);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    seminarsSortMenuEl = menu;
    seminarsSortMenuCloseHandler = (e) => {
      if (!seminarsSortMenuEl) return;
      const target = e.target;
      if (seminarsSortMenuEl.contains(target)) return;
      if (seminarsSortBtn && seminarsSortBtn.contains(target)) return;
      closeSeminarsSortMenu();
    };
    window.addEventListener('pointerdown', seminarsSortMenuCloseHandler, true);
  };

  const escapeHtml = (str) => {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const normalizeAccountStatus = (value) => {
    return String(value || '').toLowerCase() === 'deactivated' ? 'deactivated' : 'active';
  };

  const formatRegisteredDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const getAccountStatusBadge = (value) => {
    const normalized = normalizeAccountStatus(value);
    if (normalized === 'deactivated') {
      return '<span class="badge badge-red">Deactivated</span>';
    }
    return '<span class="badge badge-green">Active</span>';
  };

  const getRetentionDaysLeftText = (value) => {
    if (!value) return 'Unknown retention';
    const now = Date.now();
    const target = new Date(value).getTime();
    if (Number.isNaN(target)) return 'Unknown retention';
    const diffMs = Math.max(0, target - now);
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (days <= 1) return 'Deletes in less than 1 day';
    return `Deletes in ${days} days`;
  };

  const setDeletedSeminarsModalVisibility = (isOpen) => {
    isDeletedSeminarsModalOpen = Boolean(isOpen);
    if (deletedSeminarsModalEl) {
      deletedSeminarsModalEl.style.display = isDeletedSeminarsModalOpen ? 'flex' : 'none';
    }
    if (toggleDeletedSeminarsBtn) {
      toggleDeletedSeminarsBtn.setAttribute('aria-expanded', isDeletedSeminarsModalOpen ? 'true' : 'false');
    }
  };

  const closeDeletedSeminarsModal = () => {
    setDeletedSeminarsModalVisibility(false);
  };

  const closeAccountStatusMenu = () => {
    if (!accountStatusMenuEl) return;
    accountStatusMenuEl.remove();
    accountStatusMenuEl = null;
  };

  const updateEmployeeAccountStatus = async (row, targetStatus) => {
    try {
      const res = await authedFetch(`/api/admin/employees/${row.id}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountStatus: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to update account status');
      if (employeesStatusEl) employeesStatusEl.textContent = data?.message || 'Account status updated.';
      await loadSummary();
      await loadDepartmentsAndEmployees();
    } catch (err) {
      console.error('[admin] update account status failed', err);
      if (employeesStatusEl) employeesStatusEl.textContent = err.message || 'Failed to update account status.';
    }
  };

  const openAccountStatusMenu = (event, row) => {
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    closeAccountStatusMenu();

    const isCurrentlyDeactivated = normalizeAccountStatus(row.accountStatus) === 'deactivated';
    const targetStatus = isCurrentlyDeactivated ? 'active' : 'deactivated';
    const actionLabel = isCurrentlyDeactivated ? 'Reactivate Account' : 'Deactivate Account';

    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.zIndex = '1200';
    menu.style.background = '#fff';
    menu.style.border = '1px solid var(--border)';
    menu.style.borderRadius = '0.55rem';
    menu.style.boxShadow = '0 10px 30px rgba(15,23,42,0.16)';
    menu.style.padding = '0.35rem';
    menu.style.minWidth = '190px';
    menu.style.maxWidth = '240px';

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn secondary';
    actionBtn.style.width = '100%';
    actionBtn.style.textAlign = 'left';
    actionBtn.style.display = 'block';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAccountStatusMenu();
      await updateEmployeeAccountStatus(row, targetStatus);
    });

    menu.appendChild(actionBtn);
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    const left = Math.min(event.clientX, window.innerWidth - rect.width - 10);
    const top = Math.min(event.clientY, window.innerHeight - rect.height - 10);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;

    accountStatusMenuEl = menu;
  };

  // ========================
  // MULTI-SESSION CALENDAR
  // ========================

  const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayYMD = toYMD(new Date());

  const calState = {
    create: { year: new Date().getFullYear(), month: new Date().getMonth(), sessions: new Map() },
    edit:   { year: new Date().getFullYear(), month: new Date().getMonth(), sessions: new Map() },
  };

  const renderCalendar = (mode) => {
    const state = calState[mode];
    const el = document.getElementById(`${mode}-session-calendar`);
    if (!el) return;

    const { year, month, sessions } = state;
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const labelCells = CAL_DAYS.map((d) => `<div class="session-cal-day-label">${d}</div>`).join('');
    const cells = [];

    for (let i = 0; i < firstDow; i++) {
      cells.push(`<button type="button" class="session-cal-day is-other-month" disabled>${prevMonthDays - firstDow + i + 1}</button>`);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateStr < todayYMD;
      const isToday = dateStr === todayYMD;
      const sess = sessions.get(dateStr);
      const isSelected = Boolean(sess);
      const isLocked = Boolean(sess?.locked);
      const cls = ['session-cal-day', isToday && 'is-today', isLocked && 'is-locked', !isLocked && isSelected && 'is-selected'].filter(Boolean).join(' ');
      const disabled = (isPast && !isSelected) || isLocked ? 'disabled' : '';
      cells.push(`<button type="button" class="${cls}" data-cal-date="${dateStr}" data-cal-mode="${mode}" ${disabled}>${d}</button>`);
    }

    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    for (let i = 1; i <= totalCells - firstDow - daysInMonth; i++) {
      cells.push(`<button type="button" class="session-cal-day is-other-month" disabled>${i}</button>`);
    }

    el.innerHTML = `
      <div class="session-cal">
        <div class="session-cal-header">
          <button type="button" class="session-cal-nav" data-cal-prev="${mode}">&#8249;</button>
          <span class="session-cal-title">${CAL_MONTHS[month]} ${year}</span>
          <button type="button" class="session-cal-nav" data-cal-next="${mode}">&#8250;</button>
        </div>
        <div class="session-cal-grid">
          ${labelCells}
          ${cells.join('')}
        </div>
      </div>
    `;

    el.querySelectorAll('[data-cal-prev]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.month -= 1;
        if (state.month < 0) { state.month = 11; state.year -= 1; }
        renderCalendar(mode);
      });
    });
    el.querySelectorAll('[data-cal-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.month += 1;
        if (state.month > 11) { state.month = 0; state.year += 1; }
        renderCalendar(mode);
      });
    });
    el.querySelectorAll('[data-cal-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleCalendarDate(mode, btn.getAttribute('data-cal-date'));
      });
    });
  };

  const toggleCalendarDate = (mode, dateStr) => {
    const state = calState[mode];
    const existing = state.sessions.get(dateStr);
    if (existing?.locked) return;
    if (existing) {
      state.sessions.delete(dateStr);
    } else {
      const defaultTime = document.getElementById(`${mode}-cal-default-time`)?.value || '08:00';
      const defaultDuration = parseFloat(document.getElementById(`${mode}-cal-default-duration`)?.value) || 1;
      state.sessions.set(dateStr, { startTime: defaultTime, durationHours: defaultDuration });
    }
    renderCalendar(mode);
    renderSessionList(mode);
  };

  const renderSessionList = (mode) => {
    const state = calState[mode];
    const listEl = document.getElementById(`${mode}-session-list`);
    const countEl = document.getElementById(`${mode}-session-count`);
    if (!listEl) return;

    const sorted = Array.from(state.sessions.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (countEl) countEl.textContent = sorted.length;

    if (!sorted.length) {
      listEl.innerHTML = '<p class="muted small" style="margin:0;">Click dates on the calendar to add sessions.</p>';
      return;
    }

    listEl.innerHTML = sorted.map(([dateStr, sess]) => {
      const label = new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const locked = Boolean(sess?.locked);
      return `
        <div class="session-row" data-session-date="${escapeHtml(dateStr)}">
          <div class="session-row-main">
            <div class="session-row-header">
              <span class="session-row-title">${escapeHtml(label)}</span>
              ${locked ? '<span class="badge badge-green" style="font-size:0.72rem; padding:0.1rem 0.45rem;">Held — locked</span>' : ''}
            </div>
            <div class="session-fields-grid">
              <label class="session-field">
                Time
                <input type="time" class="session-time-input" value="${escapeHtml(sess.startTime || '08:00')}" ${locked ? 'disabled' : ''} />
              </label>
              <label class="session-field">
                Duration (hrs)
                <input type="number" class="session-duration-input" value="${escapeHtml(String(sess.durationHours || 1))}" min="0.5" step="0.5" ${locked ? 'disabled' : ''} />
              </label>
            </div>
          </div>
          ${!locked ? '<button type="button" class="session-remove-btn btn secondary">✕</button>' : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-session-date]').forEach((row) => {
      const dateStr = row.getAttribute('data-session-date');
      row.querySelector('.session-time-input')?.addEventListener('change', (e) => {
        const s = state.sessions.get(dateStr);
        if (s && !s.locked) s.startTime = e.target.value;
      });
      row.querySelector('.session-duration-input')?.addEventListener('change', (e) => {
        const s = state.sessions.get(dateStr);
        if (s && !s.locked) s.durationHours = parseFloat(e.target.value) || 1;
      });
      row.querySelector('.session-remove-btn')?.addEventListener('click', () => {
        state.sessions.delete(dateStr);
        renderCalendar(mode);
        renderSessionList(mode);
      });
    });
  };

  const collectSessions = (mode) => {
    return Array.from(calState[mode].sessions.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sess]) => {
        const out = { date, startTime: sess.startTime || '08:00', durationHours: sess.durationHours || 1 };
        if (sess._id) out._id = sess._id;
        return out;
      });
  };

  const setCalendarMode = (mode, isMulti) => {
    const singleEl = document.getElementById(`${mode}-single-session-fields`);
    const multiEl = document.getElementById(`${mode}-multi-session-section`);
    if (singleEl) singleEl.style.display = isMulti ? 'none' : 'grid';
    if (multiEl) multiEl.style.display = isMulti ? 'block' : 'none';
    if (singleEl) {
      singleEl.querySelectorAll('input').forEach((inp) => { inp.required = !isMulti; });
    }
    if (isMulti) {
      renderCalendar(mode);
      renderSessionList(mode);
    }
  };

  const initCalendarToggle = (mode) => {
    const toggle = document.getElementById(`${mode}-multi-session-toggle`);
    toggle?.addEventListener('change', () => setCalendarMode(mode, toggle.checked));
  };

  // ========================
  // MODAL TABS
  // ========================

  const switchParticipantsTab = (tabName) => {
    attendanceModalState.currentTab = tabName;
    document.querySelectorAll('.modal-tab-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-modal-tab') === tabName);
    });
    document.querySelectorAll('.modal-tab-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === `modal-tab-${tabName}`);
    });
    if (tabName === 'materials' && attendanceModalState.seminarId) {
      loadSeminarMaterials(attendanceModalState.seminarId);
    }
    if (tabName === 'report' && attendanceModalState.seminarId) {
      loadSeminarReport(attendanceModalState.seminarId);
    }
  };

  document.querySelectorAll('.modal-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-modal-tab');
      if (tab) switchParticipantsTab(tab);
    });
  });

  // ========================
  // PRE-REGISTRATION RENDER
  // ========================

  const renderPreRegisteredRows = (rows) => {
    if (!preRegListEl) return;
    const preRegRows = rows.filter((r) => r.status === 'pre-registered');

    if (!preRegRows.length) {
      preRegListEl.innerHTML = '<p class="muted">No pending pre-registrations.</p>';
      if (preRegSelectAllEl) preRegSelectAllEl.disabled = true;
      return;
    }

    if (preRegSelectAllEl) preRegSelectAllEl.disabled = false;

    preRegListEl.innerHTML = `
      <table class="table">
      <thead>
  <tr>
    <th><input type="checkbox" id="pre-reg-select-all-inner" /></th>
    <th>Name</th>
    <th>Department</th>
    <th>Position</th>
    <th>Email</th>
    <th>Date Registered</th> <!-- Add this line -->
    <th>Status</th>
  </tr>
</thead>
        <tbody>
          ${preRegRows
            .map(
              (row) => `
                <tr>
                  <td>
                    <input type="checkbox" class="admin-pre-reg-check" value="${escapeHtml(row.id || '')}" />
                  </td>
                  <td>${escapeHtml(row.name || '—')}</td>
                  <td>${escapeHtml(row.department || '—')}</td>
                  <td>${escapeHtml(row.position || '—')}</td>
                  <td>${escapeHtml(row.email || '—')}</td>
                  <td>${escapeHtml(formatRegisteredDate(row.registeredAt))}</td>
                  <td><span class="badge badge-soft badge-pending">Pending</span></td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `;

    // Inner select all
    document.getElementById('pre-reg-select-all-inner')?.addEventListener('change', (e) => {
      const checked = Boolean(e.target.checked);
      preRegListEl.querySelectorAll('.admin-pre-reg-check').forEach((cb) => {
        cb.checked = checked;
      });
    });
  };

  // ========================
  // SEMINAR REPORT
  // ========================

  const loadSeminarReport = async (seminarId) => {
    if (!seminarReportContentEl) return;
    seminarReportContentEl.innerHTML = '<p class="muted">Loading report…</p>';

    if (seminarReportChartInstance) {
      seminarReportChartInstance.destroy();
      seminarReportChartInstance = null;
    }

    try {
      const res = await authedFetch(`/api/admin/seminars/${seminarId}/report`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load report');

      const { counts, demographics, totalTracked } = data;
      const totalApproved = (counts.registered || 0) + (counts.attended || 0) + (counts.absent || 0);
      const attendedPct = totalApproved > 0 ? Math.round((counts.attended / totalApproved) * 100) : 0;
      const absentPct = totalApproved > 0 ? Math.round((counts.absent / totalApproved) * 100) : 0;

      const hasDemoData = (demographics.male + demographics.female + demographics.other) > 0;

      seminarReportContentEl.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:0.65rem; margin-bottom:1.1rem;">
          <div style="padding:0.75rem 0.9rem; border:1px solid var(--border); border-radius:0.65rem; background:#fff; text-align:center;">
            <div class="muted small" style="font-size:0.8rem;">Pre-Registered</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--xu-blue); margin-top:0.2rem;">${counts.preRegistered}</div>
          </div>
          <div style="padding:0.75rem 0.9rem; border:1px solid var(--border); border-radius:0.65rem; background:#fff; text-align:center;">
            <div class="muted small" style="font-size:0.8rem;">Approved</div>
            <div style="font-size:1.6rem; font-weight:800; color:#0284c7; margin-top:0.2rem;">${totalApproved}</div>
          </div>
          <div style="padding:0.75rem 0.9rem; border:1px solid var(--border); border-radius:0.65rem; background:#fff; text-align:center;">
            <div class="muted small" style="font-size:0.8rem;">Attended</div>
            <div style="font-size:1.6rem; font-weight:800; color:#059669; margin-top:0.2rem;">${counts.attended}</div>
            <div class="muted small" style="font-size:0.75rem;">${attendedPct}% of approved</div>
          </div>
          <div style="padding:0.75rem 0.9rem; border:1px solid var(--border); border-radius:0.65rem; background:#fff; text-align:center;">
            <div class="muted small" style="font-size:0.8rem;">Absent</div>
            <div style="font-size:1.6rem; font-weight:800; color:#dc2626; margin-top:0.2rem;">${counts.absent}</div>
            <div class="muted small" style="font-size:0.75rem;">${absentPct}% of approved</div>
          </div>
        </div>

        <div style="border:1px solid var(--border); border-radius:0.7rem; padding:0.9rem 1rem; background:#fff;">
          <div style="font-weight:700; color:var(--xu-blue); margin-bottom:0.65rem;">Attendee Demographics (Birth Sex)</div>
          ${!hasDemoData
            ? '<p class="muted" style="text-align:center; padding:1rem 0;">No attendance recorded yet — demographics will appear once attendance is saved.</p>'
            : `<div style="display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap;">
                <div style="position:relative; width:200px; height:200px; flex-shrink:0;">
                  <canvas id="admin-seminar-demo-chart" width="200" height="200"></canvas>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.55rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="width:14px; height:14px; border-radius:3px; background:#1f3c77; display:inline-block; flex-shrink:0;"></span>
                    <span style="font-size:0.9rem;">Male — <strong>${demographics.male}</strong></span>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="width:14px; height:14px; border-radius:3px; background:#db2777; display:inline-block; flex-shrink:0;"></span>
                    <span style="font-size:0.9rem;">Female — <strong>${demographics.female}</strong></span>
                  </div>
                  ${demographics.other > 0 ? `<div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="width:14px; height:14px; border-radius:3px; background:#6b7280; display:inline-block; flex-shrink:0;"></span>
                    <span style="font-size:0.9rem;">Other / Unspecified — <strong>${demographics.other}</strong></span>
                  </div>` : ''}
                  <div class="muted small" style="margin-top:0.3rem; font-size:0.8rem;">Total attendees: ${counts.attended}</div>
                </div>
              </div>`
          }
        </div>
      `;

      if (hasDemoData) {
        const canvas = document.getElementById('admin-seminar-demo-chart');
        if (canvas && window.Chart) {
          const chartData = [demographics.male, demographics.female];
          const chartLabels = ['Male', 'Female'];
          const chartColors = ['#1f3c77', '#db2777'];
          if (demographics.other > 0) {
            chartData.push(demographics.other);
            chartLabels.push('Other');
            chartColors.push('#6b7280');
          }
          seminarReportChartInstance = new window.Chart(canvas, {
            type: 'pie',
            data: {
              labels: chartLabels,
              datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: 2,
                borderColor: '#fff',
              }],
            },
            options: {
              responsive: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                      return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                    },
                  },
                },
              },
            },
          });
        }
      }
    } catch (err) {
      console.error('[admin] load seminar report failed', err);
      if (seminarReportContentEl) {
        seminarReportContentEl.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Failed to load report.')}</p>`;
      }
    }
  };

  // ========================
  // SEMINAR MATERIALS
  // ========================

  const getFileIcon = (fileURL) => {
    const ext = String(fileURL || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (ext === 'ppt' || ext === 'pptx') return 'PPT';
    return 'FILE';
  };

  const renderSeminarMaterials = (materials) => {
    if (!seminarMaterialsListEl) return;
    if (!Array.isArray(materials) || materials.length === 0) {
      seminarMaterialsListEl.innerHTML = '<p class="muted">No materials uploaded for this seminar yet.</p>';
      return;
    }

    seminarMaterialsListEl.innerHTML = materials
      .map((m) => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; padding:0.6rem 0.75rem; border:1px solid var(--border); border-radius:0.55rem; background:#fff; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.55rem; min-width:0;">
            <span style="font-size:1.3rem; flex-shrink:0;">${getFileIcon(m.fileURL)}</span>
            <div style="min-width:0;">
              <div style="font-weight:600; color:var(--xu-blue); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.title || 'Untitled')}</div>
              ${m.description ? `<div class="muted small" style="margin-top:0.1rem;">${escapeHtml(m.description)}</div>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-shrink:0;">
            <a class="btn secondary" href="${escapeHtml(m.fileURL)}" target="_blank" rel="noopener" style="padding:0.3rem 0.65rem; font-size:0.85rem; text-decoration:none;">View</a>
            <button class="btn secondary" type="button" data-delete-material="${escapeHtml(m._id || '')}" style="padding:0.3rem 0.65rem; font-size:0.85rem; border-color:#dc2626; color:#b91c1c;">Remove</button>
          </div>
        </div>
      `)
      .join('');

    seminarMaterialsListEl.querySelectorAll('[data-delete-material]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const materialId = btn.getAttribute('data-delete-material');
        if (!materialId || !attendanceModalState.seminarId) return;
        if (!window.confirm('Remove this material? This cannot be undone.')) return;
        try {
          const res = await authedFetch(`/api/admin/seminars/${attendanceModalState.seminarId}/materials/${materialId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || 'Failed to remove material');
          if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = data?.message || 'Material removed.';
          await loadSeminarMaterials(attendanceModalState.seminarId);
        } catch (err) {
          console.error('[admin] remove material failed', err);
          if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = err.message || 'Failed to remove material.';
        }
      });
    });
  };

  const loadSeminarMaterials = async (seminarId) => {
    if (!seminarMaterialsListEl) return;
    seminarMaterialsListEl.innerHTML = '<p class="muted">Loading materials…</p>';
    try {
      const res = await authedFetch(`/api/admin/seminars/${seminarId}/materials`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load materials');
      renderSeminarMaterials(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[admin] load seminar materials failed', err);
      if (seminarMaterialsListEl) seminarMaterialsListEl.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Failed to load materials.')}</p>`;
    }
  };

  seminarMaterialsFormEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!attendanceModalState.seminarId || !materialTitleEl || !materialFileEl) return;
    if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = '';

    const title = materialTitleEl.value.trim();
    const file = materialFileEl.files?.[0];
    if (!title || !file) {
      if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = 'Title and file are required.';
      return;
    }

    const uploadBtn = document.getElementById('admin-upload-material-btn');
    if (uploadBtn) uploadBtn.disabled = true;
    if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = 'Uploading…';

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('file', file);

      const res = await authedFetch(`/api/admin/seminars/${attendanceModalState.seminarId}/materials`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = 'Material uploaded successfully.';
      seminarMaterialsFormEl.reset();
      await loadSeminarMaterials(attendanceModalState.seminarId);
    } catch (err) {
      console.error('[admin] upload material failed', err);
      if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = err.message || 'Upload failed.';
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
    }
  });

  // ========================
  // APPROVE SELECTED
  // ========================

  approveSelectedBtn?.addEventListener('click', async () => {
    if (!attendanceModalState.seminarId || !preRegListEl) return;
    if (preRegStatusEl) preRegStatusEl.textContent = '';

    const selected = Array.from(preRegListEl.querySelectorAll('.admin-pre-reg-check'))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (!selected.length) {
      if (preRegStatusEl) preRegStatusEl.textContent = 'Select at least one participant to approve.';
      return;
    }

    try {
      const res = await authedFetch(`/api/admin/seminars/${attendanceModalState.seminarId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Approval failed');
      if (preRegStatusEl) preRegStatusEl.textContent = data?.message || `${data.approvedCount || 0} participant(s) approved.`;
      // Reload the modal
      const seminar = currentSeminars.find((s) => String(s._id) === String(attendanceModalState.seminarId));
      if (seminar) await openParticipantsModal(seminar);
      updateSeminarsNotificationDot();
    } catch (err) {
      console.error('[admin] approve participants failed', err);
      if (preRegStatusEl) preRegStatusEl.textContent = err.message || 'Failed to approve participants.';
    }
  });

  preRegSelectAllEl?.addEventListener('change', () => {
    if (!preRegListEl) return;
    const checked = Boolean(preRegSelectAllEl.checked);
    preRegListEl.querySelectorAll('.admin-pre-reg-check').forEach((cb) => {
      cb.checked = checked;
    });
  });

  // ========================
  // ATTENDANCE / PARTICIPANTS
  // ========================

  const renderEmployeeSeminarsList = (listEl, seminars, emptyMessage) => {
    if (!listEl) return;
    if (!Array.isArray(seminars) || seminars.length === 0) {
      listEl.innerHTML = `<div class="muted small">${escapeHtml(emptyMessage)}</div>`;
      return;
    }

    listEl.innerHTML = seminars
      .map((seminar) => {
        const datePart = seminar?.date ? formatDate(seminar.date) : 'No date';
        const timePart = seminar?.startTime ? ` • ${escapeHtml(formatTime(seminar.startTime))}` : '';
        return `
          <div style="padding: 0.4rem 0.5rem; border:1px solid var(--border); border-radius:0.55rem; background:#fff;">
            <div style="font-weight: 600; color: var(--xu-blue);">${escapeHtml(seminar?.title || 'Untitled seminar')}</div>
            <div class="muted small" style="margin-top: 0.15rem;">${escapeHtml(datePart)}${timePart}</div>
          </div>
        `;
      })
      .join('');
  };

  const renderEmployeeCertificatesList = (employeeId, certificates) => {
    if (!profileCertificatesListEl) return;
    if (!Array.isArray(certificates) || certificates.length === 0) {
      profileCertificatesListEl.innerHTML = '<div class="muted small">No certificates available yet.</div>';
      return;
    }

    profileCertificatesListEl.innerHTML = certificates
      .map((cert) => {
        const datePart = cert?.date ? formatDate(cert.date) : 'No date';
        const issuedPart = cert?.certificateIssuedAt ? formatDate(cert.certificateIssuedAt) : 'Not issued';
        return `
          <div style="padding: 0.45rem 0.55rem; border:1px solid var(--border); border-radius:0.55rem; background:#fff;">
            <div style="display:flex; justify-content:space-between; gap:0.6rem; align-items:center; flex-wrap:wrap;">
              <div>
                <div style="font-weight:600; color:var(--xu-blue);">${escapeHtml(cert?.title || 'Untitled seminar')}</div>
                <div class="muted small" style="margin-top:0.12rem;">${escapeHtml(datePart)} • Code: ${escapeHtml(cert?.certificateCode || 'Pending')}</div>
              </div>
              <button class="btn secondary" type="button" data-admin-cert-download="${escapeHtml(cert?.registrationId || '')}" style="padding:0.35rem 0.65rem;">Download</button>
            </div>
            <div class="muted small" style="margin-top:0.15rem;">Issued: ${escapeHtml(issuedPart)}</div>
          </div>
        `;
      })
      .join('');

    profileCertificatesListEl.querySelectorAll('[data-admin-cert-download]').forEach((button) => {
      button.addEventListener('click', async () => {
        const registrationId = button.getAttribute('data-admin-cert-download');
        if (!registrationId || !employeeId) return;
        try {
          const res = await authedFetch(`/api/admin/employees/${employeeId}/certificates/${registrationId}/download`);
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Certificate download failed.');
          }

          const blob = await res.blob();
          const disposition = res.headers.get('content-disposition') || '';
          const match = /filename="?([^";]+)"?/i.exec(disposition);
          const name = match?.[1] || `GIMS-Certificate-${registrationId}.png`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          console.error('[admin] certificate download failed', err);
          if (profileModalStatusEl) profileModalStatusEl.textContent = err.message || 'Certificate download failed.';
        }
      });
    });
  };

  const renderEmailLink = (el, email) => {
    if (!el) return;
    const value = (email || '').trim();
    if (!value) {
      el.textContent = '—';
      return;
    }
    const safeEmail = escapeHtml(value);
    const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(value)}`;
    el.innerHTML = `<a href="${composeUrl}" target="_blank" rel="noopener noreferrer" class="email-link" title="Compose email in Gmail">${safeEmail}</a>`;
  };

  const showEmployeeProfile = async (row) => {
    if (profileNameEl) profileNameEl.textContent = row.name || '—';
    if (profileIdEl) profileIdEl.textContent = row.employeeId || '—';
    renderEmailLink(profileEmailEl, row.email);
    if (profileDepartmentEl) profileDepartmentEl.textContent = row.department || '—';
    if (profilePositionEl) profilePositionEl.textContent = row.position || '—';
    if (profileRegisteredEl) profileRegisteredEl.textContent = formatRegisteredDate(row.registeredAt);
    if (profileStatusEl) {
      const baseStatus = row.seminarStatus || '—';
      const accountText = normalizeAccountStatus(row.accountStatus) === 'deactivated' ? ' • Account: Deactivated' : '';
      profileStatusEl.textContent = `${baseStatus}${accountText}`;
    }
    if (profileReservedCountEl) profileReservedCountEl.textContent = '0';
    if (profileTakenCountEl) profileTakenCountEl.textContent = '0';
    if (profileCertificatesCountEl) profileCertificatesCountEl.textContent = '0';
    renderEmployeeSeminarsList(profileReservedListEl, [], 'Loading reserved seminars...');
    renderEmployeeSeminarsList(profileTakenListEl, [], 'Loading taken seminars...');
    renderEmployeeCertificatesList(row.id, []);
    if (profileModalStatusEl) profileModalStatusEl.textContent = '';
    if (employeeModalEl) employeeModalEl.style.display = 'flex';

    try {
      const res = await authedFetch(`/api/admin/employees/${row.id}/profile`);
      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error('Employee profile details endpoint is unavailable. Please restart the server and try again.');
      }
      if (!res.ok) throw new Error(data?.message || 'Failed to load employee profile details');

      const profile = data?.profile || {};
      const reservedSeminars = Array.isArray(data?.reservedSeminars) ? data.reservedSeminars : [];
      const takenSeminars = Array.isArray(data?.takenSeminars) ? data.takenSeminars : [];
      const certificates = Array.isArray(data?.certificates) ? data.certificates : [];

      if (profileNameEl) profileNameEl.textContent = profile.name || row.name || '—';
      if (profileIdEl) profileIdEl.textContent = profile.employeeId || row.employeeId || '—';
      renderEmailLink(profileEmailEl, profile.email || row.email);
      if (profileDepartmentEl) profileDepartmentEl.textContent = profile.department || row.department || '—';
      if (profilePositionEl) profilePositionEl.textContent = profile.position || row.position || '—';
      if (profileRegisteredEl) profileRegisteredEl.textContent = formatRegisteredDate(profile.registeredAt || row.registeredAt);
      if (profileStatusEl) {
        const statusLabel = profile.seminarStatus || row.seminarStatus || '—';
        const completionText = profile.completionText ? ` (${profile.completionText})` : '';
        const accountText = normalizeAccountStatus(profile.accountStatus || row.accountStatus) === 'deactivated'
          ? ' • Account: Deactivated'
          : '';
        profileStatusEl.textContent = `${statusLabel}${completionText}${accountText}`;
      }

      if (profileReservedCountEl) profileReservedCountEl.textContent = String(reservedSeminars.length);
      if (profileTakenCountEl) profileTakenCountEl.textContent = String(takenSeminars.length);
      if (profileCertificatesCountEl) profileCertificatesCountEl.textContent = String(certificates.length);
      renderEmployeeSeminarsList(profileReservedListEl, reservedSeminars, 'No reserved seminars yet.');
      renderEmployeeSeminarsList(profileTakenListEl, takenSeminars, 'No seminars taken yet.');
      renderEmployeeCertificatesList(row.id, certificates);
    } catch (err) {
      console.error('[admin] load employee seminar details failed', err);
      if (profileModalStatusEl) {
        profileModalStatusEl.textContent = err.message || 'Failed to load seminar details.';
      }
      renderEmployeeSeminarsList(profileReservedListEl, [], 'Unable to load reserved seminars.');
      renderEmployeeSeminarsList(profileTakenListEl, [], 'Unable to load seminars taken.');
      renderEmployeeCertificatesList(row.id, []);
    }
  };

  const openCreateSeminarModal = () => {
    if (!createSeminarModalEl) return;
    if (createSeminarStatusEl) createSeminarStatusEl.textContent = '';
    calState.create.sessions = new Map();
    const toggle = document.getElementById('create-multi-session-toggle');
    if (toggle) toggle.checked = false;
    const defaultTypeRadio = document.querySelector('input[name="create-multiSessionType"][value="all"]');
    if (defaultTypeRadio) defaultTypeRadio.checked = true;
    setCalendarMode('create', false);
    createSeminarModalEl.style.display = 'flex';
  };

  const closeCreateSeminarModal = () => {
    if (!createSeminarModalEl) return;
    createSeminarModalEl.style.display = 'none';
  };

  const showNavModule = (nav) => {
    const key = String(nav || 'dashboard').toLowerCase();
    const isDashboard = key === 'dashboard';
    const isEmployees = key === 'employees';
    const isSeminars = key === 'seminars';
    const isCreateAdmin = key === 'create-admin';
    const isMaintenance = key === 'maintenance';

    if (dashboardWrapperEl) {
      dashboardWrapperEl.style.display = isDashboard || isEmployees ? 'block' : 'none';
    }
    if (seminarsSectionEl) {
      seminarsSectionEl.style.display = isSeminars ? 'block' : 'none';
    }
    if (createAdminSectionEl) {
      createAdminSectionEl.style.display = isCreateAdmin ? 'grid' : 'none';
    }
    const maintenanceSectionEl = document.getElementById('admin-maintenance-section');
    if (maintenanceSectionEl) {
      maintenanceSectionEl.style.display = isMaintenance ? 'block' : 'none';
    }
    if (isMaintenance && typeof window.gimsLoadMaintenance === 'function') {
      window.gimsLoadMaintenance();
    }

    sidebarNavButtons.forEach((btn) => {
      const btnKey = String(btn.getAttribute('data-nav') || '').toLowerCase();
      btn.classList.toggle('is-active', btnKey === key);
    });

    if (moduleHintEl) {
      const hintMap = {
        dashboard: 'Current View: Overview',
        seminars: 'Current View: Manage Seminars',
        'create-admin': 'Current View: Admin Accounts',
        employees: 'Current View: Employee Records',
        maintenance: 'Current View: Maintenance',
      };
      moduleHintEl.textContent = hintMap[key] || 'Current View: Overview';
    }

    if (isEmployees) {
      document.getElementById('admin-employees-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (!isSeminars) {
      closeSeminarParticipantsModal();
    }
    closeDeletedSeminarsModal();
    closeAccountStatusMenu();
  };

  const closeEmployeeProfileModal = () => {
    if (employeeModalEl) employeeModalEl.style.display = 'none';
  };

  const setTopbarFromToken = () => {
    const payload = decodeJwtPayload(adminToken) || {};
    const email = String(payload.email || '');
    const first = email.split('@')[0] || '';
    const prettyName = first
      .split(/[._-]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Admin';

    if (adminOwnProfileNameEl) adminOwnProfileNameEl.textContent = prettyName;
    if (adminOwnProfileEmailEl) adminOwnProfileEmailEl.textContent = email || '—';
    if (adminOwnProfileIdEl) adminOwnProfileIdEl.textContent = payload.id || '—';
  };

  adminProfileTriggerBtn?.addEventListener('click', () => {
    if (adminOwnProfileModalEl) adminOwnProfileModalEl.style.display = 'flex';
  });

  adminOwnProfileCloseBtn?.addEventListener('click', () => {
    if (adminOwnProfileModalEl) adminOwnProfileModalEl.style.display = 'none';
  });

  adminOwnProfileModalEl?.addEventListener('click', (e) => {
    if (e.target === adminOwnProfileModalEl) adminOwnProfileModalEl.style.display = 'none';
  });

  const closeSeminarEditModal = () => {
    if (seminarEditModalEl) seminarEditModalEl.style.display = 'none';
  };

  const closeSeminarParticipantsModal = () => {
    if (seminarParticipantsModalEl) seminarParticipantsModalEl.style.display = 'none';
    if (seminarReportChartInstance) {
      seminarReportChartInstance.destroy();
      seminarReportChartInstance = null;
    }
    if (seminarReportContentEl) seminarReportContentEl.innerHTML = '<p class="muted">Loading report…</p>';
  };

  const openSeminarEditModal = (seminar) => {
    if (!seminarEditForm || !seminarEditModalEl) return;
    seminarEditForm.elements.seminarId.value = seminar._id;
    seminarEditForm.elements.title.value = seminar.title || '';
    seminarEditForm.elements.capacity.value = seminar.capacity || 1;
    seminarEditForm.elements.mandatory.value = seminar.mandatory ? 'true' : 'false';
    seminarEditForm.elements.description.value = seminar.description || '';
    if (seminarEditForm.elements.location) seminarEditForm.elements.location.value = seminar.location || '';
    if (seminarEditForm.elements.resourcePerson) seminarEditForm.elements.resourcePerson.value = seminar.resourcePerson || '';
    const editAutoSendCheckbox = document.getElementById('edit-auto-send-cert-checkbox');
    if (editAutoSendCheckbox) editAutoSendCheckbox.checked = Boolean(seminar.autoSendCertificates);

    // Populate sessions
    const sessions = Array.isArray(seminar.sessions) ? seminar.sessions : [];
    const isMulti = sessions.length > 1;
    const toggle = document.getElementById('edit-multi-session-toggle');
    if (toggle) toggle.checked = isMulti;

    calState.edit.sessions = new Map();

    if (isMulti) {
      for (const s of sessions) {
        const dateStr = String(s.date || '').slice(0, 10);
        if (!dateStr) continue;
        calState.edit.sessions.set(dateStr, {
          startTime: s.startTime || '08:00',
          durationHours: s.durationHours || 1,
          _id: s._id,
          locked: Boolean(s.isHeld),
        });
      }
      // Navigate calendar to month of first session
      const firstDateStr = Array.from(calState.edit.sessions.keys()).sort()[0];
      if (firstDateStr) {
        const d = new Date(`${firstDateStr}T00:00:00`);
        // Show current month if first session is in the past (already held)
        const now = new Date();
        calState.edit.year = d < now ? now.getFullYear() : d.getFullYear();
        calState.edit.month = d < now ? now.getMonth() : d.getMonth();
      }
    } else {
      // Single session — populate date/time/duration inputs
      const src = sessions.length === 1 ? sessions[0] : seminar;
      seminarEditForm.elements.date.value = String(src.date || seminar.date || '').slice(0, 10);
      seminarEditForm.elements.startTime.value = src.startTime || seminar.startTime || '';
      seminarEditForm.elements.durationHours.value = src.durationHours || seminar.durationHours || 1;
      const dateInput = seminarEditForm.querySelector('input[name="date"]');
      if (dateInput) dateInput.min = getTodayDateInputValue();
    }

    // Pre-select multiSessionType radio
    if (isMulti) {
      const editSessionTypeVal = seminar.multiSessionType === 'pick-one' ? 'pick-one' : 'all';
      const editSessionTypeRadio = document.querySelector(`input[name="edit-multiSessionType"][value="${editSessionTypeVal}"]`);
      if (editSessionTypeRadio) editSessionTypeRadio.checked = true;
    }

    setCalendarMode('edit', isMulti);
    if (seminarEditStatusEl) seminarEditStatusEl.textContent = '';
    seminarEditModalEl.style.display = 'flex';
  };

  const renderParticipantsRows = (rows, isHeld) => {
    if (!seminarParticipantsListEl) return;
    // Only show registered/attended/absent (approved) participants
    const approvedRows = rows.filter((r) => ['registered', 'attended', 'absent'].includes(String(r.status || '').toLowerCase()));

    if (!approvedRows.length) {
      seminarParticipantsListEl.innerHTML = '<p class="muted">No approved participants found. Approve pre-registered participants first.</p>';
      return;
    }

    const statusBadge = (row) => {
      const status = String(row.status || 'registered').toLowerCase();
      if (status === 'attended') return '<span class="badge badge-green">Attended</span>';
      if (status === 'absent') return '<span class="badge badge-red">Absent</span>';
      return '<span class="badge badge-soft">Registered</span>';
    };

    seminarParticipantsListEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Attend</th>
            <th>Name</th>
            <th>Department</th>
            <th>Status</th>
            <th>Evaluation</th>
            <th>Certificate</th>
          </tr>
        </thead>
        <tbody>
          ${approvedRows
            .map(
              (row) => `
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      class="admin-attendance-row-check"
                      value="${escapeHtml(row.id || '')}"
                      ${row.status === 'attended' ? 'checked' : ''}
                      ${isHeld ? '' : 'disabled'}
                    />
                  </td>
                  <td>${escapeHtml(row.name || '—')}</td>
                  <td>${escapeHtml(row.department || '—')}</td>
                  <td>${statusBadge(row)}</td>
                  <td>
                    ${row.evaluationCompleted
                      ? '<span class="badge badge-green">Answered</span>'
                      : row.evaluationAvailable
                        ? '<span class="badge badge-soft">Not Answered</span>'
                        : '<span class="badge badge-soft">Not Available</span>'}
                  </td>
                  <td>${row.certificateIssued ? '<span class="badge badge-green">Sent</span>' : '<span class="badge badge-soft">Not Sent</span>'}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `;

    if (attendanceSelectAllEl) {
      attendanceSelectAllEl.checked = false;
      attendanceSelectAllEl.disabled = !isHeld;
    }
  };

  const openParticipantsModal = async (seminar) => {
    if (!seminarParticipantsModalEl || !seminarParticipantsMetaEl) return;
    const isAlreadyOpen = seminarParticipantsModalEl.style.display === 'flex';
    const savedTab = isAlreadyOpen ? attendanceModalState.currentTab : 'pre-registered';

    // Build schedule summary: support multi-session
    const buildScheduleSummary = (sm) => {
      if (Array.isArray(sm.sessions) && sm.sessions.length > 1) {
        return sm.sessions
          .map((sess, idx) => {
            const dt = formatDate(sess.date);
            const st = formatTime(sess.startTime);
            const et = sess.endTime ? `–${formatTime(sess.endTime)}` : '';
            return `Day ${idx + 1}: ${dt} • ${st}${et}`;
          })
          .join(' | ');
      }
      const dt = formatDate(sm.date);
      const st = formatTime(sm.startTime);
      const et = sm.endTime ? `–${formatTime(sm.endTime)}` : '';
      return `${dt} ${st}${et}`;
    };
    seminarParticipantsMetaEl.textContent = `${seminar.title || 'Seminar'} — ${buildScheduleSummary(seminar)}`;
    if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = 'Loading...';
    if (preRegStatusEl) preRegStatusEl.textContent = '';
    if (seminarParticipantsListEl) seminarParticipantsListEl.innerHTML = '';
    if (preRegListEl) preRegListEl.innerHTML = '';

    attendanceModalState = {
      seminarId: seminar._id,
      isHeld: Boolean(seminar.isHeld),
      rows: [],
      attendanceSaved: false,
      currentTab: savedTab,
    };

    if (!isAlreadyOpen) {
      if (materialsUploadStatusEl) materialsUploadStatusEl.textContent = '';
      if (seminarMaterialsListEl) seminarMaterialsListEl.innerHTML = '';
      if (seminarMaterialsFormEl) seminarMaterialsFormEl.reset();
    }

    switchParticipantsTab(savedTab);
    seminarParticipantsModalEl.style.display = 'flex';

    try {
      const res = await authedFetch(`/api/admin/seminars/${seminar._id}/participants`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load participants');

      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const isHeld = Boolean(data?.seminar?.isHeld);
      const autoSendCerts = Boolean(data?.seminar?.autoSendCertificates);

      attendanceModalState = {
        seminarId: seminar._id,
        isHeld,
        rows,
        attendanceSaved: rows.some((r) => ['attended', 'absent'].includes(String(r.status || '').toLowerCase())),
        currentTab: savedTab,
      };

      // Render pre-registered tab
      renderPreRegisteredRows(rows);

      // Render attendance tab
      renderParticipantsRows(rows, isHeld);

      // Update attendance buttons
      if (seminarHeldBtn) {
        seminarHeldBtn.disabled = false;
        seminarHeldBtn.textContent = isHeld ? 'Unmark Held' : 'Mark as Held';
      }
      if (markAttendanceBtn) markAttendanceBtn.disabled = !isHeld;
      if (sendCertificatesBtn) sendCertificatesBtn.disabled = !isHeld || !attendanceModalState.attendanceSaved;

      // Add auto-send cert indicator
      if (autoSendCerts && seminarParticipantsStatusEl) {
        seminarParticipantsStatusEl.textContent = 'Auto-send certificates is enabled for this seminar.';
      } else if (seminarParticipantsStatusEl) {
        seminarParticipantsStatusEl.textContent = isHeld
          ? ''
          : 'Mark this seminar as held first before recording attendance.';
      }
    } catch (err) {
      console.error('[admin] load participants failed', err);
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = err.message || 'Failed to load participants.';
      if (preRegStatusEl) preRegStatusEl.textContent = err.message || 'Failed to load participants.';
    }
  };

  const renderSeminarsCarousel = (seminars) => {
    if (!seminarsCarouselEl) return;
    if (!Array.isArray(seminars) || seminars.length === 0) {
      seminarsCarouselEl.innerHTML = '<p class="muted">No seminars created yet.</p>';
      return;
    }

    const isListView = seminarViewMode === 'list';
    const actionGroupStyle = isListView
      ? 'display:flex; gap:0.55rem; flex-wrap:wrap; margin-top:auto;'
      : 'display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:0.55rem; margin-top:auto; align-items:stretch;';
    const wideButtonStyle = isListView
      ? 'min-width:9.6rem; justify-content:center; text-align:center;'
      : 'width:100%; min-width:0; justify-content:center; text-align:center; white-space:nowrap; padding-left:0.8rem; padding-right:0.8rem;';
    const shortButtonStyle = isListView
      ? 'min-width:5.6rem; justify-content:center; text-align:center;'
      : 'width:100%; min-width:0; justify-content:center; text-align:center; white-space:nowrap; padding-left:0.8rem; padding-right:0.8rem;';

    seminarsCarouselEl.innerHTML = seminars
      .map((seminar) => {
        const registeredCount = Array.isArray(seminar.registeredEmployees) ? seminar.registeredEmployees.length : 0;
        const capacity = Number(seminar.capacity || 0);
        const mandatoryLabel = seminar.mandatory ? 'Mandatory' : 'Optional';
        const heldLabel = seminar.isHeld ? 'Held' : 'Upcoming';
        const autoSendLabel = seminar.autoSendCertificates ? 'Auto-cert' : '';
        return `
          <article class="card" style="box-shadow:none; padding: 1rem; min-width: 320px; flex: 0 0 320px; display:flex; flex-direction:column; gap: 0.75rem;">
            <div style="display:flex; justify-content: space-between; gap: 0.5rem; align-items:flex-start;">
              <h3 style="margin:0; color: var(--xu-blue);">${escapeHtml(seminar.title || 'Untitled Seminar')}</h3>
              <span class="badge badge-soft" style="display:inline-flex; align-items:center; justify-content:center; min-width:6.9rem; padding:0.32rem 0.9rem; text-align:center; white-space:nowrap; align-self:flex-start;">${escapeHtml(mandatoryLabel)}</span>
            </div>

            <div class="muted small">${escapeHtml(formatDate(seminar.date))} - ${escapeHtml(formatTime(seminar.startTime))}</div>
            ${seminar.location ? `<div class="muted small">Location: ${escapeHtml(seminar.location)}</div>` : ''}
            ${seminar.resourcePerson ? `<div class="muted small">Resource Person: ${escapeHtml(seminar.resourcePerson)}</div>` : ''}
            ${Array.isArray(seminar.sessions) && seminar.sessions.length > 1
              ? `<div class="muted small" style="color:var(--xu-blue); font-weight:600;">${seminar.sessions.length} sessions &bull; ${seminar.multiSessionType === 'pick-one' ? 'Pick one day' : 'Attend all'}</div>${buildAdminSessionsScheduleBlock(seminar.sessions, {
                  label: seminar.multiSessionType === 'pick-one' ? 'All session options' : 'Every session',
                })}`
              : `<div class="muted small">Duration: ${escapeHtml(seminar.durationHours || 0)} hour(s)</div>`
            }
            <div class="muted small">Reserved: ${escapeHtml(registeredCount)}/${escapeHtml(capacity)}</div>
            <div class="muted small">Status: ${escapeHtml(heldLabel)} ${autoSendLabel ? `• <span style="color:#059669;">${escapeHtml(autoSendLabel)}</span>` : ''}</div>
            <div style="height:1px; background:var(--border); margin:0.1rem 0 0.2rem;"></div>
            <div class="seminar-desc-wrap" data-desc-wrap>
              <div class="muted seminar-desc-clamp" data-desc-text style="font-size: 0.92rem; line-height:1.4; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(seminar.description || '')}</div>
              ${(seminar.description || '').length > 140 ? `<button type="button" class="link-btn" data-desc-toggle style="background:none; border:none; color:var(--xu-blue); padding:0; margin-top:0.2rem; cursor:pointer; font-size:0.82rem; font-weight:600;">View more</button>` : ''}
            </div>

            <div style="${actionGroupStyle}">
              <button class="btn secondary" type="button" data-seminar-view="${seminar._id}" style="${wideButtonStyle}">View Participants</button>
              <button class="btn secondary" type="button" data-seminar-held="${seminar._id}" style="${wideButtonStyle}">${seminar.isHeld ? 'Unmark Held' : 'Mark as Held'}</button>
              <button class="btn" type="button" data-seminar-edit="${seminar._id}" style="${shortButtonStyle}">Edit</button>
              <button class="btn secondary" type="button" data-seminar-delete="${seminar._id}" style="${shortButtonStyle}">Delete</button>
            </div>
          </article>
        `;
      })
      .join('');

    seminarsCarouselEl.querySelectorAll('[data-seminar-view]').forEach((button) => {
      button.addEventListener('click', async () => {
        const seminar = currentSeminars.find((item) => String(item._id) === String(button.getAttribute('data-seminar-view')));
        if (!seminar) return;
        await openParticipantsModal(seminar);
      });
    });

    seminarsCarouselEl.querySelectorAll('[data-seminar-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const seminar = currentSeminars.find((item) => String(item._id) === String(button.getAttribute('data-seminar-edit')));
        if (!seminar) return;
        openSeminarEditModal(seminar);
      });
    });

    seminarsCarouselEl.querySelectorAll('[data-seminar-held]').forEach((button) => {
      button.addEventListener('click', async () => {
        const seminar = currentSeminars.find((item) => String(item._id) === String(button.getAttribute('data-seminar-held')));
        if (!seminar) return;
        try {
          const targetHeld = !seminar.isHeld;
          const res = await authedFetch(`/api/admin/seminars/${seminar._id}/held`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isHeld: targetHeld }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || 'Failed to update held status');
          if (seminarsStatusEl) seminarsStatusEl.textContent = data?.message || 'Held status updated.';
          await loadSeminars();
        } catch (err) {
          console.error('[admin] toggle seminar held failed (list)', err);
          if (seminarsStatusEl) seminarsStatusEl.textContent = err.message || 'Failed to update held status.';
        }
      });
    });

    seminarsCarouselEl.querySelectorAll('[data-desc-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const wrap = button.closest('[data-desc-wrap]');
        const text = wrap?.querySelector('[data-desc-text]');
        if (!text) return;
        const expanded = text.classList.toggle('seminar-desc-expanded');
        if (expanded) {
          text.style.webkitLineClamp = 'unset';
          text.style.display = 'block';
          button.textContent = 'View less';
        } else {
          text.style.display = '-webkit-box';
          text.style.webkitLineClamp = '3';
          button.textContent = 'View more';
        }
      });
    });

    seminarsCarouselEl.querySelectorAll('[data-seminar-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const seminar = currentSeminars.find((item) => String(item._id) === String(button.getAttribute('data-seminar-delete')));
        if (!seminar) return;
        const ok = window.confirm(`Delete seminar "${seminar.title}"? It will move to Recently Deleted for 7 days before permanent removal.`);
        if (!ok) return;
        try {
          const res = await authedFetch(`/api/admin/seminars/${seminar._id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || 'Failed to delete seminar');
          if (seminarsStatusEl) seminarsStatusEl.textContent = data?.message || 'Seminar moved to Recently Deleted.';
          await loadSummary();
          await loadSeminars();
        } catch (err) {
          console.error('[admin] delete seminar failed', err);
          if (seminarsStatusEl) seminarsStatusEl.textContent = err.message || 'Failed to delete seminar.';
        }
      });
    });
  };

  const renderDeletedSeminars = (seminars) => {
    if (!deletedSeminarsListEl) return;
    if (!Array.isArray(seminars) || seminars.length === 0) {
      deletedSeminarsListEl.innerHTML = '<p class="muted">No recently deleted seminars.</p>';
      return;
    }

    deletedSeminarsListEl.innerHTML = seminars
      .map((seminar) => {
        return `
          <article class="card" style="box-shadow:none; padding:0.75rem 0.9rem;">
            <div style="display:flex; justify-content:space-between; gap:0.8rem; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <div style="font-weight:700; color:var(--xu-blue);">${escapeHtml(seminar?.title || 'Untitled seminar')}</div>
                <div class="muted small" style="margin-top:0.18rem;">${escapeHtml(formatDate(seminar?.date))} - ${escapeHtml(formatTime(seminar?.startTime))}</div>
                ${Array.isArray(seminar?.sessions) && seminar.sessions.length > 1
                  ? buildAdminSessionsScheduleBlock(seminar.sessions, {
                      label: seminar.multiSessionType === 'pick-one' ? 'All session options' : 'Every session',
                    })
                  : ''}
                <div class="muted small" style="margin-top:0.1rem;">${escapeHtml(getRetentionDaysLeftText(seminar?.deletePermanentlyAt))}</div>
              </div>
              <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
                <button class="btn" type="button" data-seminar-restore="${escapeHtml(seminar?._id || '')}">Restore</button>
                <button class="btn secondary" type="button" data-seminar-permanent-delete="${escapeHtml(seminar?._id || '')}" style="border-color:#dc2626; color:#b91c1c;">Delete Permanently</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    deletedSeminarsListEl.querySelectorAll('[data-seminar-restore]').forEach((button) => {
      button.addEventListener('click', async () => {
        const seminarId = button.getAttribute('data-seminar-restore');
        if (!seminarId) return;
        try {
          const res = await authedFetch(`/api/admin/seminars/${seminarId}/restore`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || 'Failed to restore seminar');
          if (deletedSeminarsStatusEl) deletedSeminarsStatusEl.textContent = data?.message || 'Seminar restored successfully.';
          await loadSummary();
          await loadSeminars();
        } catch (err) {
          console.error('[admin] restore seminar failed', err);
          if (deletedSeminarsStatusEl) deletedSeminarsStatusEl.textContent = err.message || 'Failed to restore seminar.';
        }
      });
    });

    deletedSeminarsListEl.querySelectorAll('[data-seminar-permanent-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const seminarId = button.getAttribute('data-seminar-permanent-delete');
        if (!seminarId) return;
        const ok = window.confirm('Permanently delete this seminar? This cannot be undone.');
        if (!ok) return;
        try {
          const res = await authedFetch(`/api/admin/seminars/${seminarId}/permanent`, { method: 'DELETE' });
          const contentType = String(res.headers.get('content-type') || '').toLowerCase();
          const data = contentType.includes('application/json') ? await res.json() : { message: await res.text() };
          if (!res.ok) throw new Error(data?.message || 'Failed to permanently delete seminar');
          if (deletedSeminarsStatusEl) deletedSeminarsStatusEl.textContent = data?.message || 'Seminar permanently deleted.';
          await loadSummary();
          await loadSeminars();
        } catch (err) {
          console.error('[admin] permanently delete seminar failed', err);
          if (deletedSeminarsStatusEl) deletedSeminarsStatusEl.textContent = err.message || 'Failed to permanently delete seminar.';
        }
      });
    });
  };

  const loadDeletedSeminars = async () => {
    if (deletedSeminarsStatusEl) deletedSeminarsStatusEl.textContent = '';
    if (deletedSeminarsListEl) deletedSeminarsListEl.innerHTML = '';
    const deletedRes = await authedFetch('/api/admin/seminars/deleted');
    const deletedData = await deletedRes.json();
    if (!deletedRes.ok) throw new Error(deletedData?.message || 'Failed to load recently deleted seminars');
    deletedSeminars = Array.isArray(deletedData) ? deletedData : [];
    renderDeletedSeminars(deletedSeminars);
  };

  const populateSeminarYearFilter = (seminars) => {
    if (!seminarsYearFilterEl) return;
    const currentValue = seminarsYearFilterEl.value;
    const years = [...new Set(
      (Array.isArray(seminars) ? seminars : [])
        .map((seminar) => {
          const d = new Date(seminar?.date);
          return Number.isNaN(d.getTime()) ? null : String(d.getFullYear());
        })
        .filter(Boolean)
    )].sort((a, b) => Number(b) - Number(a));

    seminarsYearFilterEl.innerHTML = ['<option value="">All Years</option>']
      .concat(years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`))
      .join('');

    if (currentValue && years.includes(currentValue)) {
      seminarsYearFilterEl.value = currentValue;
    }
  };

  const getFilteredSeminars = () => {
    const query = String(seminarFilters.query || '').trim().toLowerCase();
    const month = String(seminarFilters.month || '');
    const year = String(seminarFilters.year || '');

    return currentSeminars.filter((seminar) => {
      const title = String(seminar?.title || '').toLowerCase();
      const date = new Date(seminar?.date);
      const isValidDate = !Number.isNaN(date.getTime());

      const queryMatch = !query || title.includes(query);
      const monthMatch = !month || (isValidDate && String(date.getMonth()) === month);
      const yearMatch = !year || (isValidDate && String(date.getFullYear()) === year);

      return queryMatch && monthMatch && yearMatch;
    });
  };

  const applySeminarFilters = () => {
    const filtered = sortSeminarsByMode(getFilteredSeminars(), seminarSortMode);
    renderSeminarsCarousel(filtered);
    applySeminarsViewMode();

    if (seminarsFilterStatusEl) {
      const hasFilter = Boolean(
        String(seminarFilters.query || '').trim() || String(seminarFilters.month || '') || String(seminarFilters.year || '')
      );
      seminarsFilterStatusEl.textContent = hasFilter
        ? `${filtered.length} seminar(s) match your filter.`
        : '';
      if (hasFilter && filtered.length === 0) {
        seminarsFilterStatusEl.textContent = 'No seminars match your filter.';
      }
    }
  };

  const loadSeminars = async () => {
    if (seminarsStatusEl) seminarsStatusEl.textContent = '';
    if (seminarsCarouselEl) seminarsCarouselEl.innerHTML = '';
    try {
      const res = await authedFetch('/api/admin/seminars');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load seminars');
      currentSeminars = sortSeminarsNearestToFarthest(Array.isArray(data) ? data : []);
      populateSeminarYearFilter(currentSeminars);
      applySeminarFilters();
      if (isDeletedSeminarsModalOpen) {
        await loadDeletedSeminars();
      }
      if (typeof updateSeminarsNotificationDot === 'function') {
        updateSeminarsNotificationDot();
      }
    } catch (err) {
      console.error('[admin] load seminars failed', err);
      if (seminarsStatusEl) seminarsStatusEl.textContent = err.message || 'Failed to load seminars.';
      if (isDeletedSeminarsModalOpen && deletedSeminarsStatusEl) {
        deletedSeminarsStatusEl.textContent = err.message || 'Failed to load recently deleted seminars.';
      }
    }
  };

  const renderEmployeesTable = (rows) => {
    closeAccountStatusMenu();
    if (!Array.isArray(rows) || rows.length === 0) {
      employeesTableEl.innerHTML = '<p class="muted">No employees found.</p>';
      return;
    }

    const checkboxesEnabled = Boolean(selectModeEl?.checked);
    const body = rows
      .map((row) => {
        const checkboxStyle = checkboxesEnabled ? '' : 'display:none';
        const isComplete = row.seminarStatus === 'Complete';
        const statusBadge = `<span class="badge ${isComplete ? 'badge-green' : 'badge-red'}">${row.seminarStatus}</span>`;
        const accountBadge = getAccountStatusBadge(row.accountStatus);
        return `
          <tr data-row-id="${row.id}">
            <td><button class="table-link-btn" type="button" data-employee-profile="${row.id}">${escapeHtml(row.name)}</button></td>
            <td><input type="checkbox" class="admin-row-check" value="${row.id}" style="${checkboxStyle}" /></td>
            <td>${escapeHtml(row.employeeId)}</td>
            <td>${escapeHtml(row.department)}</td>
            <td>${escapeHtml(formatRegisteredDate(row.registeredAt))}</td>
            <td>${statusBadge}</td>
            <td><button class="table-link-btn" type="button" data-employee-account-menu="${row.id}">${accountBadge}</button></td>
          </tr>
        `;
      })
      .join('');

    employeesTableEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Profile</th>
            <th><input type="checkbox" id="admin-select-all" ${checkboxesEnabled ? '' : 'disabled'} /></th>
            <th>Employee ID</th>
            <th>Department</th>
            <th>Registered</th>
            <th>Seminar Status</th>
            <th>Account</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;

    const syncRowSelection = (checkbox) => {
      const tr = checkbox.closest('tr');
      if (tr) tr.classList.toggle('is-selected', checkbox.checked);
    };

    employeesTableEl.querySelectorAll('.admin-row-check').forEach((checkbox) => {
      checkbox.addEventListener('change', () => syncRowSelection(checkbox));
    });

    document.getElementById('admin-select-all')?.addEventListener('change', (event) => {
      const checked = Boolean(event.target.checked);
      employeesTableEl.querySelectorAll('.admin-row-check').forEach((checkbox) => {
        if (checkbox.style.display === 'none') return;
        checkbox.checked = checked;
        syncRowSelection(checkbox);
      });
    });

    employeesTableEl.querySelectorAll('[data-employee-profile]').forEach((button) => {
      button.addEventListener('click', async () => {
        const row = rows.find((item) => String(item.id) === String(button.getAttribute('data-employee-profile')));
        if (row) await showEmployeeProfile(row);
      });
    });

    employeesTableEl.querySelectorAll('[data-employee-account-menu]').forEach((button) => {
      const row = rows.find((item) => String(item.id) === String(button.getAttribute('data-employee-account-menu')));
      if (!row) return;
      button.addEventListener('click', (event) => {
        openAccountStatusMenu(event, row);
      });
      button.addEventListener('contextmenu', (event) => {
        openAccountStatusMenu(event, row);
      });
    });
  };

  const loadDepartmentsAndEmployees = async () => {
    employeesStatusEl.textContent = '';
    employeesTableEl.innerHTML = '';
    populateClusterFilter();
    populateDepartmentFilter();
    try {
      const name = String(employeeSearchEl?.value || '').trim();
      const cluster = clusterFilterEl?.value || '';
      const department = departmentFilterEl?.value || '';
      const accountStatus = accountStatusFilterEl?.value || 'active';
      const params = new URLSearchParams();
      if (name) params.set('name', name);
      if (department) params.set('department', department);
      if (accountStatus) params.set('accountStatus', accountStatus);
      const query = params.toString();
      const url = query ? `/api/admin/employees?${query}` : '/api/admin/employees';
      const res = await authedFetch(url, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load employees');

      if (Array.isArray(data.departments)) {
        populateDepartmentFilter(data.departments);
      }

      let rows = Array.isArray(data.rows) ? data.rows : [];
      if (cluster && !department) {
        const clusterDepts = window.XU_DEPARTMENTS?.[cluster] || [];
        rows = rows.filter((r) => clusterDepts.includes(r.department));
      }
      renderEmployeesTable(rows);
    } catch (err) {
      console.error('[admin] load employees failed', err);
      employeesStatusEl.textContent = err.message || 'Failed to load employees.';
      if (String(err.message || '').toLowerCase().includes('invalid token')) {
        window.localStorage.removeItem('gims_employee_token');
        window.localStorage.removeItem('gims_role');
        window.location.replace('/');
      }
    }
  };

  const loadSummary = async () => {
    const res = await authedFetch('/api/admin/reports/summary');
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Failed to load summary');
    totalEmployeesEl.textContent = String(data.totalEmployees ?? 0);
    completionRateEl.textContent = `${String(data.completionRatePercent ?? 0)}%`;
    compliantEmployeesEl.textContent = String(data.compliant ?? 0);
  };

  const notifBellBtn = document.getElementById('admin-notif-bell-btn');
  const notifBellWrapper = document.getElementById('admin-notif-bell-wrapper');
  const notifBadgeEl = document.getElementById('admin-notif-badge');
  const notifDropdownEl = document.getElementById('admin-notif-dropdown');
  const notifListEl = document.getElementById('admin-notif-list');
  const notifRefreshBtn = document.getElementById('admin-notif-refresh-btn');
  const notifClearBtn = document.getElementById('admin-notif-clear-btn');
  const adminDismissedNotifKey = 'gims_admin_dismissed_notifications';
  let latestAdminNotifItems = [];

  const getAdminNotifKey = (item) => [
    item?.type || '',
    item?.seminarId || '',
    item?.count || 0,
    item?.timestamp ? new Date(item.timestamp).getTime() : '',
  ].join(':');

  const loadDismissedAdminNotifs = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(adminDismissedNotifKey) || '[]');
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch {
      return new Set();
    }
  };

  const saveDismissedAdminNotifs = (keys) => {
    window.localStorage.setItem(adminDismissedNotifKey, JSON.stringify(Array.from(keys)));
  };

  const formatNotifTime = (date) => {
    if (!date) return '';
    const then = new Date(date).getTime();
    if (Number.isNaN(then)) return '';
    const diffMs = Date.now() - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const renderAdminNotifications = (items) => {
    if (!notifListEl) return;
    if (!Array.isArray(items) || items.length === 0) {
      notifListEl.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
      return;
    }
    const iconFor = (type) => {
      if (type === 'pre-registration') return '<i class="fa-solid fa-user-plus" style="color:#b45309;"></i>';
      if (type === 'evaluation') return '<i class="fa-solid fa-clipboard-check" style="color:#059669;"></i>';
      return '<i class="fa-solid fa-bell" style="color:var(--xu-blue);"></i>';
    };
    notifListEl.innerHTML = items
      .map((n) => `
        <div class="notif-item unread" data-seminar-id="${escapeHtml(String(n.seminarId || ''))}" data-notif-type="${escapeHtml(String(n.type || ''))}">
          <span class="notif-icon">${iconFor(n.type)}</span>
          <div class="notif-item-body">
            <div class="notif-item-msg">${escapeHtml(n.message)}</div>
            <div class="notif-item-time">${escapeHtml(formatNotifTime(n.timestamp))}</div>
          </div>
        </div>
      `)
      .join('');

    notifListEl.querySelectorAll('.notif-item').forEach((item) => {
      item.addEventListener('click', () => {
        notifDropdownEl?.classList.remove('is-open');
        showNavModule('seminars');
      });
    });
  };

  const updateAdminNotificationBell = async () => {
    if (!notifBadgeEl) return;
    try {
      const res = await authedFetch('/api/admin/notifications/bell');
      if (!res.ok) return;
      const data = await res.json();
      const dismissedKeys = loadDismissedAdminNotifs();
      const items = (Array.isArray(data?.items) ? data.items : [])
        .filter((item) => !dismissedKeys.has(getAdminNotifKey(item)));
      const unread = Number(data?.unreadCount || items.length || 0);
      latestAdminNotifItems = items;

      renderAdminNotifications(items);

      if (items.length > 0) {
        notifBadgeEl.textContent = items.length > 99 ? '99+' : String(items.length);
        notifBadgeEl.style.display = 'flex';
      } else {
        notifBadgeEl.style.display = 'none';
      }
    } catch {
      // Silent — the bell is non-critical UI.
    }
  };

  // Backwards-compatible alias used elsewhere in this file. The prior sidebar
  // dot was removed, but other callsites still invoke this name to refresh
  // notification state after seminar mutations.
  const updateSeminarsNotificationDot = updateAdminNotificationBell;

  notifBellBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!notifDropdownEl) return;
    const isOpen = notifDropdownEl.classList.contains('is-open');
    notifDropdownEl.classList.toggle('is-open', !isOpen);
    if (!isOpen) updateAdminNotificationBell();
  });

  notifRefreshBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateAdminNotificationBell();
  });

  notifClearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (latestAdminNotifItems.length === 0) return;
    if (!window.confirm('Clear all notifications? This cannot be undone.')) return;
    const dismissedKeys = loadDismissedAdminNotifs();
    latestAdminNotifItems.forEach((item) => dismissedKeys.add(getAdminNotifKey(item)));
    saveDismissedAdminNotifs(dismissedKeys);
    latestAdminNotifItems = [];
    renderAdminNotifications([]);
    if (notifBadgeEl) notifBadgeEl.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (notifBellWrapper && !notifBellWrapper.contains(e.target)) {
      notifDropdownEl?.classList.remove('is-open');
    }
  });

  const loadAll = async () => {
    await loadSummary();
    await loadDepartmentsAndEmployees();
    await loadSeminars();
    await updateSeminarsNotificationDot();
    window.localStorage.setItem('gims_role', 'admin');
  };

  // Refresh the badge on a light interval so admins see new pre-registrations
  // without a full page reload.
  setInterval(() => { updateSeminarsNotificationDot(); }, 60_000);

  // ========================
  // EVENT LISTENERS
  // ========================

  document.querySelectorAll('[data-scroll-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-scroll-target');
      if (!targetId) return;
      if (targetId === 'admin-create-seminar-card') {
        openCreateSeminarModal();
        return;
      }
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  let navScrollSpyLockedUntil = 0;
  sidebarNavButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navScrollSpyLockedUntil = Date.now() + 800;
      showNavModule(btn.getAttribute('data-nav'));
    });
  });

  const setActiveNav = (key) => {
    sidebarNavButtons.forEach((btn) => {
      const btnKey = String(btn.getAttribute('data-nav') || '').toLowerCase();
      btn.classList.toggle('is-active', btnKey === key);
    });
    if (moduleHintEl) {
      const hintMap = {
        dashboard: 'Current View: Overview',
        seminars: 'Current View: Manage Seminars',
        'create-admin': 'Current View: Admin Accounts',
        employees: 'Current View: Employee Records',
        maintenance: 'Current View: Maintenance',
      };
      moduleHintEl.textContent = hintMap[key] || 'Current View: Overview';
    }
  };

  const updateOverviewSpy = () => {
    if (Date.now() < navScrollSpyLockedUntil) return;
    if (!dashboardWrapperEl) return;
    if (dashboardWrapperEl.style.display === 'none') return;
    const employeesCard = document.getElementById('admin-employees-card');
    if (!employeesCard) return;
    const probe = window.innerHeight * 0.3;
    const rect = employeesCard.getBoundingClientRect();
    const nearBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 8;
    const inEmployees = rect.top <= probe || nearBottom;
    setActiveNav(inEmployees ? 'employees' : 'dashboard');
  };

  window.addEventListener('scroll', updateOverviewSpy, { passive: true });
  window.addEventListener('resize', updateOverviewSpy, { passive: true });

  seminarsPrevBtn?.addEventListener('click', () => {
    if (!seminarsCarouselEl) return;
    const amount = Math.max(320, seminarsCarouselEl.clientWidth * 0.9);
    seminarsCarouselEl.scrollBy({ left: -amount, behavior: 'smooth' });
  });

  seminarsNextBtn?.addEventListener('click', () => {
    if (!seminarsCarouselEl) return;
    const amount = Math.max(320, seminarsCarouselEl.clientWidth * 0.9);
    seminarsCarouselEl.scrollBy({ left: amount, behavior: 'smooth' });
  });

  seminarsSearchEl?.addEventListener('input', () => {
    seminarFilters.query = seminarsSearchEl.value || '';
    applySeminarFilters();
  });

  seminarsMonthFilterEl?.addEventListener('change', () => {
    seminarFilters.month = seminarsMonthFilterEl.value || '';
    applySeminarFilters();
  });

  seminarsYearFilterEl?.addEventListener('change', () => {
    seminarFilters.year = seminarsYearFilterEl.value || '';
    applySeminarFilters();
  });

  seminarsClearFiltersBtn?.addEventListener('click', () => {
    seminarFilters = { query: '', month: '', year: '' };
    if (seminarsSearchEl) seminarsSearchEl.value = '';
    if (seminarsMonthFilterEl) seminarsMonthFilterEl.value = '';
    if (seminarsYearFilterEl) seminarsYearFilterEl.value = '';
    applySeminarFilters();
  });

  seminarsViewSwipeBtn?.addEventListener('click', () => {
    seminarViewMode = 'swipe';
    applySeminarsViewMode();
  });
  seminarsViewGridBtn?.addEventListener('click', () => {
    seminarViewMode = 'grid';
    applySeminarsViewMode();
  });
  seminarsViewListBtn?.addEventListener('click', () => {
    seminarViewMode = 'list';
    applySeminarsViewMode();
  });
  seminarsSortBtn?.addEventListener('click', openSeminarsSortMenu);

  toggleDeletedSeminarsBtn?.addEventListener('click', async () => {
    setDeletedSeminarsModalVisibility(true);
    try {
      await loadDeletedSeminars();
    } catch (err) {
      console.error('[admin] load recently deleted seminars failed', err);
      if (deletedSeminarsStatusEl) {
        deletedSeminarsStatusEl.textContent = err.message || 'Failed to load recently deleted seminars.';
      }
    }
  });

  deletedSeminarsCloseBtn?.addEventListener('click', closeDeletedSeminarsModal);
  deletedSeminarsModalEl?.addEventListener('click', (event) => {
    if (event.target === deletedSeminarsModalEl) closeDeletedSeminarsModal();
  });

  if (createSeminarDateInput) {
    createSeminarDateInput.min = getTodayDateInputValue();
  }

  createSeminarClearBtn?.addEventListener('click', () => {
    createSeminarForm?.reset();
    if (createSeminarStatusEl) createSeminarStatusEl.textContent = '';
    calState.create.sessions = new Map();
    const toggle = document.getElementById('create-multi-session-toggle');
    if (toggle) toggle.checked = false;
    setCalendarMode('create', false);
    if (createSeminarDateInput) createSeminarDateInput.min = getTodayDateInputValue();
  });

  createSeminarCloseBtn?.addEventListener('click', closeCreateSeminarModal);
  createSeminarModalEl?.addEventListener('click', (event) => {
    if (event.target === createSeminarModalEl) closeCreateSeminarModal();
  });

  employeeModalCloseBtn?.addEventListener('click', closeEmployeeProfileModal);
  employeeModalEl?.addEventListener('click', (event) => {
    if (event.target === employeeModalEl) closeEmployeeProfileModal();
  });

  seminarEditCloseBtn?.addEventListener('click', closeSeminarEditModal);
  seminarEditCancelBtn?.addEventListener('click', closeSeminarEditModal);
  seminarEditModalEl?.addEventListener('click', (event) => {
    if (event.target === seminarEditModalEl) closeSeminarEditModal();
  });

  seminarParticipantsCloseBtn?.addEventListener('click', closeSeminarParticipantsModal);
  seminarParticipantsModalEl?.addEventListener('click', (event) => {
    if (event.target === seminarParticipantsModalEl) closeSeminarParticipantsModal();
  });

  attendanceSelectAllEl?.addEventListener('change', () => {
    if (!seminarParticipantsListEl) return;
    const checked = Boolean(attendanceSelectAllEl.checked);
    seminarParticipantsListEl.querySelectorAll('.admin-attendance-row-check').forEach((checkbox) => {
      if (checkbox.disabled) return;
      checkbox.checked = checked;
    });
  });

  seminarHeldBtn?.addEventListener('click', async () => {
    if (!attendanceModalState.seminarId) return;
    try {
      const targetHeld = !attendanceModalState.isHeld;
      const res = await authedFetch(`/api/admin/seminars/${attendanceModalState.seminarId}/held`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHeld: targetHeld }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to update held status');
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = data?.message || 'Held status updated.';
      await loadSeminars();
      const seminar = currentSeminars.find((item) => String(item._id) === String(attendanceModalState.seminarId));
      if (seminar) await openParticipantsModal(seminar);
    } catch (err) {
      console.error('[admin] toggle seminar held failed (participants)', err);
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = err.message || 'Failed to update held status.';
    }
  });

  markAttendanceBtn?.addEventListener('click', async () => {
    if (!attendanceModalState.seminarId || !seminarParticipantsListEl) return;

    const selected = Array.from(seminarParticipantsListEl.querySelectorAll('.admin-attendance-row-check'))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    try {
      const res = await authedFetch(`/api/admin/seminars/${attendanceModalState.seminarId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendedRegistrationIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to record attendance');
      attendanceModalState.attendanceSaved = true;
      if (seminarParticipantsStatusEl) {
        seminarParticipantsStatusEl.textContent =
          data?.message || `Attendance updated. Attended: ${data.attendedCount || 0}, Absent: ${data.absentCount || 0}`;
      }
      await loadSummary();
      await loadSeminars();
      const seminar = currentSeminars.find((item) => String(item._id) === String(attendanceModalState.seminarId));
      if (seminar) await openParticipantsModal(seminar);
    } catch (err) {
      console.error('[admin] record attendance failed', err);
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = err.message || 'Failed to record attendance.';
    }
  });

  sendCertificatesBtn?.addEventListener('click', async () => {
    if (!attendanceModalState.seminarId || !seminarParticipantsListEl) return;
    const selected = Array.from(seminarParticipantsListEl.querySelectorAll('.admin-attendance-row-check'))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (!selected.length) {
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = 'Select attended participants first.';
      return;
    }

    if (!attendanceModalState.attendanceSaved) {
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = 'Save attendance first before sending certificates.';
      return;
    }

    try {
      const res = await authedFetch(`/api/admin/seminars/${attendanceModalState.seminarId}/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to send certificates');
      if (seminarParticipantsStatusEl) {
        seminarParticipantsStatusEl.textContent =
          data?.message || `Certificates released to ${data.releasedCount || 0} attendee(s).`;
      }
      const seminar = currentSeminars.find((item) => String(item._id) === String(attendanceModalState.seminarId));
      if (seminar) await openParticipantsModal(seminar);
    } catch (err) {
      console.error('[admin] send certificates failed', err);
      if (seminarParticipantsStatusEl) seminarParticipantsStatusEl.textContent = err.message || 'Failed to send certificates.';
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAccountStatusMenu();
      closeDeletedSeminarsModal();
      closeEmployeeProfileModal();
      closeSeminarEditModal();
      closeSeminarParticipantsModal();
    }
  });

  document.addEventListener('click', () => {
    closeAccountStatusMenu();
  });

  seminarEditForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (seminarEditStatusEl) seminarEditStatusEl.textContent = '';
    const formData = new FormData(seminarEditForm);
    const formBody = Object.fromEntries(formData.entries());
    const seminarId = formBody.seminarId;
    if (!seminarId) return;

    const isMulti = document.getElementById('edit-multi-session-toggle')?.checked;
    const editAutoSendCheckbox = document.getElementById('edit-auto-send-cert-checkbox');
    const autoSendCertificates = editAutoSendCheckbox?.checked ? 'true' : 'false';

    const payload = {
      title: formBody.title,
      description: formBody.description,
      location: formBody.location || '',
      resourcePerson: formBody.resourcePerson || '',
      mandatory: formBody.mandatory,
      capacity: formBody.capacity,
      autoSendCertificates,
      certificateReleaseMode: autoSendCertificates === 'true' ? 'automatic' : 'evaluation',
    };

    if (isMulti) {
      const sessions = collectSessions('edit');
      if (!sessions.length) {
        if (seminarEditStatusEl) seminarEditStatusEl.textContent = 'Select at least one session on the calendar.';
        return;
      }
      payload.sessions = sessions;
      const sessionTypeInput = document.querySelector('input[name="edit-multiSessionType"]:checked');
      payload.multiSessionType = sessions.length > 1 ? (sessionTypeInput?.value || 'all') : 'all';
    } else {
      const today = getTodayDateInputValue();
      if (!formBody.date || String(formBody.date) < today) {
        if (seminarEditStatusEl) seminarEditStatusEl.textContent = 'Seminar date cannot be in the past.';
        return;
      }
      payload.date = formBody.date;
      payload.startTime = formBody.startTime;
      payload.durationHours = formBody.durationHours;
    }

    try {
      const res = await authedFetch(`/api/admin/seminars/${seminarId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to update seminar');
      if (seminarEditStatusEl) seminarEditStatusEl.textContent = 'Seminar updated successfully.';
      closeSeminarEditModal();
      if (seminarsStatusEl) seminarsStatusEl.textContent = 'Seminar updated successfully.';
      await loadSeminars();
    } catch (err) {
      console.error('[admin] update seminar failed', err);
      if (seminarEditStatusEl) seminarEditStatusEl.textContent = err.message || 'Failed to update seminar.';
    }
  });

  createAdminForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (createAdminStatusEl) createAdminStatusEl.textContent = '';
    const body = Object.fromEntries(new FormData(createAdminForm).entries());
    const pw = String(body.password || '');
    if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      if (createAdminStatusEl)
        createAdminStatusEl.textContent =
          'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';
      return;
    }
    try {
      const res = await authedFetch('/api/admin/seed-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Admin creation failed');
      if (createAdminStatusEl) createAdminStatusEl.textContent = 'Admin account created successfully.';
      setTimeout(() => {
        createAdminForm.reset();
        if (createAdminStatusEl) createAdminStatusEl.textContent = '';
      }, 2000);
    } catch (err) {
      console.error('[admin] create admin failed', err);
      if (createAdminStatusEl) createAdminStatusEl.textContent = err.message || 'Admin creation failed.';
    }
  });

  createSeminarForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (createSeminarStatusEl) createSeminarStatusEl.textContent = '';
    const formData = new FormData(createSeminarForm);
    const body = Object.fromEntries(formData.entries());
    const releaseMode = String(body.certificateReleaseMode || 'evaluation').toLowerCase();
    const isMulti = document.getElementById('create-multi-session-toggle')?.checked;

    const payload = {
      title: body.title,
      description: body.description,
      location: body.location || '',
      resourcePerson: body.resourcePerson || '',
      capacity: body.capacity,
      mandatory: body.mandatory,
      certificateReleaseMode: releaseMode,
      autoSendCertificates: releaseMode === 'automatic' ? 'true' : 'false',
    };

    if (isMulti) {
      const sessions = collectSessions('create');
      if (!sessions.length) {
        if (createSeminarStatusEl) createSeminarStatusEl.textContent = 'Select at least one session date on the calendar.';
        return;
      }
      payload.sessions = sessions;
      const sessionTypeInput = document.querySelector('input[name="create-multiSessionType"]:checked');
      payload.multiSessionType = sessions.length > 1 ? (sessionTypeInput?.value || 'all') : 'all';
    } else {
      const today = getTodayDateInputValue();
      if (!body.date || String(body.date) < today) {
        if (createSeminarStatusEl) createSeminarStatusEl.textContent = 'Seminar date cannot be in the past.';
        return;
      }
      payload.date = body.date;
      payload.startTime = body.startTime;
      payload.durationHours = body.durationHours;
    }

    try {
      const res = await authedFetch('/api/admin/seminars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Seminar creation failed');
      if (createSeminarStatusEl) createSeminarStatusEl.textContent = 'Seminar created successfully.';
      createSeminarForm.reset();
      calState.create.sessions = new Map();
      const toggle = document.getElementById('create-multi-session-toggle');
      if (toggle) toggle.checked = false;
      const defaultTypeRadio = document.querySelector('input[name="create-multiSessionType"][value="all"]');
      if (defaultTypeRadio) defaultTypeRadio.checked = true;
      setCalendarMode('create', false);
      if (createSeminarDateInput) createSeminarDateInput.min = getTodayDateInputValue();
      await loadSummary();
      await loadDepartmentsAndEmployees();
      await loadSeminars();
      closeCreateSeminarModal();
    } catch (err) {
      console.error('[admin] create seminar failed', err);
      if (createSeminarStatusEl) createSeminarStatusEl.textContent = err.message || 'Seminar creation failed.';
    }
  });

  selectModeEl?.addEventListener('change', async () => {
    await loadDepartmentsAndEmployees();
  });

  employeeSearchEl?.addEventListener('input', () => {
    if (employeeSearchDebounceId) {
      window.clearTimeout(employeeSearchDebounceId);
    }
    employeeSearchDebounceId = window.setTimeout(async () => {
      await loadDepartmentsAndEmployees();
    }, 220);
  });

  const syncAccountStatusChip = () => {
    if (!accountStatusFilterEl) return;
    accountStatusFilterEl.classList.toggle(
      'is-active',
      (accountStatusFilterEl.value || 'active') !== 'active'
    );
  };
  syncAccountStatusChip();
  accountStatusFilterEl?.addEventListener('change', async () => {
    syncAccountStatusChip();
    await loadDepartmentsAndEmployees();
  });

  notifyBtn?.addEventListener('click', async () => {
    employeesStatusEl.textContent = '';
    try {
      const selected = Array.from(employeesTableEl.querySelectorAll('.admin-row-check'))
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      if (selected.length === 0) {
        employeesStatusEl.textContent = 'No employees selected.';
        return;
      }

      const res = await authedFetch('/api/admin/employees/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Notify failed');
      employeesStatusEl.textContent =
        data?.sent !== undefined ? `Emails sent successfully (${data.sent}).` : 'Emails sent successfully.';
      await loadSummary();
    } catch (err) {
      console.error('[admin] send emails failed', err);
      employeesStatusEl.textContent = err.message || 'Failed to send emails.';
    }
  });

  const exportFormatEl = document.getElementById('admin-export-format');
  exportBtn?.addEventListener('click', async () => {
    employeesStatusEl.textContent = '';
    const format = (exportFormatEl?.value || 'pdf').toLowerCase();
    const isPdf = format === 'pdf';
    const baseEndpoint = isPdf ? '/api/admin/reports/ched.pdf' : '/api/admin/reports/employees.csv';
    const filename = isPdf ? 'gims_ched_report.pdf' : 'gims_employees.csv';
    const mime = isPdf ? 'application/pdf' : 'text/csv';

    const selectModeOn = Boolean(selectModeEl?.checked);
    const selectedIds = Array.from(employeesTableEl.querySelectorAll('.admin-row-check'))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
    if (selectModeOn && selectedIds.length === 0) {
      employeesStatusEl.textContent = 'No employees selected. Tick rows to include in the report, or turn off Select to export all.';
      return;
    }
    const endpoint = selectedIds.length
      ? `${baseEndpoint}?ids=${encodeURIComponent(selectedIds.join(','))}`
      : baseEndpoint;
    const originalLabel = exportBtn.textContent;
    exportBtn.disabled = true;
    const noun = selectedIds.length ? `${selectedIds.length} selected` : 'all';
    exportBtn.textContent = isPdf ? `Generating PDF (${noun})…` : `Exporting (${noun})…`;
    try {
      const res = await authedFetch(endpoint);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Export failed');
      }
      const blob = isPdf ? await res.blob() : new Blob([await res.text()], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[admin] export failed', err);
      employeesStatusEl.textContent = err.message || 'Failed to export.';
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = originalLabel;
    }
  });

  logoutBtn?.addEventListener('click', () => {
    window.localStorage.removeItem('gims_employee_token');
    window.localStorage.removeItem('gims_role');
    adminToken = null;
    window.location.replace('/');
  });

  // ---------------- Maintenance tab ----------------
  (function setupMaintenance() {
    const syInput = document.getElementById('maintenance-school-year');
    const previewBtn = document.getElementById('maintenance-preview-btn');
    const previewOut = document.getElementById('maintenance-preview-output');
    const downloadBtn = document.getElementById('maintenance-download-csv-btn');
    const downloadStatus = document.getElementById('maintenance-download-status');
    const cbSaved = document.getElementById('maintenance-confirm-saved');
    const cbUnderstand = document.getElementById('maintenance-confirm-understand');
    const phraseInput = document.getElementById('maintenance-phrase');
    const notesInput = document.getElementById('maintenance-notes');
    const resetBtn = document.getElementById('maintenance-reset-btn');
    const resetStatus = document.getElementById('maintenance-reset-status');
    const archivesList = document.getElementById('maintenance-archives-list');
    const archiveDetail = document.getElementById('maintenance-archive-detail');
    const logList = document.getElementById('maintenance-log-list');

    if (!syInput || !resetBtn) return;

    const RESET_PHRASE = 'GIMS MAINTENANCE';
    let csvDownloaded = false;

    const stepEls = {
      1: document.querySelector('[data-step="1"]'),
      2: document.querySelector('[data-step="2"]'),
      3: document.querySelector('[data-step="3"]'),
    };
    const setStepState = (n, state) => {
      const el = stepEls[n];
      if (!el) return;
      el.classList.remove('is-pending', 'is-active', 'is-complete');
      el.classList.add(state);
    };
    const refreshSteps = () => {
      const step2Done = cbSaved.checked && cbUnderstand.checked;
      const phraseDone = phraseInput.value.trim() === RESET_PHRASE;

      setStepState(1, csvDownloaded ? 'is-complete' : 'is-active');

      if (!csvDownloaded) setStepState(2, 'is-pending');
      else setStepState(2, step2Done ? 'is-complete' : 'is-active');

      if (!csvDownloaded || !step2Done) setStepState(3, 'is-pending');
      else setStepState(3, phraseDone ? 'is-complete' : 'is-active');
    };

    const escapeHtml = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const authFetch = (url, opts = {}) => fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const updateGate = () => {
      const ok = csvDownloaded && cbSaved.checked && cbUnderstand.checked
        && phraseInput.value.trim() === RESET_PHRASE;
      resetBtn.disabled = !ok;
      refreshSteps();
    };

    const enableStep2Onwards = () => {
      cbSaved.disabled = false;
      cbUnderstand.disabled = false;
      phraseInput.disabled = false;
      notesInput.disabled = false;
      updateGate();
    };

    [cbSaved, cbUnderstand].forEach((el) => el.addEventListener('change', updateGate));
    phraseInput.addEventListener('input', updateGate);
    refreshSteps();

    previewBtn.addEventListener('click', async () => {
      const sy = syInput.value.trim();
      if (!sy) {
        previewOut.textContent = 'Enter a school year first (e.g. 2025-2026).';
        return;
      }
      previewOut.textContent = 'Loading preview…';
      try {
        const res = await authFetch(`/api/admin/maintenance/preview?schoolYear=${encodeURIComponent(sy)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Preview failed');
        const c = data.counts || {};
        previewOut.innerHTML =
          `<strong>School year ${escapeHtml(data.schoolYear)}:</strong> ` +
          `${c.seminars} seminar(s), ${c.registrations} registration(s), ` +
          `${c.certificatesIssued} certificate(s) issued, ` +
          `${c.employeesAffected} employee(s) will have their counts reset.`;
      } catch (err) {
        previewOut.textContent = err.message || 'Preview failed.';
      }
    });

    downloadBtn.addEventListener('click', async () => {
      const sy = syInput.value.trim();
      if (!sy) {
        downloadStatus.textContent = 'Enter a school year first.';
        return;
      }
      downloadStatus.textContent = 'Generating XLSX…';
      try {
        const res = await authFetch(`/api/admin/maintenance/masterlist.xlsx?schoolYear=${encodeURIComponent(sy)}`);
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'Download failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GIMS_Masterlist_${sy}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        csvDownloaded = true;
        enableStep2Onwards();
        downloadStatus.textContent = 'Masterlist downloaded. You may now proceed.';
      } catch (err) {
        downloadStatus.textContent = err.message || 'Download failed.';
      }
    });

    resetBtn.addEventListener('click', async () => {
      const sy = syInput.value.trim();
      if (!confirm(`Final confirmation:\n\nReset school year ${sy}?\n\nThis archives EVERY existing seminar and registration under "${sy}" and clears every employee's certificate count. After this, the live seminar list will be empty. This cannot be undone from the UI.`)) {
        return;
      }
      resetBtn.disabled = true;
      resetStatus.textContent = 'Resetting…';
      try {
        const res = await authFetch('/api/admin/maintenance/reset-school-year', {
          method: 'POST',
          body: JSON.stringify({
            schoolYear: sy,
            confirmPhrase: phraseInput.value.trim(),
            notes: notesInput.value.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Reset failed');
        const c = data.counts || {};
        resetStatus.innerHTML =
          `<span style="color:#0a7a0a;"><strong>Reset complete.</strong> ` +
          `Archived ${c.registrationsArchived} registration(s) and ` +
          `${c.seminarsArchived} seminar(s) across ${c.employeesAffected} employee(s).</span>`;
        // Reset gate
        csvDownloaded = false;
        cbSaved.checked = false;
        cbUnderstand.checked = false;
        phraseInput.value = '';
        notesInput.value = '';
        cbSaved.disabled = true;
        cbUnderstand.disabled = true;
        phraseInput.disabled = true;
        notesInput.disabled = true;
        updateGate();
        loadArchives();
        loadLogs();
      } catch (err) {
        resetStatus.textContent = err.message || 'Reset failed.';
        updateGate();
      }
    });

    const loadArchives = async () => {
      archivesList.innerHTML = '<p class="muted">Loading…</p>';
      try {
        const res = await authFetch('/api/admin/maintenance/archives');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load archives');
        if (!data.archives.length) {
          archivesList.innerHTML = '<p class="muted">No archived school years yet.</p>';
          return;
        }
        archivesList.innerHTML = data.archives.map((a) => `
          <div style="border:1px solid var(--border); border-radius:0.5rem; padding:0.7rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong>${escapeHtml(a.schoolYear)}</strong>
              <span class="muted"> — ${a.seminars} seminar(s), ${a.registrations} registration(s), ${a.certificates} cert(s), ${a.employees} employee(s)</span>
            </div>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn secondary" type="button" data-archive-view="${escapeHtml(a.schoolYear)}">View</button>
              <button class="btn secondary" type="button" data-archive-csv="${escapeHtml(a.schoolYear)}">Download XLSX</button>
              <button class="btn secondary" type="button" data-archive-restore="${escapeHtml(a.schoolYear)}">Unarchive</button>
            </div>
          </div>
        `).join('');
        archivesList.querySelectorAll('[data-archive-view]').forEach((btn) => {
          btn.addEventListener('click', () => viewArchive(btn.getAttribute('data-archive-view')));
        });
        archivesList.querySelectorAll('[data-archive-csv]').forEach((btn) => {
          btn.addEventListener('click', () => downloadArchiveCsv(btn.getAttribute('data-archive-csv')));
        });
        archivesList.querySelectorAll('[data-archive-restore]').forEach((btn) => {
          btn.addEventListener('click', () => restoreArchive(btn.getAttribute('data-archive-restore')));
        });
      } catch (err) {
        archivesList.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Failed to load.')}</p>`;
      }
    };

    const viewArchive = async (sy) => {
      archiveDetail.innerHTML = `<p class="muted">Loading ${escapeHtml(sy)}…</p>`;
      try {
        const res = await authFetch(`/api/admin/maintenance/archives/${encodeURIComponent(sy)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        const seminarsHtml = (data.seminars || []).map((s) => `
          <li><strong>${escapeHtml(s.title)}</strong> <span class="muted">— ${s.date ? new Date(s.date).toLocaleDateString() : ''}, ${escapeHtml(s.location || '')}</span></li>
        `).join('');
        const employeesHtml = (data.employees || []).map((e) => `
          <details style="margin-bottom:0.4rem;">
            <summary><strong>${escapeHtml(e.employee.name || '(unknown)')}</strong> <span class="muted">— ${escapeHtml(e.employee.department || '')}, ${e.registrations.length} record(s)</span></summary>
            <ul style="margin:0.4rem 0 0.4rem 1.2rem;">
              ${e.registrations.map((r) => `
                <li>${escapeHtml(r.seminar.title || '(seminar)')} — ${escapeHtml(r.status || '')}${r.certificateIssued ? ` ✓ cert ${escapeHtml(r.certificateCode || '')}` : ''}</li>
              `).join('')}
            </ul>
          </details>
        `).join('');
        archiveDetail.innerHTML = `
          <div class="card" style="margin-top:0.5rem;">
            <h3 style="margin-top:0;">Archive — ${escapeHtml(data.schoolYear)}</h3>
            <p class="muted">${data.counts.seminars} seminar(s), ${data.counts.registrations} registration(s), ${data.counts.employees} employee(s).</p>
            <h4>Seminars</h4>
            <ul>${seminarsHtml || '<li class="muted">None</li>'}</ul>
            <h4>Employees</h4>
            ${employeesHtml || '<p class="muted">None</p>'}
          </div>
        `;
      } catch (err) {
        archiveDetail.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Failed.')}</p>`;
      }
    };

    const restoreArchive = async (sy) => {
      const phrase = window.prompt(
        `Unarchive school year ${sy}?\n\n` +
        `This moves every seminar and registration from this archive back into ` +
        `the live collections and re-adds them to each employee's record. ` +
        `The archive entry for ${sy} will be removed.\n\n` +
        `Type "GIMS MAINTENANCE" to confirm:`
      );
      if (phrase === null) return;
      if (phrase.trim() !== 'GIMS MAINTENANCE') {
        alert('Confirmation phrase did not match. Restore cancelled.');
        return;
      }
      try {
        const res = await authFetch(`/api/admin/maintenance/archives/${encodeURIComponent(sy)}/restore`, {
          method: 'POST',
          body: JSON.stringify({ confirmPhrase: phrase.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Restore failed');
        const c = data.counts || {};
        alert(
          `Restored school year ${sy}.\n\n` +
          `${c.seminarsRestored || 0} seminar(s), ${c.registrationsRestored || 0} registration(s), ` +
          `${c.employeesAffected || 0} employee(s) updated.`
        );
        archiveDetail.innerHTML = '';
        loadArchives();
        loadLogs();
      } catch (err) {
        alert(err.message || 'Restore failed.');
      }
    };

    const downloadArchiveCsv = async (sy) => {
      try {
        const res = await authFetch(`/api/admin/maintenance/archives/${encodeURIComponent(sy)}/masterlist.xlsx`);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GIMS_Masterlist_${sy}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        alert(err.message || 'Download failed.');
      }
    };

    const loadLogs = async () => {
      logList.innerHTML = '<p class="muted">Loading…</p>';
      try {
        const res = await authFetch('/api/admin/maintenance/logs');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed');
        if (!data.logs.length) {
          logList.innerHTML = '<p class="muted">No maintenance actions yet.</p>';
          return;
        }
        logList.innerHTML = data.logs.map((l) => `
          <div style="border:1px solid var(--border); border-radius:0.5rem; padding:0.6rem; margin-bottom:0.4rem;">
            <div><strong>${escapeHtml(l.action)}</strong> — SY ${escapeHtml(l.schoolYear)}</div>
            <div class="muted small">
              ${new Date(l.triggeredAt).toLocaleString()} by ${escapeHtml(l.triggeredByName || l.triggeredByEmail || 'admin')}
              — ${l.counts?.registrationsArchived || 0} regs, ${l.counts?.seminarsArchived || 0} seminars, ${l.counts?.employeesAffected || 0} employees
              ${l.notes ? `<br/><em>${escapeHtml(l.notes)}</em>` : ''}
            </div>
          </div>
        `).join('');
      } catch (err) {
        logList.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Failed.')}</p>`;
      }
    };

    const populateDefaultSY = async () => {
      try {
        const res = await authFetch('/api/admin/maintenance/current-school-year');
        const data = await res.json();
        if (data.schoolYear && !syInput.value) syInput.value = data.schoolYear;
      } catch {}
    };

    window.gimsLoadMaintenance = () => {
      populateDefaultSY();
      loadArchives();
      loadLogs();
    };
  })();
  // -------------- end Maintenance tab --------------

  initCalendarToggle('create');
  initCalendarToggle('edit');
  setTopbarFromToken();
  setDeletedSeminarsModalVisibility(false);
  showNavModule('dashboard');
  loadAll().catch((err) => {
    console.error('[admin] loadAll failed', err);
    employeesStatusEl.textContent = err.message || 'Failed to load admin dashboard.';
    window.localStorage.removeItem('gims_employee_token');
    window.localStorage.removeItem('gims_role');
    setTimeout(() => {
      window.location.replace('/');
    }, 600);
  });
});
