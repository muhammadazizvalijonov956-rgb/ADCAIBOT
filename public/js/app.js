let allUsers = [];
let allIelts = [];
let chartInstance = null;

// Login Function
async function login() {
    const password = document.getElementById("admin-password").value;
    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });

    if (res.ok) {
        document.getElementById("login-container").style.display = "none";
        document.getElementById("admin-container").style.display = "block";
        loadData();
    } else {
        const err = document.getElementById("login-error");
        err.textContent = "Invalid password. Try again.";
        err.style.display = "block";
    }
}

async function logout() {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
}

// Tab Switching
function showTab(tab) {
    document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
    document.querySelectorAll(".sidebar li").forEach(l => l.classList.remove("active"));

    document.getElementById(`${tab}-tab`).style.display = "block";
    event.currentTarget.classList.add("active");

    if (tab === "knowledge") loadKnowledge();
    if (tab === "ielts") renderIELTS(allIelts);
    if (tab === "dashboard") updateDashboard();
}

async function loadData() {
    const [usersRes, ieltsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/ielts")
    ]);

    if (usersRes.ok) {
        allUsers = await usersRes.json();
        renderUsers(allUsers);
    }
    if (ieltsRes.ok) {
        allIelts = await ieltsRes.json();
    }

    updateDashboard();
}

function updateDashboard() {
    document.getElementById("stat-total-users").textContent = allUsers.length;
    document.getElementById("stat-total-ielts").textContent = allIelts.length;

    // Count courses
    const courseCounts = {};
    allUsers.forEach(u => {
        if (!u.course) return;
        courseCounts[u.course] = (courseCounts[u.course] || 0) + 1;
    });

    const ctx = document.getElementById('courseChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(courseCounts),
            datasets: [{
                label: 'Students per Course',
                data: Object.values(courseCounts),
                backgroundColor: '#1a73e8',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderUsers(users) {
    const tbody = document.querySelector("#users-table tbody");
    tbody.innerHTML = "";

    users.forEach(user => {
        const date = new Date(user.created_at).toLocaleDateString();
        const row = `
            <tr>
                <td>${user.id}</td>
                <td><strong>${user.full_name}</strong></td>
                <td>${user.phone_number}</td>
                <td>${user.course}</td>
                <td>${user.preferred_days || '-'} <br> <small>${user.preferred_time || ''}</small></td>
                <td><span class="status-badge status-${user.status}">${user.status}</span></td>
                <td>${date}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" onclick="openEditModal(${user.id})" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-view" onclick="openDmModal('${user.telegram_id}')" title="Send Message" style="background: #0088cc; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                        <button class="btn-delete" onclick="deleteUser(${user.id})" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function filterUsers() {
    const query = document.getElementById("user-search").value.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.full_name.toLowerCase().includes(query) ||
        u.phone_number.toLowerCase().includes(query)
    );
    renderUsers(filtered);
}

// User Actions
function openEditModal(id) {
    const user = allUsers.find(u => u.id === id);
    document.getElementById("edit-id").value = user.id;
    document.getElementById("edit-name").value = user.full_name;
    document.getElementById("edit-phone").value = user.phone_number;
    document.getElementById("edit-course").value = user.course;
    document.getElementById("edit-status").value = user.status;
    document.getElementById("edit-modal").style.display = "block";
}

function closeModal() {
    document.getElementById("edit-modal").style.display = "none";
}

async function saveUser() {
    const id = document.getElementById("edit-id").value;
    const data = {
        full_name: document.getElementById("edit-name").value,
        phone_number: document.getElementById("edit-phone").value,
        course: document.getElementById("edit-course").value,
        status: document.getElementById("edit-status").value
    };

    const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        closeModal();
        loadData();
    }
}

async function deleteUser(id) {
    if (confirm("Are you sure you want to delete this user?")) {
        const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
        if (res.ok) loadData();
    }
}

function exportToExcel() {
    window.location.href = "/api/export";
}

// Knowledge Base
async function loadKnowledge() {
    const res = await fetch("/api/knowledge");
    if (res.ok) {
        const data = await res.json();
        document.getElementById("knowledge-editor").value = data.content;
    }
}

async function saveKnowledge() {
    const content = document.getElementById("knowledge-editor").value;
    const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
    });
    if (res.ok) alert("Knowledge base updated successfully! The bot will now use the new information.");
}

// IELTS Management
async function loadIELTS() {
    const res = await fetch("/api/ielts");
    if (res.ok) {
        allIelts = await res.json();
        renderIELTS(allIelts);
        updateDashboard();
    }
}

function renderIELTS(records) {
    const tbody = document.querySelector("#ielts-table tbody");
    tbody.innerHTML = "";

    records.forEach(reg => {
        const row = `
            <tr>
                <td>${reg.id}</td>
                <td><strong>${reg.full_name}</strong></td>
                <td>${reg.phone_number}</td>
                <td>${reg.gmail}</td>
                <td><strong>${reg.exam_type || '-'}</strong></td>
                <td>
                    <a href="/api/passport/${reg.passport_file_id}" target="_blank" class="btn-view">
                        <i class="fas fa-id-card"></i> View Passport
                    </a>
                </td>
                <td><span class="status-badge status-${reg.status}">${reg.status}</span></td>
                <td>
                    <button class="btn-view" onclick="openDmModal('${reg.telegram_id}')" title="Send Message" style="background: #0088cc; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-bottom: 5px;">
                        <i class="fas fa-paper-plane"></i> DM
                    </button>
                    <select onchange="updateIELTSStatus(${reg.id}, this.value)" class="status-select">
                        <option value="pending" ${reg.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="registered" ${reg.status === 'registered' ? 'selected' : ''}>Registered</option>
                        <option value="contacted" ${reg.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="cancelled" ${reg.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

async function updateIELTSStatus(id, status) {
    const res = await fetch(`/api/ielts/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
    if (res.ok) loadIELTS();
}

// Broadcast
async function sendBroadcast() {
    const message = document.getElementById("broadcast-message").value;
    const fileInput = document.getElementById("broadcast-file");
    const file = fileInput.files[0];

    if (!message.trim() && !file) return alert("Please enter a message or select a file.");

    const btn = document.getElementById("broadcast-btn") || document.querySelector("button[onclick='sendBroadcast()']");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }

    const formData = new FormData();
    formData.append("message", message);
    if (file) {
        formData.append("file", file);
    }

    try {
        const res = await fetch("/api/broadcast", {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            alert("Broadcast sent successfully!");
            document.getElementById("broadcast-message").value = "";
            fileInput.value = "";
        } else {
            alert("Failed to send broadcast.");
        }
    } catch (err) {
        alert("Error sending broadcast.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to All';
        }
    }
}

// Direct Message
function openDmModal(telegramId) {
    if (!telegramId || telegramId === 'null' || telegramId === 'undefined') {
        return alert("This user does not have a valid Telegram ID recorded.");
    }
    document.getElementById("dm-telegram-id").value = telegramId;
    document.getElementById("dm-modal").style.display = "block";
}

function closeDmModal() {
    document.getElementById("dm-modal").style.display = "none";
    document.getElementById("dm-message").value = "";
}

async function sendDm() {
    const telegramId = document.getElementById("dm-telegram-id").value;
    const message = document.getElementById("dm-message").value;

    if (!message.trim()) return alert("Please enter a message.");

    const res = await fetch(`/api/message/${telegramId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    });

    if (res.ok) {
        alert("Message sent successfully!");
        closeDmModal();
    } else {
        alert("Failed to send message.");
    }
}
