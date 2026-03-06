let tasks = JSON.parse(localStorage.getItem('agenda-tasks') || '[]');

function salvar() {
    localStorage.setItem('agenda-tasks', JSON.stringify(tasks));
}

function renderizar() {
    const container = document.getElementById('tarefas');
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = '<p>Sem nada para fazer </p>';
        return;
    }

    tasks.forEach((task, i) => {
    const item = document.createElement('div');
    item.className = 'tarefa' + (task.done ? ' done' : '');
    item.innerHTML = `
    <div class="a2"><input class="check" type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${i})" /></div>
    <div class="a1">
        <span>${escHtml(task.text)}</span>
    ${task.desc ? `<small class="desc1">${escHtml(task.desc)}</small>` : ''}
        <button id="Xzinho" onclick="removeTask(${i})">X</button>
    </div>
      `;
      container.appendChild(item);
    });
}

function addTask() {
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    const desc = document.getElementById('task-desc');
    if (!text) { input.focus(); return; }
    tasks.unshift({ text, desc: desc.value.trim(), done: false});
    salvar()
    renderizar()
    input.value = '';
    desc.value = '';
    input.focus();
}

function toggleTask(i) {
    tasks[i].done = !tasks[i].done;
    salvar();
    renderizar();
}

function removeTask(i) {
    tasks.splice(i, 1);
    salvar();
    renderizar();
}

function clearAll() {
    if (confirm('Limpar tudo')) {
        tasks = [];
        salvar();
        renderizar();
    }
}

document.getElementById('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
});

function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


renderizar();