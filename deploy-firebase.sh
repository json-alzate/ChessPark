#!/bin/bash

# Script para deployar todas las apps a Firebase Hosting
# Uso: ./deploy-firebase.sh [app-name] o ./deploy-firebase.sh para deployar todas

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando deployment a Firebase Hosting${NC}"

# Función para deployar una app específica
deploy_app() {
    local app_name=$1
    local target_name=$2
    
    echo -e "${YELLOW}📦 Construyendo $app_name...${NC}"
    
    # Build de la app
    npx nx build $app_name
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build completado para $app_name${NC}"
        
        echo -e "${YELLOW}🚀 Deployando $app_name a Firebase...${NC}"
        
        # Deploy a Firebase
        firebase deploy --only hosting:$target_name
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}🎉 $app_name deployado exitosamente!${NC}"
        else
            echo -e "${RED}❌ Error en el deploy de $app_name${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Error en el build de $app_name${NC}"
        exit 1
    fi
}

# Función para deployar todas las apps
deploy_all() {
    echo -e "${BLUE}🔄 Deployando todas las aplicaciones...${NC}"
    
    # Deploy chesspark
    deploy_app "chesspark" "chesspark"
    
    # Deploy chessCoordinatesTrainer
    deploy_app "chessCoordinatesTrainer" "chessCoordinatesTrainer"
    
    # Deploy chessColate
    deploy_app "chessColate" "chessColate"
    
    echo -e "${GREEN}🎉 Todas las aplicaciones han sido deployadas exitosamente!${NC}"
}

# Verificar si se proporcionó un argumento
if [ $# -eq 0 ]; then
    # Sin argumentos, deployar todas
    deploy_all
else
    # Con argumento, deployar app específica
    case $1 in
        "chesspark")
            deploy_app "chesspark" "chesspark"
            ;;
        "chessCoordinatesTrainer")
            deploy_app "chessCoordinatesTrainer" "chessCoordinatesTrainer"
            ;;
        "chessColate")
            deploy_app "chessColate" "chessColate"
            ;;
        *)
            echo -e "${RED}❌ App '$1' no reconocida${NC}"
            echo -e "${YELLOW}Apps disponibles: chesspark, chessCoordinatesTrainer, chessColate${NC}"
            exit 1
            ;;
    esac
fi

echo -e "${BLUE}✨ Deployment completado!${NC}"
