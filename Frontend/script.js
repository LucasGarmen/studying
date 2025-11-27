const englishText = document.getElementById("english-text");
const userTranslation = document.getElementById("user-translation");
const checkButton = document.getElementById("check-btn");
const result = document.getElementById("result");
const nextButton = document.getElementById("next-btn");
const levelSelect = document.getElementById("level");
const topicSelect = document.getElementById("topic");

let texts = {};
nextButton.disabled = true;

const wordCache = JSON.parse(localStorage.getItem("wordCache") || "{}"); // cache local
let localDictionary = {};
let currentText = null;

// ------------------------------
// 🔹 CARGAR TEXTOS
// ------------------------------
fetch("texts.json")
  .then(res => res.json())
  .then(async data => {
    texts = data;
    nextButton.disabled = false;

    const initialTopic = topicSelect.value;
    await loadDictionary(initialTopic);
    loadRandomText();
  })
  .catch(err => {
    console.error("Error al cargar textos:", err);
    englishText.innerHTML = "❌ Error al cargar los textos.";
  });

// ------------------------------
// 🔹 FUNCIÓN PARA MOSTRAR FRASE
// ------------------------------
function loadRandomText() {
  const topic = topicSelect.value;
  const level = parseInt(levelSelect.value);

  if (!texts[topic]) {
    englishText.innerHTML = "⏳ Cargando textos...";
    return;
  }

  const allTexts = texts[topic];
  const filtered = allTexts.filter(t => t.level === level);

  if (filtered.length === 0) {
    englishText.innerHTML = "⚠️ No hay textos para este nivel y tema.";
    return;
  }

  let newText;
  do {
    newText = filtered[Math.floor(Math.random() * filtered.length)];
  } while (currentText && newText.english === currentText.english && filtered.length > 1);

  currentText = newText;

  const words = currentText.english.split(" ");
  englishText.innerHTML = words.map(word => `<span class="word">${word}</span>`).join(" ");
  userTranslation.value = "";
  result.textContent = "";
}

// ------------------------------
// 🔹 FUNCIÓN PARA CARGAR DICCIONARIO POR TEMA
// ------------------------------
async function loadDictionary(topic) {
  try {
    const res = await fetch(`${topic}.json`);
    const data = await res.json();
    localDictionary = data;
    console.log(`Diccionario de ${topic} cargado.`);
  } catch (err) {
    console.error("Error al cargar diccionario:", err);
    localDictionary = {};
  }
}

topicSelect.addEventListener("change", async () => {
  const topic = topicSelect.value;
  await loadDictionary(topic);
  loadRandomText();
});

// ------------------------------
// 🔹 FUNCIÓN PARA TRADUCIR CON CACHE (usa backend y localStorage)
// ------------------------------
async function getWordTranslation(word) {
  word = word.toLowerCase();

  // 1️⃣ Buscar en diccionario local
  if (localDictionary[word]) return localDictionary[word];

  // 2️⃣ Buscar en cache localStorage
  if (wordCache[word]) return wordCache[word];

  // 3️⃣ Buscar en backend cache
  try {
    const resCache = await fetch(`/get_translation/${word}`);
    const dataCache = await resCache.json();
    if (dataCache.translation) {
      wordCache[word] = dataCache.translation;
      localStorage.setItem("wordCache", JSON.stringify(wordCache));
      return dataCache.translation;
    }
  } catch {
    console.warn("⚠️ Backend no disponible, se usa API directa.");
  }

  // 4️⃣ Si no está en ningún lado, traducir con API y guardar
  try {
    const url = `https://api.mymemory.translated.net/get?q=${word}&langpair=en|es`;
    const res = await fetch(url);
    const data = await res.json();
    const translation = data.responseData.translatedText || "[sin traducción]";
    wordCache[word] = translation;
    localStorage.setItem("wordCache", JSON.stringify(wordCache));

    // Guardar también en backend
    fetch("/cache_translation", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({word, translation})
    }).catch(() => {}); // no romper si falla

    return translation;
  } catch {
    return "[error al traducir]";
  }
}

// ------------------------------
// 🔹 TOOLTIP DE TRADUCCIÓN AL PASAR EL MOUSE
// ------------------------------
englishText.addEventListener("mouseover", async (e) => {
  if (!e.target.classList.contains("word")) return;

  const word = e.target.textContent.replace(/[.,!?]/g, "").toLowerCase();
  const existingTooltip = document.querySelector(".tooltip");
  if (existingTooltip) existingTooltip.remove();

  const tooltip = document.createElement("div");
  tooltip.classList.add("tooltip");
  tooltip.textContent = "Traduciendo...";
  document.body.appendChild(tooltip);

  const rect = e.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.top - 30 + window.scrollY}px`;

  const translation = await getWordTranslation(word);
  tooltip.textContent = translation;

  const removeTooltip = () => tooltip.remove();
  e.target.addEventListener("mouseout", removeTooltip, { once: true });
});

// ------------------------------
// 🔹 BOTÓN DE COMPROBAR TRADUCCIÓN
// ------------------------------
checkButton.addEventListener("click", async () => {
  result.style.color = "#0077b6";
  result.textContent = "Comprobando...";

const response = await fetch("/check_translation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    english: currentText.english,
    correct_translation: currentText.spanish,
    user_translation: userTranslation.value
  })
});


  const data = await response.json();
  result.style.color = data.score > 60 ? "green" : "red";
  result.textContent = `${data.feedback}`;
});

// ------------------------------
// 🔹 CHAT CON LA IA
// ------------------------------
const chatInput = document.getElementById("chat-input");
const chatButton = document.getElementById("chat-btn");
const chatResponse = document.getElementById("chat-response");

chatButton.addEventListener("click", async () => {
  const question = chatInput.value.trim();
  if (!question) return;

  chatResponse.textContent = "Pensando...";

  const response = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question })
  });

  const data = await response.json();
  chatResponse.textContent = data.reply;
});

// ------------------------------
// 🔹 ENTER para enviar
// ------------------------------
userTranslation.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    checkButton.click();
  }
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatButton.click();
  }
});
