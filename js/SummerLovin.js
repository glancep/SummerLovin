$(document).ready(function () {
    // --- Config ---
    const gridSize = 7;
    const decoyProbability = 0.25;
    const easyDecoyProbability = 0.75;
    let easyRowColDecoyProbability = 0.3;
    const maxLives = 3;

    // --- State ---
    let mode = "pencil"; // "pencil" or "eraser"
    let numbers, decoys;
    let livesLeft = maxLives;
    let gameSeed = null;
    let lastSeed = null;

    // --- Seeded random number generator (mulberry32) ---
    function mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    // --- Seed helpers ---
    function makeSeedString(prob, seed) {
        return `${prob}:${seed}`;
    }
    function parseSeedString(seedStr) {
        const parts = seedStr.split(":");
        if (parts.length !== 2) return null;
        const prob = parseFloat(parts[0]);
        if (isNaN(prob)) return null;
        return { prob, seed: parts[1] };
    }
    function randomSeed() {
        // 8-char alphanumeric
        return Math.random().toString(36).substr(2, 8);
    }

    // --- Main ---
    newRandomSeedAndStart();

    // --- UI: Toggle Button ---
    $('#toggle-mode')
        .css({ background: "#fff" })
        .on('click', function () {
            mode = (mode === "pencil") ? "eraser" : "pencil";
            $(this).html(mode === "pencil" ? "✏️" : "🧽");
        })
        .html("✏️");

    // --- UI: Seed Button ---
    $('#seed-btn').on('click', function () {
        $('#seed-input').val(gameSeed).prop('readonly', true);
        $('#apply-seed-btn').hide();
        $('#edit-seed-btn').show();
        $('#seed-popup').fadeIn(150);
    });
    $('#close-seed-btn').on('click', function () {
        $('#seed-popup').fadeOut(150);
    });
    $('#copy-seed-btn').on('click', function () {
        navigator.clipboard.writeText($('#seed-input').val());
        $(this).text('Copied!');
        setTimeout(() => $(this).text('Copy'), 1000);
    });
    $('#edit-seed-btn').on('click', function () {
        $('#seed-input').prop('readonly', false).focus();
        $('#apply-seed-btn').show();
        $(this).hide();
    });
    $('#apply-seed-btn').on('click', function () {
        const val = $('#seed-input').val();
        const parsed = parseSeedString(val);
        if (!parsed) {
            alert("Invalid seed format. Example: 0.3:abcd1234");
            return;
        }
        easyRowColDecoyProbability = parsed.prob;
        gameSeed = val;
        lastSeed = val;
        $('#seed-popup').fadeOut(150);
        startGame(true);
    });

    // --- UI: Restart Button ---
    $('#game-over-popup').on('click', '#restart-btn', function () {
        $('#game-over-popup').hide();
        startGame(true);
    });

    // --- Functions ---
    function newRandomSeedAndStart() {
        easyRowColDecoyProbability = 0.3;
        const seed = randomSeed();
        gameSeed = makeSeedString(easyRowColDecoyProbability, seed);
        lastSeed = gameSeed;
        startGame(false);
    }

    function startGame(useLastSeed) {
        let seedObj;
        if (useLastSeed && lastSeed) {
            seedObj = parseSeedString(lastSeed);
        } else {
            seedObj = parseSeedString(gameSeed);
        }
        if (!seedObj) {
            // fallback
            easyRowColDecoyProbability = 0.3;
            const seed = randomSeed();
            gameSeed = makeSeedString(easyRowColDecoyProbability, seed);
            lastSeed = gameSeed;
            seedObj = parseSeedString(gameSeed);
        }
        easyRowColDecoyProbability = seedObj.prob;
        gameSeed = makeSeedString(easyRowColDecoyProbability, seedObj.seed);
        lastSeed = gameSeed;

        // Use seeded RNG
        const rand = mulberry32(hashCode(seedObj.seed));

        numbers = generateNumbers(gridSize, rand);
        const { easyRows, easyCols } = generateEasyRowsCols(gridSize, easyRowColDecoyProbability, rand);
        decoys = generateDecoyMap(gridSize, easyRows, easyCols, decoyProbability, easyDecoyProbability, rand);
        ensureAtLeastOneRealPerRowCol(decoys, rand);
        const rowSums = calculateRowSums(numbers, decoys);
        const colSums = calculateColSums(numbers, decoys);
        renderGrid($('#game-grid'), gridSize, numbers, decoys, rowSums, colSums);
        bindCellClicks();
        livesLeft = maxLives;
        updateLives();
    }

    function hashCode(str) {
        // Simple hash for string to int
        let hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    }

    function generateNumbers(size, rand) {
        const arr = [];
        for (let row = 0; row < size; row++) {
            arr[row] = [];
            for (let col = 0; col < size; col++) {
                arr[row][col] = Math.floor((rand ? rand() : Math.random()) * 9) + 1;
            }
        }
        return arr;
    }

    function generateEasyRowsCols(size, easyProb, rand) {
        const easyRows = [];
        const easyCols = [];
        for (let row = 0; row < size; row++) {
            easyRows[row] = (rand ? rand() : Math.random()) < easyProb;
        }
        for (let col = 0; col < size; col++) {
            easyCols[col] = (rand ? rand() : Math.random()) < easyProb;
        }
        return { easyRows, easyCols };
    }

    function generateDecoyMap(size, easyRows, easyCols, decoyProb, easyDecoyProb, rand) {
        const decoys = [];
        for (let row = 0; row < size; row++) {
            decoys[row] = [];
            for (let col = 0; col < size; col++) {
                const prob = (easyRows[row] || easyCols[col]) ? easyDecoyProb : decoyProb;
                decoys[row][col] = (rand ? rand() : Math.random()) < prob;
            }
        }
        return decoys;
    }

    function ensureAtLeastOneRealPerRowCol(decoys, rand) {
        const size = decoys.length;
        // Ensure each row has at least one real cell
        for (let row = 0; row < size; row++) {
            if (decoys[row].every(isDecoy => isDecoy)) {
                const realCol = Math.floor((rand ? rand() : Math.random()) * size);
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
                const realRow = Math.floor((rand ? rand() : Math.random()) * size);
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
                    // Column sum cell with current sum span
                    $container.append(
                        `<div class="sum-cell col-sum" data-col="${col - 1}">
                            ${colSums[col - 1]}
                            <span class="current-sum"></span>
                        </div>`
                    );
                } else if (col === 0) {
                    // Row sum cell with current sum span
                    $container.append(
                        `<div class="sum-cell row-sum" data-row="${row - 1}">
                            ${rowSums[row - 1]}
                            <span class="current-sum"></span>
                        </div>`
                    );
                } else {
                    const isDecoy = decoys[row - 1][col - 1];
                    // Add data attributes for row/col and decoy status
                    $container.append(
                        `<div class="grid-cell${isDecoy ? ' decoy' : ''}" data-row="${row - 1}" data-col="${col - 1}" data-decoy="${isDecoy}">${numbers[row - 1][col - 1]}</div>`
                    );
                }
            }
        }
        updateCurrentSums();
    }

    // --- Update current sums for all rows and columns ---
    function updateCurrentSums() {
        // Rows
        for (let row = 0; row < gridSize; row++) {
            let sum = 0;
            for (let col = 0; col < gridSize; col++) {
                const $cell = $(`.grid-cell[data-row=${row}][data-col=${col}]`);
                if ($cell.hasClass('selected') && !$cell.data('decoy')) {
                    sum += parseInt($cell.text(), 10);
                }
            }
            $(`.sum-cell.row-sum[data-row=${row}] .current-sum`).text(sum > 0 ? sum : "");
        }
        // Columns
        for (let col = 0; col < gridSize; col++) {
            let sum = 0;
            for (let row = 0; row < gridSize; row++) {
                const $cell = $(`.grid-cell[data-row=${row}][data-col=${col}]`);
                if ($cell.hasClass('selected') && !$cell.data('decoy')) {
                    sum += parseInt($cell.text(), 10);
                }
            }
            $(`.sum-cell.col-sum[data-col=${col}] .current-sum`).text(sum > 0 ? sum : "");
        }
    }

    function bindCellClicks() {
        $('#game-grid').off('click').on('click', '.grid-cell', function () {
            if (livesLeft <= 0) return;
            const $cell = $(this);
            if ($cell.hasClass('selected') || $cell.hasClass('erased')) return; // Already acted on

            const isDecoy = $cell.data('decoy') === true || $cell.data('decoy') === "true";
            let correct = false;
            if (mode === "pencil") {
                if (!isDecoy) {
                    $cell.addClass('selected');
                    correct = true;
                }
            } else if (mode === "eraser") {
                if (isDecoy) {
                    $cell.addClass('erased');
                    correct = true;
                }
            }
            if (!correct) {
                flashWrong($cell);
                loseLife();
            } else {
                // Check for solved rows/cols
                checkSolvedRowsAndCols();
            }
            updateCurrentSums();
        });
    }

    // --- New helper for solved rows/cols ---
    function checkSolvedRowsAndCols() {
        // Check each row
        for (let row = 0; row < gridSize; row++) {
            let solved = true;
            for (let col = 0; col < gridSize; col++) {
                const isDecoy = decoys[row][col];
                const $cell = $(`.grid-cell[data-row=${row}][data-col=${col}]`);
                if (!isDecoy && !$cell.hasClass('selected')) {
                    solved = false;
                    break;
                }
                if (isDecoy && !$cell.hasClass('erased')) {
                    solved = false;
                    break;
                }
            }
            // If solved and not already cleared
            const $sumCell = $(`.sum-cell.row-sum`).eq(row);
            if (solved && $sumCell.text() !== "") {
                $sumCell.text("");
                flashRowOrCol(row, null);
            }
        }
        // Check each column
        for (let col = 0; col < gridSize; col++) {
            let solved = true;
            for (let row = 0; row < gridSize; row++) {
                const isDecoy = decoys[row][col];
                const $cell = $(`.grid-cell[data-row=${row}][data-col=${col}]`);
                if (!isDecoy && !$cell.hasClass('selected')) {
                    solved = false;
                    break;
                }
                if (isDecoy && !$cell.hasClass('erased')) {
                    solved = false;
                    break;
                }
            }
            // If solved and not already cleared
            const $sumCell = $(`.sum-cell.col-sum`).eq(col);
            if (solved && $sumCell.text() !== "") {
                $sumCell.text("");
                flashRowOrCol(null, col);
            }
        }
    }

    // --- Flash row or column ---
    function flashRowOrCol(row, col) {
        let $cells;
        if (row !== null) {
            $cells = $(`.grid-cell[data-row=${row}]`);
            $cells.add($(`.sum-cell.row-sum`).eq(row));
        } else if (col !== null) {
            $cells = $(`.grid-cell[data-col=${col}]`);
            $cells = $cells.add($(`.sum-cell.col-sum`).eq(col));
        }
        $cells.addClass('solved');
    }

    function flashWrong($cell) {
        $cell.addClass('flash-wrong');
        setTimeout(() => {
            $cell.removeClass('flash-wrong');
        }, 300);
    }

    function updateLives() {
        let hearts = "";
        for (let i = 0; i < livesLeft; i++) hearts += "❤️";
        for (let i = 0; i < maxLives - livesLeft; i++) hearts += "🤍";
        $('#lives').html(hearts);
    }

    function loseLife() {
        if (livesLeft > 0) {
            livesLeft--;
            updateLives();
            if (livesLeft === 0) {
                setTimeout(showGameOver, 350);
            }
        }
    }

    function showGameOver() {
        $('#game-over-popup').show();
    }
});
