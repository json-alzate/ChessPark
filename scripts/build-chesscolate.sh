#!/bin/bash
# Script de compilación para chessColate
# Uso: ./scripts/build-chesscolate.sh [plataforma] [acción]
# Plataformas: android, ios, web
# Acciones: build, open, run

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Función para mostrar el menú de plataformas
show_platform_menu() {
    echo ""
    echo "📱 Selecciona la plataforma para compilar:"
    echo ""
    echo "  1) Android   - Compilar para dispositivos Android"
    echo "  2) iOS       - Compilar para dispositivos iOS"
    echo "  3) Web       - Compilar solo para web"
    echo ""
    echo "  0) Cancelar"
    echo ""
}

# Función para seleccionar plataforma interactivamente
select_platform() {
    while true; do
        show_platform_menu >&2
        read -p "Escribe el número (1, 2, 3) o el nombre (android, ios, web): " option
        
        # Convertir a minúsculas y eliminar espacios al inicio y final
        option=$(echo "$option" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        case $option in
            1|android)
                echo "android"
                return 0
                ;;
            2|ios)
                echo "ios"
                return 0
                ;;
            3|web)
                echo "web"
                return 0
                ;;
            0|cancelar|cancel)
                error "Compilación cancelada" >&2
                exit 0
                ;;
            *)
                error "Opción inválida: \"$option\"" >&2
                echo "" >&2
                warning "Opciones válidas:" >&2
                echo "  - Números: 1 (Android), 2 (iOS), 3 (Web), 0 (Cancelar)" >&2
                echo "  - Nombres: android, ios, web, cancelar" >&2
                echo "" >&2
                ;;
        esac
    done
}

# Función para ejecutar comandos
execute_command() {
    local command=$1
    local description=$2
    
    info "$description..."
    if eval "$command"; then
        success "$description completado"
        return 0
    else
        error "Error al $description"
        exit 1
    fi
}

# Función principal de compilación
build_platform() {
    local platform=$1
    local action=${2:-build}
    
    # Validar plataforma
    case $platform in
        android)
            platform_name="Android"
            build_cmd="CI=true nx build chessColate && cd apps/chessColate && npx cap sync android"
            open_cmd="cd apps/chessColate && npx cap open android"
            run_cmd="cd apps/chessColate && npx cap run android"
            ;;
        ios)
            platform_name="iOS"
            build_cmd="CI=true nx build chessColate && cd apps/chessColate && npx cap sync ios"
            open_cmd="cd apps/chessColate && npx cap open ios"
            run_cmd="cd apps/chessColate && npx cap run ios"
            ;;
        web)
            platform_name="Web"
            build_cmd="CI=true nx build chessColate"
            open_cmd=""
            run_cmd=""
            ;;
        *)
            error "Plataforma \"$platform\" no es válida"
            echo "Plataformas disponibles: android, ios, web"
            exit 1
            ;;
    esac
    
    echo ""
    info "🚀 Compilando chessColate para $platform_name"
    echo ""
    
    # Ejecutar acción
    case $action in
        build)
            execute_command "$build_cmd" "Compilando y sincronizando"
            
            if [ -n "$open_cmd" ]; then
                echo ""
                read -p "¿Deseas abrir el proyecto en el IDE? (s/n): " answer
                if [[ "$answer" =~ ^[sSyY]$ ]]; then
                    execute_command "$open_cmd" "Abriendo proyecto"
                fi
            fi
            ;;
        open)
            if [ -z "$open_cmd" ]; then
                error "Acción \"open\" no disponible para la plataforma $platform"
                exit 1
            fi
            execute_command "$open_cmd" "Abriendo proyecto"
            ;;
        run)
            if [ -z "$run_cmd" ]; then
                error "Acción \"run\" no disponible para la plataforma $platform"
                exit 1
            fi
            execute_command "$run_cmd" "Ejecutando aplicación"
            ;;
        *)
            error "Acción \"$action\" no es válida"
            echo "Acciones disponibles: build, open, run"
            exit 1
            ;;
    esac
    
    echo ""
    success "Compilación para $platform_name finalizada exitosamente"
    echo ""
}

# Obtener argumentos
PLATFORM=$1
ACTION=${2:-build}

# Validar acción
if [[ ! "$ACTION" =~ ^(build|open|run)$ ]]; then
    error "Acción \"$ACTION\" no es válida"
    echo "Acciones disponibles: build, open, run"
    exit 1
fi

# Si no se proporciona plataforma, preguntar interactivamente
if [ -z "$PLATFORM" ]; then
    PLATFORM=$(select_platform)
    # Limpiar el valor (eliminar espacios y saltos de línea)
    PLATFORM=$(echo "$PLATFORM" | tr -d '\n\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
fi

# Validar plataforma
if [[ ! "$PLATFORM" =~ ^(android|ios|web)$ ]]; then
    error "Plataforma \"$PLATFORM\" no es válida"
    echo "Plataformas disponibles: android, ios, web"
    exit 1
fi

# Cambiar al directorio raíz del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Ejecutar compilación
build_platform "$PLATFORM" "$ACTION"
