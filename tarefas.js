const DB_NAME = 'cozy-tasks-db';
const DB_VERSION = 1;
const STORE = 'tasks';
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE)) {
                d.createObjectStore(STORE, { keyPath: 'dateKey' });
            }
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror   = e => reject(e.target.error);
    });
}

function dbGet(dateKey) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(dateKey);
        req.onsuccess = e => resolve(e.target.result ? e.target.result.tasks : []);
        req.onerror   = e => reject(e.target.error);
    });
}

function dbSet(dateKey, tasks) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ dateKey, tasks });
        tx.oncomplete = resolve;
        tx.onerror    = e => reject(e.target.error);
    });
}

function dbGetAll() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = e => resolve(e.target.result || []);
        req.onerror   = e => reject(e.target.error);
    });
}

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let currentView  = 'calendar';
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); 
let openDateKey  = null;   
let pendingSubtasks = [];  

function dateKey(year, month, day) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function todayKey() {
    const t = new Date();
    return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}




function setView(v) {
    currentView = v;
    document.getElementById('view-calendar').style.display = v === 'calendar' ? '' : 'none';
    document.getElementById('view-stats').style.display    = v === 'stats'    ? '' : 'none';
    document.getElementById('btn-calendar').classList.toggle('active', v === 'calendar');
    document.getElementById('btn-stats').classList.toggle('active', v === 'stats');
    if (v === 'stats') renderStats();
}




function updateMonthLabel() {
    document.getElementById('month-label').textContent =
        `${MONTHS_PT[currentMonth]} ${currentYear}`;
}
function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateMonthLabel();
    renderCalendar();
}
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateMonthLabel();
    renderCalendar();
}




async function renderCalendar() {
    const grid = document.getElementById('days-grid');
    grid.innerHTML = '';


    DAYS_PT.forEach(d => {
        const el = document.createElement('div');
        el.className = 'day-name';
        el.textContent = d;
        grid.appendChild(el);
    });



    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = todayKey();


    const monthPrefix = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-`;
    const allRecords = await dbGetAll();
    const monthData = {};
    allRecords.forEach(r => {
        if (r.dateKey.startsWith(monthPrefix)) {
            monthData[r.dateKey] = r.tasks;
        }
    });



    for (let e = 0; e < firstDay; e++) {
        const blank = document.createElement('div');
        blank.className = 'day-cell empty';
        grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const key = dateKey(currentYear, currentMonth, d);
        const tasks = monthData[key] || [];

        const cell = document.createElement('div');
        cell.className = 'day-cell' + (key === today ? ' today' : '');
        cell.onclick = () => openModal(key);

        const num = document.createElement('div');
        num.className = 'day-num';
        num.textContent = d;
        cell.appendChild(num);



        const visible = tasks.slice(0, 2);
        visible.forEach(t => {
            const pill = document.createElement('div');
            pill.className = 'day-pill' + (t.done ? ' done-pill' : '');
            pill.textContent = t.text;
            cell.appendChild(pill);
        });
        if (tasks.length > 2) {
            const more = document.createElement('div');
            more.className = 'day-pill';
            more.textContent = `+${tasks.length - 2} mais`;
            cell.appendChild(more);
        }

       
        if (tasks.length > 0) {
            const done = tasks.filter(t => t.done).length;
            const pct  = Math.round(done / tasks.length * 100);
            const bar  = document.createElement('div');
            bar.className = 'day-progress-bar';
            bar.innerHTML = `<div class="day-progress-fill" style="width:${pct}%"></div>`;
            cell.appendChild(bar);
        }

        grid.appendChild(cell);
    }
}




async function openModal(key) {
    openDateKey = key;
    pendingSubtasks = [];
    renderSubtaskFields();

    const [y, m, d] = key.split('-');
    const date = new Date(Number(y), Number(m)-1, Number(d));
    const dow  = DAYS_PT[date.getDay()];
    document.getElementById('modal-day-title').textContent =
        `${dow}, ${Number(d)} de ${MONTHS_PT[Number(m)-1]} de ${y}`;

    document.getElementById('task-input').value = '';
    document.getElementById('task-desc').value  = '';
    document.getElementById('subtask-input').value = '';

    document.getElementById('modal-overlay').classList.add('open');
    await renderTasks();
    document.getElementById('task-input').focus();
}

function closeModal(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModalForce();
}
function closeModalForce() {
    document.getElementById('modal-overlay').classList.remove('open');
    openDateKey = null;
    renderCalendar();
}




async function renderTasks() {
    const container = document.getElementById('tarefas');
    container.innerHTML = '';
    const tasks = await dbGet(openDateKey);

    if (tasks.length === 0) {
        container.innerHTML = '<p>Sem tarefas para este dia 🌸</p>';
        return;
    }

    tasks.forEach((task, i) => {
        const item = document.createElement('div');
        item.className = 'tarefa' + (task.done ? ' done-task' : '');



        const mainRow = document.createElement('div');
        mainRow.className = 'task-main-row';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'check';
        chk.checked = task.done;
        chk.onchange = () => toggleTask(i);

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.text;

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-remove';
        delBtn.textContent = '✕';
        delBtn.onclick = () => removeTask(i);

        mainRow.appendChild(chk);
        mainRow.appendChild(span);
        mainRow.appendChild(delBtn);
        item.appendChild(mainRow);



        if (task.desc) {
            const desc = document.createElement('div');
            desc.className = 'task-desc-text';
            desc.textContent = task.desc;
            item.appendChild(desc);
        }



        if (task.subtasks && task.subtasks.length > 0) {
            const subList = document.createElement('div');
            subList.className = 'subtasks-list';
            task.subtasks.forEach((sub, si) => {
                const subItem = document.createElement('div');
                subItem.className = 'subtask-item' + (sub.done ? ' sub-done' : '');

                const sc = document.createElement('input');
                sc.type = 'checkbox';
                sc.className = 'check';
                sc.checked = sub.done;
                sc.onchange = () => toggleSubtask(i, si);

                const st = document.createElement('span');
                st.className = 'subtask-text';
                st.textContent = sub.text;

                subItem.appendChild(sc);
                subItem.appendChild(st);
                subList.appendChild(subItem);
            });
            item.appendChild(subList);
        }

        container.appendChild(item);
    });
}



async function addTask() {
    const input = document.getElementById('task-input');
    const text  = input.value.trim();
    if (!text) { input.focus(); return; }

    const desc = document.getElementById('task-desc').value.trim();
    const subs = pendingSubtasks
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => ({ text: t, done: false }));



    const lastSub = document.getElementById('subtask-input').value.trim();
    if (lastSub) subs.push({ text: lastSub, done: false });

    const tasks = await dbGet(openDateKey);
    tasks.unshift({ text, desc, subtasks: subs, done: false });
    await dbSet(openDateKey, tasks);

    input.value = '';
    document.getElementById('task-desc').value  = '';
    document.getElementById('subtask-input').value = '';
    pendingSubtasks = [];
    renderSubtaskFields();

    input.focus();
    renderTasks();
}

async function toggleTask(i) {
    const tasks = await dbGet(openDateKey);
    tasks[i].done = !tasks[i].done;
    await dbSet(openDateKey, tasks);
    renderTasks();
}

async function toggleSubtask(ti, si) {
    const tasks = await dbGet(openDateKey);
    tasks[ti].subtasks[si].done = !tasks[ti].subtasks[si].done;

    if (tasks[ti].subtasks.every(s => s.done)) tasks[ti].done = true;
    else tasks[ti].done = false;
    await dbSet(openDateKey, tasks);
    renderTasks();
}

async function removeTask(i) {
    const tasks = await dbGet(openDateKey);
    tasks.splice(i, 1);
    await dbSet(openDateKey, tasks);
    renderTasks();
}


function addSubtaskField() {
    const inp = document.getElementById('subtask-input');
    const val = inp.value.trim();
    if (val) {
        pendingSubtasks.push(val);
        inp.value = '';
    } else {
        
        pendingSubtasks.push('');
    }
    renderSubtaskFields();
    
    const fields = document.querySelectorAll('.subtask-field-row input');
    if (fields.length) fields[fields.length - 1].focus();
}

function removeSubtaskField(idx) {
    pendingSubtasks.splice(idx, 1);
    renderSubtaskFields();
}

function renderSubtaskFields() {
    const list = document.getElementById('subtask-list');
    list.innerHTML = '';
    pendingSubtasks.forEach((val, i) => {
        const row = document.createElement('div');
        row.className = 'subtask-field-row';
        row.innerHTML = `
            <input type="text" value="${escHtml(val)}" maxlength="200"
                   placeholder="Sub-tarefa ${i+1}"
                   oninput="pendingSubtasks[${i}]=this.value">
            <button onclick="removeSubtaskField(${i})">✕</button>
        `;
        list.appendChild(row);
    });
}





async function renderStats() {
    const container = document.getElementById('stats-container');
    container.innerHTML = '';

    const allRecords = await dbGetAll();
    if (allRecords.length === 0) {
        container.innerHTML = '<p class="stats-empty" style="color:var(--corativa);text-align:center;padding:20px;">Nenhuma tarefa encontrada ainda 🌸</p>';
        return;
    }


    const monthMap = {};
    allRecords.forEach(r => {
        const [y, m] = r.dateKey.split('-');
        const mk = `${y}-${m}`;
        if (!monthMap[mk]) monthMap[mk] = [];
        monthMap[mk].push(r);
    });


    const sortedMonths = Object.keys(monthMap).sort().reverse();

    sortedMonths.forEach(mk => {
        const [y, m] = mk.split('-');
        const monthIdx = Number(m) - 1;
        const records  = monthMap[mk];

        let totalTasks = 0, doneTasks = 0;
        records.forEach(r => {
            totalTasks += r.tasks.length;
            doneTasks  += r.tasks.filter(t => t.done).length;
        });

        const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;

        const card = document.createElement('div');
        card.className = 'stats-month-card';

        const title = document.createElement('div');
        title.className = 'stats-month-title';
        title.textContent = `${MONTHS_PT[monthIdx]} ${y}`;
        card.appendChild(title);


        const overall = document.createElement('div');
        overall.className = 'stats-overall';
        overall.innerHTML = `
            <div class="stats-bar-label">
                <span>✅ ${doneTasks} / ${totalTasks} tarefas</span>
                <span>${pct}%</span>
            </div>
            <div class="stats-bar-track">
                <div class="stats-bar-fill" style="width:${pct}%"></div>
            </div>
        `;
        card.appendChild(overall);

        const daysInMonth = new Date(Number(y), monthIdx + 1, 0).getDate();
        const firstDow    = new Date(Number(y), monthIdx, 1).getDay();

        const dayGrid = document.createElement('div');
        dayGrid.className = 'stats-days-grid';

        
        DAYS_PT.forEach(d => {
            const h = document.createElement('div');
            h.style.cssText = 'font-size:0.6rem;text-align:center;color:var(--corinativa);font-weight:800;';
            h.textContent = d;
            dayGrid.appendChild(h);
        });

        
        for (let e = 0; e < firstDow; e++) {
            dayGrid.appendChild(document.createElement('div'));
        }

        const dayLookup = {};
        records.forEach(r => { dayLookup[r.dateKey] = r.tasks; });

        for (let d = 1; d <= daysInMonth; d++) {
            const key   = `${y}-${m}-${String(d).padStart(2,'0')}`;
            const tasks = dayLookup[key] || [];
            const dot   = document.createElement('div');
            const done  = tasks.filter(t => t.done).length;
            let cls = 'stats-day-dot ';
            if (tasks.length === 0) cls += 'no-tasks';
            else if (done === tasks.length) cls += 'all-done';
            else cls += 'has-tasks';
            dot.className = cls;
            dot.textContent = d;
            if (tasks.length > 0) {
                const p = Math.round(done / tasks.length * 100);
                dot.title = `${d}/${m}: ${done}/${tasks.length} (${p}%)`;
            }
            dayGrid.appendChild(dot);
        }
        card.appendChild(dayGrid);

        
        const legend = document.createElement('div');
        legend.className = 'stats-legend';
        legend.innerHTML = `
            <span><span class="legend-dot" style="background:var(--corinativa)"></span>Tudo feito</span>
            <span><span class="legend-dot" style="background:var(--corbk3)"></span>Parcial</span>
            <span><span class="legend-dot" style="background:transparent;border:1px solid var(--corbk3)"></span>Sem tarefas</span>
        `;
        card.appendChild(legend);

        container.appendChild(card);
    });
}


document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (document.getElementById('modal-overlay').classList.contains('open')) {
            closeModalForce();
        }
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const ti = document.getElementById('task-input');
    if (ti) ti.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

    const si = document.getElementById('subtask-input');
    if (si) si.addEventListener('keydown', e => { if (e.key === 'Enter') addSubtaskField(); });
});



openDB().then(() => {
    updateMonthLabel();
    renderCalendar();
}).catch(err => {
    console.error('IndexedDB error:', err);
    alert('Erro ao abrir o banco de dados. Tente recarregar a página.');
});
