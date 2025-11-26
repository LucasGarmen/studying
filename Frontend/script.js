const englishText = document.getElementById("english-text");
const userTranslation = document.getElementById("user-translation");
const checkButton = document.getElementById("check-btn");
const result = document.getElementById("result");
const nextButton = document.getElementById("next-btn");
const levelSelect = document.getElementById("level");

let texts = {};
nextButton.disabled = true;

fetch("texts.json")
  .then(res => res.json())
  .then(data => {
    texts = data;
    nextButton.disabled = false; // ✅ activar cuando ya está listo
    loadRandomText();
  })
  .catch(err => {
    console.error("Error al cargar textos:", err);
    englishText.innerHTML = "❌ Error al cargar los textos.";
  });



let currentText = null;

// Mostrar una frase aleatoria
function loadRandomText() {
  const topic = document.getElementById("topic").value;
  const level = parseInt(levelSelect.value);

  // ⚠️ Si aún no se cargó el JSON
  if (!texts[topic]) {
    englishText.innerHTML = "⏳ Cargando textos...";
    return;
  }

  const allTexts = texts[topic];
  const filtered = allTexts.filter(t => t.level === level);

  if (filtered.length === 0) {
    englishText.innerHTML = "⚠️ No hay textos aún para este nivel y tema.";
    return;
  }

  // ✅ Selecciona aleatoriamente una nueva frase distinta de la actual
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


const wordCache = {}; // Guarda las palabras ya traducidas
let localDictionary = {};

fetch("dictionary.json")
  .then(res => res.json())
  .then(data => {
    localDictionary = data;
  });


englishText.addEventListener("mouseover", async (e) => {
  if (!e.target.classList.contains("word")) return;

  const word = e.target.textContent.replace(/[.,!?]/g, "").toLowerCase();

  // 🔥 Si ya hay un tooltip visible, eliminarlo antes de crear otro
  const existingTooltip = document.querySelector(".tooltip");
  if (existingTooltip) existingTooltip.remove();

  const tooltip = document.createElement("div");
  tooltip.classList.add("tooltip");
  tooltip.textContent = "Traduciendo...";
  document.body.appendChild(tooltip);

  const rect = e.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.top - 30 + window.scrollY}px`;

  // Buscar traducción
  try {
    let translation = "";

    if (localDictionary[word]) translation = localDictionary[word];
    else if (wordCache[word]) translation = wordCache[word];
    else {
      const url = `https://api.mymemory.translated.net/get?q=${word}&langpair=en|es`;
      const res = await fetch(url);
      const data = await res.json();
      translation = data.responseData.translatedText;
      wordCache[word] = translation;
    }

    tooltip.textContent = translation;
  } catch {
    tooltip.textContent = "Error";
  }

  // 🧹 Siempre eliminar el tooltip al salir del mouse o cambiar el texto
  const removeTooltip = () => tooltip.remove();
  e.target.addEventListener("mouseout", removeTooltip, { once: true });
  englishText.addEventListener("DOMSubtreeModified", removeTooltip, { once: true });
});



loadRandomText();
nextButton.addEventListener("click", loadRandomText);

// NUEVA FUNCIÓN: traducir usando la API
async function translateText(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const translation = data.responseData.translatedText;
    return translation;
  } catch (error) {
    console.error("Error:", error);
    return "Error al traducir";
  }
}

// BOTÓN para traducir
checkButton.addEventListener("click", async () => {
  result.style.color = "#0077b6";
  result.textContent = "Comprobando...";

  const response = await fetch("http://127.0.0.1:8000/check_translation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      english: currentText.english,
      correct_translation: currentText.spanish, // ✅ le mandamos la traducción correcta
      user_translation: userTranslation.value
    })

  });

  const data = await response.json();

  result.style.color = data.score > 60 ? "green" : "red";
  result.textContent = `${data.feedback} `;
});



const chatInput = document.getElementById("chat-input");
const chatButton = document.getElementById("chat-btn");
const chatResponse = document.getElementById("chat-response");

chatButton.addEventListener("click", async () => {
  const question = chatInput.value.trim();
  if (!question) return;

  chatResponse.textContent = "Pensando...";

  const response = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question })
  });

  const data = await response.json();
  chatResponse.textContent = data.reply;
});

// Permitir usar "Enter" para evaluar directamente
userTranslation.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // evita salto de línea
    checkButton.click(); // simula clic en el botón
  }
});

// ✅ Permitir usar "Enter" para enviar mensaje a la IA
chatInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // evita salto de línea
    chatButton.click(); // simula clic en el botón "Enviar"
  }
});

