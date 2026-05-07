// Regras educativas de macronutrientes por faixa etaria.
// Base: AMDRs do Institute of Medicine / National Academies.

const AGE_NUTRITION_RULES = [
    {
        id: 'toddler',
        label: '1 a 3 anos',
        minMonths: 12,
        maxMonths: 47,
        carbsPct: [45, 65],
        proteinPct: [5, 20],
        fatPct: [30, 40],
        proteinGPerKg: 1.05,
        referenceWeightKg: 13,
        guidance: 'Prioriza preparacoes macias, alimentos in natura, gorduras boas e variedade ao longo do dia.'
    },
    {
        id: 'child',
        label: '4 a 8 anos',
        minMonths: 48,
        maxMonths: 107,
        carbsPct: [45, 65],
        proteinPct: [10, 30],
        fatPct: [25, 35],
        proteinGPerKg: 0.95,
        referenceWeightKg: 22,
        guidance: 'Busca equilibrio entre energia, fibras, proteinas e variedade de frutas, legumes e leguminosas.'
    },
    {
        id: 'preteen',
        label: '9 a 13 anos',
        minMonths: 108,
        maxMonths: 167,
        carbsPct: [45, 65],
        proteinPct: [10, 30],
        fatPct: [25, 35],
        proteinGPerKg: 0.95,
        referenceWeightKg: 38,
        guidance: 'Considera maior demanda de energia e porcoes, especialmente em dias de maior atividade.'
    },
    {
        id: 'teen',
        label: '14 a 18 anos',
        minMonths: 168,
        maxMonths: 227,
        carbsPct: [45, 65],
        proteinPct: [10, 30],
        fatPct: [25, 35],
        proteinGPerKg: 0.85,
        referenceWeightKg: 55,
        guidance: 'Mantem a distribuicao de macronutrientes e reforca qualidade dos alimentos e rotina regular.'
    }
];

function getAgeNutritionRule(ageYears, ageMonths = 0) {
    const totalMonths = (Number(ageYears) || 0) * 12 + (Number(ageMonths) || 0);
    return AGE_NUTRITION_RULES.find(rule => totalMonths >= rule.minMonths && totalMonths <= rule.maxMonths) || AGE_NUTRITION_RULES[1];
}

function estimateRecipeNutrition(recipe, profile = null) {
    const scale = getPortionScale(profile);
    const nutrition = (recipe.ingredients || []).reduce((total, ingredient) => {
        const estimate = estimateIngredientNutrition(ingredient);
        total.carbsG += estimate.carbsG * scale;
        total.proteinG += estimate.proteinG * scale;
        total.fatG += estimate.fatG * scale;
        total.fiberG += estimate.fiberG * scale;
        return total;
    }, { carbsG: 0, proteinG: 0, fatG: 0, fiberG: 0 });

    nutrition.kcal = Math.round(nutrition.carbsG * 4 + nutrition.proteinG * 4 + nutrition.fatG * 9);
    nutrition.carbsG = roundOne(nutrition.carbsG);
    nutrition.proteinG = roundOne(nutrition.proteinG);
    nutrition.fatG = roundOne(nutrition.fatG);
    nutrition.fiberG = roundOne(nutrition.fiberG);
    nutrition.macroPct = calculateMacroPct(nutrition);
    return nutrition;
}

function estimateMenuNutrition(menu, profile = null) {
    const total = { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, fiberG: 0 };
    (menu.meals || []).forEach(meal => {
        const estimate = estimateRecipeNutrition(meal.recipe, profile);
        total.kcal += estimate.kcal;
        total.carbsG += estimate.carbsG;
        total.proteinG += estimate.proteinG;
        total.fatG += estimate.fatG;
        total.fiberG += estimate.fiberG;
    });

    total.kcal = Math.round(total.kcal);
    total.carbsG = roundOne(total.carbsG);
    total.proteinG = roundOne(total.proteinG);
    total.fatG = roundOne(total.fatG);
    total.fiberG = roundOne(total.fiberG);
    total.macroPct = calculateMacroPct(total);
    return total;
}

function getIngredientPortions(recipe, profile = null) {
    const scale = getPortionScale(profile);
    return (recipe.ingredients || []).map(ingredient => {
        const grams = estimateIngredientGrams(ingredient);
        const adjustedGrams = grams * scale;
        const nutrition = estimateIngredientNutrition(ingredient);

        return {
            original: `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`.trim(),
            name: ingredient.name,
            category: ingredient.category || 'outros',
            grams: Math.round(grams),
            adjustedGrams: Math.round(adjustedGrams),
            carbsG: roundOne(nutrition.carbsG * scale),
            proteinG: roundOne(nutrition.proteinG * scale),
            fatG: roundOne(nutrition.fatG * scale),
            kcal: Math.round((nutrition.carbsG * 4 + nutrition.proteinG * 4 + nutrition.fatG * 9) * scale)
        };
    });
}

function getWeightGuidance(profile = null) {
    const rule = getAgeNutritionRule(profile?.ageYears, profile?.ageMonths);
    const weight = Number(profile?.weight) || null;
    const scale = getPortionScale(profile);

    return {
        rule,
        weight,
        scale,
        minProteinGDay: weight ? roundOne(weight * rule.proteinGPerKg) : null,
        proteinGPerKg: rule.proteinGPerKg,
        referenceWeightKg: rule.referenceWeightKg
    };
}

function estimateIngredientNutrition(ingredient) {
    const text = `${ingredient.name || ''} ${ingredient.category || ''}`.toLowerCase();
    const amountFactor = getAmountFactor(ingredient);

    let base = { carbsG: 3, proteinG: 1, fatG: 0.4, fiberG: 0.6 };

    if (ingredient.category === 'graos') base = { carbsG: 18, proteinG: 3.5, fatG: 1.2, fiberG: 2 };
    if (ingredient.category === 'proteinas') base = { carbsG: 0.5, proteinG: 12, fatG: 5, fiberG: 0 };
    if (ingredient.category === 'laticinios') base = { carbsG: 4, proteinG: 6, fatG: 5, fiberG: 0 };
    if (ingredient.category === 'hortifruti') base = { carbsG: 10, proteinG: 1, fatG: 0.3, fiberG: 2 };
    if (ingredient.category === 'temperos') base = { carbsG: 0.8, proteinG: 0.1, fatG: 0.2, fiberG: 0.1 };

    if (containsAny(text, ['ovo', 'ovos'])) base = { carbsG: 0.5, proteinG: 6, fatG: 5, fiberG: 0 };
    if (containsAny(text, ['frango', 'carne', 'peixe', 'atum', 'sardinha', 'tilapia', 'peru'])) base = { carbsG: 0, proteinG: 18, fatG: 5, fiberG: 0 };
    if (containsAny(text, ['feijao', 'lentilha', 'grao de bico', 'ervilha', 'homus'])) base = { carbsG: 18, proteinG: 8, fatG: 1, fiberG: 6 };
    if (containsAny(text, ['leite', 'iogurte', 'queijo', 'ricota', 'requeijao'])) base = { carbsG: 5, proteinG: 7, fatG: 5, fiberG: 0 };
    if (containsAny(text, ['abacate', 'pasta de amendoim', 'amendoim', 'castanha', 'azeite'])) base = { carbsG: 4, proteinG: 3, fatG: 10, fiberG: 3 };
    if (containsAny(text, ['arroz', 'macarrao', 'pao', 'tapioca', 'cuscuz', 'fuba', 'polvilho', 'mandioca', 'batata', 'batata doce', 'aveia'])) base = { carbsG: 22, proteinG: 3, fatG: 1, fiberG: 2 };
    if (containsAny(text, ['banana', 'maca', 'pera', 'mamao', 'manga', 'morango', 'laranja', 'mexerica', 'uva'])) base = { carbsG: 14, proteinG: 0.8, fatG: 0.2, fiberG: 2.4 };
    if (containsAny(text, ['cenoura', 'abobora', 'abobrinha', 'brocolis', 'couve', 'espinafre', 'tomate', 'chuchu', 'vagem', 'beterraba', 'pepino'])) base = { carbsG: 6, proteinG: 1.2, fatG: 0.2, fiberG: 2.2 };

    return {
        carbsG: base.carbsG * amountFactor,
        proteinG: base.proteinG * amountFactor,
        fatG: base.fatG * amountFactor,
        fiberG: base.fiberG * amountFactor
    };
}

function getAmountFactor(ingredient) {
    const quantity = Number(String(ingredient.quantity || '1').replace(',', '.')) || 1;
    const unit = String(ingredient.unit || '').toLowerCase();

    if (['g', 'ml'].includes(unit)) return Math.max(0.25, Math.min(2.5, quantity / 100));
    if (unit.includes('xicara')) return Math.max(0.25, quantity * 1.6);
    if (unit.includes('colher')) return Math.max(0.15, quantity * 0.28);
    if (unit.includes('fatia')) return Math.max(0.25, quantity * 0.55);
    if (unit.includes('unidade')) return Math.max(0.35, Math.min(2.2, quantity * 0.9));
    if (unit.includes('lata')) return Math.max(0.8, quantity * 1.3);
    return Math.max(0.25, Math.min(2.5, quantity));
}

function estimateIngredientGrams(ingredient) {
    const quantity = Number(String(ingredient.quantity || '1').replace(',', '.')) || 1;
    const unit = String(ingredient.unit || '').toLowerCase();
    const text = `${ingredient.name || ''} ${ingredient.category || ''}`.toLowerCase();

    if (unit === 'g' || unit.includes('grama')) return quantity;
    if (unit === 'ml') return quantity;
    if (unit.includes('xicara')) return quantity * 160;
    if (unit.includes('colher')) return quantity * 15;
    if (unit.includes('fatia')) return quantity * 28;
    if (unit.includes('lata')) return quantity * 120;
    if (unit.includes('pitada') || unit.includes('fio')) return quantity * 2;
    if (unit.includes('pedaco')) return quantity * 80;
    if (unit.includes('espiga')) return quantity * 90;

    if (unit.includes('unidade')) {
        if (containsAny(text, ['ovo'])) return quantity * 50;
        if (containsAny(text, ['banana', 'maca', 'pera', 'laranja', 'mexerica', 'manga'])) return quantity * 90;
        if (containsAny(text, ['tomate', 'cenoura', 'batata', 'batata doce', 'abobrinha', 'chuchu', 'beterraba'])) return quantity * 80;
        if (containsAny(text, ['morangos', 'uva'])) return quantity * 12;
        if (containsAny(text, ['pao', 'tortilha', 'tapioca', 'panqueca'])) return quantity * 50;
        return quantity * 60;
    }

    return getAmountFactor(ingredient) * 100;
}

function getPortionScale(profile = null) {
    if (!profile) return 1;

    const rule = getAgeNutritionRule(profile.ageYears, profile.ageMonths);
    const weight = Number(profile.weight) || null;
    if (!weight || !rule.referenceWeightKg) return 1;

    return Math.max(0.6, Math.min(1.55, weight / rule.referenceWeightKg));
}

function calculateMacroPct(nutrition) {
    const carbKcal = nutrition.carbsG * 4;
    const proteinKcal = nutrition.proteinG * 4;
    const fatKcal = nutrition.fatG * 9;
    const macroKcal = carbKcal + proteinKcal + fatKcal;

    if (!macroKcal) return { carbs: 0, protein: 0, fat: 0 };

    return {
        carbs: Math.round((carbKcal / macroKcal) * 100),
        protein: Math.round((proteinKcal / macroKcal) * 100),
        fat: Math.round((fatKcal / macroKcal) * 100)
    };
}

function getMacroFit(macroPct, rule) {
    return {
        carbs: getRangeStatus(macroPct.carbs, rule.carbsPct),
        protein: getRangeStatus(macroPct.protein, rule.proteinPct),
        fat: getRangeStatus(macroPct.fat, rule.fatPct)
    };
}

function getRangeStatus(value, range) {
    if (value < range[0]) return 'baixo';
    if (value > range[1]) return 'alto';
    return 'dentro';
}

function getRecipeAgeScore(recipe, rule) {
    const macroPct = estimateRecipeNutrition(recipe).macroPct;
    const midpoint = {
        carbs: average(rule.carbsPct),
        protein: average(rule.proteinPct),
        fat: average(rule.fatPct)
    };
    const distance = Math.abs(macroPct.carbs - midpoint.carbs) + Math.abs(macroPct.protein - midpoint.protein) + Math.abs(macroPct.fat - midpoint.fat);
    return Math.max(0, 18 - distance * 0.25);
}

function containsAny(text, terms) {
    return terms.some(term => text.includes(term));
}

function average(range) {
    return (range[0] + range[1]) / 2;
}

function roundOne(value) {
    return Math.round(value * 10) / 10;
}

window.NutritionRules = {
    AGE_NUTRITION_RULES,
    getAgeNutritionRule,
    estimateRecipeNutrition,
    estimateMenuNutrition,
    getIngredientPortions,
    getWeightGuidance,
    getMacroFit,
    getRecipeAgeScore
};
