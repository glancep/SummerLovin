$(document).ready(function () {
    // Set grid size and decoy probability
    const gridSize = 7;
    const decoyProbability = 0.25; // 25% chance for a cell to be a decoy

    // Prepare the grid container
    const $gridContainer = $('#game-grid');
    $gridContainer.css({
        'grid-template-columns': `repeat(${gridSize + 1}, 1fr)`,
        'grid-template-rows': `repeat(${gridSize + 1}, 1fr)`
    });
    $gridContainer.empty();

    // Generate random numbers
    const numbers = [];
    for (let row = 0; row < gridSize; row++) {
        numbers[row] = [];
        for (let col = 0; col < gridSize; col++) {
            numbers[row][col] = Math.floor(Math.random() * 9) + 1;
        }
    }

    // Generate decoy map (true = decoy, false = real)
    const decoys = [];
    for (let row = 0; row < gridSize; row++) {
        decoys[row] = [];
        for (let col = 0; col < gridSize; col++) {
            decoys[row][col] = Math.random() < decoyProbability;
        }
    }

    // Ensure each row has at least one real cell
    for (let row = 0; row < gridSize; row++) {
        if (decoys[row].every(isDecoy => isDecoy)) {
            // Pick a random column to be real
            const realCol = Math.floor(Math.random() * gridSize);
            decoys[row][realCol] = false;
        }
    }
    // Ensure each column has at least one real cell
    for (let col = 0; col < gridSize; col++) {
        let allDecoy = true;
        for (let row = 0; row < gridSize; row++) {
            if (!decoys[row][col]) {
                allDecoy = false;
                break;
            }
        }
        if (allDecoy) {
            // Pick a random row to be real
            const realRow = Math.floor(Math.random() * gridSize);
            decoys[realRow][col] = false;
        }
    }

    // Calculate row sums and column sums (ignore decoys)
    const rowSums = numbers.map((rowArr, row) =>
        rowArr.reduce((sum, num, col) => sum + (decoys[row][col] ? 0 : num), 0)
    );
    const colSums = [];
    for (let col = 0; col < gridSize; col++) {
        let sum = 0;
        for (let row = 0; row < gridSize; row++) {
            if (!decoys[row][col]) sum += numbers[row][col];
        }
        colSums[col] = sum;
    }

    // Build the grid with extra row and column for sums
    for (let row = 0; row <= gridSize; row++) {
        for (let col = 0; col <= gridSize; col++) {
            // Top-left cell (empty)
            if (row === 0 && col === 0) {
                $gridContainer.append('<div class="sum-cell empty-cell"></div>');
            }
            // Top row (column sums)
            else if (row === 0) {
                $gridContainer.append(`<div class="sum-cell col-sum">${colSums[col - 1]}</div>`);
            }
            // Left column (row sums)
            else if (col === 0) {
                $gridContainer.append(`<div class="sum-cell row-sum">${rowSums[row - 1]}</div>`);
            }
            // Main grid cells
            else {
                const isDecoy = decoys[row - 1][col - 1];
                $gridContainer.append(`<div class="grid-cell${isDecoy ? ' decoy' : ''}">${numbers[row - 1][col - 1]}</div>`);
            }
        }
    }
});