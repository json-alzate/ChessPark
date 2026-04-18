# Chess Bot Trainer

Pipeline para entrenar bots de ajedrez que clonan el estilo de jugadores reales.
Descarga partidas de Lichess o Chess.com, entrena una red neuronal ResNet y exporta el modelo a TF.js para usarlo en ChessPark.

Solo ajedrez estándar — variantes (Chess960, King of the Hill, etc.) se filtran automáticamente.

## Requisitos

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Uso rápido

```bash
# Clonar a Magnus Carlsen desde Lichess
./scripts/train_bot.sh lichess DrNykterstein "Magnus Carlsen" 2882

# Clonar desde Chess.com
./scripts/train_bot.sh chesscom hikaru "Hikaru Nakamura" 3200

# Clonar tu propio perfil
./scripts/train_bot.sh lichess tu_usuario "Mi Clone" 1500
```

El bundle final queda en `data/bots/<slug>/`. Copiarlo a la app:

```
apps/chess-bot-studio/src/assets/bots/<slug>/
```

## Pipeline paso a paso

| Paso | Script | Descripción |
|------|--------|-------------|
| 1 | `pipeline/01_download.py` | Descarga partidas (PGN) |
| 2 | `pipeline/02_parse.py` | Parsea PGN, construye libro de aperturas |
| 3 | `pipeline/03_encode.py` | Codifica posiciones como tensores 8×8×20 |
| 4 | `pipeline/04_train.py` | Entrena red ResNet (política + valor) |
| 5 | `pipeline/05_export.py` | Exporta a TF.js con cuantización float16 |
| 6 | `pipeline/06_package.py` | Empaqueta bundle final |

## Variables de entorno

```bash
LICHESS_TOKEN=lip_xxx  # Token de Lichess (opcional, sube el rate limit)
```

## Estructura del bundle resultante

```
data/bots/<slug>/
├── model/
│   ├── model.json          # Manifiesto TF.js
│   └── group*.bin          # Pesos (~4-8 MB con float16)
├── opening_book.json       # Repertorio del jugador (primeras 15 jugadas)
└── bot_profile.json        # Metadata del bot
```
