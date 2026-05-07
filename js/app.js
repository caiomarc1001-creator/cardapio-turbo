// CARDÁPIO TURBO KIDS - APP PRINCIPAL

let allRecipes = [];
let currentProfile = null;
let currentMenu = null;
let userHistory = {
    ratings: {},
    favorites: [],
    generated: []
};

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
    setupThemeSwitcher();
    setupFontControls();
    await loadRecipes();
    loadUserHistory();
    setupEventListeners();
});

function setupThemeSwitcher() {
    const savedTheme = localStorage.getItem('visualTheme') || 'glass';
    setVisualTheme(savedTheme);

    document.querySelectorAll('.theme-btn').forEach(button => {
        button.addEventListener('click', () => {
            setVisualTheme(button.dataset.theme);
            localStorage.setItem('visualTheme', button.dataset.theme);
        });
    });
}

function setVisualTheme(theme) {
    document.body.dataset.theme = theme;
    document.querySelectorAll('.theme-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.theme === theme);
    });
}

function setupFontControls() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem('fontScaleBySection') || '{}');
    } catch (error) {
        saved = {};
        localStorage.removeItem('fontScaleBySection');
    }
    const controls = document.querySelectorAll('.font-control');

    controls.forEach(control => {
        const target = control.dataset.fontTarget;
        const value = saved[target] || control.value || 100;
        control.value = value;
        applySectionFontScale(target, value);

        control.addEventListener('input', () => {
            saved[target] = control.value;
            applySectionFontScale(target, control.value);
            localStorage.setItem('fontScaleBySection', JSON.stringify(saved));
        });
    });

    const resetBtn = document.getElementById('reset-fonts-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            controls.forEach(control => {
                control.value = 100;
                applySectionFontScale(control.dataset.fontTarget, 100);
            });
            localStorage.removeItem('fontScaleBySection');
        });
    }
}

function applySectionFontScale(target, value) {
    document.documentElement.style.setProperty(`--font-${target}`, `${Number(value) / 100}`);
}

// CARREGAR RECEITAS
async function loadRecipes() {
    try {
        const response = await fetch('data/recipes.json');
        allRecipes = await response.json();
        console.log(`✅ ${allRecipes.length} receitas carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar receitas:', error);
        alert('Erro ao carregar receitas. Verifique se o arquivo data/recipes.json existe.');
    }
}

// HISTÓRICO
function loadUserHistory() {
    const saved = localStorage.getItem('userHistory');
    if (saved) userHistory = JSON.parse(saved);
}

function saveUserHistory() {
    localStorage.setItem('userHistory', JSON.stringify(userHistory));
}

// EVENT LISTENERS
function setupEventListeners() {
    const form = document.getElementById('profile-form');
    const resetBtn = document.getElementById('reset-btn');
    const generateAnotherBtn = document.getElementById('generate-another-btn');
    const goesToSchool = document.getElementById('goes-to-school');

    form.addEventListener('submit', handleFormSubmit);
    resetBtn.addEventListener('click', resetForm);
    generateAnotherBtn.addEventListener('click', generateAnotherMenu);

    goesToSchool.addEventListener('change', (e) => {
        document.getElementById('full-time-wrapper').style.display = e.target.checked ? 'flex' : 'none';
    });
}

// PROCESSAR FORMULÁRIO
function handleFormSubmit(e) {
    e.preventDefault();

    if (allRecipes.length === 0) {
        alert('Aguarde o carregamento das receitas...');
        return;
    }

    currentProfile = parseProfileFromForm();
    localStorage.setItem('childProfile', JSON.stringify(currentProfile));

    currentMenu = generateDailyMenu(currentProfile, allRecipes, userHistory);

    if (currentMenu) {
        displayMenu(currentMenu);
        document.getElementById('menu-section').classList.remove('hidden');
        document.getElementById('menu-section').scrollIntoView({ behavior: 'smooth' });
    }
}

function parseProfileFromForm() {
    const form = document.getElementById('profile-form');
    const formData = new FormData(form);

    const allergens = Array.from(document.querySelectorAll('input[name="allergens"]:checked')).map(cb => cb.value);

    const preferences = {
        breakfast: {
            likes: parseList(formData.get('prefBreakfast')),
            dislikes: parseList(formData.get('avoidBreakfast'))
        },
        schoolSnack: {
            likes: parseList(formData.get('prefSchoolSnack')),
            dislikes: parseList(formData.get('avoidSchoolSnack'))
        },
        lunch: {
            likes: parseList(formData.get('prefLunch')),
            dislikes: parseList(formData.get('avoidLunch'))
        },
        afternoonSnack: {
            likes: parseList(formData.get('prefAfternoonSnack')),
            dislikes: parseList(formData.get('avoidAfternoonSnack'))
        },
        dinner: {
            likes: parseList(formData.get('prefDinner')),
            dislikes: parseList(formData.get('avoidDinner'))
        },
        supper: {
            likes: parseList(formData.get('prefSupper')),
            dislikes: parseList(formData.get('avoidSupper'))
        }
    };

    return {
        ageYears: parseInt(formData.get('ageYears')) || 0,
        ageMonths: parseInt(formData.get('ageMonths')) || 0,
        weight: parseFloat(formData.get('weight')) || null,
        height: parseFloat(formData.get('height')) || null,
        goesToSchool: formData.get('goesToSchool') === 'on',
        fullTime: formData.get('fullTime') === 'on',
        activityLevel: formData.get('activityLevel') || 'medium',
        allergens: allergens,
        otherRestrictions: parseList(formData.get('otherRestrictions')),
        preferences: preferences,
        prepTime: formData.get('prepTime') || 'any',
        costLevel: formData.get('costLevel') || 'any',
        recipeMode: formData.get('recipeMode') || 'practical'
    };
}

function parseList(str) {
    if (!str) return [];
    return str.split(',').map(item => item.trim().toLowerCase()).filter(item => item.length > 0);
}

// GERAR CARDÁPIO
function generateDailyMenu(profile, recipes, history) {
    const mealPeriods = [
        { id: 'breakfast', name: '☀️ Café da Manhã' },
        { id: 'schoolSnack', name: profile.goesToSchool ? '🎒 Lanche da Escola' : '🍎 Lanche da Manhã' },
        { id: 'lunch', name: '🍽️ Almoço' },
        { id: 'afternoonSnack', name: '🥤 Café da Tarde' },
        { id: 'dinner', name: '🌙 Jantar' },
        { id: 'supper', name: '🌜 Ceia' }
    ];

    const menu = { meals: [], warnings: [] };
    const dayContext = { usedProteins: [], usedBases: [], fruitCount: 0, vegetableCount: 0 };

    for (const period of mealPeriods) {
        const candidates = filterRecipesForMeal(recipes, profile, period.id);

        if (candidates.length === 0) {
            menu.warnings.push(`Não foi possível gerar ${period.name}. Tente ajustar as preferências.`);
            continue;
        }

        const recipe = pickRecipe(candidates, profile, history, dayContext);

        if (recipe) {
            menu.meals.push({
                period: period.id,
                periodName: period.name,
                recipe: recipe
            });
            updateDayContext(dayContext, recipe);
        }
    }

    return menu;
}

function filterRecipesForMeal(recipes, profile, mealPeriod) {
    return recipes.filter(recipe => {
        if (recipe.mealPeriod !== mealPeriod) return false;
        if (hasAllergens(recipe, profile.allergens)) return false;

        const prefs = profile.preferences[mealPeriod];
        if (prefs && hasDislikedIngredients(recipe, prefs.dislikes)) return false;

        if (profile.prepTime !== 'any') {
            const maxTime = parseInt(profile.prepTime);
            if (recipe.prepTimeMinutes > maxTime) return false;
        }

        if (profile.costLevel !== 'any') {
            if (profile.costLevel === 'low' && recipe.costLevel !== 'low') return false;
            if (profile.costLevel === 'medium' && recipe.costLevel === 'high') return false;
        }

        if (profile.recipeMode === 'practical' && !isPracticalRecipe(recipe)) return false;

        if (mealPeriod === 'schoolSnack' && profile.goesToSchool) {
            if (!recipe.portability || !recipe.portability.includes('lunchbox_ok')) return false;
        }

        return true;
    });
}

function isPracticalRecipe(recipe) {
    const ingredientsCount = (recipe.ingredients || []).length;
    const stepsCount = (recipe.steps || []).length;
    return recipe.prepTimeMinutes <= 20 || recipe.tags?.includes('quick') || (ingredientsCount <= 3 && stepsCount <= 3);
}

function getComplexityScore(recipe) {
    const ingredientsCount = (recipe.ingredients || []).length;
    const stepsCount = (recipe.steps || []).length;
    return recipe.prepTimeMinutes + ingredientsCount * 3 + stepsCount * 2;
}

function hasAllergens(recipe, allergens) {
    if (!recipe.allergens || allergens.length === 0) return false;
    return recipe.allergens.some(a => allergens.includes(a));
}

function hasDislikedIngredients(recipe, dislikes) {
    if (!dislikes || dislikes.length === 0) return false;
    const recipeText = getRecipeSearchText(recipe);
    return dislikes.some(dislike => recipeText.includes(dislike));
}

function hasLikedIngredients(recipe, likes) {
    if (!likes || likes.length === 0) return false;
    const recipeText = getRecipeSearchText(recipe);
    return likes.some(like => recipeText.includes(like));
}

function getRecipeSearchText(recipe) {
    return [recipe.name, ...(recipe.ingredients || []).map(i => i.name), ...(recipe.tags || [])].join(' ').toLowerCase();
}

function pickRecipe(candidates, profile, history, dayContext) {
    const scored = candidates.map(recipe => ({
        recipe,
        score: scoreRecipe(recipe, profile, history, dayContext)
    }));

    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(5, scored.length);
    const finalists = scored.slice(0, topN);
    const chosen = finalists[Math.floor(Math.random() * finalists.length)];

    history.generated.push(chosen.recipe.id);
    saveUserHistory();

    return chosen.recipe;
}

function scoreRecipe(recipe, profile, history, dayContext) {
    let score = 100;
    const prefs = profile.preferences[recipe.mealPeriod];
    const ageRule = window.NutritionRules?.getAgeNutritionRule(profile.ageYears, profile.ageMonths);

    if (prefs && hasLikedIngredients(recipe, prefs.likes)) score += 25;
    if (ageRule) score += window.NutritionRules.getRecipeAgeScore(recipe, ageRule);

    const rating = history.ratings[recipe.id];
    if (rating) {
        if (rating.ate === 'no') score -= 50;
        if (rating.liked) score += (rating.liked - 3) * 10;
    }

    if (history.favorites.includes(recipe.id)) score += 30;

    if (recipe.tags) {
        if (recipe.tags.includes('high_fiber')) score += 10;
        if (recipe.tags.includes('high_protein')) score += 8;
        if (recipe.tags.includes('kid_friendly')) score += 8;
        if (recipe.tags.includes('quick') && profile.prepTime !== 'any') score += 6;
    }

    const complexityScore = getComplexityScore(recipe);
    if (profile.recipeMode === 'practical') {
        score += recipe.tags?.includes('quick') ? 18 : 0;
        score += Math.max(0, 22 - complexityScore * 0.55);
    }

    if (profile.recipeMode === 'complex') {
        score += Math.min(24, complexityScore * 0.32);
        if (recipe.prepTimeMinutes >= 15) score += 10;
        if ((recipe.ingredients || []).length >= 4) score += 8;
    }

    const protein = getFirstIngredientByCategory(recipe, 'proteinas');
    const base = getFirstIngredientByCategory(recipe, 'graos');
    if (protein && dayContext.usedProteins.includes(protein)) score -= 12;
    if (base && dayContext.usedBases.includes(base)) score -= 6;
    if (recipe.ingredients.some(ing => ing.category === 'hortifruti')) score += 10;

    return Math.max(score, 0);
}

function updateDayContext(context, recipe) {
    const protein = getFirstIngredientByCategory(recipe, 'proteinas');
    const base = getFirstIngredientByCategory(recipe, 'graos');
    if (protein) context.usedProteins.push(protein);
    if (base) context.usedBases.push(base);
}

function getFirstIngredientByCategory(recipe, category) {
    const ingredient = (recipe.ingredients || []).find(ing => ing.category === category);
    return ingredient ? ingredient.name.toLowerCase() : null;
}

// EXIBIR MENU
function displayMenu(menu) {
    const container = document.getElementById('meals-container');
    container.innerHTML = '';

    if (menu.warnings.length > 0) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-message';
        warningDiv.innerHTML = `<strong>⚠️ Atenção:</strong><ul>${menu.warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
        container.appendChild(warningDiv);
    }

    menu.meals.forEach(meal => {
        const card = createMealCard(meal);
        container.appendChild(card);
    });

    displayNutritionSummary(menu);
    generateShoppingList(menu);
}

function displayNutritionSummary(menu) {
    const container = document.getElementById('nutrition-summary');
    if (!container || !window.NutritionRules || !currentProfile) return;

    const rule = window.NutritionRules.getAgeNutritionRule(currentProfile.ageYears, currentProfile.ageMonths);
    const estimate = window.NutritionRules.estimateMenuNutrition(menu, currentProfile);
    const fit = window.NutritionRules.getMacroFit(estimate.macroPct, rule);
    const weightGuidance = window.NutritionRules.getWeightGuidance(currentProfile);

    container.innerHTML = `
        <div class="turbo-card nutrition-card">
            <div class="nutrition-card-header">
                <div>
                    <p class="eyebrow">Adequação por idade</p>
                    <h3>Faixa usada: ${rule.label}</h3>
                    <p>${rule.guidance}</p>
                </div>
                <div class="nutrition-kcal">
                    <strong>${estimate.kcal}</strong>
                    <span>kcal estimadas no dia</span>
                </div>
            </div>

            <div class="macro-grid">
                ${createMacroItem('Carboidratos', estimate.macroPct.carbs, rule.carbsPct, fit.carbs)}
                ${createMacroItem('Proteínas', estimate.macroPct.protein, rule.proteinPct, fit.protein)}
                ${createMacroItem('Gorduras', estimate.macroPct.fat, rule.fatPct, fit.fat)}
                <div class="macro-item">
                    <span>Fibras estimadas</span>
                    <strong>${estimate.fiberG} g</strong>
                    <small>Indicador educativo</small>
                </div>
            </div>

            ${weightGuidance.weight ? `
                <div class="weight-guidance">
                    <strong>Peso informado: ${weightGuidance.weight} kg</strong>
                    <span>Proteína mínima diária de referência: ${weightGuidance.minProteinGDay} g/dia (${weightGuidance.proteinGPerKg} g/kg/dia). Porções ajustadas por fator ${weightGuidance.scale.toFixed(2)} em relação ao peso de referência da faixa etária.</span>
                </div>
            ` : `
                <div class="weight-guidance">
                    <strong>Peso não informado</strong>
                    <span>As quantidades exibidas usam porção padrão da receita. Informe o peso para estimar porções mínimas ajustadas.</span>
                </div>
            `}

            <p class="medical-note">Estimativa educativa baseada nos ingredientes cadastrados. Não substitui avaliação individual e não calcula necessidades energéticas personalizadas.</p>
        </div>
    `;
}

function createMacroItem(label, value, range, status) {
    return `
        <div class="macro-item macro-${status}">
            <span>${label}</span>
            <strong>${value}%</strong>
            <small>Meta: ${range[0]}-${range[1]}% • ${status}</small>
        </div>
    `;
}

function createMealCard(meal) {
    const card = document.createElement('div');
    card.className = 'meal-card';

    const recipe = meal.recipe;
    const recipeNutrition = window.NutritionRules?.estimateRecipeNutrition(recipe, currentProfile);
    const ingredientPortions = window.NutritionRules?.getIngredientPortions(recipe, currentProfile) || [];

    card.innerHTML = `
        <div class="meal-title">${meal.periodName}</div>
        <h3 class="meal-name">${recipe.name}</h3>
        <div class="meal-meta">
            <span>⏱️ ${recipe.prepTimeMinutes} min</span>
            <span>💰 ${getCostLabel(recipe.costLevel)}</span>
            ${recipeNutrition ? `<span>${recipeNutrition.kcal} kcal</span><span>C ${recipeNutrition.carbsG}g</span><span>P ${recipeNutrition.proteinG}g</span><span>G ${recipeNutrition.fatG}g</span>` : ''}
        </div>
        ${recipe.tags ? `<div class="meal-tags">${recipe.tags.map(tag => `<span class="tag">${formatTag(tag)}</span>`).join('')}</div>` : ''}
        ${recipe.nutritionNotes ? `<div class="nutrition-note">💡 ${recipe.nutritionNotes}</div>` : ''}

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span>Ingredientes</span>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="ingredient-table">
                    <div class="ingredient-row ingredient-head">
                        <span>Ingrediente</span>
                        <span>Qtd.</span>
                        <span>Mín. ajustado</span>
                        <span>Macros</span>
                    </div>
                    ${ingredientPortions.map(item => `
                        <div class="ingredient-row">
                            <span>${item.name}</span>
                            <span>${item.original}<small>${item.grams} g estimados</small></span>
                            <span>${item.adjustedGrams} g</span>
                            <span>${item.kcal} kcal • C ${item.carbsG}g • P ${item.proteinG}g • G ${item.fatG}g</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span>Modo de Preparo</span>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <ol>${recipe.steps.map(step => `<li>${step}</li>`).join('')}</ol>
            </div>
        </div>

        <div class="button-row">
            <button class="btn-turbo btn-secondary" onclick="substituteMeal('${meal.period}')">🔄 Substituir</button>
        </div>

        <div class="meal-feedback">
            <h4>Como foi?</h4>
            <div class="feedback-row">
                <div class="feedback-group">
                    <label>Comeu?</label>
                    <select class="feedback-ate" onchange="saveFeedback('${recipe.id}', 'ate', this.value)">
                        <option value="">-</option>
                        <option value="yes">Sim</option>
                        <option value="partial">Parcial</option>
                        <option value="no">Não</option>
                    </select>
                </div>
                <div class="feedback-group">
                    <label>Gostou?</label>
                    <div class="rating-stars">${[1,2,3,4,5].map(n => `<button type="button" class="star-btn" onclick="rateRecipe('${recipe.id}', ${n})">★</button>`).join('')}</div>
                </div>
            </div>
        </div>
    `;

    return card;
}

function toggleAccordion(header) {
    header.classList.toggle('active');
    const content = header.nextElementSibling;
    content.classList.toggle('active');
}

function saveFeedback(recipeId, field, value) {
    if (!userHistory.ratings[recipeId]) {
        userHistory.ratings[recipeId] = {};
    }
    userHistory.ratings[recipeId][field] = value;
    saveUserHistory();
}

function rateRecipe(recipeId, rating) {
    if (!userHistory.ratings[recipeId]) {
        userHistory.ratings[recipeId] = {};
    }
    userHistory.ratings[recipeId].liked = rating;
    saveUserHistory();

    // Atualizar UI
    event.target.parentElement.querySelectorAll('.star-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx < rating);
    });
}

function substituteMeal(period) {
    const candidates = filterRecipesForMeal(allRecipes, currentProfile, period);
    const currentMeal = currentMenu.meals.find(m => m.period === period);
    const filtered = candidates.filter(r => r.id !== currentMeal.recipe.id);

    if (filtered.length === 0) {
        alert('Não há outras opções compatíveis.');
        return;
    }

    const newRecipe = filtered[Math.floor(Math.random() * filtered.length)];
    currentMeal.recipe = newRecipe;

    displayMenu(currentMenu);
}

function generateShoppingList(menu) {
    const categories = {
        hortifruti: { name: '🥬 Hortifruti', items: {} },
        proteinas: { name: '🍗 Proteínas', items: {} },
        graos: { name: '🌾 Grãos', items: {} },
        laticinios: { name: '🥛 Laticínios', items: {} },
        temperos: { name: '🧂 Outros', items: {} }
    };

    menu.meals.forEach(meal => {
        meal.recipe.ingredients.forEach(ing => {
            const category = ing.category || 'temperos';
            const key = ing.name.toLowerCase();

            if (!categories[category].items[key]) {
                categories[category].items[key] = { name: ing.name, quantities: [] };
            }
            categories[category].items[key].quantities.push(`${ing.quantity} ${ing.unit}`);
        });
    });

    const container = document.getElementById('shopping-list');
    container.innerHTML = '';

    Object.values(categories).forEach(category => {
        const items = Object.values(category.items);
        if (items.length === 0) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'shopping-category';
        categoryDiv.innerHTML = `
            <h4>${category.name}</h4>
            <ul>${items.map(item => `<li>${item.name} - ${item.quantities.join(', ')}</li>`).join('')}</ul>
        `;
        container.appendChild(categoryDiv);
    });
}

function getCostLabel(cost) {
    const labels = { low: 'Baixo', medium: 'Médio', high: 'Alto' };
    return labels[cost] || cost;
}

function formatTag(tag) {
    const labels = {
        high_fiber: 'Rico em fibras',
        high_protein: 'Proteína',
        kid_friendly: 'Kids adoram',
        quick: 'Rápido',
        lunchbox_ok: 'Lancheira OK'
    };
    return labels[tag] || tag;
}

function generateAnotherMenu() {
    if (!currentProfile) return;
    currentMenu = generateDailyMenu(currentProfile, allRecipes, userHistory);
    displayMenu(currentMenu);
}

function resetForm() {
    if (confirm('Limpar todos os dados?')) {
        localStorage.clear();
        location.reload();
    }
}

