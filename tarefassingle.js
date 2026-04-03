(function () {

    const STORAGE_KEY = 'agenda-tasks-single';

    let singleTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    function single_salvar() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(singleTasks));
    }

    function single_escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function single_renderizar() {
        const container = document.getElementById('single-tarefas');
        if (!container) return;
        container.innerHTML = '';

        if (singleTasks.length === 0) {
            container.innerHTML = '<p class="single-empty">Sem nada para fazer 🌸</p>';
            return;
        }

        singleTasks.forEach((task, i) => {
            const item = document.createElement('div');
            item.className = 'tarefa' + (task.done ? ' done-task' : '');
            item.innerHTML = `
                <div class="task-main-row">
                    <input class="check" type="checkbox" ${task.done ? 'checked' : ''} onchange="singleToggle(${i})" />
                    <span class="task-text">${single_escHtml(task.text)}</span>
                    <button class="btn-remove" onclick="singleRemove(${i})">✕</button>
                </div>
                ${task.desc ? `<div class="task-desc">${single_escHtml(task.desc)}</div>` : ''}
            `;
            container.appendChild(item);
        });
    }

   
    window.singleAddTask = function () {
        const input = document.getElementById('single-task-input');
        const desc  = document.getElementById('single-task-desc');
        const text  = input.value.trim();
        if (!text) { input.focus(); return; }
        singleTasks.unshift({ text, desc: desc.value.trim(), done: false });
        single_salvar();
        single_renderizar();
        input.value = '';
        desc.value  = '';
        input.focus();
    };

    window.singleToggle = function (i) {
        singleTasks[i].done = !singleTasks[i].done;
        single_salvar();
        single_renderizar();
    };

    window.singleRemove = function (i) {
        singleTasks.splice(i, 1);
        single_salvar();
        single_renderizar();
    };

    window.singleClearAll = function () {
        if (confirm('Limpar todas as tarefas da lista geral?')) {
            singleTasks = [];
            single_salvar();
            single_renderizar();
        }
    };

    
    document.addEventListener('DOMContentLoaded', () => {
        single_renderizar();

        const inp = document.getElementById('single-task-input');
        if (inp) inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') window.singleAddTask();
        });
    });

    window.singleRenderizar = single_renderizar;
    const _originalSetView = setView;
    window.setView = function (v) {
        const singleView = document.getElementById('view-single');
        const singleBtn  = document.getElementById('btn-single');
        const monthNav   = document.getElementById('month-nav');
        if (v === 'single') {
            document.getElementById('view-calendar').style.display = 'none';
            document.getElementById('view-stats').style.display    = 'none';
            singleView.style.display = '';
            document.getElementById('btn-calendar').classList.remove('active');
            document.getElementById('btn-stats').classList.remove('active');
            singleBtn.classList.add('active');
            monthNav.style.display = 'none';
            single_renderizar();
        } else {
            singleView.style.display = 'none';
            singleBtn.classList.remove('active');
            monthNav.style.display = '';
            _originalSetView(v);
        }
    };

})(); 