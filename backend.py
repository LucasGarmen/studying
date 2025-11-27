from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
import unicodedata
import re
from difflib import SequenceMatcher
from groq import Groq
import os

# Cargar variables de entorno
load_dotenv()

# Cliente de Groq
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI()

# Permitir conexión desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Normalizar texto ----
def normalize_text(text: str) -> str:
    text = text.lower()
    text = ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')  # quita acentos
    text = text.replace("ñ", "n")
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ---- Comparación ----
def similarity(a: str, b: str) -> float:
    return round(SequenceMatcher(None, normalize_text(a), normalize_text(b)).ratio() * 100, 2)

# ---- Modelos ----
class TranslationRequest(BaseModel):
    english: str
    user_translation: str
    correct_translation: str

class ChatRequest(BaseModel):
    message: str

# ---- Cache global ----
word_cache = {}

@app.post("/cache_translation")
def cache_translation(word: str, translation: str):
    word_cache[word.lower()] = translation
    return {"status": "ok"}

@app.get("/get_translation/{word}")
def get_translation(word: str):
    return {"translation": word_cache.get(word.lower(), None)}

@app.post("/check_translation")
def check_translation(request: TranslationRequest):
    score = similarity(request.user_translation, request.correct_translation)

    if score > 90:
        feedback = "✅ Excelente traducción."
    elif score > 60:
        feedback = "🟡 Bastante bien, aunque podrías mejorar."
    else:
        feedback = "❌ Bastante diferente, repasá la frase."

    return {
        "score": round(score, 2),
        "feedback": feedback,
        "correct_translation": request.correct_translation
    }

@app.get("/")
def redirect_to_internal():
    return RedirectResponse(url="/chat")

@app.post("/chat")
def chat_with_ai(request: ChatRequest):
    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "Sos un profesor de inglés amable y explicativo. Corrige traducciones y explica los errores."},
                {"role": "user", "content": request.message}
            ]
        )
        reply = completion.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        print("Error en la API:", e)
        return {"reply": "❌ Error al conectar con la IA. Verifica tu API Key o tu conexión a internet."}

# ---- Servir frontend ----
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
