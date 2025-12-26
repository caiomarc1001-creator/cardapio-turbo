// ADMIN PANEL - Cardapio Turbo

const PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
let recipes = [];
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('adminAuth') === 'authenticated') {
        isAuthenticated = true;
        showAdminPanel();
    }

    document.getElementById('login-form').addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();

    const password = document.getElementById('admin-password').value;
    const hash = await sha256(password);

    if (hash === PASSWORD_HASH) {
        isAuthenticated = true;
        sessionStorage.setItem('adminAuth', 'authenticated');
        showAdminPanel();
    } else {
        const errorDiv = document.getElementById('login-error');
        errorDiv.textContent = 'Senha incorreta';
        errorDiv.classList.remove('hidden');
    }
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showAdminPanel() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    initAdmin();
}

async function initAdmin() {
    await loadRecipes();
    setupAdminListeners();
    renderRecipesList();
}

function setupAdminListeners() {
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('add-recipe-btn').addEventListener('click', () => openModal());
    document.getElementById('export-btn').addEventListener('click', exportRecipes);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importRecipes);
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('recipe-form').addEventListener('submit', saveRecipe);
    document.getElementById('search-input').addEventListener('input', filterRecipes);
    document.getElementById('filter-meal').addEventListener('change', filterRecipes);
}

function logout() {
    sessionStorage.removeItem('adminAuth');
    location.reload();
}

async function loadRecipes() {
    try {
           const response = await fetch('data/recipes.json');
        recipes = await response.json();
        console.log('Receitas carregadas:', recipes.length);
    } catch (error) {
        console.error('Erro ao carregar receitas:', error);
        recipes = [];
    }
}

function renderRecipesList(filtered = null) {
    const container = document.getElementById('recipes-list');
    const recipesToShow = filtered || recipes;

    document.getElementById('recipe-count').textContent = recipesToShow.length + ' receitas';

    if (recipesToShow.length === 0) {
        container.innerHTML = '<div class="turbo-card"><p>Nenhuma receita encontrada.</p></div>';
        return;
    }

    container.innerHTML = '';

    recipesToShow.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'turbo-card';
        card.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:1rem;';

        card.innerHTML = `
            <div>
                <h3 style="margin:0;">${recipe.name}</h3>
                <p style="color:#999;margin:0.5rem 0 0 0;">${getMealLabel(recipe.mealPeriod)} • ${recipe.prepTimeMinutes} min</p>
            </div>
            <div style="display:flex;gap:0.5rem;">
                <button class="btn-turbo btn-secondary" onclick="editRecipe('${recipe.id}')" style="padding:0.5rem 1rem;min-height:auto;">Editar</button>
                <button class="btn-turbo btn-secondary" onclick="deleteRecipe('${recipe.id}')" style="padding:0.5rem 1rem;min-height:auto;">Excluir</button>
            </div>
        `;

        container.appendChild(card);
    });
}

function getMealLabel(period) {
    const labels = {
        breakfast: 'Café da Manhã',
        schoolSnack: 'Lanche da Escola',
        lunch: 'Almoço',
        afternoonSnack: 'Café da Tarde',
        dinner: 'Jantar',
        supper: 'Ceia'
    };
    return labels[period] || period;
}

function filterRecipes() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const meal = document.getElementById('filter-meal').value;

    let filtered = recipes;

    if (search) {
        filtered = filtered.filter(r => r.name.toLowerCase().includes(search));
    }

    if (meal) {
        filtered = filtered.filter(r => r.mealPeriod === meal);
    }

    renderRecipesList(filtered);
}

function openModal(recipe = null) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('recipe-form');

    if (recipe) {
        document.getElementById('modal-title').textContent = 'Editar Receita';
        fillForm(recipe);
    } else {
        document.getElementById('modal-title').textContent = 'Nova Receita';
        form.reset();
        document.getElementById('recipe-id').value = '';
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function fillForm(recipe) {
    document.getElementById('recipe-id').value = recipe.id;
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-meal').value = recipe.mealPeriod;
    document.getElementById('recipe-time').value = recipe.prepTimeMinutes;
    document.getElementById('recipe-cost').value = recipe.costLevel;

    const ingredientsText = recipe.ingredients.map(i => i.quantity + ' ' + i.unit + ' ' + i.name + ', ' + i.category).join('\n');
    document.getElementById('recipe-ingredients').value = ingredientsText;

    document.getElementById('recipe-steps').value = recipe.steps.join('\n');
    document.getElementById('recipe-tags').value = (recipe.tags || []).join(', ');
    document.getElementById('recipe-allergens').value = (recipe.allergens || []).join(', ');
    document.getElementById('recipe-nutrition').value = recipe.nutritionNotes || '';
}

function saveRecipe(e) {
    e.preventDefault();

    const id = document.getElementById('recipe-id').value;

    const ingredientsText = document.getElementById('recipe-ingredients').value;
    const ingredients = ingredientsText.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.split(',').map(p => p.trim());
        const qtyAndName = parts[0];
        const category = parts[1] || 'temperos';

        const words = qtyAndName.split(' ');
        const quantity = words[0];
        const unit = words[1];
        const name = words.slice(2).join(' ');

        return {
            quantity: quantity,
            unit: unit,
            name: name,
            category: category
        };
    });

    const stepsText = document.getElementById('recipe-steps').value;
    const steps = stepsText.split('\n').filter(s => s.trim());

    const tagsText = document.getElementById('recipe-tags').value;
    const tags = tagsText.split(',').map(t => t.trim()).filter(t => t);

    const allergensText = document.getElementById('recipe-allergens').value;
    const allergens = allergensText.split(',').map(a => a.trim()).filter(a => a);

    const recipe = {
        id: id || 'recipe_' + Date.now(),
        name: document.getElementById('recipe-name').value,
        mealPeriod: document.getElementById('recipe-meal').value,
        ingredients: ingredients,
        steps: steps,
        prepTimeMinutes: parseInt(document.getElementById('recipe-time').value),
        costLevel: document.getElementById('recipe-cost').value,
        tags: tags,
        allergens: allergens,
        nutritionNotes: document.getElementById('recipe-nutrition').value,
        portability: []
    };

    if (id) {
        const index = recipes.findIndex(r => r.id === id);
        if (index > -1) {
            recipes[index] = recipe;
        }
    } else {
        recipes.push(recipe);
    }

    renderRecipesList();
    closeModal();
    alert('Receita salva! Exporte o JSON para atualizar o site.');
}

window.editRecipe = function(id) {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
        openModal(recipe);
    }
}

window.deleteRecipe = function(id) {
    if (!confirm('Remover esta receita?')) return;

    recipes = recipes.filter(r => r.id !== id);
    renderRecipesList();
    alert('Receita removida! Exporte o JSON para atualizar o site.');
}

function importRecipes(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (!Array.isArray(imported)) {
                alert('Formato invalido.');
                return;
            }
            if (confirm('Importar ' + imported.length + ' receitas?')) {
                recipes = imported;
                renderRecipesList();
                alert('Receitas importadas!');
            }
        } catch (error) {
            alert('Erro ao importar: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function exportRecipes() {
    const json = JSON.stringify(recipes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'recipes.json';
    a.click();

    URL.revokeObjectURL(url);
    alert('JSON exportado! Substitua o arquivo no GitHub.');
}




