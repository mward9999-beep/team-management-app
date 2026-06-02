const firebaseConfig = {
  apiKey: "AIzaSyAN6akv_GgnbQyU652LAsAvl6p8q4MtrO4",
  authDomain: "studio-8900996552-5002d.firebaseapp.com",
  projectId: "studio-8900996552-5002d",
  storageBucket: "studio-8900996552-5002d.firebasestorage.app",
  messagingSenderId: "113013586350",
  appId: "1:113013586350:web:daeecfbf34d336132eb03f",
};

const requiredFirebaseKeys = ["apiKey", "authDomain", "projectId", "appId"];
const isFirebaseConfigured = requiredFirebaseKeys.every((key) => {
  const value = firebaseConfig[key];
  return value && !String(value).startsWith("PASTE_");
});
const hasFirebaseSdk = typeof window.firebase !== "undefined";

let auth = null;
let db = null;
let appUnsubscribers = [];
let teamUnsubscribers = [];
let activeTeamListenerId = "";

let teamRecords = [];
let teamMembers = [];
let players = [];
let scheduleEvents = [];
let scheduleRsvps = [];
let teamMessages = [];

const state = {
  authError: "",
  authMode: "login",
  authUser: null,
  dataError: "",
  isAuthReady: !isFirebaseConfigured || !hasFirebaseSdk,
  messageSearch: "",
  page: "schedule",
  playerFormError: "",
  scheduleFormError: "",
  pinnedMessageIds: new Set(),
  editingPlayerId: "",
  editingScheduleId: "",
  selectedEventId: "",
  showMessageComposer: false,
  showPlayerForm: false,
  showScheduleForm: false,
  team: "No Team",
  teamId: "",
  userProfile: null,
};

const pages = {
  schedule: {
    eyebrow: "Schedule",
    title: "Team calendar",
    copy: "Upcoming games, practices, and travel notes for the selected team.",
    status: () => `${scheduleEvents.length} upcoming`,
    body: renderScheduleBody,
  },
  roster: {
    eyebrow: "Roster",
    title: "Players and staff",
    copy: "A clean roster view for athletes, coaches, and team contacts.",
    status: () => `${getRosterRows().length} members`,
    body: renderRosterBody,
  },
  messages: {
    eyebrow: "Messages",
    title: "Team messages",
    copy: "Pinned updates, coach notes, and announcements in one team feed.",
    status: () => `${getPinnedMessages().length} pinned`,
    body: renderMessagesBody,
  },
  settings: {
    eyebrow: "Settings",
    title: "Team settings",
    copy: "Manage notifications, team preferences, and access controls.",
    status: "Firebase ready",
    body: renderSettingsBody,
  },
  profile: {
    eyebrow: "Profile",
    title: "Member profile",
    copy: "Account details from Firebase Authentication and Firestore.",
    status: "Signed in",
    body: renderProfileBody,
  },
  changeTeam: {
    eyebrow: "Change Team",
    title: "Switch teams",
    copy: "Move between teams stored in Cloud Firestore.",
    status: () => `${teamRecords.length} teams`,
    body: renderChangeTeamBody,
  },
};

const compactPages = new Set(["schedule", "roster", "messages"]);

const mainContent = document.querySelector("#main-content");
const currentTeam = document.querySelector("#current-team");
const menuToggle = document.querySelector(".menu-toggle");
const sideMenu = document.querySelector("#side-menu");
const menuBackdrop = document.querySelector(".menu-backdrop");
const assetBackdrop = document.querySelector(".asset-backdrop");
const assetMenu = document.querySelector("#asset-menu");
const mediaToggle = document.querySelector(".media-toggle");
const pictureList = document.querySelector("[data-picture-list]");
const fileList = document.querySelector("[data-file-list]");
const topbar = document.querySelector(".topbar");
const teamButton = document.querySelector(".team-button");
const teamMenu = document.querySelector("#team-menu");
const signOutButton = document.querySelector("[data-sign-out]");
const authStatus = document.querySelector("[data-auth-status]");

if (isFirebaseConfigured && hasFirebaseSdk) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  watchAuthState();
} else {
  renderPage("schedule");
  syncAuthUI();
}

function watchAuthState() {
  auth.onAuthStateChanged(async (user) => {
    cleanupAppListeners();
    resetAppData();
    state.authUser = user;
    state.isAuthReady = true;
    state.authError = "";
    state.dataError = "";

    if (user) {
      await ensureUserDocument(user);
      await acceptPendingInvitesForUser(user);
      startAppListeners(user);
    }

    syncAuthUI();
    renderPage(state.page);
  });
}

async function ensureUserDocument(user) {
  const fallbackName = user.displayName || user.email?.split("@")[0] || "Team Member";
  const email = normalizeEmail(user.email);

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        email,
        name: fallbackName,
        uid: user.uid,
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function acceptPendingInvitesForUser(user) {
  const email = normalizeEmail(user.email);

  if (!email) {
    return;
  }

  const inviteSnapshot = await db
    .collection("pendingInvites")
    .where("email", "==", email)
    .where("status", "==", "pending")
    .get();

  if (inviteSnapshot.empty) {
    return;
  }

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const displayName = user.displayName || email;
  const batches = inviteSnapshot.docs.map((inviteDoc) => {
    const invite = inviteDoc.data();
    const batch = db.batch();
    const playerRef = db.collection("players").doc(invite.playerId);
    const teamRef = db.collection("teams").doc(invite.teamId);
    const teamMemberRef = db.collection("teamMembers").doc(getTeamMemberDocId(invite.teamId, user.uid));
    const userRef = db.collection("users").doc(user.uid);

    batch.set(
      playerRef,
      {
        lastParentInviteId: inviteDoc.id,
        parentUserIds: firebase.firestore.FieldValue.arrayUnion(user.uid),
        pendingParentEmails: firebase.firestore.FieldValue.arrayRemove(email),
        updatedAt: now,
      },
      { merge: true }
    );

    batch.set(
      teamRef,
      {
        lastMemberInviteId: inviteDoc.id,
        memberIds: firebase.firestore.FieldValue.arrayUnion(user.uid),
        memberRoles: {
          [user.uid]: "parent",
        },
        updatedAt: now,
      },
      { merge: true }
    );

    batch.set(
      teamMemberRef,
      {
        accessRole: "parent",
        email,
        linkedPlayerIds: firebase.firestore.FieldValue.arrayUnion(invite.playerId),
        name: displayName,
        pendingInviteId: inviteDoc.id,
        playerId: invite.playerId,
        role: "parent",
        status: "active",
        teamId: invite.teamId,
        updatedAt: now,
        userId: user.uid,
      },
      { merge: true }
    );

    batch.set(
      userRef,
      {
        teamIds: firebase.firestore.FieldValue.arrayUnion(invite.teamId),
        updatedAt: now,
      },
      { merge: true }
    );

    batch.set(
      inviteDoc.ref,
      {
        acceptedAt: now,
        acceptedByUserId: user.uid,
        status: "accepted",
      },
      { merge: true }
    );

    return batch.commit();
  });

  await Promise.all(batches);
}

function startAppListeners(user) {
  appUnsubscribers.push(
    db
      .collection("users")
      .doc(user.uid)
      .onSnapshot((snapshot) => {
        state.userProfile = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
        state.pinnedMessageIds = new Set(state.userProfile?.pinnedMessageIds || []);
        resolveActiveTeam();
        syncAuthUI();
        renderPage(state.page);
      }, handleDataError)
  );

  appUnsubscribers.push(
    db
      .collection("teams")
      .where("memberIds", "array-contains", user.uid)
      .onSnapshot((snapshot) => {
        teamRecords = snapshot.docs.map(normalizeTeam).sort(sortByName);
        resolveActiveTeam();
        renderPage(state.page);
      }, handleDataError)
  );
}

function subscribeTeamData(teamId) {
  if (!teamId || activeTeamListenerId === teamId) {
    return;
  }

  cleanupTeamListeners();
  resetTeamData();
  activeTeamListenerId = teamId;

  teamUnsubscribers.push(
    db
      .collection("teamMembers")
      .where("teamId", "==", teamId)
      .onSnapshot((snapshot) => {
        teamMembers = snapshot.docs.map(normalizeTeamMember).sort(sortByName);
        renderPage(state.page);
      }, handleDataError)
  );

  teamUnsubscribers.push(
    db
      .collection("players")
      .where("teamId", "==", teamId)
      .onSnapshot((snapshot) => {
        players = snapshot.docs.map(normalizePlayer).sort(sortByName);
        renderPage(state.page);
      }, handleDataError)
  );

  teamUnsubscribers.push(
    db
      .collection("schedules")
      .where("teamId", "==", teamId)
      .onSnapshot((snapshot) => {
        scheduleEvents = snapshot.docs.map(normalizeSchedule).sort(sortByStartDate);

        if (!scheduleEvents.some((event) => event.id === state.selectedEventId)) {
          state.selectedEventId = scheduleEvents[0]?.id || "";
        }

        renderPage(state.page);
      }, handleDataError)
  );

  teamUnsubscribers.push(
    db
      .collection("scheduleRsvps")
      .where("teamId", "==", teamId)
      .onSnapshot((snapshot) => {
        scheduleRsvps = snapshot.docs.map(normalizeScheduleRsvp).sort(sortRsvps);
        renderPage(state.page);
      }, handleDataError)
  );

  teamUnsubscribers.push(
    db
      .collection("messages")
      .where("teamId", "==", teamId)
      .onSnapshot((snapshot) => {
        teamMessages = snapshot.docs.map(normalizeMessage).sort(sortMessages);
        renderPage(state.page);
      }, handleDataError)
  );
}

function cleanupAppListeners() {
  appUnsubscribers.forEach((unsubscribe) => unsubscribe());
  appUnsubscribers = [];
  cleanupTeamListeners();
}

function cleanupTeamListeners() {
  teamUnsubscribers.forEach((unsubscribe) => unsubscribe());
  teamUnsubscribers = [];
  activeTeamListenerId = "";
}

function resetAppData() {
  teamRecords = [];
  state.pinnedMessageIds = new Set();
  state.team = "No Team";
  state.teamId = "";
  state.userProfile = null;
  resetTeamData();
}

function resetTeamData() {
  teamMembers = [];
  players = [];
  scheduleEvents = [];
  scheduleRsvps = [];
  teamMessages = [];
  state.editingPlayerId = "";
  state.editingScheduleId = "";
  state.playerFormError = "";
  state.scheduleFormError = "";
  state.selectedEventId = "";
  state.showPlayerForm = false;
  state.showScheduleForm = false;
}

function resolveActiveTeam() {
  if (!state.authUser) {
    return;
  }

  if (!teamRecords.length) {
    cleanupTeamListeners();
    resetTeamData();
    state.team = "No Team";
    state.teamId = "";
    syncTeamLabels();
    return;
  }

  const preferredTeamId = state.userProfile?.activeTeamId || state.teamId;
  const preferredTeamExists = teamRecords.some((team) => team.id === preferredTeamId);
  const nextTeamId = preferredTeamExists ? preferredTeamId : teamRecords[0].id;

  selectTeamById(nextTeamId, { persist: false, render: false });
}

function selectTeamById(teamId, options = {}) {
  const { persist = true, render = true } = options;
  const selectedTeam = teamRecords.find((team) => team.id === teamId);

  if (!selectedTeam) {
    return;
  }

  state.teamId = selectedTeam.id;
  state.team = selectedTeam.name;
  subscribeTeamData(selectedTeam.id);
  syncTeamLabels();

  if (persist && state.authUser) {
    db.collection("users").doc(state.authUser.uid).set(
      {
        activeTeamId: selectedTeam.id,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (render) {
    renderPage(state.page);
  }
}

function handleDataError(error) {
  state.dataError = error.message || "Could not load Firebase data.";
  renderPage(state.page);
}

function renderPage(pageName) {
  const nextPageName = pageName || state.page || "schedule";
  state.page = nextPageName;

  if (!isFirebaseConfigured) {
    renderFirebaseSetup("Paste your Firebase web config into the top of app.js.");
    return;
  }

  if (!hasFirebaseSdk) {
    renderFirebaseSetup(
      "Firebase scripts did not load. Check your internet connection and rebuild the Xcode app."
    );
    return;
  }

  if (!state.isAuthReady) {
    renderLoadingState("Checking your Firebase login...");
    return;
  }

  if (!state.authUser) {
    renderAuthPage();
    return;
  }

  const page = pages[nextPageName] || pages.schedule;
  const body = typeof page.body === "function" ? page.body() : page.body;
  const status = typeof page.status === "function" ? page.status() : page.status;
  const hero = compactPages.has(nextPageName)
    ? ""
    : `
      <section class="page-hero">
        <div>
          <p class="eyebrow">${page.eyebrow}</p>
          <h1>${page.title}</h1>
          <p class="hero-copy">${page.copy}</p>
        </div>
        <span class="status-pill" data-page-status>${status}</span>
      </section>
    `;

  mainContent.innerHTML = `
    ${hero}
    ${state.dataError ? renderNotice(state.dataError, "error") : ""}
    ${body}
  `;

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.page === nextPageName);
  });

  document.querySelectorAll(".menu-item[data-page]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === nextPageName);
  });

  syncTeamLabels();
  syncAuthUI();
  teamButton.classList.toggle("is-active", nextPageName === "changeTeam");
  closeMenus();
  mainContent.focus({ preventScroll: true });
}

function renderFirebaseSetup(message) {
  mainContent.innerHTML = `
    <section class="section-card auth-card">
      <p class="eyebrow-card">Firebase Setup</p>
      <h1>Connect Firebase</h1>
      <p class="tile-copy">${escapeHTML(message)}</p>
      <div class="empty-state">
        <p class="tile-title">Needed in Firebase Console</p>
        <p class="tile-copy">Enable Email/Password Authentication, create Cloud Firestore, then copy your web app config into <strong>firebaseConfig</strong> at the top of <strong>app.js</strong>.</p>
      </div>
    </section>
  `;
  syncAuthUI();
}

function renderLoadingState(message) {
  mainContent.innerHTML = `
    <section class="section-card auth-card">
      <p class="eyebrow-card">Loading</p>
      <h1>Team App MVP</h1>
      <p class="tile-copy">${escapeHTML(message)}</p>
    </section>
  `;
}

function renderAuthPage() {
  const isSignup = state.authMode === "signup";

  mainContent.innerHTML = `
    <section class="section-card auth-card">
      <p class="eyebrow-card">Firebase Authentication</p>
      <h1>${isSignup ? "Create account" : "Log in"}</h1>
      <p class="tile-copy">Use email and password to access your Firestore team data.</p>
      ${state.authError ? renderNotice(state.authError, "error") : ""}

      <form class="auth-form" data-auth-form>
        ${
          isSignup
            ? `
              <label>
                <span>Name</span>
                <input type="text" name="name" placeholder="Your name" autocomplete="name" required />
              </label>
            `
            : ""
        }
        <label>
          <span>Email</span>
          <input type="email" name="email" placeholder="you@example.com" autocomplete="email" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" placeholder="At least 6 characters" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="6" required />
        </label>
        <button class="primary-action" type="submit">${isSignup ? "Sign Up" : "Log In"}</button>
        <button class="secondary-action" type="button" data-auth-mode-toggle>
          ${isSignup ? "Already have an account? Log in" : "Need an account? Sign up"}
        </button>
      </form>
    </section>
  `;
  syncAuthUI();
}

function renderScheduleBody() {
  const canManageSchedule = canCurrentUserManageSchedule();

  if (!state.teamId) {
    return renderEmptyCard(
      "No teams found",
      "Add documents to the teams collection in Firestore, then add schedules with a matching teamId."
    );
  }

  return `
    <section class="schedule-layout">
      <div class="list-card">
        <div class="section-title-row schedule-title-row">
          <div>
            <h2>Upcoming Schedule</h2>
            <p class="tile-copy">${scheduleEvents.length} upcoming ${scheduleEvents.length === 1 ? "event" : "events"}</p>
          </div>
          ${
            canManageSchedule
              ? `<button class="primary-action compact-action" type="button" data-add-schedule>+ Add</button>`
              : ""
          }
        </div>

        ${state.scheduleFormError ? renderNotice(state.scheduleFormError, "error") : ""}
        ${state.showScheduleForm && canManageSchedule ? renderScheduleForm() : ""}

        ${
          scheduleEvents.length
            ? `
              <ul class="team-list schedule-events">
                ${scheduleEvents.map(renderScheduleEvent).join("")}
              </ul>
            `
            : `
              <div class="empty-state schedule-empty-state">
                <p class="tile-title">No schedule yet</p>
                <p class="tile-copy">${
                  canManageSchedule
                    ? "Use Add to create the first team event."
                    : "Team schedule events will show here once they are added."
                }</p>
              </div>
            `
        }
      </div>
    </section>
  `;
}

function renderScheduleEvent(event) {
  const isSelected = event.id === state.selectedEventId;
  const rsvpTargets = getCurrentUserRsvpTargets();
  const attendanceRows = getEventAttendanceRows(event);
  const counts = getRsvpCounts(attendanceRows);
  const canManageSchedule = canCurrentUserManageSchedule();
  const canViewAttendance = canCurrentUserViewAttendance();

  return `
    <li class="schedule-event ${isSelected ? "is-selected" : ""}">
      <button
        class="event-main"
        type="button"
        data-event-id="${event.id}"
        aria-pressed="${isSelected}"
      >
        <span class="date-badge ${event.alert ? "alert" : ""}" aria-label="${event.dateLabel}">
          <span>${escapeHTML(event.dateMonth)}</span>
          <strong>${escapeHTML(event.dateDay)}</strong>
        </span>
        <span class="event-copy">
          <span class="item-title">${escapeHTML(event.title)}</span>
          <span class="item-meta">${escapeHTML(event.meta)}</span>
          <span class="item-status">${escapeHTML(event.note)}</span>
        </span>
        <span class="going-count">
          <strong>${counts.available}</strong>
          <span>available</span>
        </span>
      </button>

      ${renderEventRsvpControls(event, rsvpTargets)}

      ${
        isSelected
          ? `
            <div class="event-availability-drawer" aria-label="Team availability for ${escapeAttribute(event.title)}">
              <div class="event-detail-copy">
                <p class="event-date-line">${escapeHTML(event.dateLabel)}</p>
                <p>${escapeHTML(event.detail)}</p>
              </div>
              ${
                canManageSchedule
                  ? `
                    <div class="event-actions">
                      <button class="secondary-action table-action" type="button" data-edit-schedule="${event.id}">Edit</button>
                      <button class="secondary-action table-action danger" type="button" data-delete-schedule="${event.id}">Delete</button>
                    </div>
                  `
                  : ""
              }
              <div class="availability-summary">
                <span><strong>${counts.available}</strong> Available</span>
                <span><strong>${counts.notAvailable}</strong> Not Available</span>
                <span><strong>${counts.maybe}</strong> Maybe</span>
              </div>
              ${canViewAttendance ? renderAttendanceList(attendanceRows) : ""}
            </div>
          `
          : ""
      }
    </li>
  `;
}

function renderEventRsvpControls(event, rsvpTargets) {
  if (!rsvpTargets.length) {
    return "";
  }

  return `
    <div class="event-rsvp-controls" aria-label="RSVP for ${escapeAttribute(event.title)}">
      ${rsvpTargets
        .map((player) => {
          const rsvp = getPlayerRsvp(event, player.id);
          const selectedStatus = rsvp?.status || "noResponse";

          return `
            <div class="event-rsvp-card" data-rsvp-card>
              <div class="event-rsvp-header">
                <span>
                  <span class="event-availability-label">${escapeHTML(player.name)}</span>
                  <span class="item-meta">${player.userId === state.authUser?.uid ? "Player RSVP" : "Parent RSVP"}</span>
                </span>
                <span class="availability-chip ${selectedStatus}">${formatRsvpStatus(selectedStatus)}</span>
              </div>
              <div class="availability-actions">
                ${["available", "notAvailable", "maybe"]
                  .map(
                    (status) => `
                      <button
                        class="availability-button ${status} ${rsvp?.status === status ? "is-selected" : ""}"
                        type="button"
                        data-rsvp-status="${status}"
                        data-rsvp-event="${event.id}"
                        data-rsvp-player="${player.id}"
                        aria-pressed="${rsvp?.status === status}"
                      >
                        ${formatRsvpStatus(status)}
                      </button>
                    `
                  )
                  .join("")}
              </div>
              <input
                class="rsvp-note-input"
                type="text"
                value="${escapeAttribute(rsvp?.note || "")}"
                placeholder="Optional note"
                data-rsvp-note
              />
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAttendanceList(attendanceRows) {
  return `
    <div class="availability-list">
      <h3>Attendance List</h3>
      ${attendanceRows
        .map(
          (row) => `
            <div class="availability-row">
              <span>
                <span class="item-title">${escapeHTML(row.playerName)}</span>
                <span class="item-meta">${escapeHTML(row.submittedBy)}</span>
                ${row.note ? `<span class="rsvp-note">${escapeHTML(row.note)}</span>` : ""}
              </span>
              <span class="availability-chip ${row.status}">${formatRsvpStatus(row.status)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderScheduleForm() {
  const editingEvent = scheduleEvents.find((event) => event.id === state.editingScheduleId);
  const type = normalizeScheduleType(editingEvent?.type || "practice");

  return `
    <form class="schedule-form" data-schedule-form>
      <input type="hidden" name="scheduleId" value="${escapeAttribute(editingEvent?.id || "")}" />
      <label>
        <span>Event Title</span>
        <input type="text" name="title" value="${escapeAttribute(editingEvent?.title || "")}" placeholder="Practice Night" required />
      </label>
      <label>
        <span>Event Type</span>
        <select name="type" required>
          ${["practice", "game", "tournament", "team event", "other"]
            .map(
              (option) => `
                <option value="${escapeAttribute(option)}" ${type === option ? "selected" : ""}>
                  ${escapeHTML(formatScheduleType(option))}
                </option>
              `
            )
            .join("")}
        </select>
      </label>
      <div class="form-split">
        <label>
          <span>Date</span>
          <input type="date" name="date" value="${escapeAttribute(editingEvent?.date || "")}" required />
        </label>
        <label>
          <span>Start Time</span>
          <input type="time" name="startTime" value="${escapeAttribute(editingEvent?.startTime || "")}" required />
        </label>
        <label>
          <span>End Time</span>
          <input type="time" name="endTime" value="${escapeAttribute(editingEvent?.endTime || "")}" />
        </label>
      </div>
      <label>
        <span>Location Name</span>
        <input type="text" name="locationName" value="${escapeAttribute(editingEvent?.locationName || "")}" placeholder="North Field" />
      </label>
      <label>
        <span>Location Address</span>
        <input type="text" name="locationAddress" value="${escapeAttribute(editingEvent?.locationAddress || "")}" placeholder="123 Team Way" />
      </label>
      <label>
        <span>Notes / Details</span>
        <textarea name="notes" placeholder="Warmups, gear, travel notes">${escapeHTML(editingEvent?.notes || "")}</textarea>
      </label>
      <div class="form-actions">
        <button class="primary-action" type="submit">${editingEvent ? "Save Event" : "Add Event"}</button>
        <button class="secondary-action" type="button" data-cancel-schedule>Cancel</button>
      </div>
    </form>
  `;
}

function renderRosterBody() {
  const rosterRows = getRosterRows();
  const canEdit = canCurrentUserEditRoster();

  if (!state.teamId) {
    return renderEmptyCard("No team selected", "Create a team document in Firestore first.");
  }

  return `
    <section class="section-card">
      <div class="section-title-row">
        <div>
          <h2>Team Roster</h2>
          <p class="tile-copy">${rosterRows.length} roster ${rosterRows.length === 1 ? "member" : "members"}</p>
        </div>
        ${
          canEdit
            ? `<button class="primary-action compact-action" type="button" data-add-player>Add Player</button>`
            : ""
        }
      </div>

      ${state.playerFormError ? renderNotice(state.playerFormError, "error") : ""}
      ${state.showPlayerForm && canEdit ? renderPlayerForm() : ""}

      ${
        rosterRows.length
          ? `
            <table class="roster-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Jersey</th>
                  <th>Position</th>
                  <th>Status</th>
                  ${canEdit ? "<th>Actions</th>" : ""}
                </tr>
              </thead>
              <tbody>
                ${rosterRows
                  .map((member) => renderRosterRow(member, canEdit))
                  .join("")}
              </tbody>
            </table>
          `
          : `
            <div class="empty-state">
              <p class="tile-title">No roster yet</p>
              <p class="tile-copy">Owners, managers, and head coaches can add players here.</p>
            </div>
          `
      }
    </section>
  `;
}

function renderRosterRow(member, canEdit) {
  const canManageThisRow = canEdit && member.source === "player";

  return `
    <tr>
      <td>${escapeHTML(member.name)}</td>
      <td>${escapeHTML(member.role)}</td>
      <td>${escapeHTML(member.jerseyNumber || "-")}</td>
      <td>${escapeHTML(member.position || "-")}</td>
      <td>${escapeHTML(member.status || "Active")}</td>
      ${
        canEdit
          ? `
            <td>
              ${
                canManageThisRow
                  ? `
                    <div class="table-actions">
                      <button class="secondary-action table-action" type="button" data-edit-player="${member.id}">Edit</button>
                      <button class="secondary-action table-action danger" type="button" data-delete-player="${member.id}">Delete</button>
                    </div>
                  `
                  : `<span class="item-meta">Member</span>`
              }
            </td>
          `
          : ""
      }
    </tr>
  `;
}

function renderPlayerForm() {
  const editingPlayer = players.find((player) => player.id === state.editingPlayerId);
  const parentEmail = editingPlayer?.parentEmails?.[0] || editingPlayer?.pendingParentEmails?.[0] || "";

  return `
    <form class="player-form" data-player-form>
      <input type="hidden" name="playerId" value="${escapeAttribute(editingPlayer?.id || "")}" />
      <label>
        <span>Player Name</span>
        <input type="text" name="name" value="${escapeAttribute(editingPlayer?.name || "")}" placeholder="Player name" required />
      </label>
      <label>
        <span>Jersey Number</span>
        <input type="text" name="jerseyNumber" value="${escapeAttribute(editingPlayer?.jerseyNumber || "")}" placeholder="12" />
      </label>
      <label>
        <span>Position</span>
        <input type="text" name="position" value="${escapeAttribute(editingPlayer?.position || "")}" placeholder="Forward" />
      </label>
      <label>
        <span>Parent Email</span>
        <input type="email" name="parentEmail" value="${escapeAttribute(parentEmail)}" placeholder="parent@example.com" required />
      </label>
      <div class="form-actions">
        <button class="primary-action" type="submit">${editingPlayer ? "Save Player" : "Add Player"}</button>
        <button class="secondary-action" type="button" data-cancel-player>Cancel</button>
      </div>
    </form>
  `;
}

function renderMessagesBody() {
  const filteredMessages = getFilteredMessages();

  return `
    <section class="content-grid message-layout">
      <div class="section-card messages-card">
        <div class="messages-toolbar">
          <div>
            <h2>Inbox</h2>
            <p class="message-count" data-message-count>${getMessageCountLabel(filteredMessages)}</p>
          </div>
          <label class="search-field">
            <span>Search Keywords</span>
            <input
              type="search"
              data-message-search
              value="${escapeAttribute(state.messageSearch)}"
              placeholder="Search messages"
              autocomplete="off"
            />
          </label>
        </div>
        ${state.showMessageComposer ? renderMessageComposer() : ""}
        <div class="message-results" data-message-results>
          ${renderMessageList(filteredMessages)}
        </div>
      </div>

      <aside class="section-card pinned-card">
        <h2>Pinned Messages</h2>
        <div data-pinned-list>
          ${renderPinnedMessages()}
        </div>
        <button class="primary-action" type="button" data-new-message>New Message</button>
      </aside>
    </section>
  `;
}

function renderMessageComposer() {
  return `
    <form class="message-form" data-message-form>
      <label>
        <span>Title</span>
        <input type="text" name="title" placeholder="Message title" required />
      </label>
      <label>
        <span>Message</span>
        <textarea name="body" placeholder="Write a team update" required></textarea>
      </label>
      <div class="form-actions">
        <button class="primary-action" type="submit">Send Message</button>
        <button class="secondary-action" type="button" data-cancel-message>Cancel</button>
      </div>
    </form>
  `;
}

function renderMessageList(messages) {
  if (!messages.length) {
    return `
      <div class="empty-state">
        <p class="tile-title">No messages found</p>
        <p class="tile-copy">Messages are loaded from Firestore for the selected team.</p>
      </div>
    `;
  }

  return messages.map(renderMessageCard).join("");
}

function renderMessageCard(message) {
  const isPinned = state.pinnedMessageIds.has(message.id);

  return `
    <article class="message-row ${isPinned ? "is-pinned" : ""}">
      <span class="${message.unread ? "dot" : "message-marker"}" aria-hidden="true"></span>
      <span class="message-copy">
        <span class="message-topline">
          <span class="item-title">${escapeHTML(message.sender)}</span>
          <span class="message-time">${escapeHTML(message.time)}</span>
        </span>
        <span class="message-subject">${escapeHTML(message.title)}</span>
        <span class="item-meta">${escapeHTML(message.body)}</span>
      </span>
      <button
        class="pin-button ${isPinned ? "is-pinned" : ""}"
        type="button"
        data-pin-message="${message.id}"
        aria-pressed="${isPinned}"
      >
        ${isPinned ? "Pinned" : "Pin"}
      </button>
    </article>
  `;
}

function renderPinnedMessages() {
  const pinnedMessages = getPinnedMessages();

  if (!pinnedMessages.length) {
    return `
      <div class="empty-state compact">
        <p class="tile-title">No pinned messages</p>
        <p class="tile-copy">Pin key updates so they stay easy to find.</p>
      </div>
    `;
  }

  return pinnedMessages
    .map(
      (message) => `
        <article class="pinned-message">
          <span>
            <span class="item-title">${escapeHTML(message.title)}</span>
            <span class="item-meta">${escapeHTML(message.sender)} - ${escapeHTML(message.time)}</span>
          </span>
          <button
            class="pin-button is-pinned"
            type="button"
            data-pin-message="${message.id}"
            aria-pressed="true"
          >
            Pinned
          </button>
        </article>
      `
    )
    .join("");
}

function renderSettingsBody() {
  return `
    <section class="settings-grid" aria-label="Settings options">
      <div class="section-card">
        <p class="tile-title">Authentication</p>
        <p class="tile-copy">Signup, login, and logout are handled by Firebase Authentication.</p>
      </div>
      <div class="section-card">
        <p class="tile-title">Firestore Data</p>
        <p class="tile-copy">Teams, rosters, schedules, and messages now load from Cloud Firestore.</p>
      </div>
      <div class="section-card">
        <p class="tile-title">Storage</p>
        <p class="tile-copy">Firebase Storage is intentionally skipped for this version.</p>
      </div>
      <div class="section-card">
        <p class="tile-title">Profiles</p>
        <p class="tile-copy">Profile photos and logos can be optional text URLs later.</p>
      </div>
    </section>
  `;
}

function renderProfileBody() {
  const userName = getCurrentUserName();
  const email = state.authUser?.email || "";

  return `
    <section class="profile-grid" aria-label="Profile details">
      <div class="section-card">
        <p class="tile-title">Name</p>
        <p class="tile-copy">${escapeHTML(userName)}</p>
      </div>
      <div class="section-card">
        <p class="tile-title">Email</p>
        <p class="tile-copy">${escapeHTML(email)}</p>
      </div>
      <div class="section-card">
        <p class="tile-title">Primary Team</p>
        <p class="tile-copy" data-current-team-copy>${escapeHTML(state.team)}</p>
      </div>
      <div class="section-card">
        <p class="tile-title">User ID</p>
        <p class="tile-copy">${escapeHTML(state.authUser?.uid || "")}</p>
      </div>
    </section>
  `;
}

function renderChangeTeamBody() {
  return `
    <section class="content-grid team-management-layout">
      <div>
        ${
          teamRecords.length
            ? `
              <section class="card-grid" aria-label="Available teams">
                ${teamRecords
                  .map(
                    (team) => `
                      <button class="metric-card team-select-card" type="button" data-team="${team.id}">
                        <p class="metric-label">${escapeHTML(team.season || "Team")}</p>
                        <p class="metric-value">T</p>
                        <p class="metric-detail">${escapeHTML(team.name)}</p>
                      </button>
                    `
                  )
                  .join("")}
              </section>
            `
            : renderEmptyCard(
                "No teams yet",
                "Create your first team here. The app will automatically make you the owner and team admin."
              )
        }
      </div>

      <aside class="section-card">
        <h2>Create Team</h2>
        <p class="tile-copy">This creates the team and adds you as owner/team admin in Firestore.</p>
        <form class="team-form" data-team-form>
          <label>
            <span>Team Name</span>
            <input type="text" name="name" placeholder="Team Blue" required />
          </label>
          <label>
            <span>Season</span>
            <input type="text" name="season" placeholder="Spring 2026" />
          </label>
          <label>
            <span>Logo URL Optional</span>
            <input type="url" name="logoUrl" placeholder="https://example.com/logo.png" />
          </label>
          <button class="primary-action" type="submit">Create Team</button>
        </form>
      </aside>
    </section>
  `;
}

function renderEmptyCard(title, copy) {
  return `
    <section class="section-card">
      <h2>${escapeHTML(title)}</h2>
      <p class="tile-copy">${escapeHTML(copy)}</p>
    </section>
  `;
}

function renderNotice(message, tone = "info") {
  return `
    <div class="notice ${tone}">
      ${escapeHTML(message)}
    </div>
  `;
}

function getRosterRows() {
  const playerRows = players.map((player) => ({
    id: player.id,
    jerseyNumber: player.jerseyNumber,
    memberId: player.memberId,
    name: player.name,
    parentUserIds: player.parentUserIds,
    position: player.position,
    role: "Player",
    source: "player",
    status: player.status,
    userId: player.userId,
  }));
  const memberRows = teamMembers
    .filter((member) => {
      return !playerRows.some((player) => {
        return (
          player.memberId === member.id ||
          (player.userId && player.userId === member.userId) ||
          player.name === member.name
        );
      });
    })
    .map((member) => ({
      id: member.id,
      jerseyNumber: "",
      name: member.name,
      position: member.position,
      role: member.role,
      source: "member",
      status: member.status,
      userId: member.userId,
    }));

  return [...playerRows, ...memberRows].sort(sortByName);
}

function getCurrentTeamRecord() {
  return teamRecords.find((team) => team.id === state.teamId) || null;
}

function getCurrentUserTeamRole() {
  const team = getCurrentTeamRecord();
  return team?.memberRoles?.[state.authUser?.uid] || "";
}

function canCurrentUserEditRoster() {
  return ["owner", "manager", "headCoach"].includes(getCurrentUserTeamRole());
}

function canCurrentUserManageSchedule() {
  return ["owner", "manager", "headCoach"].includes(getCurrentUserTeamRole());
}

function getFilteredMessages() {
  const terms = state.messageSearch
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filtered = terms.length
    ? teamMessages.filter((message) => {
        const searchableText = [
          message.sender,
          message.title,
          message.body,
          message.time,
          ...message.keywords,
        ]
          .join(" ")
          .toLowerCase();

        return terms.every((term) => searchableText.includes(term));
      })
    : teamMessages;

  return [...filtered].sort((first, second) => {
    const firstPinned = state.pinnedMessageIds.has(first.id);
    const secondPinned = state.pinnedMessageIds.has(second.id);

    if (firstPinned === secondPinned) {
      return sortMessages(first, second);
    }

    return firstPinned ? -1 : 1;
  });
}

function getPinnedMessages() {
  return teamMessages.filter((message) => state.pinnedMessageIds.has(message.id));
}

function getMessageCountLabel(messages) {
  const resultLabel = messages.length === 1 ? "message" : "messages";
  const searchLabel = state.messageSearch.trim() ? "found" : "in inbox";
  return `${messages.length} ${resultLabel} ${searchLabel}`;
}

async function togglePinnedMessage(messageId) {
  if (!state.authUser) {
    return;
  }

  const wasPinned = state.pinnedMessageIds.has(messageId);

  if (wasPinned) {
    state.pinnedMessageIds.delete(messageId);
  } else {
    state.pinnedMessageIds.add(messageId);
  }

  renderPage("messages");

  await db
    .collection("users")
    .doc(state.authUser.uid)
    .set(
      {
        pinnedMessageIds: wasPinned
          ? firebase.firestore.FieldValue.arrayRemove(messageId)
          : firebase.firestore.FieldValue.arrayUnion(messageId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

function updateMessageResults() {
  const results = document.querySelector("[data-message-results]");
  const count = document.querySelector("[data-message-count]");
  const status = document.querySelector("[data-page-status]");

  if (!results || !count) {
    return;
  }

  const filteredMessages = getFilteredMessages();
  results.innerHTML = renderMessageList(filteredMessages);
  count.textContent = getMessageCountLabel(filteredMessages);

  if (status) {
    status.textContent = pages.messages.status();
  }
}

function getSelectedEvent() {
  return scheduleEvents.find((event) => event.id === state.selectedEventId) || scheduleEvents[0];
}

function getCurrentUserRsvpTargets() {
  const uid = state.authUser?.uid || "";

  if (!uid) {
    return [];
  }

  return players.filter((player) => {
    return player.teamId === state.teamId && (player.userId === uid || player.parentUserIds.includes(uid));
  });
}

function canCurrentUserViewAttendance() {
  return ["owner", "manager", "headCoach", "assistantCoach"].includes(getCurrentUserTeamRole());
}

function getPlayerRsvp(event, playerId) {
  const rsvp = scheduleRsvps.find((item) => {
    return item.scheduleId === event.id && item.playerId === playerId;
  });

  if (rsvp) {
    return rsvp;
  }

  return getLegacyPlayerRsvp(event, playerId);
}

function getLegacyPlayerRsvp(event, playerId) {
  const player = players.find((item) => item.id === playerId);
  const legacyStatus = normalizeRsvpStatus(
    event.availability?.[playerId] || event.availability?.[player?.userId] || ""
  );

  if (!legacyStatus) {
    return null;
  }

  return {
    id: "",
    note: "",
    playerId,
    scheduleId: event.id,
    status: legacyStatus,
    teamId: state.teamId,
    userId: "",
  };
}

function getEventAttendanceRows(event) {
  return players.map((player) => {
    const rsvp = getPlayerRsvp(event, player.id);

    return {
      note: rsvp?.note || "",
      playerId: player.id,
      playerName: player.name,
      status: rsvp?.status || "noResponse",
      submittedBy: getRsvpSubmitterName(rsvp),
    };
  });
}

function getRsvpSubmitterName(rsvp) {
  if (!rsvp?.userId) {
    return "No RSVP submitted";
  }

  const uid = state.authUser?.uid || "";
  const teamMember = teamMembers.find((member) => member.userId === rsvp.userId);
  const player = players.find((item) => item.userId === rsvp.userId);

  if (rsvp.userId === uid) {
    return `Submitted by ${getCurrentUserName()}`;
  }

  return `Submitted by ${teamMember?.name || player?.name || "Team member"}`;
}

function getRsvpCounts(attendanceRows) {
  return attendanceRows.reduce(
    (counts, member) => {
      counts[member.status] += 1;
      return counts;
    },
    { available: 0, notAvailable: 0, maybe: 0, noResponse: 0 }
  );
}

function formatRsvpStatus(status) {
  const labels = {
    available: "Available",
    maybe: "Maybe",
    noResponse: "No Response",
    notAvailable: "Not Available",
  };

  return labels[status] || "No Response";
}

function normalizeRsvpStatus(status) {
  const normalizedStatus = String(status || "").trim();
  const lowerStatus = normalizedStatus.toLowerCase();

  if (["available", "yes"].includes(lowerStatus)) {
    return "available";
  }

  if (["notavailable", "not available", "no"].includes(lowerStatus)) {
    return "notAvailable";
  }

  if (lowerStatus === "maybe") {
    return "maybe";
  }

  return "";
}

function selectScheduleEvent(eventId) {
  state.selectedEventId = eventId;
  renderPage("schedule");
}

async function setScheduleRsvp(eventId, playerId, status, note = "") {
  const scheduleEvent = scheduleEvents.find((event) => event.id === eventId);
  const player = getCurrentUserRsvpTargets().find((item) => item.id === playerId);
  const rsvpStatus = normalizeRsvpStatus(status);

  if (!scheduleEvent || !player || !rsvpStatus) {
    return;
  }

  const rsvpId = getScheduleRsvpDocId(eventId, playerId);
  const rsvp = {
    id: rsvpId,
    note: String(note || "").trim(),
    playerId,
    scheduleId: eventId,
    status: rsvpStatus,
    teamId: state.teamId,
    updatedAt: new Date(),
    userId: state.authUser.uid,
  };
  const existingIndex = scheduleRsvps.findIndex((item) => item.id === rsvpId);

  if (existingIndex >= 0) {
    scheduleRsvps[existingIndex] = rsvp;
  } else {
    scheduleRsvps.push(rsvp);
  }

  state.selectedEventId = eventId;
  state.scheduleFormError = "";
  renderPage("schedule");

  try {
    await db
      .collection("scheduleRsvps")
      .doc(rsvpId)
      .set(
      {
        ...rsvp,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    state.scheduleFormError = error.message || "Could not save RSVP.";
    renderPage("schedule");
  }
}

function getScheduleRsvpDocId(scheduleId, playerId) {
  return `${scheduleId}_${playerId}`;
}

async function saveSchedule(form) {
  if (!state.teamId || !state.authUser || !canCurrentUserManageSchedule()) {
    state.scheduleFormError = "You do not have permission to manage schedule events.";
    renderPage("schedule");
    return;
  }

  const formData = new FormData(form);
  const scheduleId = String(formData.get("scheduleId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const startTime = String(formData.get("startTime") || "").trim();
  const endTime = String(formData.get("endTime") || "").trim();
  const locationName = String(formData.get("locationName") || "").trim();
  const locationAddress = String(formData.get("locationAddress") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const validTypes = ["practice", "game", "tournament", "team event", "other"];

  if (!title || !date || !startTime) {
    state.scheduleFormError = "Event title, date, and start time are required.";
    renderPage("schedule");
    return;
  }

  if (!validTypes.includes(type)) {
    state.scheduleFormError = "Choose a valid event type.";
    renderPage("schedule");
    return;
  }

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const scheduleRef = scheduleId ? db.collection("schedules").doc(scheduleId) : db.collection("schedules").doc();
  const scheduleData = {
    date,
    endTime,
    locationAddress,
    locationName,
    notes,
    startTime,
    teamId: state.teamId,
    title,
    type,
  };

  try {
    if (scheduleId) {
      await scheduleRef.set(
        {
          ...scheduleData,
          updatedAt: now,
          updatedByUserId: state.authUser.uid,
        },
        { merge: true }
      );
    } else {
      await scheduleRef.set({
        ...scheduleData,
        createdAt: now,
        createdByUserId: state.authUser.uid,
      });
    }

    state.editingScheduleId = "";
    state.scheduleFormError = "";
    state.selectedEventId = scheduleRef.id;
    state.showScheduleForm = false;
    form.reset();
    renderPage("schedule");
  } catch (error) {
    state.scheduleFormError = error.message || "Could not save the schedule event.";
    renderPage("schedule");
  }
}

async function deleteSchedule(scheduleId) {
  if (!canCurrentUserManageSchedule()) {
    state.scheduleFormError = "You do not have permission to delete schedule events.";
    renderPage("schedule");
    return;
  }

  const scheduleEvent = scheduleEvents.find((event) => event.id === scheduleId);

  if (!scheduleEvent) {
    return;
  }

  const confirmed = window.confirm(`Delete ${scheduleEvent.title} from the schedule?`);

  if (!confirmed) {
    return;
  }

  try {
    await db.collection("schedules").doc(scheduleId).delete();

    if (state.selectedEventId === scheduleId) {
      state.selectedEventId = "";
    }

    if (state.editingScheduleId === scheduleId) {
      state.editingScheduleId = "";
      state.showScheduleForm = false;
    }

    state.scheduleFormError = "";
    renderPage("schedule");
  } catch (error) {
    state.scheduleFormError = error.message || "Could not delete the schedule event.";
    renderPage("schedule");
  }
}

async function sendMessage(form) {
  if (!state.teamId || !state.authUser) {
    return;
  }

  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!title || !body) {
    return;
  }

  await db.collection("messages").add({
    body,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    keywords: createKeywords([title, body, getCurrentUserName()]),
    senderId: state.authUser.uid,
    senderName: getCurrentUserName(),
    teamId: state.teamId,
    title,
    unread: false,
  });

  state.showMessageComposer = false;
  renderPage("messages");
}

async function savePlayer(form) {
  if (!state.teamId || !state.authUser || !canCurrentUserEditRoster()) {
    state.playerFormError = "You do not have permission to manage players.";
    renderPage("roster");
    return;
  }

  const formData = new FormData(form);
  const playerId = String(formData.get("playerId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const jerseyNumber = String(formData.get("jerseyNumber") || "").trim();
  const position = String(formData.get("position") || "").trim();
  const parentEmail = normalizeEmail(formData.get("parentEmail"));

  if (!name) {
    state.playerFormError = "Player name is required.";
    renderPage("roster");
    return;
  }

  if (!parentEmail) {
    state.playerFormError = "Parent email is required.";
    renderPage("roster");
    return;
  }

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const playerRef = playerId ? db.collection("players").doc(playerId) : db.collection("players").doc();

  try {
    if (playerId) {
      await playerRef.set(
        {
          jerseyNumber,
          name,
          position,
          teamId: state.teamId,
          updatedAt: now,
          updatedByUserId: state.authUser.uid,
        },
        { merge: true }
      );
    } else {
      await playerRef.set({
        createdAt: now,
        createdByUserId: state.authUser.uid,
        jerseyNumber,
        name,
        parentEmails: [],
        parentUserIds: [],
        pendingParentEmails: [],
        position,
        status: "Active",
        teamId: state.teamId,
      });
    }

    if (parentEmail) {
      await connectParentEmailToPlayer(playerRef.id, parentEmail);
    }

    state.editingPlayerId = "";
    state.playerFormError = "";
    state.showPlayerForm = false;
    form.reset();
    renderPage("roster");
  } catch (error) {
    state.playerFormError = error.message || "Could not save player.";
    renderPage("roster");
  }
}

async function connectParentEmailToPlayer(playerId, parentEmail) {
  const userSnapshot = await db
    .collection("users")
    .where("email", "==", parentEmail)
    .limit(1)
    .get();

  if (!userSnapshot.empty) {
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    await linkParentToPlayer({
      email: parentEmail,
      name: userData.name || parentEmail,
      playerId,
      userId: userDoc.id,
    });
    return;
  }

  await createPendingParentInvite(playerId, parentEmail);
}

async function linkParentToPlayer({ email, name, playerId, userId }) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  const playerRef = db.collection("players").doc(playerId);
  const teamRef = db.collection("teams").doc(state.teamId);
  const teamMemberRef = db.collection("teamMembers").doc(getTeamMemberDocId(state.teamId, userId));

  batch.set(
    playerRef,
    {
      parentUserIds: firebase.firestore.FieldValue.arrayUnion(userId),
      parentEmails: firebase.firestore.FieldValue.arrayUnion(email),
      pendingParentEmails: firebase.firestore.FieldValue.arrayRemove(email),
      updatedAt: now,
    },
    { merge: true }
  );

  batch.set(
    teamRef,
    {
      memberIds: firebase.firestore.FieldValue.arrayUnion(userId),
      memberRoles: {
        [userId]: "parent",
      },
      updatedAt: now,
    },
    { merge: true }
  );

  batch.set(
    teamMemberRef,
    {
      accessRole: "parent",
      email,
      linkedPlayerIds: firebase.firestore.FieldValue.arrayUnion(playerId),
      name,
      playerId,
      role: "parent",
      status: "active",
      teamId: state.teamId,
      updatedAt: now,
      userId,
    },
    { merge: true }
  );

  await batch.commit();
}

async function createPendingParentInvite(playerId, email) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const inviteId = getPendingInviteId(state.teamId, playerId, email);
  const batch = db.batch();
  const playerRef = db.collection("players").doc(playerId);
  const inviteRef = db.collection("pendingInvites").doc(inviteId);

  batch.set(
    playerRef,
    {
      pendingParentEmails: firebase.firestore.FieldValue.arrayUnion(email),
      parentEmails: firebase.firestore.FieldValue.arrayUnion(email),
      updatedAt: now,
    },
    { merge: true }
  );

  batch.set(
    inviteRef,
    {
      createdAt: now,
      createdByUserId: state.authUser.uid,
      email,
      playerId,
      role: "parent",
      status: "pending",
      teamId: state.teamId,
    },
    { merge: true }
  );

  await batch.commit();
}

async function deletePlayer(playerId) {
  if (!canCurrentUserEditRoster()) {
    state.playerFormError = "You do not have permission to delete players.";
    renderPage("roster");
    return;
  }

  const player = players.find((item) => item.id === playerId);

  if (!player) {
    return;
  }

  const confirmed = window.confirm(`Delete ${player.name} from the roster?`);

  if (!confirmed) {
    return;
  }

  try {
    await db.collection("players").doc(playerId).delete();
    state.editingPlayerId = "";
    state.playerFormError = "";
    state.showPlayerForm = false;
    renderPage("roster");
  } catch (error) {
    state.playerFormError = error.message || "Could not delete player.";
    renderPage("roster");
  }
}

function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getTeamMemberDocId(teamId, userId) {
  return `${teamId}_${userId}`;
}

function getPendingInviteId(teamId, playerId, email) {
  return `${teamId}_${playerId}_${email.replace(/[^a-z0-9._-]/gi, "_")}`;
}

function renderAssetLists() {
  if (pictureList) {
    pictureList.innerHTML = `
      <p class="empty-assets">Firebase Storage is skipped for now. Profile photos, team logos, and pictures can use optional text URLs later.</p>
    `;
  }

  if (fileList) {
    fileList.innerHTML = `
      <p class="empty-assets">File uploads are off until Firebase Storage is added.</p>
    `;
  }
}

function normalizeTeam(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    logoUrl: data.logoUrl || "",
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
    memberRoles: data.memberRoles || {},
    name: data.name || "Unnamed Team",
    ownerId: data.ownerId || "",
    season: data.season || "",
  };
}

function normalizeTeamMember(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name || data.displayName || "Team Member",
    position: data.position || "",
    role: data.role || "Member",
    status: data.status || "Active",
    teamId: data.teamId || "",
    userId: data.userId || "",
  };
}

function normalizePlayer(snapshot) {
  const data = snapshot.data();
  return {
    createdByUserId: data.createdByUserId || "",
    id: snapshot.id,
    jerseyNumber: data.jerseyNumber || "",
    memberId: data.memberId || "",
    name: data.name || data.displayName || "Player",
    parentEmails: Array.isArray(data.parentEmails) ? data.parentEmails : [],
    parentUserIds: Array.isArray(data.parentUserIds) ? data.parentUserIds : [],
    pendingParentEmails: Array.isArray(data.pendingParentEmails) ? data.pendingParentEmails : [],
    position: data.position || "",
    role: "Player",
    status: data.status || "Active",
    teamId: data.teamId || "",
    userId: data.userId || "",
  };
}

function normalizeSchedule(snapshot) {
  const data = snapshot.data();
  const startDate = getScheduleStartDate(data);
  const dateParts = getDateParts(startDate, data.dateLabel);
  const type = normalizeScheduleType(data.type || "practice");
  const locationName = data.locationName || data.location || "";
  const locationAddress = data.locationAddress || "";
  const notes = data.notes || data.detail || data.description || "";

  return {
    alert: Boolean(data.alert),
    availability: data.availability || {},
    date: typeof data.date === "string" ? data.date : formatDateInputValue(startDate),
    dateDay: data.dateDay || dateParts.day,
    dateLabel: data.dateLabel || dateParts.label,
    dateMonth: data.dateMonth || dateParts.month,
    detail: notes || locationAddress || "No details added yet.",
    endTime: data.endTime || "",
    id: snapshot.id,
    location: locationName,
    locationAddress,
    locationName,
    meta: data.meta || formatEventMeta(startDate, locationName, data.endTime),
    note: data.note || formatScheduleType(type),
    notes,
    startTime: data.startTime || formatTimeInputValue(startDate),
    startDate,
    teamId: data.teamId || "",
    title: data.title || "Team Event",
    type,
  };
}

function normalizeScheduleRsvp(snapshot) {
  const data = snapshot.data();

  return {
    id: data.id || snapshot.id,
    note: data.note || "",
    playerId: data.playerId || "",
    scheduleId: data.scheduleId || "",
    status: normalizeRsvpStatus(data.status) || "maybe",
    teamId: data.teamId || "",
    updatedAt: toDate(data.updatedAt),
    userId: data.userId || "",
  };
}

function normalizeMessage(snapshot) {
  const data = snapshot.data();
  const createdAt = toDate(data.createdAt || data.sentAt);
  const sender = data.senderName || data.sender || "Team Update";
  const title = data.title || "Message";
  const body = data.body || "";

  return {
    body,
    createdAt,
    id: snapshot.id,
    keywords: Array.isArray(data.keywords) ? data.keywords : createKeywords([sender, title, body]),
    sender,
    teamId: data.teamId || "",
    time: data.time || formatMessageTime(createdAt),
    title,
    unread: isMessageUnread(data),
  };
}

function isMessageUnread(data) {
  if (Array.isArray(data.unreadFor) && state.authUser) {
    return data.unreadFor.includes(state.authUser.uid);
  }

  return Boolean(data.unread);
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getScheduleStartDate(data) {
  const timestampDate = toDate(data.startAt || data.startsAt);

  if (timestampDate) {
    return timestampDate;
  }

  if (typeof data.date === "string") {
    return parseLocalDateTime(data.date, data.startTime || "00:00");
  }

  return toDate(data.date);
}

function parseLocalDateTime(dateValue, timeValue = "00:00") {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));

  if (!dateMatch) {
    return toDate(dateValue);
  }

  const timeMatch = /^(\d{2}):(\d{2})/.exec(String(timeValue || "00:00"));
  const hours = timeMatch ? Number(timeMatch[1]) : 0;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  return new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hours,
    minutes
  );
}

function getDateParts(date, fallbackLabel) {
  if (!date) {
    return {
      day: "--",
      label: fallbackLabel || "Date TBD",
      month: "TBD",
    };
  }

  return {
    day: String(date.getDate()),
    label: date.toLocaleDateString([], {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    month: date.toLocaleDateString([], { month: "short" }).toUpperCase(),
  };
}

function formatEventMeta(date, location, endTime = "") {
  const datePart = date
    ? `${date.toLocaleDateString([], { weekday: "long" })}, ${date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}${endTime ? ` - ${formatDisplayTime(endTime)}` : ""}`
    : "Time TBD";

  return [datePart, location].filter(Boolean).join(" - ");
}

function formatDisplayTime(timeValue) {
  const timeMatch = /^(\d{2}):(\d{2})/.exec(String(timeValue || ""));

  if (!timeMatch) {
    return timeValue;
  }

  const date = new Date();
  date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateInputValue(date) {
  if (!(date instanceof Date)) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTimeInputValue(date) {
  if (!(date instanceof Date)) {
    return "";
  }

  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}

function formatScheduleType(type) {
  return String(type || "other")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeScheduleType(type) {
  const normalizedType = String(type || "").trim().toLowerCase();
  const validTypes = ["practice", "game", "tournament", "team event", "other"];

  if (validTypes.includes(normalizedType)) {
    return normalizedType;
  }

  if (normalizedType.includes("team")) {
    return "team event";
  }

  if (normalizedType.includes("tournament")) {
    return "tournament";
  }

  if (normalizedType.includes("game")) {
    return "game";
  }

  if (normalizedType.includes("practice")) {
    return "practice";
  }

  return "other";
}

function formatMessageTime(date) {
  if (!date) {
    return "Just now";
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameDay = date.toDateString() === now.toDateString();
  const previousDay = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (sameDay) {
    return `Today, ${time}`;
  }

  if (previousDay) {
    return `Yesterday, ${time}`;
  }

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function createKeywords(values) {
  return [...new Set(values.join(" ").toLowerCase().split(/\W+/).filter(Boolean))];
}

function sortByName(first, second) {
  return first.name.localeCompare(second.name);
}

function sortByStartDate(first, second) {
  return getSortTime(first.startDate) - getSortTime(second.startDate);
}

function sortRsvps(first, second) {
  return getSortTime(second.updatedAt) - getSortTime(first.updatedAt);
}

function sortMessages(first, second) {
  return getSortTime(second.createdAt) - getSortTime(first.createdAt);
}

function getSortTime(value) {
  return value instanceof Date ? value.getTime() : 0;
}

function getCurrentUserName() {
  return (
    state.userProfile?.name ||
    state.authUser?.displayName ||
    state.authUser?.email?.split("@")[0] ||
    "Team Member"
  );
}

function syncTeamLabels() {
  renderTeamMenu();
  currentTeam.textContent = state.team || "No Team";

  document.querySelectorAll("[data-current-team-copy]").forEach((item) => {
    item.textContent = state.team || "No Team";
  });

  document.querySelectorAll("[data-team]").forEach((item) => {
    item.classList.toggle("is-selected", item.dataset.team === state.teamId);
  });
}

function renderTeamMenu() {
  if (!teamMenu) {
    return;
  }

  teamMenu.innerHTML = teamRecords.length
    ? teamRecords
        .map(
          (team) => `
            <button type="button" role="menuitem" data-team="${team.id}">
              ${escapeHTML(team.name)}
            </button>
          `
        )
        .join("")
    : `<button type="button" role="menuitem" disabled>No teams yet</button>`;
}

function syncAuthUI() {
  if (authStatus) {
    authStatus.textContent = state.authUser
      ? `Signed in as ${getCurrentUserName()}`
      : "Signed out";
  }

  if (signOutButton) {
    signOutButton.hidden = !state.authUser;
  }
}

function setTeam(teamId) {
  const selectedTeam = teamRecords.find((team) => team.id === teamId || team.name === teamId);

  if (!selectedTeam) {
    return;
  }

  selectTeamById(selectedTeam.id, { persist: true });
  closeTeamMenu();
}

async function createTeam(form) {
  if (!state.authUser) {
    return;
  }

  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const season = String(formData.get("season") || "").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim();

  if (!name) {
    state.dataError = "Team name is required.";
    renderPage("changeTeam");
    return;
  }

  const now = firebase.firestore.FieldValue.serverTimestamp();
  const userName = getCurrentUserName();
  const teamRef = db.collection("teams").doc();
  const ownerMemberRef = db.collection("teamMembers").doc();
  const batch = db.batch();

  batch.set(teamRef, {
    adminIds: [state.authUser.uid],
    createdAt: now,
    createdBy: state.authUser.uid,
    logoUrl,
    memberIds: [state.authUser.uid],
    memberRoles: {
      [state.authUser.uid]: "owner",
    },
    name,
    ownerId: state.authUser.uid,
    season,
    updatedAt: now,
  });

  batch.set(ownerMemberRef, {
    createdAt: now,
    isOwner: true,
    name: userName,
    position: "Team Admin",
    profilePhotoUrl: state.userProfile?.profilePhotoUrl || "",
    role: "Owner",
    status: "Active",
    teamId: teamRef.id,
    updatedAt: now,
    userId: state.authUser.uid,
  });

  batch.set(
    db.collection("users").doc(state.authUser.uid),
    {
      activeTeamId: teamRef.id,
      name: userName,
      ownedTeamIds: firebase.firestore.FieldValue.arrayUnion(teamRef.id),
      teamIds: firebase.firestore.FieldValue.arrayUnion(teamRef.id),
      updatedAt: now,
    },
    { merge: true }
  );

  try {
    await batch.commit();
    state.dataError = "";
    state.teamId = teamRef.id;
    state.team = name;
    form.reset();
    renderPage("changeTeam");
  } catch (error) {
    state.dataError = error.message || "Could not create the team.";
    renderPage("changeTeam");
  }
}

async function handleAuthSubmit(form) {
  const formData = new FormData(form);
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  state.authError = "";

  try {
    if (state.authMode === "signup") {
      const result = await auth.createUserWithEmailAndPassword(email, password);

      if (name) {
        await result.user.updateProfile({ displayName: name });
      }

      await db
        .collection("users")
        .doc(result.user.uid)
        .set(
          {
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            email,
            name: name || email.split("@")[0],
            pinnedMessageIds: [],
            uid: result.user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    state.authError = formatAuthError(error);
    renderAuthPage();
  }
}

function formatAuthError(error) {
  const code = error?.code || "";

  if (code.includes("email-already-in-use")) {
    return "That email already has an account. Try logging in.";
  }

  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "The email or password did not match.";
  }

  if (code.includes("weak-password")) {
    return "Use a password with at least 6 characters.";
  }

  return error?.message || "Authentication failed.";
}

async function signOutCurrentUser() {
  if (!auth) {
    return;
  }

  await auth.signOut();
}

function openSideMenu() {
  syncMenuOffset();
  closeAssetMenu();
  closeTeamMenu();
  sideMenu.classList.add("is-open");
  sideMenu.setAttribute("aria-hidden", "false");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Close menu");
  menuBackdrop.hidden = false;
}

function closeSideMenu() {
  sideMenu.classList.remove("is-open");
  sideMenu.setAttribute("aria-hidden", "true");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open menu");
  menuBackdrop.hidden = true;
}

function toggleSideMenu() {
  sideMenu.classList.contains("is-open") ? closeSideMenu() : openSideMenu();
}

function syncMenuOffset() {
  const offset = Math.ceil(topbar.getBoundingClientRect().height + 10);
  document.documentElement.style.setProperty("--menu-offset", `${offset}px`);
}

function openTeamMenu() {
  closeAssetMenu();
  teamMenu.classList.add("is-open");
  teamButton.setAttribute("aria-expanded", "true");
}

function closeTeamMenu() {
  teamMenu.classList.remove("is-open");
  teamButton.setAttribute("aria-expanded", "false");
}

function toggleTeamMenu() {
  teamMenu.classList.contains("is-open") ? closeTeamMenu() : openTeamMenu();
}

function closeMenus() {
  closeSideMenu();
  closeAssetMenu();
  closeTeamMenu();
}

function openAssetMenu() {
  syncMenuOffset();
  closeSideMenu();
  closeTeamMenu();
  assetMenu.classList.add("is-open");
  assetMenu.setAttribute("aria-hidden", "false");
  mediaToggle.setAttribute("aria-expanded", "true");
  mediaToggle.setAttribute("aria-label", "Close team files");
  assetBackdrop.hidden = false;
}

function closeAssetMenu() {
  assetMenu.classList.remove("is-open");
  assetMenu.setAttribute("aria-hidden", "true");
  mediaToggle.setAttribute("aria-expanded", "false");
  mediaToggle.setAttribute("aria-label", "Open team files");
  assetBackdrop.hidden = true;
}

function toggleAssetMenu() {
  assetMenu.classList.contains("is-open") ? closeAssetMenu() : openAssetMenu();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

window.addEventListener("resize", syncMenuOffset);

menuToggle.addEventListener("click", toggleSideMenu);
menuBackdrop.addEventListener("click", closeSideMenu);
mediaToggle.addEventListener("click", toggleAssetMenu);
assetBackdrop.addEventListener("click", closeAssetMenu);
teamButton.addEventListener("click", (event) => {
  event.stopPropagation();

  if (state.authUser && state.page !== "changeTeam") {
    renderPage("changeTeam");
    openTeamMenu();
    return;
  }

  toggleTeamMenu();
});

document.addEventListener("submit", async (event) => {
  const authForm = event.target.closest("[data-auth-form]");
  const messageForm = event.target.closest("[data-message-form]");
  const playerForm = event.target.closest("[data-player-form]");
  const scheduleForm = event.target.closest("[data-schedule-form]");
  const teamForm = event.target.closest("[data-team-form]");

  if (authForm) {
    event.preventDefault();
    await handleAuthSubmit(authForm);
    return;
  }

  if (messageForm) {
    event.preventDefault();
    await sendMessage(messageForm);
    return;
  }

  if (playerForm) {
    event.preventDefault();
    await savePlayer(playerForm);
    return;
  }

  if (scheduleForm) {
    event.preventDefault();
    await saveSchedule(scheduleForm);
    return;
  }

  if (teamForm) {
    event.preventDefault();
    await createTeam(teamForm);
  }
});

document.addEventListener("click", async (event) => {
  const addPlayerTarget = event.target.closest("[data-add-player]");
  const addScheduleTarget = event.target.closest("[data-add-schedule]");
  const authModeTarget = event.target.closest("[data-auth-mode-toggle]");
  const cancelPlayerTarget = event.target.closest("[data-cancel-player]");
  const cancelScheduleTarget = event.target.closest("[data-cancel-schedule]");
  const cancelMessageTarget = event.target.closest("[data-cancel-message]");
  const closeAssetsTarget = event.target.closest("[data-close-assets]");
  const deletePlayerTarget = event.target.closest("[data-delete-player]");
  const deleteScheduleTarget = event.target.closest("[data-delete-schedule]");
  const editPlayerTarget = event.target.closest("[data-edit-player]");
  const editScheduleTarget = event.target.closest("[data-edit-schedule]");
  const newMessageTarget = event.target.closest("[data-new-message]");
  const pinTarget = event.target.closest("[data-pin-message]");
  const signOutTarget = event.target.closest("[data-sign-out]");
  const rsvpTarget = event.target.closest("[data-rsvp-status]");
  const scheduleEventTarget = event.target.closest("[data-event-id]");
  const teamTarget = event.target.closest("[data-team]");
  const pageTarget = event.target.closest("[data-page]");

  if (authModeTarget) {
    state.authMode = state.authMode === "login" ? "signup" : "login";
    state.authError = "";
    renderAuthPage();
    return;
  }

  if (addPlayerTarget) {
    state.editingPlayerId = "";
    state.playerFormError = "";
    state.showPlayerForm = true;
    renderPage("roster");
    return;
  }

  if (editPlayerTarget) {
    state.editingPlayerId = editPlayerTarget.dataset.editPlayer;
    state.playerFormError = "";
    state.showPlayerForm = true;
    renderPage("roster");
    return;
  }

  if (deletePlayerTarget) {
    await deletePlayer(deletePlayerTarget.dataset.deletePlayer);
    return;
  }

  if (addScheduleTarget) {
    state.editingScheduleId = "";
    state.scheduleFormError = "";
    state.showScheduleForm = true;
    renderPage("schedule");
    return;
  }

  if (editScheduleTarget) {
    state.editingScheduleId = editScheduleTarget.dataset.editSchedule;
    state.scheduleFormError = "";
    state.showScheduleForm = true;
    state.selectedEventId = editScheduleTarget.dataset.editSchedule;
    renderPage("schedule");
    return;
  }

  if (deleteScheduleTarget) {
    await deleteSchedule(deleteScheduleTarget.dataset.deleteSchedule);
    return;
  }

  if (cancelScheduleTarget) {
    state.editingScheduleId = "";
    state.scheduleFormError = "";
    state.showScheduleForm = false;
    renderPage("schedule");
    return;
  }

  if (cancelPlayerTarget) {
    state.editingPlayerId = "";
    state.playerFormError = "";
    state.showPlayerForm = false;
    renderPage("roster");
    return;
  }

  if (signOutTarget) {
    await signOutCurrentUser();
    closeMenus();
    return;
  }

  if (closeAssetsTarget) {
    closeAssetMenu();
    return;
  }

  if (newMessageTarget) {
    state.showMessageComposer = true;
    renderPage("messages");
    return;
  }

  if (cancelMessageTarget) {
    state.showMessageComposer = false;
    renderPage("messages");
    return;
  }

  if (pinTarget) {
    await togglePinnedMessage(pinTarget.dataset.pinMessage);
    return;
  }

  if (rsvpTarget) {
    const rsvpCard = rsvpTarget.closest("[data-rsvp-card]");
    const note = rsvpCard?.querySelector("[data-rsvp-note]")?.value || "";

    await setScheduleRsvp(
      rsvpTarget.dataset.rsvpEvent,
      rsvpTarget.dataset.rsvpPlayer,
      rsvpTarget.dataset.rsvpStatus,
      note
    );
    return;
  }

  if (scheduleEventTarget) {
    selectScheduleEvent(scheduleEventTarget.dataset.eventId);
    return;
  }

  if (teamTarget && !teamTarget.disabled) {
    setTeam(teamTarget.dataset.team);
    return;
  }

  if (pageTarget) {
    event.preventDefault();
    renderPage(pageTarget.dataset.page);
    return;
  }

  if (!event.target.closest(".team-switcher")) {
    closeTeamMenu();
  }
});

document.addEventListener("input", (event) => {
  const searchTarget = event.target.closest("[data-message-search]");

  if (!searchTarget) {
    return;
  }

  state.messageSearch = searchTarget.value;
  updateMessageResults();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenus();
  }
});

renderAssetLists();
syncMenuOffset();
