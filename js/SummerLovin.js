$(document).ready(function () {
    // --- Config ---
    let gridSize = 7; // Now let, not const
    const decoyProbability = 0.25;
    const easyDecoyProbability = 0.75;
    let easyRowColDecoyProbability = 0.3;
    const maxLives = 3;

    // --- State ---
    let pencilMode = true;
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
    function makeSeedString(prob, size, seed) {
        return `${prob}:${size}:${seed}`;
    }
    function parseSeedString(seedStr) {
        const parts = seedStr.split(":");
        if (parts.length !== 3) return null;
        const prob = parseFloat(parts[0]);
        const size = parseInt(parts[1], 10);
        if (isNaN(prob) || isNaN(size)) return null;
        return { prob, size, seed: parts[2] };
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
        .on('click', function (e) {
            e.stopPropagation();
            toggleMode();
        })
        .html("✏️");

    // --- Toggle mode function and background color ---
    function toggleMode() {
        pencilMode = !pencilMode;
        $('#toggle-mode').html(pencilMode ? "✏️" : "🧽");
        if (pencilMode) {
            $('body').css('background', '#fffbe7');
        } else {
            $('body').css('background', '#e3f2fd');
        }
    }

    // Set initial background
    toggleMode();

    // --- Toggle mode by clicking on background (not grid/board) ---
    // Allow toggle if clicking on body, except if inside #game-grid and NOT on a solved cell
    $('body').on('click', function (e) {
        $target = $(e.target);
        if (
            $target.closest('button').length === 0 &&
            $target.closest('#seed-popup').length === 0 &&
            $target.closest('#game-over-popup').length === 0 &&
            $target.closest('input').length === 0
        ) {
            toggleMode();
        }
    });

    // --- UI: Settings (gear) Button ---
    $('#settings-btn').on('click', function () {
        $('#seed-input').val(gameSeed).prop('readonly', true);
        $('#apply-seed-btn').hide();
        $('#edit-seed-btn').show();
        $('#seed-popup').fadeIn(150);
    });

    // --- UI: Seed Popup Buttons ---
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
            alert("Invalid seed format. Example: 0.3:7:abcd1234");
            return;
        }
        easyRowColDecoyProbability = parsed.prob;
        gridSize = parsed.size;
        gameSeed = val;
        lastSeed = val;
        $('#seed-popup').fadeOut(150);
        startGame(true);
    });
    $('#randomize-seed-btn').on('click', function () {
        // Generate a new random seed, probability, and size, apply and close popup
        const size = Math.floor(Math.random() * 4) + 7;
        const seed = randomSeed();
        const prob = Math.round((Math.random() * 0.8 + 0.1) * 10) / 10;
        easyRowColDecoyProbability = prob;
        gridSize = size;
        gameSeed = makeSeedString(easyRowColDecoyProbability, gridSize, seed);
        lastSeed = gameSeed;
        $('#seed-input').val(gameSeed);
        $('#seed-input').prop('readonly', true);
        $('#apply-seed-btn').hide();
        $('#edit-seed-btn').show();
        $('#seed-popup').fadeOut(150);
        startGame(false);
    });

    // --- UI: Restart Button ---
    $('#game-over-popup').on('click', '#restart-btn', function () {
        $('#game-over-popup').hide();
        startGame(true);
    });

    // --- Functions ---
    function newRandomSeedAndStart() {
        // Random grid size between 7 and 10
        const size = Math.floor(Math.random() * 4) + 7;
        const seed = randomSeed();
        const prob = Math.round((Math.random() * 0.8 + 0.1) * 10) / 10;
        easyRowColDecoyProbability = prob;
        gridSize = size;
        gameSeed = makeSeedString(easyRowColDecoyProbability, gridSize, seed);
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
            const size = Math.floor(Math.random() * 4) + 7;
            const seed = randomSeed();
            const prob = Math.round((Math.random() * 0.8 + 0.1) * 10) / 10;
            easyRowColDecoyProbability = prob;
            gridSize = size;
            gameSeed = makeSeedString(easyRowColDecoyProbability, gridSize, seed);
            lastSeed = gameSeed;
            seedObj = parseSeedString(gameSeed);
        }
        easyRowColDecoyProbability = seedObj.prob;
        gridSize = seedObj.size;
        gameSeed = makeSeedString(easyRowColDecoyProbability, gridSize, seedObj.seed);
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
        $('#game-grid').off('click').on('click', '.grid-cell', function (e) {
            if (livesLeft <= 0) return;
            const $cell = $(this);
            if ($cell.hasClass('selected') || $cell.hasClass('erased')) return; // Already acted on

            const isDecoy = $cell.data('decoy') === true || $cell.data('decoy') === "true";
            let correct = false;
            if (pencilMode) {
                if (!isDecoy) {
                    $cell.addClass('selected');
                    correct = true;
                }
            } else if (!pencilMode) {
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
                $cell.addClass('correct');
                checkSolvedRowsAndCols();
            }
            updateCurrentSums();

            // Prevent toggle when an active cell is clicked
            e.stopPropagation();
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

    // Show confetti on top of win popup
    function showConfetti() {
        const $canvas = $('canvas.confetti-canvas');

        const canvas = $canvas[0];
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');

        // Confetti parameters
        const confettiCount = 120;
        const colors = ['#ffb300', '#ff5252', '#4fc3f7', '#81c784', '#ffd54f', '#f06292', '#fff176'];
        const confetti = [];

        for (let i = 0; i < confettiCount; i++) {
            confetti.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * confettiCount,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 10,
                tiltAngleIncremental: (Math.random() * 0.07) + .05,
                tiltAngle: 0
            });
        }

        let angle = 0;
        let tiltAngle = 0;
        let animationFrame;

        function drawConfetti() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            angle += 0.01;
            tiltAngle += 0.1;

            for (let i = 0; i < confetti.length; i++) {
                let c = confetti[i];
                c.tiltAngle += c.tiltAngleIncremental;
                c.y += (Math.cos(angle + c.d) + 3 + c.r / 2) / 2;
                c.x += Math.sin(angle);
                c.tilt = Math.sin(c.tiltAngle - (i % 3)) * 15;

                ctx.beginPath();
                ctx.lineWidth = c.r;
                ctx.strokeStyle = c.color;
                ctx.moveTo(c.x + c.tilt + c.r / 3, c.y);
                ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 5);
                ctx.stroke();
            }

            // Remove confetti that falls off screen and add new ones
            for (let i = 0; i < confetti.length; i++) {
                if (confetti[i].y > canvas.height + 20) {
                    confetti[i].x = Math.random() * canvas.width;
                    confetti[i].y = -10;
                }
            }

            animationFrame = requestAnimationFrame(drawConfetti);
        }

        drawConfetti();

        // Remove confetti after 2.5 seconds
        setTimeout(() => {
            cancelAnimationFrame(animationFrame);
            $canvas.fadeOut(400, function () { $(this).remove(); });
        }, 2500);
    }

    // Add this function to check if the board is fully solved
    function isBoardSolved() {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const isDecoy = decoys[row][col];
                const $cell = $(`.grid-cell[data-row=${row}][data-col=${col}]`);
                if (!isDecoy && !$cell.hasClass('selected')) return false;
                if (isDecoy && !$cell.hasClass('erased')) return false;
            }
        }
        return true;
    }

    // Win popup restart button
    $('body').on('click', '#win-restart-btn', function () {
        $('#game-win-popup').hide();
        newRandomSeedAndStart();
    });

    // --- Modify checkSolvedRowsAndCols to trigger confetti and win popup ---
    function checkSolvedRowsAndCols() {
        let anySolved = false;
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
                anySolved = true;
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
                anySolved = true;
            }
        }
        // If any row/col solved, check for full board solved
        if (anySolved && isBoardSolved()) {
            setTimeout(() => {
                showConfetti();
                $('#game-win-popup').fadeIn(200);
            }, 550);
        }
    }
});
