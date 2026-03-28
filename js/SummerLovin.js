$(document).ready(function () {
    // --- Config ---
    const gridSize = 7;
    const decoyProbability = 0.25;
    const easyDecoyProbability = 0.75;
    const easyRowColDecoyProbability = 0.3;

    // --- Main ---
    const numbers = generateNumbers(gridSize);
    const { easyRows, easyCols } = generateEasyRowsCols(gridSize, easyRowColDecoyProbability);
    const decoys = generateDecoyMap(gridSize, easyRows, easyCols, decoyProbability, easyDecoyProbability);
    ensureAtLeastOneRealPerRowCol(decoys);
    const rowSums = calculateRowSums(numbers, decoys);
    const colSums = calculateColSums(numbers, decoys);
    renderGrid($('#game-grid'), gridSize, numbers, decoys, rowSums, colSums);

    // --- Functions ---
    function generateNumbers(size) {
        const arr = [];
        for (let row = 0; row < size; row++) {
            arr[row] = [];
            for (let col = 0; col < size; col++) {
                arr[row][col] = Math.floor(Math.random() * 9) + 1;
            }
        }
        return arr;
    }

    function generateEasyRowsCols(size, easyProb) {
        const easyRows = [];
        const easyCols = [];
        for (let row = 0; row < size; row++) {
            easyRows[row] = Math.random() < easyProb;
        }
        for (let col = 0; col < size; col++) {
            easyCols[col] = Math.random() < easyProb;
        }
        return { easyRows, easyCols };
    }

    function generateDecoyMap(size, easyRows, easyCols, decoyProb, easyDecoyProb) {
        const decoys = [];
        for (let row = 0; row < size; row++) {
            decoys[row] = [];
            for (let col = 0; col < size; col++) {
                const prob = (easyRows[row] || easyCols[col]) ? easyDecoyProb : decoyProb;
                decoys[row][col] = Math.random() < prob;
            }
        }
        return decoys;
    }

    function ensureAtLeastOneRealPerRowCol(decoys) {
        const size = decoys.length;
        // Ensure each row has at least one real cell
        for (let row = 0; row < size; row++) {
            if (decoys[row].every(isDecoy => isDecoy)) {
                const realCol = Math.floor(Math.random() * size);
                decoys[row][realCol] = false;
            }
        }
        // Ensure each column has at least one real cell
        for (let col = 0; col < size; col++) {
            let allDecoy = true;
            for (let row = 0; row < size; row++) {
                if (!decoys[row][col]) {
                    allDecoy = false;
                    break;
                }
            }
            if (allDecoy) {
                const realRow = Math.floor(Math.random() * size);
                decoys[realRow][col] = false;
            }
        }
    }

    function calculateRowSums(numbers, decoys) {
        return numbers.map((rowArr, row) =>
            rowArr.reduce((sum, num, col) => sum + (decoys[row][col] ? 0 : num), 0)
        );
    }

    function calculateColSums(numbers, decoys) {
        const size = numbers.length;
        const colSums = [];
        for (let col = 0; col < size; col++) {
            let sum = 0;
            for (let row = 0; row < size; row++) {
                if (!decoys[row][col]) sum += numbers[row][col];
            }
            colSums[col] = sum;
        }
        return colSums;
    }

    function renderGrid($container, size, numbers, decoys, rowSums, colSums) {
        $container.css({
            'grid-template-columns': `repeat(${size + 1}, 1fr)`,
            'grid-template-rows': `repeat(${size + 1}, 1fr)`
        });
        $container.empty();
        for (let row = 0; row <= size; row++) {
            for (let col = 0; col <= size; col++) {
                if (row === 0 && col === 0) {
                    $container.append('<div class="sum-cell empty-cell"></div>');
                } else if (row === 0) {
                    $container.append(`<div class="sum-cell col-sum">${colSums[col - 1]}</div>`);
                } else if (col === 0) {
                    $container.append(`<div class="sum-cell row-sum">${rowSums[row - 1]}</div>`);
                } else {
                    const isDecoy = decoys[row - 1][col - 1];
                    $container.append(`<div class="grid-cell${isDecoy ? ' decoy' : ''}">${numbers[row - 1][col - 1]}</div>`);
                }
            }
        }
    }
});