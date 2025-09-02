// Javascript program for Elo Rating

export const calculateElo = (playerElo: number, opponentElo: number, result: 1 | 0.5 | 0, kFactor = 32) => {
    // Calcular la expectativa de resultado para el jugador
    const expectedOutcome = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));

    // Ajustar la puntuación basándose en el resultado real y el esperado
    const newElo = playerElo + kFactor * (result - expectedOutcome);

    return Math.round(newElo);
};

