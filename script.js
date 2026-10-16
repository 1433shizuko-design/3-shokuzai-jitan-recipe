(() => {
  const $ = (selector) => document.querySelector(selector);
  const aliases = {
    "ツナ缶（水煮・油漬け）": "ツナ缶", "ツナ": "ツナ缶",
    "サバ缶（水煮・味噌煮）": "サバ缶", "さば缶": "サバ缶",
    "いわし缶": "イワシ缶", "焼鳥缶": "焼き鳥缶",
    "冷凍うどん": "冷凍うどん", "鯖": "サバ", "鶏胸肉": "鶏むね肉", "鶏モモ肉": "鶏もも肉"
  };
  const allFoods = [...new Set(Object.values(INGREDIENT_CATEGORIES).flat().map(food => aliases[food] || food))];
  const canonical = (value) => aliases[value.trim()] || value.trim();
  const state = { selected: [], activeCategory: Object.keys(INGREDIENT_CATEGORIES)[0], lastResults: [] };
  const savedFavorites = () => JSON.parse(localStorage.getItem("jitan-recipe-favorites") || "[]");
  const saveFavorites = (items) => localStorage.setItem("jitan-recipe-favorites", JSON.stringify(items));
  const selectedBox = $("#selected-ingredients");
  const input = $("#ingredient-input");
  const suggestions = $("#suggestions");
  const message = $("#form-message");

  function displayName(food) {
    const variants = { "ツナ缶": "ツナ缶（水煮・油漬け）", "サバ缶": "サバ缶（水煮・味噌煮）" };
    return variants[food] || food;
  }
  function renderSelection() {
    selectedBox.innerHTML = state.selected.length ? state.selected.map((food, index) =>
      `<span class="ingredient-chip">${escapeHtml(displayName(food))}<button type="button" class="chip-edit" data-edit="${index}">変更</button><button type="button" data-remove="${index}" aria-label="${escapeHtml(food)}を削除">×</button></span>`).join("") :
      '<span class="empty-chip">食材を3つ選んでください</span>';
    $("#selection-status").textContent = state.selected.length === 3 ? "3つそろいました！ レシピを探せます" : `あと${3 - state.selected.length}つ選べます`;
    $("#search-recipes").disabled = state.selected.length !== 3;
    $("#search-recipes").style.opacity = state.selected.length === 3 ? "1" : ".58";
    selectedBox.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
      state.selected.splice(Number(button.dataset.remove), 1); message.textContent = ""; renderSelection();
    }));
    selectedBox.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => {
      const index = Number(button.dataset.edit); input.value = state.selected[index]; state.selected.splice(index, 1); message.textContent = "変更する食材名を入力してください。"; renderSelection(); input.focus(); renderSuggestions();
    }));
  }
  function escapeHtml(text) { return String(text).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
  function addIngredient(raw) {
    const food = canonical(raw);
    if (!food) return;
    if (state.selected.length >= 3) { message.textContent = "食材は3つまでです。変更する場合は、食材の×を押してください。"; return; }
    if (state.selected.includes(food)) { message.textContent = "同じ食材は重複して選べません。別の食材を選んでください。"; return; }
    state.selected.push(food); input.value = ""; hideSuggestions(); message.textContent = ""; renderSelection(); input.focus();
  }
  function hideSuggestions() { suggestions.classList.remove("visible"); suggestions.innerHTML = ""; input.setAttribute("aria-expanded", "false"); }
  function renderSuggestions() {
    const query = input.value.trim();
    if (!query) return hideSuggestions();
    const matches = allFoods.filter(food => food.includes(query) || displayName(food).includes(query)).slice(0, 8);
    suggestions.innerHTML = matches.length ? matches.map(food => `<button type="button" class="suggestion" role="option" data-food="${escapeHtml(food)}">${escapeHtml(displayName(food))}</button>`).join("") : `<div class="suggestion">候補にない食材です。「追加する」で自由入力できます。</div>`;
    suggestions.classList.add("visible"); input.setAttribute("aria-expanded", "true");
    suggestions.querySelectorAll("[data-food]").forEach(button => button.addEventListener("click", () => addIngredient(button.dataset.food)));
  }
  function renderCategories() {
    $("#category-tabs").innerHTML = Object.keys(INGREDIENT_CATEGORIES).map(category => `<button type="button" class="category-tab ${category === state.activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
    $("#category-items").innerHTML = INGREDIENT_CATEGORIES[state.activeCategory].map(food => `<button type="button" class="food-button" data-category-food="${escapeHtml(food)}">${escapeHtml(displayName(food))}</button>`).join("");
    document.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => { state.activeCategory = button.dataset.category; renderCategories(); }));
    document.querySelectorAll("[data-category-food]").forEach(button => button.addEventListener("click", () => addIngredient(button.dataset.categoryFood)));
  }
  function matchingRecipes(foods) {
    return RECIPES.map(recipe => ({ ...recipe, matches: foods.filter(food => recipe.majorIngredients.includes(food)) }))
      .filter(recipe => recipe.matches.length > 0 && recipe.minutes <= 30)
      .sort((a, b) => b.matches.length - a.matches.length || a.minutes - b.minutes || a.name.localeCompare(b.name, "ja"))
      .slice(0, 5);
  }
  function isFavorite(id) { return savedFavorites().includes(id); }
  function card(recipe, foods = state.selected) {
    const unused = foods.filter(food => !recipe.majorIngredients.includes(food));
    const additions = recipe.extra.length;
    return `<article class="recipe-card"><button class="favorite" data-favorite="${recipe.id}" aria-label="${escapeHtml(recipe.name)}をお気に入りに${isFavorite(recipe.id) ? "から削除" : "登録"}">${isFavorite(recipe.id) ? "♥" : "♡"}</button><div class="recipe-emoji" aria-hidden="true">${recipe.icon}</div><h3>${escapeHtml(recipe.name)}</h3><div class="meta"><span>⏱ ${recipe.minutes}分</span><span>難易度：${recipe.difficulty}</span></div><p class="match">${foods.length ? `入力食材 ${recipe.matches ? recipe.matches.length : recipe.majorIngredients.filter(food => foods.includes(food)).length}つを使用` : "登録レシピ"}</p><p>${escapeHtml(recipe.point)}</p><p>${additions ? `追加材料：${recipe.extra.map(item => item[0]).join("、")}` : "追加の主要食材なし（調味料を除く）"}${unused.length ? `<br><small>今回使わない入力食材：${unused.join("、")}</small>` : ""}</p><button class="button button-secondary" type="button" data-detail="${recipe.id}">レシピを見る</button></article>`;
  }
  function bindCards(container) {
    container.querySelectorAll("[data-detail]").forEach(button => button.addEventListener("click", () => openDetail(button.dataset.detail)));
    container.querySelectorAll("[data-favorite]").forEach(button => button.addEventListener("click", () => toggleFavorite(button.dataset.favorite)));
  }
  function renderResults(results, foods) {
    const area = $("#recipe-results"); const empty = $("#no-results");
    area.innerHTML = results.map(recipe => card(recipe, foods)).join(""); bindCards(area);
    empty.hidden = results.length > 0;
  }
  function search() {
    if (state.selected.length !== 3) { message.textContent = "食材を3つ選んでからレシピを探してください。"; return; }
    const results = matchingRecipes(state.selected);
    state.lastResults = results;
    localStorage.setItem("jitan-recipe-last-ingredients", JSON.stringify(state.selected));
    $("#reuse-last").hidden = true;
    $("#results-section").hidden = false; $("#favorites-section").hidden = true;
    $("#results-summary").textContent = results.length ? `「${state.selected.map(displayName).join("・")}」で作れるレシピを${results.length}件見つけました。` : "";
    $("#no-results").innerHTML = "<strong>ぴったりのレシピが見つかりませんでした。</strong><br>入力した食材に無関係なレシピは表示していません。食材の組み合わせを変更して、もう一度探してみてください。";
    renderResults(results, state.selected);
    $("#results-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggleFavorite(id) {
    const favorites = savedFavorites(); const index = favorites.indexOf(id);
    if (index >= 0) favorites.splice(index, 1); else favorites.push(id);
    saveFavorites(favorites);
    if (!$("#favorites-section").hidden) showFavorites(); else renderResults(state.lastResults, state.selected);
  }
  function showFavorites() {
    const favorites = RECIPES.filter(recipe => isFavorite(recipe.id));
    $("#results-section").hidden = true; $("#favorites-section").hidden = false;
    const area = $("#favorites-results"); area.innerHTML = favorites.map(recipe => card(recipe, [])).join(""); bindCards(area);
    $("#no-favorites").hidden = favorites.length > 0;
    $("#favorites-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function list(items) { return items.map(item => `<li>${escapeHtml(item[0])}：${escapeHtml(item[1])}</li>`).join(""); }
  function openDetail(id) {
    const recipe = RECIPES.find(item => item.id === id); if (!recipe) return;
    const used = state.selected.filter(food => recipe.majorIngredients.includes(food));
    const unused = state.selected.filter(food => !recipe.majorIngredients.includes(food));
    $("#recipe-detail").innerHTML = `<div class="recipe-emoji" aria-hidden="true">${recipe.icon}</div><h2 id="dialog-title" class="detail-title">${escapeHtml(recipe.name)}</h2><p class="detail-lead">⏱ ${recipe.minutes}分　｜　難易度：${recipe.difficulty}<br>${escapeHtml(recipe.point)}</p><div class="detail-grid"><section class="detail-box"><h3>入力食材のうち使うもの</h3><ul>${used.length ? used.map(food => `<li>${escapeHtml(displayName(food))}</li>`).join("") : "<li>今回の入力食材との照合なし</li>"}</ul></section><section class="detail-box"><h3>入力したが使わないもの</h3><ul>${unused.length ? unused.map(food => `<li>${escapeHtml(displayName(food))}</li>`).join("") : "<li>ありません</li>"}</ul></section></div><section class="detail-section"><h3>材料（2人分）</h3><ul>${list(recipe.ingredients)}</ul></section><section class="detail-section"><h3>追加で必要な材料</h3>${recipe.extra.length ? `<ul>${list(recipe.extra)}</ul>` : "<p>ありません（下記の調味料は必要です）。</p>"}</section><section class="detail-section"><h3>調味料</h3><ul>${list(recipe.seasonings)}</ul></section><section class="detail-section"><h3>下準備</h3><p>${escapeHtml(recipe.prep.join(" "))}</p></section><section class="detail-section"><h3>作り方</h3><ol>${recipe.steps.map((step, index) => `<li><span class="step-time">${index + 1}（${step.minutes}分）</span> ${escapeHtml(step.text)}</li>`).join("")}</ol></section><section class="detail-section"><h3>失敗しにくくするコツ</h3><p>${escapeHtml(recipe.tip)}</p><h3>保存・アレンジ</h3><p>${escapeHtml(recipe.storage)}</p></section><div class="actions"><button class="button button-plain" type="button" id="print-recipe">このレシピを印刷</button><button class="button button-primary" type="button" id="random-recipe">別の候補をランダム表示</button></div>`;
    $("#recipe-dialog").showModal();
    $("#print-recipe").addEventListener("click", () => window.print());
    $("#random-recipe").addEventListener("click", () => {
      const pool = state.lastResults.filter(item => item.id !== recipe.id); if (!pool.length) return;
      openDetail(pool[Math.floor(Math.random() * pool.length)].id);
    });
  }
  function initPrevious() {
    const previous = JSON.parse(localStorage.getItem("jitan-recipe-last-ingredients") || "[]");
    if (Array.isArray(previous) && previous.length === 3) $("#reuse-last").hidden = false;
  }

  input.addEventListener("input", renderSuggestions);
  input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addIngredient(input.value); } if (event.key === "Escape") hideSuggestions(); });
  $("#add-ingredient").addEventListener("click", () => addIngredient(input.value));
  $("#search-recipes").addEventListener("click", search);
  $("#clear-ingredients").addEventListener("click", () => { state.selected = []; message.textContent = "入力内容をクリアしました。"; renderSelection(); });
  $("#reuse-last").addEventListener("click", () => { state.selected = JSON.parse(localStorage.getItem("jitan-recipe-last-ingredients") || "[]").slice(0, 3); message.textContent = "前回の食材を読み込みました。"; renderSelection(); });
  $("#show-favorites").addEventListener("click", showFavorites);
  $("#close-favorites").addEventListener("click", () => { $("#favorites-section").hidden = true; $("#results-section").hidden = false; });
  $("#close-dialog").addEventListener("click", () => $("#recipe-dialog").close());
  $("#recipe-dialog").addEventListener("click", event => { if (event.target === $("#recipe-dialog")) $("#recipe-dialog").close(); });
  $("#mascot").addEventListener("error", () => { $("#mascot").hidden = true; $("#mascot-missing").hidden = false; });
  renderSelection(); renderCategories(); initPrevious();
})();
