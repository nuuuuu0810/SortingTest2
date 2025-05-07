// js/selectionSortVisualizer.js
// このスクリプトは pages/selection-sort-learn.html から読み込まれ、
// そのページのDOM要素が構築された後に実行されることを想定しています。
(function() {
    // この関数は、ページが完全にロードされ、関連するDOM要素が存在する場合にのみ実行されるべき
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupVisualizer);
    } else {
        // DOMContentLoaded は既に発火済み
        setupVisualizer();
    }

    function setupVisualizer() {
        const container = document.getElementById('sort-container');
        const statusDiv = document.getElementById('status');
        const startSortButton = document.getElementById('start-sort');
        const resetButton = document.getElementById('reset');
        const speedSlider = document.getElementById('speed-slider');
        const speedValueSpan = document.getElementById('speed-value');

        // これらの要素が見つからない場合は、何もしない（エラーを防ぐ）
        if (!container || !statusDiv || !startSortButton || !resetButton || !speedSlider || !speedValueSpan) {
            // console.warn("Selection sort visualizer elements not found. Skipping initialization.");
            return;
        }
        
        let currentArray = [];
        let sortGenerator = null;
        let isAutoRunning = false;
        let autoRunTimeoutId = null;
        let currentSpeedMs = 500;

        function calculateSpeedMs(sliderValue) {
            const maxMs = 1500;
            const minMs = 100;
            const range = parseFloat(speedSlider.max) - parseFloat(speedSlider.min);
            const normalizedValue = (parseFloat(speedSlider.max) - parseFloat(sliderValue)) / range;
            return Math.round(minMs + (maxMs - minMs) * normalizedValue);
        }

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function renderArray(arr, highlights = {}) {
            // container が存在しない場合は早期リターン
            if (!container) return;

            if (container.children.length !== arr.length || !container.hasChildNodes() ||
                Array.from(container.children).some((child, index) => child.id !== `item-${index}`)) {
                container.innerHTML = ''; // 要素が存在しないか、数が違う場合のみクリア
                arr.forEach((value, index) => {
                    const item = document.createElement('div');
                    item.className = 'item';
                    item.id = `item-${index}`;
                    container.appendChild(item);
                });
            }

            arr.forEach((value, index) => {
                const item = document.getElementById(`item-${index}`);
                if (!item) {
                    // console.error(`Element item-${index} not found during render!`);
                    return;
                }
                item.textContent = value;
                item.style.setProperty('--value', value);

                item.classList.remove('comparing', 'min', 'swapping', 'sorted');

                if (highlights.comparing?.includes(index)) item.classList.add('comparing');
                if (highlights.min === index) item.classList.add('min');
                if (highlights.swapping?.includes(index)) item.classList.add('swapping');
                if (highlights.sortedBoundary !== undefined && index < highlights.sortedBoundary) {
                    item.classList.add('sorted');
                } else if (highlights.sortedBoundary === arr.length && index >= 0) {
                    item.classList.add('sorted');
                }
            });
        }

        function* selectionSortSteps(arr) {
            let n = arr.length;
            let localArray = [...arr];

            for (let i = 0; i < n - 1; i++) {
                let minIndex = i;
                yield { step: 'find_min_start', i: i, minIndex: minIndex, array: [...localArray], highlights: { min: minIndex, sortedBoundary: i } };

                for (let j = i + 1; j < n; j++) {
                    yield { step: 'comparing', i: i, j: j, minIndex: minIndex, array: [...localArray], highlights: { comparing: [minIndex, j], min: minIndex, sortedBoundary: i } };

                    if (localArray[j] < localArray[minIndex]) {
                        minIndex = j;
                        yield { step: 'new_min_found', i: i, minIndex: minIndex, array: [...localArray], highlights: { min: minIndex, comparing: [minIndex, j], sortedBoundary: i } };
                    } else {
                        yield { step: 'compare_end', i: i, j:j, minIndex: minIndex, array: [...localArray], highlights: { min: minIndex, comparing: [minIndex, j], sortedBoundary: i } };
                    }
                }

                if (minIndex !== i) {
                    yield { step: 'before_swap', i: i, minIndex: minIndex, array: [...localArray], highlights: { swapping: [i, minIndex], min: minIndex, sortedBoundary: i } };
                    [localArray[i], localArray[minIndex]] = [localArray[minIndex], localArray[i]];
                    yield { step: 'after_swap', i: i, swappedFrom: minIndex, array: [...localArray], highlights: { sortedBoundary: i + 1 } };
                } else {
                    yield { step: 'no_swap', i: i, array: [...localArray], highlights: { sortedBoundary: i + 1 } };
                }
            }
            yield { step: 'done', array: [...localArray], highlights: { sortedBoundary: n } };
        }

        async function executeNextStep() {
            if (!sortGenerator) return true;

            const result = sortGenerator.next();
            let isDone = false;

            if (!result.done) {
                const state = result.value;
                currentArray = [...state.array];

                let statusMessage = '';
                switch(state.step) {
                    case 'find_min_start': statusMessage = `パス ${state.i + 1}: 最小値探索中 (候補: ${currentArray[state.minIndex]})`; break;
                    case 'comparing': statusMessage = `パス ${state.i + 1}: ${currentArray[state.j]} と ${currentArray[state.minIndex]} を比較`; break;
                    case 'new_min_found': statusMessage = `パス ${state.i + 1}: 新しい最小値 ${currentArray[state.minIndex]}`; break;
                    case 'compare_end': statusMessage = `パス ${state.i + 1}: 比較終了`; break;
                    case 'before_swap': statusMessage = `パス ${state.i + 1}: ${currentArray[state.i]} と ${currentArray[state.minIndex]} を交換`; break;
                    case 'after_swap':
                        statusMessage = `パス ${state.i + 1}: 交換完了`;
                        renderArray(currentArray, state.highlights);
                        await sleep(Math.max(50, Math.floor(currentSpeedMs / 3)));
                        renderArray(currentArray, { sortedBoundary: state.highlights.sortedBoundary });
                        break;
                    case 'no_swap': statusMessage = `パス ${state.i + 1}: 交換なし`; break;
                    default: statusMessage = "処理中...";
                }
                if(statusDiv) statusDiv.innerHTML = statusMessage.replace(/\n/g, '<br>');

                if(state.step !== 'after_swap'){
                    renderArray(currentArray, state.highlights);
                }
                await sleep(Math.max(50, Math.floor(currentSpeedMs * 2 / 3)));

            } else {
                isDone = true;
                isAutoRunning = false;
                clearTimeout(autoRunTimeoutId);

                const finalState = result.value;
                if (finalState && finalState.array) {
                    currentArray = [...finalState.array];
                    if(statusDiv) statusDiv.innerHTML = `ソート完了: [${currentArray.join(', ')}]`;
                    renderArray(currentArray, finalState.highlights);
                } else {
                    if(statusDiv) statusDiv.innerHTML = `ソート完了`;
                    renderArray(currentArray, {sortedBoundary: currentArray.length});
                }
                // console.log("Sorting done.");

                if(startSortButton) {
                    startSortButton.innerHTML = '実行開始 <span>▶▶</span>';
                    startSortButton.disabled = true;
                }
                if(resetButton) resetButton.disabled = false;
                if(speedSlider) speedSlider.disabled = false;
            }
            return isDone;
        }

        function updateSpeedDisplay() {
            if(!speedSlider || !speedValueSpan) return;
            const sliderVal = parseFloat(speedSlider.value);
            let displayMultiplier = 0.2 + ((sliderVal - 1) / (speedSlider.max - speedSlider.min)) * 2.0;
            speedValueSpan.textContent = `x${displayMultiplier.toFixed(1)}`;
            currentSpeedMs = calculateSpeedMs(sliderVal);
        }

        function initialize() {
            isAutoRunning = false;
            clearTimeout(autoRunTimeoutId);

            const userDefinedArray = [5, 2, 8, 1, 9, 4, 7, 3, 6, 10];
            currentArray = [...userDefinedArray];

            renderArray(currentArray);
            sortGenerator = selectionSortSteps([...currentArray]);
            if(statusDiv) statusDiv.innerHTML = '初期状態。「実行開始」を押してください。';

            if(startSortButton) {
                startSortButton.innerHTML = '実行開始 <span>▶▶</span>';
                startSortButton.disabled = false;
            }
            if(resetButton) resetButton.disabled = false;
            if(speedSlider) speedSlider.disabled = false;
            updateSpeedDisplay();
        }
        
        // イベントリスナーの設定は要素が存在することを確認してから
        if(speedSlider) speedSlider.addEventListener('input', updateSpeedDisplay);
        
        if(startSortButton) {
            startSortButton.addEventListener('click', () => {
                if (!sortGenerator || (sortGenerator.next().done && !isAutoRunning) ) {
                    sortGenerator = selectionSortSteps([...currentArray]);
                }

                isAutoRunning = !isAutoRunning;

                if (isAutoRunning) {
                    startSortButton.innerHTML = '停止 <span>⏹</span>';
                    startSortButton.disabled = false; // 停止ボタンは常に有効
                    if(resetButton) resetButton.disabled = true;
                    if(speedSlider) speedSlider.disabled = true;

                    if(statusDiv) statusDiv.innerHTML = 'ソート処理を開始します...';
                    runAutoStep();
                } else {
                    clearTimeout(autoRunTimeoutId);
                    startSortButton.innerHTML = '実行開始 <span>▶▶</span>';
                    if(resetButton) resetButton.disabled = false;
                    if(speedSlider) speedSlider.disabled = false;
                    if(statusDiv) statusDiv.innerHTML = 'ソート処理が停止されました。';
                }
            });
        }

        async function runAutoStep() {
            if (!isAutoRunning || !sortGenerator) return;
            const isDone = await executeNextStep();
            if (!isDone && isAutoRunning) {
                autoRunTimeoutId = setTimeout(runAutoStep, currentSpeedMs);
            } else if (isDone) {
                // console.log("Auto run finished by completion.");
            } else if (!isAutoRunning) {
                // console.log("Auto run stopped by user.");
            }
        }
        
        if(resetButton) {
            resetButton.addEventListener('click', () => {
                isAutoRunning = false;
                clearTimeout(autoRunTimeoutId);
                initialize();
            });
        }

        initialize(); // Visualizerの初期化
    } // end of setupVisualizer

})();
